const express = require('express');
const router = express.Router();
const brityRpaService = require('../services/brityRpaService');
const powerAutomateService = require('../services/powerAutomateService');
const Schedule = require('../models/Schedule');
const db = require('../config/database');
const moment = require('moment-timezone');

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
      data: latest[0]
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
    
    // 1단계: Brity RPA API에서 스케줄 조회
    // britySource:
    // - 'jobs' (기본): /jobs/list (실행 이력/결과)
    // - 'schedulings': /schedulings/list (등록된 스케줄, 미래 포함)
    const effectiveBritySource = String(
      britySource || process.env.BRITY_SYNC_SOURCE || 'jobs'
    ).toLowerCase();

    let schedules = [];
    if (effectiveBritySource === 'jobs') {
      console.log('📋 1단계: Brity 실행 결과 조회 (/jobs/list)');
      const tz = 'Asia/Seoul';
      const startIso = moment.tz(startDate, 'YYYY-MM-DD', tz).startOf('day').toISOString();
      const endIso = moment.tz(endDate, 'YYYY-MM-DD', tz).endOf('day').toISOString();
      schedules = await brityRpaService.getJobResults(startIso, endIso);
    } else {
      console.log('📋 1단계: RPA 등록 스케줄 조회 (/schedulings/list)');
      schedules = await brityRpaService.getSchedules(startDate, endDate);
    }
    console.log(`✅ ${schedules.length}개 스케줄 조회 완료\n`);
    
    let syncCount = 0;
    let errorCount = 0;
    let registeredCount = 0;
    let skippedCount = 0;
    
    // 2단계: 각 스케줄에 대해 BOT 일정 조회 및 등록
    for (const schedule of schedules) {
      try {
        // 0단계(중요): DB에 이미 있는 스케줄이면 Power Automate 등록까지 포함해서 건너뜀
        // - JS Date 파싱/타임존 이슈로 중복 판정이 흔들리지 않도록 "정확 일치"를 DB에서 확인
        const botIdForDb = schedule.botId || schedule.botName;
        const existsInDb = await Schedule.existsExactActive({
          botId: botIdForDb,
          subject: schedule.subject,
          startIso: schedule.start,
          endIso: schedule.end
        });

        if (existsInDb) {
          skippedCount++;
          console.log(`⏭️ DB 중복 일정 건너뜀(=PA 등록도 생략): ${schedule.botName} - ${schedule.subject} (${schedule.start})`);
          continue;
        }

        // 2-1: Power Automate에서 BOT 일정 조회
        const startDateTime = new Date(schedule.start).toISOString();
        const endDateTime = new Date(schedule.end).toISOString();
        
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
          
          // 조회된 일정 중에서 동일한 BOT과 시간대의 일정이 있는지 확인
          if (queryResult.events && Array.isArray(queryResult.events)) {
            existsInPowerAutomate = queryResult.events.some(event => {
              const eventStart = new Date(event.start?.dateTime || event.start);
              const eventEnd = new Date(event.end?.dateTime || event.end);
              const scheduleStart = new Date(schedule.start);
              const scheduleEnd = new Date(schedule.end);
              
              // BOT 이름이 일치하고 시간이 겹치는지 확인 (botName 사용)
              const botMatch = event.bot === schedule.botName || 
                              event.bot === schedule.botId ||
                              event.subject?.includes(schedule.botName) ||
                              event.subject?.includes(schedule.botId) ||
                              event.subject === schedule.subject;
              
              // 시간이 정확히 일치하거나 겹치는지 확인 (5분 이내 차이는 동일한 것으로 간주)
              const timeDiff = Math.abs(eventStart.getTime() - scheduleStart.getTime());
              const timeOverlap = (eventStart <= scheduleEnd && eventEnd >= scheduleStart) || 
                                 (timeDiff < 5 * 60 * 1000); // 5분 이내 차이
              
              return botMatch && timeOverlap;
            });
          }
        } catch (queryError) {
          console.warn(`⚠️ Power Automate 일정 조회 실패 (${schedule.botName}):`, queryError.message);
          // 조회 실패 시 "없다"로 간주하고 등록하면, 동기화마다 중복 등록되는 문제가 생길 수 있음.
          // 따라서 조회 실패 시에는 안전하게 "등록 생략" 처리한다.
          existsInPowerAutomate = true;
        }
        
        // 2-2: Power Automate에 일정이 없으면 등록
        if (!existsInPowerAutomate) {
          try {
            // Power Automate API 형식으로 변환
            // botName을 bot 필드에 매핑 (응답의 botName 값 사용)
            const powerAutomateData = {
              bot: schedule.botName, // botName을 bot 필드에 매핑
              subject: schedule.subject,
              start: {
                dateTime: schedule.start,
                timeZone: 'Asia/Seoul'
              },
              end: {
                dateTime: schedule.end,
                timeZone: 'Asia/Seoul'
              },
              body: schedule.body || `프로세스: ${schedule.processName || ''}`
            };
            
            await powerAutomateService.createSchedule(powerAutomateData);
            registeredCount++;
            console.log(`✅ 일정 등록: ${schedule.botName} - ${schedule.subject}`);
          } catch (registerError) {
            console.warn(`⚠️ Power Automate 일정 등록 실패 (${schedule.botName}):`, registerError.message);
            // 등록 실패해도 DB에는 저장
          }
        } else {
          skippedCount++;
          console.log(`⏭️ 일정 건너뜀 (이미 존재): ${schedule.botName} - ${schedule.subject}`);
        }
        
        // 3단계: DB에 저장 또는 업데이트 (upsert가 중복을 체크/업데이트)
        // botId가 비어있으면 botName을 사용
        const scheduleId = await Schedule.upsert({
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
      } catch (error) {
        console.error(`❌ 스케줄 처리 실패 (${schedule.id}):`, error.message);
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
      const redis = require('../config/redis');
      const keys = await redis.keys('schedules:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (cacheError) {
      console.warn('캐시 무효화 실패:', cacheError.message);
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
      totalRecords: schedules.length
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
  }
});

module.exports = router;

