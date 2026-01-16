const cron = require('node-cron');
const moment = require('moment-timezone');

// 동적 로딩 (에러 방지)
let brityRpaService, powerAutomateService, Schedule, db, redis, groupSchedulesByTimeBucket;
let PowerAutomateRegistration;

try {
  brityRpaService = require('../services/brityRpaService');
  powerAutomateService = require('../services/powerAutomateService');
  Schedule = require('../models/Schedule');
  PowerAutomateRegistration = require('../models/PowerAutomateRegistration');
  db = require('../config/database');
  redis = require('../config/redis');
  ({ groupSchedulesByTimeBucket } = require('../utils/scheduleGrouping'));
} catch (error) {
  console.warn('⚠️ 동기화 작업 초기화 실패 (계속 진행):', error.message);
}

// Power Automate 자동 등록 여부 (환경 변수로 제어)
const AUTO_REGISTER_TO_POWER_AUTOMATE = process.env.AUTO_REGISTER_TO_POWER_AUTOMATE === 'true';
// ✅ 요구사항: "Power Automate 조회가 200이 아니면 일정 등록(create)을 해야 함"
const PA_CREATE_ON_QUERY_ERROR =
  String(process.env.PA_CREATE_ON_QUERY_ERROR || 'true').toLowerCase() === 'true';
// ✅ 안전장치(선택): 자동 동기화에서 PA create 폭주 방지 상한
// - 기본값 0(무제한). 필요 시 env로 제한: PA_MAX_CREATES_PER_RUN=200
const PA_MAX_CREATES_PER_RUN = Math.max(0, parseInt(process.env.PA_MAX_CREATES_PER_RUN || '0', 10) || 0);
const PA_SYNC_TAG = String(process.env.PA_SYNC_TAG || 'RPA_SCHED_MANAGER');
const PA_REFRESH_ON_DIFF = String(process.env.PA_REFRESH_ON_DIFF || 'true').toLowerCase() === 'true';
const PA_MAX_REFRESH_CALLS = Math.max(0, parseInt(process.env.PA_MAX_REFRESH_CALLS || '10', 10) || 10);
// ✅ 강제 옵션: PA 존재 여부 체크(query 결과)를 무시하고 create를 시도
// - pa_registrations가 REGISTERED인 경우는 계속 스킵(중복 방지)
const PA_DISABLE_EXISTENCE_CHECK = String(process.env.PA_DISABLE_EXISTENCE_CHECK || 'false').toLowerCase() === 'true';

/**
 * 매시간 정각에 Brity RPA 스케줄 동기화
 * Cron 표현식: '0 * * * *' = 매시간 0분
 */
