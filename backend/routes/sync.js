const express = require('express');
const router = express.Router();
const brityRpaService = require('../services/brityRpaService');
const powerAutomateService = require('../services/powerAutomateService');
const Schedule = require('../models/Schedule');
const PowerAutomateRegistration = require('../models/PowerAutomateRegistration');
const db = require('../config/database');
const moment = require('moment-timezone');
const redis = require('../config/redis');
const { groupSchedulesByTimeBucket } = require('../utils/scheduleGrouping');

// ✅ 동기화 "진행 중" 상태(메모리)
// - 프론트가 DB 적재가 끝날 때까지 "동기화 중" 표시를 유지할 수 있도록 진행률 제공
// - 단일 프로세스 기준(멀티 인스턴스/클러스터면 Redis/DB로 옮겨야 함)
const currentSync = {
  inProgress: false,
  startedAt: null,   // ISO
  finishedAt: null,  // ISO
  range: null,       // { startDate, endDate }
  lastResult: null,  // 마지막 동기화 결과 요약(메모리)
  progress: {
    total: 0,
    processed: 0,
    dbUpserted: 0,
    dbSkipped: 0,
    failed: 0,
    paRegistered: 0,
    paSkipped: 0,
    paQueryErrors: 0,
    paCreateErrors: 0,
    paRefreshCalls: 0,
    paRefreshErrors: 0,
    paDisabledReason: null,
  }
};

/**
 * GET /api/sync/logs - 동기화 로그 조회
 */
