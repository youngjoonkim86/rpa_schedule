const express = require('express');
const router = express.Router();
const brityRpaService = require('../services/brityRpaService');
const powerAutomateService = require('../services/powerAutomateService');
const Schedule = require('../models/Schedule');
const db = require('../config/database');
const moment = require('moment-timezone');
const redis = require('../config/redis');

// ✅ 동기화 "진행 중" 상태(메모리)
// - 프론트가 DB 적재가 끝날 때까지 "동기화 중" 표시를 유지할 수 있도록 진행률 제공
// - 단일 프로세스 기준(멀티 인스턴스/클러스터면 Redis/DB로 옮겨야 함)
const currentSync = {
  inProgress: false,
  startedAt: null,   // ISO
  finishedAt: null,  // ISO
  range: null,       // { startDate, endDate }
  progress: {
    total: 0,
    processed: 0,
    dbUpserted: 0,
    dbSkipped: 0,
    failed: 0,
    paRegistered: 0,
    paSkipped: 0,
    paQueryErrors: 0,
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
          progress: currentSync.progress
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
        latest: latest[0]
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
      paDisabledReason: null,
    };
    
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
    let brityDebug = {
      source: effectiveBritySource,
      jobs: null,
      schedulings: null,
      merged: {
        beforeDedupe: 0,
        afterDedupe: 0
      }
    };
    if (effectiveBritySource === 'jobs') {
      // ✅ 실제 운영 환경에서 /jobs/list가 "오늘 이후"도 내려오는 케이스가 있어
      // start~end 전체 범위를 그대로 /jobs/list로 조회해야 합니다.
      console.log('📋 1단계: Brity 스케줄/이력 조회 (/jobs/list, 전체 범위)');
      const startIso = moment.tz(startDate, 'YYYY-MM-DD', tz).startOf('day').toISOString();
      const endIso = moment.tz(endDate, 'YYYY-MM-DD', tz).endOf('day').toISOString();
      const jobRes = await brityRpaService.getJobResultsWithMeta(startIso, endIso);
      schedules = jobRes.items;
      brityDebug.jobs = jobRes.meta;

      // 필요 시(환경별) 등록 스케줄 API도 병합할 수 있게 옵션 제공
      // - default: false (jobs/list만 사용)
      // - enable: BRITY_SYNC_MERGE_SCHEDULINGS=true
      // ✅ 미래 일정은 schedulings(등록 스케줄)에서 내려오는 케이스가 많아 자동 병합
      const mergeSchedulings =
        String(process.env.BRITY_SYNC_MERGE_SCHEDULINGS || 'false').toLowerCase() === 'true' ||
        endDate > todayStr;
      if (mergeSchedulings) {
        console.log('➕ /schedulings/* 병합(미래 일정 포함)');
        const schedRes = await brityRpaService.getSchedulesWithMeta(startDate, endDate);
        brityDebug.schedulings = schedRes.meta;
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
      brityDebug.schedulings = schedRes.meta;
      brityDebug.merged.beforeDedupe = schedules.length;
      brityDebug.merged.afterDedupe = schedules.length;
    }
    console.log(`✅ ${schedules.length}개 스케줄 조회 완료\n`);
    currentSync.progress.total = schedules.length;
    
    let syncCount = 0;
    let errorCount = 0;
    let registeredCount = 0;
    let skippedCount = 0;

    const powerAutomateEnabled =
      !!process.env.POWER_AUTOMATE_QUERY_URL && !!process.env.POWER_AUTOMATE_CREATE_URL;
    // PA가 502 등으로 불안정할 때 동기화가 "끝없이 느려지고 타임아웃" 나는 걸 방지
    // - 첫 번째 치명적 실패를 감지하면 해당 run에서는 PA 조회/등록을 즉시 중단
    let powerAutomateAvailable = powerAutomateEnabled;
    let powerAutomateDisabledReason = null;
    let powerAutomateQueryErrors = 0;
    
    // 2단계: 각 스케줄에 대해 BOT 일정 조회 및 등록
    for (const schedule of schedules) {
      try {
        currentSync.progress.processed += 1;

        // 0단계(중요): DB에 이미 있는지 확인
        // - 기존에는 "DB 중복이면 continue"로 PA 조회/등록까지 스킵되어,
        //   "PA에 없으면 등록" 플로우가 누락되는 문제가 생김.
        // - 이제는: DB 저장만 스킵하고, Power Automate는 계속 조회/등록 수행.
        const botIdForDb = schedule.botId || schedule.botName;
        const existsInDb = await Schedule.existsExactActive({
          botId: botIdForDb,
          subject: schedule.subject,
          startIso: schedule.start,
          endIso: schedule.end
        });
        const skipDbUpsert = !!existsInDb;
        if (skipDbUpsert) {
          console.log(`⏭️ DB 중복(저장 스킵): ${schedule.botName} - ${schedule.subject} (${schedule.start})`);
          currentSync.progress.dbSkipped += 1;
        }

        if (powerAutomateAvailable) {
          let existsInPowerAutomate = false;
          try {
            // 조회 범위를 넓혀서 중복 체크 (시작 시간 ±1시간)
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

                const botMatch =
                  event.bot === schedule.botName ||
                  event.bot === schedule.botId ||
                  event.subject?.includes(schedule.botName) ||
                  event.subject?.includes(schedule.botId) ||
                  event.subject === schedule.subject;

                const timeDiff = Math.abs(eventStart.getTime() - scheduleStart.getTime());
                const timeOverlap =
                  (eventStart <= scheduleEnd && eventEnd >= scheduleStart) ||
                  (timeDiff < 5 * 60 * 1000);

                return botMatch && timeOverlap;
              });
            }
          } catch (queryError) {
            powerAutomateQueryErrors += 1;
            currentSync.progress.paQueryErrors += 1;
            const status = queryError?.status || queryError?.response?.status;
            console.warn(`⚠️ Power Automate 일정 조회 실패 (${schedule.botName}):`, queryError.message);
            // 조회 실패 시 등록하면 중복이 생길 수 있어 안전하게 등록 생략
            existsInPowerAutomate = true;

            // 502/timeout 등 반복될 가능성이 큰 장애면 해당 run에서는 PA를 끈다
            if (!powerAutomateDisabledReason && (status === 502 || status === 503 || status === 504 || queryError.code === 'ETIMEDOUT')) {
              powerAutomateAvailable = false;
              powerAutomateDisabledReason = `Power Automate query failed (${status || queryError.code || 'unknown'})`;
              currentSync.progress.paDisabledReason = powerAutomateDisabledReason;
              console.warn(`🛑 Power Automate 임시 중단: ${powerAutomateDisabledReason}`);
            }
          }

          if (!existsInPowerAutomate) {
            try {
              const powerAutomateData = {
                bot: schedule.botName,
                subject: schedule.subject,
                start: { dateTime: schedule.start, timeZone: 'Asia/Seoul' },
                end: { dateTime: schedule.end, timeZone: 'Asia/Seoul' },
                body: schedule.body || `프로세스: ${schedule.processName || ''}`
              };

              await powerAutomateService.createSchedule(powerAutomateData);
              registeredCount++;
              currentSync.progress.paRegistered += 1;
              console.log(`✅ Power Automate 일정 등록: ${schedule.botName} - ${schedule.subject}`);
            } catch (registerError) {
              console.warn(`⚠️ Power Automate 일정 등록 실패 (${schedule.botName}):`, registerError.message);
            }
          }
        } else if (!powerAutomateEnabled) {
          // 설정이 없으면 PA 조회/등록 자체를 수행하지 않음(명확히)
          console.log('ℹ️ Power Automate 미사용: POWER_AUTOMATE_QUERY_URL/CREATE_URL 미설정');
        } else if (powerAutomateDisabledReason) {
          // 장애로 인해 run 중 임시 중단된 상태
          // (로그 스팸 방지: 매 건마다 찍지 않음)
        }
        
        // 3단계: DB에 저장 또는 업데이트 (중복이면 저장 스킵)
        if (!skipDbUpsert) {
          await Schedule.upsert({
            bot_id: schedule.botId || schedule.botName, // botId가 없으면 botName 사용
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
        } else {
          skippedCount++;
          currentSync.progress.dbSkipped += 1;
        }
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
    console.log(`   - 총 스케줄 (nextJobTime 있음): ${schedules.length}개`);
    console.log(`   - DB 저장/업데이트: ${syncCount}개 (중복은 자동으로 업데이트됨)`);
    console.log(`   - Power Automate 등록: ${registeredCount}개`);
    console.log(`   - Power Automate 건너뜀 (이미 존재): ${skippedCount}개`);
    console.log(`   - 실패: ${errorCount}개`);
    
    res.json({
      success: true,
      message: '동기화가 완료되었습니다.',
      recordsSynced: syncCount,
      recordsRegistered: registeredCount,
      recordsSkipped: skippedCount,
      recordsFailed: errorCount,
      totalRecords: schedules.length,
      brity: brityDebug,
      powerAutomateEnabled,
      powerAutomateAvailable,
      powerAutomateQueryErrors,
      powerAutomateDisabledReason
    });
  } catch (error) {
    console.error('동기화 오류:', error);
    
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
    
    res.status(500).json({
      success: false,
      message: '동기화 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    // 진행 상태 종료
    if (currentSync.inProgress) {
      currentSync.inProgress = false;
      currentSync.finishedAt = new Date().toISOString();
    }
  }
});

module.exports = router;

