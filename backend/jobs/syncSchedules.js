const cron = require('node-cron');
const moment = require('moment-timezone');

// 동적 로딩 (에러 방지)
let brityRpaService, powerAutomateService, Schedule, db, redis;

try {
  brityRpaService = require('../services/brityRpaService');
  powerAutomateService = require('../services/powerAutomateService');
  Schedule = require('../models/Schedule');
  db = require('../config/database');
  redis = require('../config/redis');
} catch (error) {
  console.warn('⚠️ 동기화 작업 초기화 실패 (계속 진행):', error.message);
}

// Power Automate 자동 등록 여부 (환경 변수로 제어)
const AUTO_REGISTER_TO_POWER_AUTOMATE = process.env.AUTO_REGISTER_TO_POWER_AUTOMATE === 'true';

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
    let schedules = [];
    if (effectiveBritySource === 'schedulings') {
      schedules = await brityRpaService.getSchedules(startDateStr, endDateStr);
    } else {
      const tz = 'Asia/Seoul';
      const startIso = moment.tz(startDateStr, 'YYYY-MM-DD', tz).startOf('day').toISOString();
      const endIso = moment.tz(endDateStr, 'YYYY-MM-DD', tz).endOf('day').toISOString();
      schedules = await brityRpaService.getJobResults(startIso, endIso);
    }
    
    let syncCount = 0;
    let errorCount = 0;
    let registeredCount = 0;
    let skippedCount = 0;
    
    // 2단계: 각 스케줄 처리
    for (const schedule of schedules) {
      try {
        // Power Automate 자동 등록이 활성화된 경우에만 실행
        if (AUTO_REGISTER_TO_POWER_AUTOMATE && powerAutomateService) {
          // 2-1: Power Automate에서 BOT 일정 조회
          const startDateTime = new Date(schedule.start).toISOString();
          const endDateTime = new Date(schedule.end).toISOString();
          
          let existsInPowerAutomate = false;
          try {
            const queryResult = await powerAutomateService.querySchedules(startDateTime, endDateTime);
            
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
                
                const timeOverlap = (eventStart <= scheduleEnd && eventEnd >= scheduleStart);
                
                return botMatch && timeOverlap;
              });
            }
          } catch (queryError) {
            // 조회 실패해도 계속 진행
          }
          
          // 2-2: Power Automate에 일정이 없으면 등록
          if (!existsInPowerAutomate) {
            try {
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
            } catch (registerError) {
              // 등록 실패해도 DB에는 저장
            }
          } else {
            skippedCount++;
          }
        }
        
        // 3단계: DB에 저장 또는 업데이트
        // botId가 비어있으면 botName을 사용
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