if (brityRpaService && Schedule && db) {
  cron.schedule('0 * * * *', async () => {
    console.log('🔄 자동 동기화 시작:', new Date().toISOString());
    
    try {
    const now = new Date();
    // 당월 기준 -7일: 현재 월의 첫날에서 7일 전
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1); // 이번 달 1일
    startDate.setDate(startDate.getDate() - 7); // 7일 전부터
    
    // 종료 일정은 전체로 (제한 없음 - 1년 후로 설정)
    const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 동기화 기간: ${startDateStr} ~ ${endDateStr} (당월 기준 -7일 ~ 1년 후)`);
    
    // 1단계: Brity RPA API에서 조회 (기본: /jobs/list)
    const effectiveBritySource = String(process.env.BRITY_SYNC_SOURCE || 'jobs').toLowerCase();
    const tz = 'Asia/Seoul';
    const todayStr = moment.tz(tz).format('YYYY-MM-DD');

    const uniqueKey = (s) => {
      const bot = s.botId || s.botName || '';
      const subj = s.subject || '';
      const start = s.start || '';
      const end = s.end || '';
      return `${bot}||${subj}||${start}||${end}`;
    };

    let schedules = [];
    // ✅ Power Automate 등록은 "등록 스케줄(schedulings)"만 대상으로 해야 함
    let schedulesForPaBase = [];
    if (effectiveBritySource === 'schedulings') {
      schedules = await brityRpaService.getSchedules(startDateStr, endDateStr);
      schedulesForPaBase = schedules;
    } else {
      // ✅ jobs/list는 "실행 이력" 위주 → 과거/오늘 구간
      // ✅ schedulings/*는 "등록 스케줄(반복 규칙)" → 오늘/미래 구간
      schedules = [];

      if (startDateStr <= todayStr) {
        const jobsEndStr = endDateStr < todayStr ? endDateStr : todayStr;
        const startIso = moment.tz(startDateStr, 'YYYY-MM-DD', tz).startOf('day').toISOString();
        const endIso = moment.tz(jobsEndStr, 'YYYY-MM-DD', tz).endOf('day').toISOString();
        schedules = [...schedules, ...(await brityRpaService.getJobResults(startIso, endIso))];
      }

      const mergeSchedulings =
        String(process.env.BRITY_SYNC_MERGE_SCHEDULINGS || 'true').toLowerCase() === 'true' ||
        endDateStr >= todayStr;
      if (mergeSchedulings && endDateStr >= todayStr) {
        const schedStartStr = startDateStr > todayStr ? startDateStr : todayStr;
        const schedItems = await brityRpaService.getSchedules(schedStartStr, endDateStr);
        schedulesForPaBase = [...schedulesForPaBase, ...schedItems];
        schedules = [...schedules, ...schedItems];
      }

      const map = new Map();
      for (const s of schedules) map.set(uniqueKey(s), s);
      schedules = Array.from(map.values());
    }

    // (옵션) DB 저장 row 수 절감을 위한 시간 버킷 그룹핑
    const bucketMinutesRaw = parseInt(process.env.BRITY_GROUP_BUCKET_MINUTES || '0', 10);
    const shouldGroup =
      Number.isFinite(bucketMinutesRaw) && bucketMinutesRaw > 0 && bucketMinutesRaw % 5 === 0;
    // ✅ Power Automate 대상: schedulings 기반만 (dedupe)
    const paMap = new Map();
    for (const s of schedulesForPaBase) paMap.set(uniqueKey(s), s);
    const schedulesForPa = Array.from(paMap.values());
    const schedulesForDb = shouldGroup
      ? groupSchedulesByTimeBucket(schedules, bucketMinutesRaw, tz)
      : schedules;
    if (shouldGroup) {
      console.log(`🧺(자동) DB 그룹핑 저장: ${bucketMinutesRaw}분 버킷 (raw ${schedulesForPa.length} → db ${schedulesForDb.length})`);
    }
    
    let syncCount = 0;
    let errorCount = 0;
    let registeredCount = 0;
    let skippedCount = 0;
    const powerAutomateEnabled =
      !!process.env.POWER_AUTOMATE_QUERY_URL && !!process.env.POWER_AUTOMATE_CREATE_URL;
    let powerAutomateQueryAvailable = AUTO_REGISTER_TO_POWER_AUTOMATE && powerAutomateService && powerAutomateEnabled;
    let powerAutomateCreateAvailable = AUTO_REGISTER_TO_POWER_AUTOMATE && powerAutomateService && powerAutomateEnabled;

    // 2단계: Power Automate 처리(원본 기준)
    if (powerAutomateQueryAvailable || powerAutomateCreateAvailable) {
      // ✅ 범위 갱신(diff 감지 → PUT refresh)
      try {
        const refreshUrlConfigured = !!process.env.POWER_AUTOMATE_REFRESH_URL;
        if (PA_REFRESH_ON_DIFF && refreshUrlConfigured && powerAutomateService?.refreshSchedulesByBotRange) {
          const rangeStartStr = startDateStr;
          const rangeEndStr = endDateStr;
          const rangeStartIso = moment.tz(rangeStartStr, 'YYYY-MM-DD', tz).startOf('day').toISOString();
          const rangeEndIso = moment.tz(rangeEndStr, 'YYYY-MM-DD', tz).endOf('day').toISOString();
          const rangeStartLocal = `${rangeStartStr}T00:00:00`;
          const rangeEndLocal = `${rangeEndStr}T23:59:59`;

          const desiredByBot = new Map();
          for (const s of schedulesForPa) {
            const d = moment.tz(s.start, tz).format('YYYY-MM-DD');
            if (d < rangeStartStr || d > rangeEndStr) continue;
            const botKey = s.botName || s.botId || '';
            if (!botKey) continue;
            const key = PowerAutomateRegistration.buildKeyFromIso({
              subject: s.subject,
              startIso: s.start,
              endIso: s.end
            });
            if (!key) continue;
            if (!desiredByBot.has(botKey)) desiredByBot.set(botKey, new Set());
            desiredByBot.get(botKey).add(key);
          }

          let refreshCalls = 0;
          for (const [botKey, desiredSet] of desiredByBot.entries()) {
            if (PA_MAX_REFRESH_CALLS > 0 && refreshCalls >= PA_MAX_REFRESH_CALLS) break;
            const registeredSet = await PowerAutomateRegistration.listRegisteredKeySetInRange({
              botId: botKey,
              startIso: rangeStartIso,
              endIso: rangeEndIso
            });

            let different = desiredSet.size !== registeredSet.size;
            if (!different) {
              for (const k of desiredSet) {
                if (!registeredSet.has(k)) { different = true; break; }
              }
            }

            if (different) {
              console.log(`♻️(자동) PA 범위 갱신(diff): bot=${botKey} range=${rangeStartStr}~${rangeEndStr} desired=${desiredSet.size} registered=${registeredSet.size}`);
              try {
                await powerAutomateService.refreshSchedulesByBotRange({
                  bot: botKey,
                  startDateTime: rangeStartLocal,
                  endDateTime: rangeEndLocal,
                  timeZone: tz
                });
                refreshCalls += 1;
                await PowerAutomateRegistration.deleteInRange({ botId: botKey, startIso: rangeStartIso, endIso: rangeEndIso });
                for (const k of desiredSet) {
                  const [subject, startDt, endDt] = String(k).split('||');
                  const startIso = moment.tz(startDt, 'YYYY-MM-DD HH:mm:ss', tz).toISOString();
                  const endIso = moment.tz(endDt, 'YYYY-MM-DD HH:mm:ss', tz).toISOString();
                  await PowerAutomateRegistration.markRegistered({ botId: botKey, subject, startIso, endIso });
                }
              } catch (e) {
                console.warn(`⚠️(자동) PA REFRESH 실패(bot=${botKey}): ${e.message}`);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️(자동) PA 당일 갱신(diff) 처리 실패(계속 진행): ${e.message}`);
      }

      let paCreatesThisRun = 0;
      for (const schedule of schedulesForPa) {
        try {
          const botKey = schedule.botName || schedule.botId || '';
          const alreadyRegistered = await PowerAutomateRegistration.isRegistered({
            botId: botKey,
            subject: schedule.subject,
            startIso: schedule.start,
            endIso: schedule.end
          });
          if (alreadyRegistered) {
            skippedCount++;
            continue;
          }

          let existsInPowerAutomate = false;
          if (powerAutomateQueryAvailable) {
            try {
              const queryStart = new Date(schedule.start);
              queryStart.setHours(queryStart.getHours() - 1);
              const queryEnd = new Date(schedule.end);
              queryEnd.setHours(queryEnd.getHours() + 1);

              const queryResult = await powerAutomateService.querySchedules(
                queryStart.toISOString(),
                queryEnd.toISOString()
              );

              if (queryResult.events && Array.isArray(queryResult.events)) {
                existsInPowerAutomate = queryResult.events.some(event => {
                  const eventStart = new Date(event.start?.dateTime || event.start);
                  const eventEnd = new Date(event.end?.dateTime || event.end);
                  const scheduleStart = new Date(schedule.start);
                  const scheduleEnd = new Date(schedule.end);

                  const botMatch = event.bot === schedule.botName || event.bot === schedule.botId;
                  const subjectMatch = event.subject === schedule.subject;

                  const timeDiff = Math.abs(eventStart.getTime() - scheduleStart.getTime());
                  const timeOverlap =
                    (eventStart <= scheduleEnd && eventEnd >= scheduleStart) ||
                    (timeDiff < 5 * 60 * 1000);

                  return botMatch && subjectMatch && timeOverlap;
                });
              }
              if (existsInPowerAutomate) {
                await PowerAutomateRegistration.markRegistered({
                  botId: botKey,
                  subject: schedule.subject,
                  startIso: schedule.start,
                  endIso: schedule.end
                });
              }
            } catch (queryError) {
              const status = queryError?.status || queryError?.response?.status;
              // ✅ 조회 실패 시 create 시도(요구사항)
              existsInPowerAutomate = PA_CREATE_ON_QUERY_ERROR ? false : true;

              if (status === 502 || status === 503 || status === 504 || queryError.code === 'ETIMEDOUT') {
                powerAutomateQueryAvailable = false; // query만 중단
                console.warn(`🛑 Power Automate query 중단(자동 동기화): failed (${status || queryError.code || 'unknown'})`);
              }
            }
          } else {
            existsInPowerAutomate = PA_CREATE_ON_QUERY_ERROR ? false : true;
          }

          // ✅ 강제모드: query로 "이미 존재" 판단을 무시하고 create로 진행
          if (PA_DISABLE_EXISTENCE_CHECK) {
            existsInPowerAutomate = false;
          }

          if (!existsInPowerAutomate) {
            if (!powerAutomateCreateAvailable) break;
            if (PA_MAX_CREATES_PER_RUN > 0 && paCreatesThisRun >= PA_MAX_CREATES_PER_RUN) {
              powerAutomateCreateAvailable = false;
              console.warn(`🛑 Power Automate create 상한 도달(자동 동기화): max ${PA_MAX_CREATES_PER_RUN}/run`);
              break;
            }
            const powerAutomateData = {
              bot: schedule.botName,
              subject: schedule.subject,
              start: { dateTime: schedule.start, timeZone: 'Asia/Seoul' },
              end: { dateTime: schedule.end, timeZone: 'Asia/Seoul' },
              body: `[syncTag=${PA_SYNC_TAG}]\n${schedule.body || `프로세스: ${schedule.processName || ''}`}`
            };
            try {
              await powerAutomateService.createScheduleThrottled(powerAutomateData);
              registeredCount++;
              paCreatesThisRun += 1;
              await PowerAutomateRegistration.markRegistered({
                botId: botKey,
                subject: schedule.subject,
                startIso: schedule.start,
                endIso: schedule.end
              });
            } catch (createError) {
              const status = createError?.status || createError?.response?.status;
              await PowerAutomateRegistration.markFailed({
                botId: botKey,
                subject: schedule.subject,
                startIso: schedule.start,
                endIso: schedule.end,
                errorMessage: createError?.message
              });
              if (status === 502 || status === 503 || status === 504 || createError.code === 'ETIMEDOUT') {
                powerAutomateCreateAvailable = false;
                console.warn(`🛑 Power Automate create 중단(자동 동기화): failed (${status || createError.code || 'unknown'})`);
              }
            }
          } else {
            skippedCount++;
          }
        } catch (_) {
          // PA 실패는 전체 동기화 실패로 보지 않음
        }
      }
    }

    // 3단계: DB 적재(그룹핑 기준)
    // ✅ 자동 동기화도 기본적으로 "replace 모드"가 안전 (BRITY_RPA만 기간 내 소프트삭제 후 재적재)
    const replaceBrityInRange =
      String(process.env.BRITY_REPLACE_IN_RANGE || 'true').toLowerCase() === 'true';
    if (replaceBrityInRange) {
      try {
        const deleted = await Schedule.softDeleteBySourceInRange({
          sourceSystem: 'BRITY_RPA',
          startDate: startDateStr,
          endDate: endDateStr
        });
        console.log(`🧹(자동) replace: 기존 BRITY_RPA ${deleted}건 소프트삭제 (${startDateStr}~${endDateStr})`);
      } catch (e) {
        console.warn('⚠️(자동) replace 실패(계속 진행):', e.message);
      }
    }

    for (const schedule of schedulesForDb) {
      try {
        const botIdForDb = schedule.botId || schedule.botName;
        const existsInDb = await Schedule.existsExactActive({
          botId: botIdForDb,
          subject: schedule.subject,
          startIso: schedule.start,
          endIso: schedule.end
        });
        if (existsInDb) {
          skippedCount++;
          continue;
        }

        await Schedule.upsert({
          bot_id: schedule.botId || schedule.botName,
          bot_name: schedule.botName,
          subject: schedule.subject,
          start_datetime: schedule.start,
          end_datetime: schedule.end,
          body: schedule.body,
          process_id: schedule.processId,
          source_system: 'BRITY_RPA'
        });
        syncCount++;
      } catch (error) {
        console.error(`스케줄 처리 실패 (${schedule.id}):`, error.message);
        errorCount++;
      }
    }
    
    // 동기화 로그 기록
    try {
      await db.execute(
        `INSERT INTO sync_logs (sync_type, sync_status, records_synced, error_message)
         VALUES (?, ?, ?, ?)`,
        [
          'BRITY_RPA',
          errorCount === 0 ? 'SUCCESS' : (syncCount > 0 ? 'PARTIAL' : 'FAILED'),
          syncCount,
          errorCount > 0 ? `${errorCount}개 레코드 저장 실패` : null
        ]
      );
    } catch (logError) {
      console.error('동기화 로그 기록 실패:', logError.message);
    }
    
    // 캐시 무효화
    try {
      const keys = await redis.keys('schedules:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (cacheError) {
      console.warn('캐시 무효화 실패:', cacheError.message);
    }
    
    console.log(`✅ 자동 동기화 완료: ${syncCount}개 DB 저장, ${registeredCount}개 Power Automate 등록, ${skippedCount}개 건너뜀, ${errorCount}개 실패`);
    if (PA_DISABLE_EXISTENCE_CHECK) {
      console.log(`   - (참고) PA_DISABLE_EXISTENCE_CHECK=true: query 기반 '이미 존재' 판단을 무시하고 create를 시도했습니다.`);
    }
  } catch (error) {
    console.error('❌ 자동 동기화 실패:', error);
    
    // 에러 로그 기록
    try {
      await db.execute(
        `INSERT INTO sync_logs (sync_type, sync_status, records_synced, error_message)
         VALUES (?, ?, ?, ?)`,
        ['BRITY_RPA', 'FAILED', 0, error.message]
      );
    } catch (logError) {
      console.error('에러 로그 기록 실패:', logError.message);
    }
    }
  });
  
  console.log('✅ RPA 스케줄 자동 동기화 작업이 초기화되었습니다. (매시간 정각 실행)');
} else {
  console.warn('⚠️ 동기화 작업 초기화 건너뜀 (필요한 모듈이 없음)');
}

