const Schedule = require('../models/Schedule');
const powerAutomateService = require('../services/powerAutomateService');
const redis = require('../config/redis');

/**
 * 일정 조회
 */
exports.getSchedules = async (req, res) => {
  try {
    const { startDate, endDate, botId } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'startDate와 endDate는 필수입니다.'
      });
    }
    
    // Redis 캐시 확인
    const cacheKey = `schedules:${startDate}:${endDate}:${botId || 'all'}`;
    
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return res.json({
          success: true,
          data: JSON.parse(cached),
          source: 'cache'
        });
      }
    } catch (cacheError) {
      console.warn('캐시 조회 실패 (계속 진행):', cacheError.message);
    }
    
    // DB 조회
    const schedules = await Schedule.findByDateRange(startDate, endDate, botId);
    
    // Redis에 캐싱 (5분 TTL)
    try {
      await redis.setEx(cacheKey, 300, JSON.stringify(schedules));
    } catch (cacheError) {
      console.warn('캐시 저장 실패 (계속 진행):', cacheError.message);
    }
    
    res.json({
      success: true,
      data: schedules,
      count: schedules.length
    });
  } catch (error) {
    console.error('Error fetching schedules:', error);
    res.status(500).json({
      success: false,
      message: '일정 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 일정 생성
 */
exports.createSchedule = async (req, res) => {
  try {
    const scheduleData = req.body;
    
    // 유효성 검사
    if (!scheduleData.bot || !scheduleData.subject || !scheduleData.start || !scheduleData.end) {
      return res.status(400).json({
        success: false,
        message: '필수 필드가 누락되었습니다. (bot, subject, start, end)'
      });
    }
    
    // 중복 체크: 동일한 BOT, 동일한 시간에 동일한 작업이 있는지 확인
    const startDateTime = scheduleData.start.dateTime;
    const endDateTime = scheduleData.end.dateTime;
    const botId = scheduleData.bot;
    
    // DB에서 중복 일정 확인
    const existingSchedules = await Schedule.findByDateRange(
      startDateTime.split('T')[0],
      endDateTime.split('T')[0],
      botId
    );
    
    // 동일한 시간대에 동일한 작업(subject)이 있는지 확인
    const isDuplicate = existingSchedules.some(existing => {
      const existingStart = new Date(existing.start);
      const existingEnd = new Date(existing.end);
      const newStart = new Date(startDateTime);
      const newEnd = new Date(endDateTime);
      
      // 시간이 겹치거나 5분 이내 차이이고, 제목이 동일한 경우 중복으로 간주
      const timeOverlap = (existingStart <= newEnd && existingEnd >= newStart) ||
                         (Math.abs(existingStart.getTime() - newStart.getTime()) < 5 * 60 * 1000);
      const subjectMatch = existing.subject === scheduleData.subject;
      
      return timeOverlap && subjectMatch;
    });
    
    if (isDuplicate) {
      return res.status(409).json({
        success: false,
        message: '동일한 시간에 동일한 작업이 이미 등록되어 있습니다.',
        duplicate: true
      });
    }
    
    // Power Automate에서도 중복 체크
    let existsInPowerAutomate = false;
    try {
      const queryStart = new Date(startDateTime);
      queryStart.setHours(queryStart.getHours() - 1);
      const queryEnd = new Date(endDateTime);
      queryEnd.setHours(queryEnd.getHours() + 1);
      
      const queryResult = await powerAutomateService.querySchedules(
        queryStart.toISOString(),
        queryEnd.toISOString()
      );
      
      if (queryResult.events && Array.isArray(queryResult.events)) {
        existsInPowerAutomate = queryResult.events.some(event => {
          const eventStart = new Date(event.start?.dateTime || event.start);
          const eventEnd = new Date(event.end?.dateTime || event.end);
          const newStart = new Date(startDateTime);
          const newEnd = new Date(endDateTime);
          
          const botMatch = event.bot === botId || event.subject?.includes(botId);
          const timeOverlap = (eventStart <= newEnd && eventEnd >= newStart) ||
                            (Math.abs(eventStart.getTime() - newStart.getTime()) < 5 * 60 * 1000);
          const subjectMatch = event.subject === scheduleData.subject;
          
          return botMatch && timeOverlap && subjectMatch;
        });
      }
    } catch (queryError) {
      console.warn('Power Automate 일정 조회 실패 (계속 진행):', queryError.message);
    }
    
    if (existsInPowerAutomate) {
      return res.status(409).json({
        success: false,
        message: 'Power Automate에 동일한 시간에 동일한 작업이 이미 등록되어 있습니다.',
        duplicate: true
      });
    }
    
    // Power Automate API 호출
    let powerAutomateResult = null;
    try {
      // ✅ PA 부하 방지: 등록은 1초 간격(기본, PA_CREATE_DELAY_MS)으로 throttle
      powerAutomateResult = await powerAutomateService.createScheduleThrottled(scheduleData);
    } catch (paError) {
      console.warn('Power Automate API 호출 실패 (DB에는 저장):', paError.message);
      // Power Automate 실패해도 DB에는 저장
    }
    
    // DB에 저장 (upsert 사용하여 중복 체크)
    const scheduleId = await Schedule.upsert({
      bot_id: scheduleData.bot,
      bot_name: scheduleData.bot,
      subject: scheduleData.subject,
      start_datetime: scheduleData.start.dateTime,
      end_datetime: scheduleData.end.dateTime,
      body: scheduleData.body || null,
      source_system: 'MANUAL'
    });
    
    // 캐시 무효화
    try {
      const keys = await redis.keys('schedules:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (cacheError) {
      console.warn('캐시 무효화 실패:', cacheError.message);
    }
    
    res.status(201).json({
      success: true,
      message: '일정이 등록되었습니다.',
      scheduleId: scheduleId,
      powerAutomateSuccess: powerAutomateResult !== null
    });
  } catch (error) {
    console.error('Error creating schedule:', error);
    res.status(500).json({
      success: false,
      message: '일정 등록 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 일정 수정
 */
exports.updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 기존 일정 확인
    const existing = await Schedule.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '일정을 찾을 수 없습니다.'
      });
    }
    
    // 수정 데이터 준비
    const updateFields = {};
    if (updateData.subject) updateFields.subject = updateData.subject;
    if (updateData.start) updateFields.start_datetime = updateData.start.dateTime;
    if (updateData.end) updateFields.end_datetime = updateData.end.dateTime;
    if (updateData.body !== undefined) updateFields.body = updateData.body;
    
    await Schedule.update(id, updateFields);
    
    // 캐시 무효화
    try {
      const keys = await redis.keys('schedules:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (cacheError) {
      console.warn('캐시 무효화 실패:', cacheError.message);
    }
    
    res.json({
      success: true,
      message: '일정이 수정되었습니다.'
    });
  } catch (error) {
    console.error('Error updating schedule:', error);
    res.status(500).json({
      success: false,
      message: '일정 수정 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * 일정 삭제
 */
exports.deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    
    // 기존 일정 확인
    const existing = await Schedule.findById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: '일정을 찾을 수 없습니다.'
      });
    }
    
    // 소프트 삭제
    await Schedule.softDelete(id);
    
    // 캐시 무효화
    try {
      const keys = await redis.keys('schedules:*');
      if (keys.length > 0) {
        await redis.del(keys);
      }
    } catch (cacheError) {
      console.warn('캐시 무효화 실패:', cacheError.message);
    }
    
    res.json({
      success: true,
      message: '일정이 삭제되었습니다.'
    });
  } catch (error) {
    console.error('Error deleting schedule:', error);
    res.status(500).json({
      success: false,
      message: '일정 삭제 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};