router.get('/logs', async (req, res) => {
  try {
    const { limit = 50, syncType } = req.query;
    
    let query = 'SELECT * FROM sync_logs WHERE 1=1';
    const params = [];
    
    if (syncType) {
      query += ' AND sync_type = ?';
      params.push(syncType);
    }
    
    query += ' ORDER BY sync_datetime DESC LIMIT ?';
    params.push(parseInt(limit));
    
    const [logs] = await db.execute(query, params);
    
    res.json({
      success: true,
      data: logs,
      count: logs.length
    });
  } catch (error) {
    console.error('동기화 로그 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '동기화 로그 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/sync/status - 최근 동기화 상태 조회
 */
router.get('/status', async (req, res) => {
  try {
    // 동기화 진행 중이면 DB 로그보다 우선 응답
    if (currentSync.inProgress) {
      return res.json({
        success: true,
        data: {
          inProgress: true,
          startedAt: currentSync.startedAt,
          finishedAt: currentSync.finishedAt,
          range: currentSync.range,
          progress: currentSync.progress,
          lastResult: currentSync.lastResult
        }
      });
    }

    const [latest] = await db.execute(
      `SELECT * FROM sync_logs 
       WHERE sync_type = 'BRITY_RPA' 
       ORDER BY sync_datetime DESC 
       LIMIT 1`
    );
    
    if (latest.length === 0) {
      return res.json({
        success: true,
        data: null,
        message: '동기화 기록이 없습니다.'
      });
    }
    
    res.json({
      success: true,
      data: {
        inProgress: false,
        latest: latest[0],
        lastResult: currentSync.lastResult
      }
    });
  } catch (error) {
    console.error('동기화 상태 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: '동기화 상태 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/sync/rpa-schedules - Brity RPA 스케줄 동기화
 */
router.post('/rpa-schedules', async (req, res) => {
  // 중복 실행 방지
  if (currentSync.inProgress) {
    return res.status(409).json({
      success: false,
      message: '동기화가 이미 진행 중입니다. 잠시 후 다시 시도해주세요.',
      data: {
        inProgress: true,
        startedAt: currentSync.startedAt,
        range: currentSync.range,
        progress: currentSync.progress
      }
    });
  }

  try {
    let { startDate, endDate, britySource } = req.body;
    
    // startDate와 endDate가 없으면 당월 기준 -7일 ~ 1년 후로 설정
    if (!startDate || !endDate) {
      const now = new Date();
      // 당월 기준 -7일: 현재 월의 첫날에서 7일 전
      const start = new Date(now.getFullYear(), now.getMonth(), 1); // 이번 달 1일
      start.setDate(start.getDate() - 7); // 7일 전부터
      // 종료 일정은 전체로 (제한 없음 - 1년 후로 설정)
      const end = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
      
      startDate = start.toISOString().split('T')[0];
      endDate = end.toISOString().split('T')[0];
      
      console.log(`📅 날짜 범위 미지정, 기본값 사용: ${startDate} ~ ${endDate} (당월 기준 -7일 ~ 1년 후)`);
    }
    
    console.log(`🔄 Brity RPA 동기화 시작: ${startDate} ~ ${endDate}`);

    // 진행 상태 초기화
    currentSync.inProgress = true;
    currentSync.startedAt = new Date().toISOString();
    currentSync.finishedAt = null;
    currentSync.range = { startDate, endDate };
    currentSync.progress = {
      total: 0,
      processed: 0,
      dbUpserted: 0,
      dbSkipped: 0,
      failed: 0,
      paRegistered: 0,
      paSkipped: 0,
      paQueryErrors: 0,
      paCreateErrors: 0,
      paRefreshCalls: 0,
      paRefreshErrors: 0,
      paDisabledReason: null,
    };

    // ✅ Cloudflare Tunnel(524) 회피: 요청은 즉시 응답하고, 실제 동기화는 백그라운드에서 수행
    res.status(202).json({
      success: true,
      message: '동기화를 시작했습니다. 진행 상태는 /api/sync/status 로 확인하세요.',
      data: {
        inProgress: true,
        startedAt: currentSync.startedAt,
        range: currentSync.range,
        progress: currentSync.progress
      }
    });

    // 백그라운드 실행(응답 이후)
    (async () => {
      try {
    
    // 1단계: Brity RPA API에서 스케줄 조회
    // britySource:
    // - 'jobs' (기본): /jobs/list (실행 이력/결과)
    // - 'schedulings': /schedulings/list (등록된 스케줄, 미래 포함)
    const effectiveBritySource = String(
      britySource || process.env.BRITY_SYNC_SOURCE || 'jobs'
    ).toLowerCase();

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
    // - jobs/list(실행 이력)을 그대로 PA에 등록하면 수천건이 생성될 수 있음
    let schedulesForPaBase = [];
    let brityDebug = {
      source: effectiveBritySource,
      jobs: null,
      schedulings: null,
      merged: {
        beforeDedupe: 0,
        afterDedupe: 0
      },
      paInput: { source: null, beforeDedupe: 0, afterDedupe: 0 }
    };
    if (effectiveBritySource === 'jobs') {
      // ✅ jobs/list는 "실행 결과(이력)" 위주이므로 과거/오늘 구간에 적합
      // ✅ schedulings/*는 "등록 스케줄(반복 규칙)"이므로 오늘/미래 구간에 적합
      console.log('📋 1단계: Brity 조회 (과거/오늘=jobs, 오늘/미래=schedulings)');

      // 1) jobs/list: startDate ~ min(endDate, today)
      if (startDate <= todayStr) {
        const jobsEndStr = endDate < todayStr ? endDate : todayStr;
        const startIso = moment.tz(startDate, 'YYYY-MM-DD', tz).startOf('day').toISOString();
        const endIso = moment.tz(jobsEndStr, 'YYYY-MM-DD', tz).endOf('day').toISOString();
        const jobRes = await brityRpaService.getJobResultsWithMeta(startIso, endIso);
        schedules = [...schedules, ...jobRes.items];
        brityDebug.jobs = jobRes.meta;
      }

      // 2) schedulings/*: max(startDate, today) ~ endDate (미래 포함)
      const mergeSchedulings =
        String(process.env.BRITY_SYNC_MERGE_SCHEDULINGS || 'true').toLowerCase() === 'true' ||
        endDate >= todayStr;
      if (mergeSchedulings && endDate >= todayStr) {
        const schedStartStr = startDate > todayStr ? startDate : todayStr;
        console.log(`➕ /schedulings/* 병합(반복 규칙 전개): ${schedStartStr} ~ ${endDate}`);
        const schedRes = await brityRpaService.getSchedulesWithMeta(schedStartStr, endDate);
        brityDebug.schedulings = schedRes.meta;
        // ✅ PA는 등록 스케줄만 사용
        schedulesForPaBase = [...schedulesForPaBase, ...schedRes.items];
        schedules = [...schedules, ...schedRes.items];
      }

      // 중복 제거
      brityDebug.merged.beforeDedupe = schedules.length;
      const map = new Map();
      for (const s of schedules) map.set(uniqueKey(s), s);
      schedules = Array.from(map.values());
      brityDebug.merged.afterDedupe = schedules.length;
    } else {
      console.log('📋 1단계: RPA 등록 스케줄 조회 (/schedulings/list)');
      const schedRes = await brityRpaService.getSchedulesWithMeta(startDate, endDate);
      schedules = schedRes.items;
      schedulesForPaBase = schedRes.items;
      brityDebug.schedulings = schedRes.meta;
      brityDebug.merged.beforeDedupe = schedules.length;
      brityDebug.merged.afterDedupe = schedules.length;
    }

    // Power Automate 설정 여부
    const powerAutomateEnabled =
      !!process.env.POWER_AUTOMATE_QUERY_URL && !!process.env.POWER_AUTOMATE_CREATE_URL;

    // ✅ 요구사항: "Power Automate 조회가 200이 아니면 일정 등록(create)을 해야 함"
    // - 기본값 true (필요 시 env로 끌 수 있음)
    const createOnQueryError =
      String(process.env.PA_CREATE_ON_QUERY_ERROR || 'true').toLowerCase() === 'true';
    const enablePaRefreshOnDiff =
      String(process.env.PA_REFRESH_ON_DIFF || 'true').toLowerCase() === 'true';
    const paMaxRefreshCalls = Math.max(0, parseInt(process.env.PA_MAX_REFRESH_CALLS || '10', 10) || 10);

    // ✅ 안전장치(선택): PA 등록(create) 폭주 방지 상한
    // - 기본값 0(무제한). 필요 시 env로 제한: PA_MAX_CREATES_PER_RUN=200
    const paMaxCreatesPerRun = Math.max(0, parseInt(process.env.PA_MAX_CREATES_PER_RUN || '0', 10) || 0);
    const paSyncTag = String(process.env.PA_SYNC_TAG || 'RPA_SCHED_MANAGER');

    // (옵션) DB 저장 row 수 절감을 위한 시간 버킷 그룹핑
    // ✅ PA는 원본(정확한 시간)으로 처리, DB는 버킷으로 묶어서 저장
    const bucketMinutesRaw = parseInt(process.env.BRITY_GROUP_BUCKET_MINUTES || '0', 10);
    const shouldGroup =
      Number.isFinite(bucketMinutesRaw) && bucketMinutesRaw > 0 && bucketMinutesRaw % 5 === 0;

    // ✅ Power Automate 대상: schedulings 기반(등록 스케줄)만
    brityDebug.paInput.source = effectiveBritySource === 'jobs' ? 'schedulings_only' : 'schedulings';
    brityDebug.paInput.beforeDedupe = schedulesForPaBase.length;
    const paMap = new Map();
    for (const s of schedulesForPaBase) paMap.set(uniqueKey(s), s);
    const schedulesForPa = Array.from(paMap.values());
    brityDebug.paInput.afterDedupe = schedulesForPa.length;

    const schedulesForDb = shouldGroup
      ? groupSchedulesByTimeBucket(schedules, bucketMinutesRaw, tz)
      : schedules;

    brityDebug.grouping = shouldGroup
      ? { enabled: true, bucketMinutes: bucketMinutesRaw, rawCount: schedulesForPa.length, dbCount: schedulesForDb.length }
      : { enabled: false, bucketMinutes: 0, rawCount: schedulesForPa.length, dbCount: schedulesForDb.length };

    console.log(
      `✅ Brity 스케줄 준비 완료: raw=${schedulesForPa.length}, db=${schedulesForDb.length} (group=${shouldGroup ? bucketMinutesRaw + 'm' : 'off'})\n`
    );

    // progress는 DB 적재 기준(캘린더 반영 기준)
    currentSync.progress.total = schedulesForDb.length;
    
    let syncCount = 0;
    let errorCount = 0;
    let registeredCount = 0;
    let skippedCount = 0;

    // PA가 502 등으로 불안정할 때 동기화가 "끝없이 느려지고 타임아웃" 나는 걸 방지
    // - query 실패 시: query만 중단하고(서킷브레이커), create는 계속 시도할 수 있음(요구사항)
    // - create 실패 시: create도 중단
    let powerAutomateQueryAvailable = powerAutomateEnabled;
    let powerAutomateCreateAvailable = powerAutomateEnabled;
    let powerAutomateDisabledReason = null;
    let powerAutomateQueryErrors = 0;
    
    // 2단계: Power Automate 처리(원본 기준)
    if ((powerAutomateQueryAvailable || powerAutomateCreateAvailable) && powerAutomateService && powerAutomateEnabled) {
      console.log(`🔗 Power Automate 연동: enabled=true, query=${!!process.env.POWER_AUTOMATE_QUERY_URL}, create=${!!process.env.POWER_AUTOMATE_CREATE_URL}`);

      // ✅ 범위 갱신: "기존 값과 상이"하면 PUT(삭제 후 재등록) 호출
      // - 비교 기준: (Brity schedulings 기반) 원하는 스케줄 vs pa_registrations(REGISTERED) 기록
      // - diff가 있으면 bot 단위로 [startDate~endDate] 범위를 PUT 1회 호출
      try {
        const refreshUrlConfigured = !!process.env.POWER_AUTOMATE_REFRESH_URL;
        if (enablePaRefreshOnDiff && refreshUrlConfigured) {
          const rangeStartStr = startDate;
          const rangeEndStr = endDate;
          const rangeStartIso = moment.tz(rangeStartStr, 'YYYY-MM-DD', tz).startOf('day').toISOString();
          const rangeEndIso = moment.tz(rangeEndStr, 'YYYY-MM-DD', tz).endOf('day').toISOString();
          const rangeStartLocal = `${rangeStartStr}T00:00:00`;
          const rangeEndLocal = `${rangeEndStr}T23:59:59`;

          const desiredByBot = new Map(); // botKey -> Set(key)
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
            if (paMaxRefreshCalls > 0 && refreshCalls >= paMaxRefreshCalls) break;
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
              console.log(`♻️ PA 범위 갱신(diff 감지): bot=${botKey} range=${rangeStartStr}~${rangeEndStr} desired=${desiredSet.size} registered=${registeredSet.size} → REFRESH(PUT)`);
              try {
                await powerAutomateService.refreshSchedulesByBotRange({
                  bot: botKey,
                  startDateTime: rangeStartLocal,
                  endDateTime: rangeEndLocal,
                  timeZone: tz
                });
                currentSync.progress.paRefreshCalls += 1;
                refreshCalls += 1;

                // 등록상태 테이블을 [startDate~endDate] 기준으로 교체
                await PowerAutomateRegistration.deleteInRange({ botId: botKey, startIso: rangeStartIso, endIso: rangeEndIso });
                for (const k of desiredSet) {
                  // k 포맷: subject||YYYY-MM-DD HH:mm:ss||YYYY-MM-DD HH:mm:ss
                  const [subject, startDt, endDt] = String(k).split('||');
                  // markRegistered는 ISO가 필요하므로 DATETIME을 ISO로 재구성(로컬 기준으로 해석)
                  const startIso = moment.tz(startDt, 'YYYY-MM-DD HH:mm:ss', tz).toISOString();
                  const endIso = moment.tz(endDt, 'YYYY-MM-DD HH:mm:ss', tz).toISOString();
                  await PowerAutomateRegistration.markRegistered({ botId: botKey, subject, startIso, endIso });
                }
              } catch (e) {
                currentSync.progress.paRefreshErrors += 1;
                console.warn(`⚠️ PA REFRESH 실패(bot=${botKey}): ${e.message}`);
              }
            }
          }
        }
      } catch (e) {
        console.warn(`⚠️ PA 당일 갱신(diff) 처리 실패(계속 진행): ${e.message}`);
      }

      let paCreatesThisRun = 0;
      for (const schedule of schedulesForPa) {
        try {
          // ✅ PA 등록 상태(별도 테이블) 기준으로 중복 방지/재시도
          const botKey = schedule.botName || schedule.botId || '';
          const alreadyRegistered = await PowerAutomateRegistration.isRegistered({
            botId: botKey,
            subject: schedule.subject,
            startIso: schedule.start,
            endIso: schedule.end
          });
          if (alreadyRegistered) {
            skippedCount++;
            currentSync.progress.paSkipped += 1;
            continue;
          }

          let existsInPowerAutomate = false;
          // 1) query가 가능하면 먼저 조회
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

                  // ✅ 오판(이미 존재) 방지: bot/subject는 가능한 한 정확히 매칭
                  const botMatch = event.bot === schedule.botName || event.bot === schedule.botId;
                  const subjectMatch = event.subject === schedule.subject;

                  const timeDiff = Math.abs(eventStart.getTime() - scheduleStart.getTime());
                  const timeOverlap =
                    (eventStart <= scheduleEnd && eventEnd >= scheduleStart) ||
                    (timeDiff < 5 * 60 * 1000);

                  return botMatch && subjectMatch && timeOverlap;
                });
              }

              // query로 존재 확인되면 등록 상태 저장(다음 run에서 재조회/재등록 방지)
              if (existsInPowerAutomate) {
                await PowerAutomateRegistration.markRegistered({
                  botId: botKey,
                  subject: schedule.subject,
                  startIso: schedule.start,
                  endIso: schedule.end
                });
              }
            } catch (queryError) {
              powerAutomateQueryErrors += 1;
              currentSync.progress.paQueryErrors += 1;
              const status = queryError?.status || queryError?.response?.status;

              // ✅ 요구사항: 조회가 실패(200 아님)하면 등록(create)을 시도
              existsInPowerAutomate = createOnQueryError ? false : true;

              // query 서킷브레이커(해당 run 동안만)
              if (!powerAutomateDisabledReason && (status === 502 || status === 503 || status === 504 || queryError.code === 'ETIMEDOUT')) {
                powerAutomateQueryAvailable = false;
                powerAutomateDisabledReason = `Power Automate query failed (${status || queryError.code || 'unknown'})`;
                currentSync.progress.paDisabledReason = powerAutomateDisabledReason;
              }
            }
          } else {
            // query가 이미 중단된 상태면, 설정에 따라 create를 시도하거나 스킵
            existsInPowerAutomate = createOnQueryError ? false : true;
          }

          if (!existsInPowerAutomate) {
            if (!powerAutomateCreateAvailable) {
              // create도 중단 상태면 더 진행해도 의미 없음
              break;
            }
            if (paMaxCreatesPerRun > 0 && paCreatesThisRun >= paMaxCreatesPerRun) {
              powerAutomateCreateAvailable = false;
              powerAutomateDisabledReason = `Power Automate create capped (max ${paMaxCreatesPerRun}/run)`;
              currentSync.progress.paDisabledReason = powerAutomateDisabledReason;
              break;
            }
            const powerAutomateData = {
              bot: schedule.botName,
              subject: schedule.subject,
              start: { dateTime: schedule.start, timeZone: 'Asia/Seoul' },
              end: { dateTime: schedule.end, timeZone: 'Asia/Seoul' },
              body: `[syncTag=${paSyncTag}]\n${schedule.body || `프로세스: ${schedule.processName || ''}`}`
            };
            try {
              await powerAutomateService.createScheduleThrottled(powerAutomateData);
              registeredCount++;
              paCreatesThisRun += 1;
              currentSync.progress.paRegistered += 1;
              await PowerAutomateRegistration.markRegistered({
                botId: botKey,
                subject: schedule.subject,
                startIso: schedule.start,
                endIso: schedule.end
              });
            } catch (createError) {
              currentSync.progress.paCreateErrors += 1;
              const status = createError?.status || createError?.response?.status;
              await PowerAutomateRegistration.markFailed({
                botId: botKey,
                subject: schedule.subject,
                startIso: schedule.start,
                endIso: schedule.end,
                errorMessage: createError?.message
              });
              if (!powerAutomateDisabledReason && (status === 502 || status === 503 || status === 504 || createError.code === 'ETIMEDOUT')) {
                powerAutomateCreateAvailable = false;
                powerAutomateDisabledReason = `Power Automate create failed (${status || createError.code || 'unknown'})`;
                currentSync.progress.paDisabledReason = powerAutomateDisabledReason;
              }
            }
          } else {
            skippedCount++;
            currentSync.progress.paSkipped += 1;
          }
        } catch (e) {
          // PA 실패는 전체 동기화 실패로 보지 않음
        }
      }
    }

    // 3단계: DB 적재(그룹핑 기준)
    // ✅ 동기화는 기본적으로 "replace 모드"가 안전:
    // - 동일 범위를 매번 재동기화할 때, 기존 BRITY_RPA 값이 남아 결과가 꼬이거나 과다/부족해 보이는 문제를 방지
    // - MANUAL/POWER_AUTOMATE는 건드리지 않고 BRITY_RPA만 기간 내 소프트삭제 후 재적재
    const replaceBrityInRange =
      String(process.env.BRITY_REPLACE_IN_RANGE || 'true').toLowerCase() === 'true';
    if (replaceBrityInRange) {
      try {
        const deleted = await Schedule.softDeleteBySourceInRange({
          sourceSystem: 'BRITY_RPA',
          startDate,
          endDate
        });
        brityDebug.replace = { enabled: true, deleted };
        console.log(`🧹 replace: 기존 BRITY_RPA ${deleted}건 소프트삭제 (${startDate}~${endDate})`);
      } catch (e) {
        console.warn('⚠️ replace 실패(계속 진행):', e.message);
        brityDebug.replace = { enabled: true, error: e.message };
      }
    } else {
      brityDebug.replace = { enabled: false };
    }

    for (const schedule of schedulesForDb) {
      try {
        currentSync.progress.processed += 1;

        const botIdForDb = schedule.botId || schedule.botName;
        const existsInDb = await Schedule.existsExactActive({
          botId: botIdForDb,
          subject: schedule.subject,
          startIso: schedule.start,
          endIso: schedule.end
        });
        if (existsInDb) {
          currentSync.progress.dbSkipped += 1;
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
        currentSync.progress.dbUpserted += 1;
      } catch (error) {
        console.error(`❌ 스케줄 처리 실패 (${schedule.id}):`, error.message);
        errorCount++;
        currentSync.progress.failed += 1;
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

    // ✅ 캐시 무효화: 동기화 후에도 캘린더가 "이전 캐시"를 보는 문제 방지
    try {
      const keys = await redis.keys('schedules:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (cacheError) {
      console.warn('캐시 무효화 실패(계속 진행):', cacheError.message);
    }
    
    console.log(`\n✅ 동기화 완료:`);
    console.log(`   - 총 스케줄(raw): ${schedulesForPa.length}개`);
    console.log(`   - DB 대상(db): ${schedulesForDb.length}개`);
    console.log(`   - DB 저장/업데이트: ${syncCount}개 (중복은 자동으로 업데이트됨)`);
    console.log(`   - Power Automate 등록: ${registeredCount}개`);
    console.log(`   - Power Automate 건너뜀 (이미 존재): ${skippedCount}개`);
    console.log(`   - 실패: ${errorCount}개`);

    // ✅ 마지막 결과 요약 저장(프론트/점검용)
    currentSync.lastResult = {
      finishedAt: new Date().toISOString(),
      range: { startDate, endDate },
      rawCount: schedulesForPa.length,
      dbCount: schedulesForDb.length,
      dbUpserted: syncCount,
      dbSkipped: currentSync.progress.dbSkipped,
      failed: errorCount,
      paEnabled: powerAutomateEnabled,
      paAvailable: { query: powerAutomateQueryAvailable, create: powerAutomateCreateAvailable },
      paRegistered: currentSync.progress.paRegistered,
      paSkipped: currentSync.progress.paSkipped,
      paQueryErrors: currentSync.progress.paQueryErrors,
      paCreateErrors: currentSync.progress.paCreateErrors,
      paRefreshCalls: currentSync.progress.paRefreshCalls,
      paRefreshErrors: currentSync.progress.paRefreshErrors,
      paDisabledReason: currentSync.progress.paDisabledReason,
      brity: brityDebug
    };
    
      // (이미 202 응답을 보냈으므로 여기서는 응답을 보내지 않음)
      // 완료 정보는 sync_logs 및 /api/sync/status 에서 확인
    } catch (error) {
      console.error('동기화 오류:', error);

      currentSync.lastResult = {
        finishedAt: new Date().toISOString(),
        range: currentSync.range,
        error: error.message
      };
    
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
    } finally {
      // 진행 상태 종료
      if (currentSync.inProgress) {
        currentSync.inProgress = false;
        currentSync.finishedAt = new Date().toISOString();
      }
    }
  })().catch(() => {});

  } catch (error) {
    // 202 응답 이전 단계에서만 여기로 옴
    console.error('동기화 시작 오류:', error);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: '동기화 시작 중 오류가 발생했습니다.',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    // 진행 상태 종료
    if (currentSync.inProgress) {
      currentSync.inProgress = false;
      currentSync.finishedAt = new Date().toISOString();
    }
  }
});

module.exports = router;

