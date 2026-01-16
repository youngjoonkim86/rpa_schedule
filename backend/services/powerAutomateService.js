const axios = require('axios');
require('dotenv').config();

class PowerAutomateService {
  static _createQueue = Promise.resolve();
  static _lastCreateAtMs = 0;

  static _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Power Automate create 호출을 직렬화 + 간격(throttle) 적용
   * - 기본 간격: 1000ms (PA_CREATE_DELAY_MS)
   */
  static async createScheduleThrottled(scheduleData, delayMs = null) {
    const effectiveDelayMs =
      delayMs != null ? Number(delayMs) : Number(process.env.PA_CREATE_DELAY_MS || 1000);

    // 큐에 순차적으로 쌓아서 동시호출을 막고 간격을 강제
    this._createQueue = this._createQueue.then(async () => {
      const d = Number.isFinite(effectiveDelayMs) ? Math.max(0, effectiveDelayMs) : 1000;
      const now = Date.now();
      const nextAllowed = (this._lastCreateAtMs || 0) + d;
      const waitMs = Math.max(0, nextAllowed - now);
      if (waitMs > 0) {
        await this._sleep(waitMs);
      }
      // 다음 호출 기준점(요청 시작 시점) 업데이트
      this._lastCreateAtMs = Date.now();
      return await this.createSchedule(scheduleData);
    });

    return await this._createQueue;
  }
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
          timeout: 30000,
          // ✅ 일부 Flow는 "조회된 일정 없음"을 300으로 반환함 (HTTP 300 or body.code=300)
          validateStatus: (status) => (status >= 200 && status < 300) || status === 300
        }
      );

      // ✅ HTTP 300을 "0건"으로 간주
      if (response.status === 300) {
        return { success: true, count: 0, events: [], treatedAsEmpty: true, treatedAs: 'http_300' };
      }

      // ✅ body.code=300 / message에 "조회된 일정 없음"인 경우도 0건으로 간주
      const bodyCode = response?.data?.code ?? response?.data?.statusCode ?? null;
      const bodyMsg = String(response?.data?.message || response?.data?.msg || '');
      const treat300AsEmpty =
        String(process.env.PA_TREAT_300_AS_EMPTY || 'true').toLowerCase() === 'true';
      if (
        treat300AsEmpty &&
        (String(bodyCode) === '300' || bodyMsg.includes('조회된 일정 없음'))
      ) {
        return { success: true, count: 0, events: [], treatedAsEmpty: true, treatedAs: 'body_300' };
      }

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

      // ✅ 일부 환경에서 "조회 결과 0건"을 502로 반환하는 Flow가 있어, 옵션으로 0건으로 간주
      // 기본값 true: 일부 Flow가 "조회된 일정 없음"을 502로 반환하는 케이스를 정상(0건)으로 취급
      const treat502AsEmpty = String(process.env.PA_TREAT_502_AS_EMPTY || 'true').toLowerCase() === 'true';
      if (treat502AsEmpty && status === 502) {
        return { success: true, count: 0, events: [], treatedAsEmpty: true, treatedAs: 'http_502' };
      }

      // ✅ (옵션) HTTP 300을 에러로 던지는 환경(프록시/중간계층) 대비
      const treat300AsEmpty =
        String(process.env.PA_TREAT_300_AS_EMPTY || 'true').toLowerCase() === 'true';
      if (treat300AsEmpty && status === 300) {
        return { success: true, count: 0, events: [], treatedAsEmpty: true, treatedAs: 'http_300_catch' };
      }

      const err = new Error(`Power Automate API 오류${status ? ` (${status})` : ''}: ${error.message}`);
      err.status = status;
      err.code = error?.code;
      throw err;
    }
  }

  /**
   * Power Automate "삭제 후 재등록" (Bot + 기간 단위)
   * - 사용자가 제공한 Flow 엔드포인트(PUT)를 호출합니다.
   *
   * body 예:
   * {
   *   bot: "BOT5",
   *   start: { dateTime: "2026-01-16T00:00:00", timeZone: "Asia/Seoul" },
   *   end:   { dateTime: "2026-01-16T23:59:59", timeZone: "Asia/Seoul" }
   * }
   */
  static async refreshSchedulesByBotRange({ bot, startDateTime, endDateTime, timeZone = 'Asia/Seoul' }) {
    try {
      const url = process.env.POWER_AUTOMATE_REFRESH_URL;
      if (!url) {
        throw new Error('POWER_AUTOMATE_REFRESH_URL이 설정되어 있지 않습니다.');
      }

      const response = await axios.put(
        url,
        {
          bot,
          start: { dateTime: startDateTime, timeZone },
          end: { dateTime: endDateTime, timeZone }
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 60000
        }
      );

      return { success: true, data: response.data };
    } catch (error) {
      const status = error?.response?.status;
      console.error('Power Automate 삭제 후 재등록(REFRESH) 실패:', status ? `${status} ${error.message}` : error.message);
      const err = new Error(`Power Automate REFRESH API 오류${status ? ` (${status})` : ''}: ${error.message}`);
      err.status = status;
      err.code = error?.code;
      throw err;
    }
  }
}

module.exports = PowerAutomateService;


