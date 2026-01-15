const axios = require('axios');
require('dotenv').config();

class PowerAutomateService {
  /**
   * Power Automate API를 통해 일정 등록
   */
  static async createSchedule(scheduleData) {
    try {
      const response = await axios.post(
        process.env.POWER_AUTOMATE_CREATE_URL,
        {
          bot: scheduleData.bot,
          subject: scheduleData.subject,
          start: scheduleData.start,
          end: scheduleData.end,
          body: scheduleData.body || ''
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const status = error?.response?.status;
      console.error('Power Automate 일정 등록 실패:', status ? `${status} ${error.message}` : error.message);
      const err = new Error(`Power Automate API 오류${status ? ` (${status})` : ''}: ${error.message}`);
      err.status = status;
      err.code = error?.code;
      throw err;
    }
  }

  /**
   * Power Automate API를 통해 일정 조회
   */
  static async querySchedules(startDateTime, endDateTime) {
    try {
      const response = await axios.post(
        process.env.POWER_AUTOMATE_QUERY_URL,
        {
          startDateTime: startDateTime,
          endDateTime: endDateTime
        },
        {
          headers: {
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      // events는 JSON 문자열로 반환되므로 파싱 필요
      let events = [];
      if (response.data.events) {
        try {
          events = typeof response.data.events === 'string' 
            ? JSON.parse(response.data.events) 
            : response.data.events;
        } catch (parseError) {
          console.error('Events 파싱 오류:', parseError);
          events = [];
        }
      }

      return {
        success: true,
        count: parseInt(response.data.count) || 0,
        events: events
      };
    } catch (error) {
      const status = error?.response?.status;
      console.error('Power Automate 일정 조회 실패:', status ? `${status} ${error.message}` : error.message);
      const err = new Error(`Power Automate API 오류${status ? ` (${status})` : ''}: ${error.message}`);
      err.status = status;
      err.code = error?.code;
      throw err;
    }
  }
}

module.exports = PowerAutomateService;


