const axios = require('axios');
require('dotenv').config();
const moment = require('moment-timezone');

class BrityRpaService {
  /**
   * 내부 헬퍼: Brity API 호출
   */
  static async _post(endpoint, requestBody) {
    return await axios.post(endpoint, requestBody, {
      headers: {
        Authorization: process.env.BRITY_RPA_TOKEN,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });
  }

  /**
   * Brity RPA API를 통해 Job 수행 결과(이력) 조회
   * API: POST /scheduler/api/v1/jobs/list
   *
   * @param {string} startIso UTC ISO 8601 (예: 2026-01-15T00:00:00.000Z)
   * @param {string} endIso   UTC ISO 8601
   */
  static async getJobResults(startIso, endIso, offset = 0, limit = 100) {
    const res = await this.getJobResultsWithMeta(startIso, endIso, offset, limit);
    return res.items;
  }

  /**
   * getJobResults + 메타(totalCount/listCount/endpoint) 포함
   */
  static async getJobResultsWithMeta(startIso, endIso, offset = 0, limit = 100) {
    try {
      let apiUrl = process.env.BRITY_RPA_URL;
      if (!apiUrl) {
        apiUrl = 'https://bwrpa.samsungsds.com:8777/scheduler/api/v1';
      }
      if (!apiUrl.includes('/scheduler/api/v1')) {
        apiUrl = apiUrl.replace(/\/$/, '') + '/scheduler/api/v1';
      }
      const endpoint = `${apiUrl}/jobs/list`;

      if (!process.env.BRITY_RPA_TOKEN) {
        throw new Error('BRITY_RPA_TOKEN이 설정되어 있지 않습니다. backend/.env에 BRITY_RPA_TOKEN을 설정해주세요.');
      }

      const buildRequest = (mode) => {
        if (mode === 'calendar') {
          // 일부 환경에서는 jobs/list도 START_DATETIME/END_DATETIME(YYYY-MM-DD HH:mm) 포맷을 요구/권장
          const tz = 'Asia/Seoul';
          return {
            offset,
            limit,
            orderBy: 'startTime desc',
            parameter: {
              START_DATETIME: moment.tz(startIso, tz).format('YYYY-MM-DD HH:mm'),
              END_DATETIME: moment.tz(endIso, tz).format('YYYY-MM-DD HH:mm')
            }
          };
        }
        // default: ISO (기존 방식)
        return {
          offset,
          limit,
          orderBy: 'startTime desc',
          parameter: {
            startDatetime: startIso,
            endDatetime: endIso
          }
        };
      };

      const modeEnv = String(process.env.BRITY_JOBS_PARAM_MODE || 'auto').toLowerCase();
      const shouldProbe = String(process.env.BRITY_JOBS_AUTO_PROBE || 'true').toLowerCase() === 'true';

      const fetchAllByMode = async (mode) => {
        const req = buildRequest(mode);
        const first = await this._post(endpoint, req);
        const firstList = first.data.list || [];
        const totalCount = first.data.totalCount || firstList.length || 0;
        const listCount = first.data.listCount || firstList.length || 0;

        let all = [...firstList];
        let currentOffset = offset + listCount;

        if (totalCount > all.length) {
          const maxLimit = 100;
          while (all.length < totalCount) {
            const nextBody = {
              offset: currentOffset,
              limit: maxLimit,
              orderBy: 'startTime desc',
              parameter: req.parameter
            };
            const nextRes = await this._post(endpoint, nextBody);
            const nextList = nextRes.data.list || [];
            const nextListCount = nextRes.data.listCount || nextList.length;
            if (nextList.length === 0) break;
            all.push(...nextList);
            currentOffset += nextListCount;
          }
        }

        return { mode, req, all, totalCount, listCount };
      };

      // 1) 1차(기본) 모드
      const primaryMode = modeEnv === 'calendar' ? 'calendar' : 'iso';
      let fetched = await fetchAllByMode(primaryMode);

      // 2) auto 모드면 반대 모드도 "첫 페이지만" 찍어서 totalCount 비교 후 더 큰 쪽 선택
      if (modeEnv === 'auto' && shouldProbe) {
        const altMode = primaryMode === 'iso' ? 'calendar' : 'iso';
        try {
          const altReq = buildRequest(altMode);
          const altRes = await this._post(endpoint, altReq);
          const altList = altRes.data.list || [];
          const altTotal = altRes.data.totalCount || altList.length || 0;

          if (altTotal > (fetched.totalCount || 0)) {
            console.warn(`🔎 Brity jobs/list 모드 자동 전환: ${primaryMode}(${fetched.totalCount}) → ${altMode}(${altTotal})`);
            fetched = await fetchAllByMode(altMode);
          }
        } catch (e) {
          // probing 실패는 무시하고 primary 결과 사용
        }
      }

      // 정규화
      // - /jobs/list 에서 "미래 일정"은 startTime이 비어 있고 scheduledTime만 내려오는 케이스가 있음
      // - 따라서 startTime 우선, 없으면 scheduledTime을 start로 사용
      const items = fetched.all
        .filter(j => j.startTime || j.scheduledTime)
        .map(j => {
          const start = j.startTime || j.scheduledTime;
          const end = j.endTime || (() => {
            const d = new Date(start);
            d.setMinutes(d.getMinutes() + 1);
            return d.toISOString();
          })();

          return {
            id: j.jobId,
            jobId: j.jobId,
            botId: j.botId || '',
            botName: j.botName || j.botId || '',
            processId: j.processId,
            processName: j.processName,
            subject: j.processName || j.jobName || j.jobId || '제목 없음',
            start,
            end,
            statusCode: j.statusCode,
            statusName: j.statusName,
            detailCode: j.detailCode,
            detailName: j.detailName,
            scheduledTime: j.scheduledTime,
            sourceSystem: 'BRITY_RPA'
          };
        });

      return {
        items,
        meta: {
          endpoint,
          request: fetched.req,
          totalCount: fetched.totalCount,
          listCount: fetched.listCount,
          fetchedCount: items.length,
          mode: fetched.mode,
          modeEnv
        }
      };
    } catch (error) {
      console.error('Brity RPA Job 결과 조회 실패:', error.message);
      if (error.response && error.response.status === 401) {
        throw new Error('Brity RPA 인증 토큰이 만료되었거나 유효하지 않습니다. 토큰을 갱신해주세요.');
      }
      throw new Error(`Brity RPA API 오류: ${error.message}`);
    }
  }

  /**
   * Brity RPA API를 통해 "등록된 스케줄" 조회 (미래 일정 포함)
   * API: POST /scheduler/api/v1/schedulings/list
   *
   * ⚠️ 주의:
   * - /jobs/list 는 "수행 결과(이력)" 위주라 미래(오늘 이후) 일정이 거의 나오지 않습니다.
   * - 미래 1년치 스케줄을 동기화하려면 /schedulings/list 를 사용해야 합니다.
   */
  static async getSchedules(startDate, endDate, offset = 0, limit = 100) {
    const res = await this.getSchedulesWithMeta(startDate, endDate, offset, limit);
    return res.items;
  }

  /**
   * getSchedules + 메타(totalCount/listCount/endpointUsed) 포함
   */
  static async getSchedulesWithMeta(startDate, endDate, offset = 0, limit = 100) {
    try {
      // API URL 구성
      let apiUrl = process.env.BRITY_RPA_URL;
      if (!apiUrl) {
        apiUrl = 'https://bwrpa.samsungsds.com:8777/scheduler/api/v1';
      }
      // URL이 전체 경로를 포함하지 않으면 기본 경로 추가
      if (!apiUrl.includes('/scheduler/api/v1')) {
        apiUrl = apiUrl.replace(/\/$/, '') + '/scheduler/api/v1';
      }
      // ✅ 운영 환경에 따라 미래 일정(캘린더 표시용)은 /schedulings/calendar/list 가 필요한 경우가 있음
      // 다만 calendar/list 는 환경/권한/버전에 따라 요청 파라미터 포맷이 달라 400(INVALID_INPUT)이 날 수 있어,
      // 기본은 calendar/list를 시도하되 실패 시 /schedulings/list 로 자동 폴백합니다.
      const preferredPath = process.env.BRITY_SCHEDULINGS_PATH || '/schedulings/calendar/list';
      const normalizedPreferredPath = preferredPath.startsWith('/') ? preferredPath : `/${preferredPath}`;
      const preferredEndpoint = `${apiUrl}${normalizedPreferredPath}`;
      const fallbackEndpoint = `${apiUrl}/schedulings/list`;
      const enableFallback = String(process.env.BRITY_SCHEDULINGS_FALLBACK || 'true').toLowerCase() === 'true';
      
      if (!process.env.BRITY_RPA_TOKEN) {
        throw new Error('BRITY_RPA_TOKEN이 설정되어 있지 않습니다. backend/.env에 BRITY_RPA_TOKEN을 설정해주세요.');
      }

      console.log(`📡 Brity RPA 등록/캘린더 스케줄 API 호출: ${preferredEndpoint}`);
      console.log(`📅 기간: ${startDate} ~ ${endDate}`);
      
      const startDatetime = `${startDate} 00:00`;
      const endDatetime = `${endDate} 23:59`;

      const buildRequestBody = (endpointToUse, overrideCalendarMode = null) => {
        const isCalendar = String(endpointToUse).endsWith('/schedulings/calendar/list');

        // ✅ calendar/list는 환경에 따라 parameter 키가 다름:
        // - (사용자 제공 샘플) startDateTime/endDateTime
        // - (기존 list용) START_DATETIME/END_DATETIME
        // 기본은 calendar/list면 startDateTime/endDateTime으로 시도
        const calendarMode = String(overrideCalendarMode || process.env.BRITY_CALENDAR_PARAM_MODE || 'auto').toLowerCase();
        const useCalendarKeys = isCalendar && (calendarMode === 'auto' || calendarMode === 'calendar');

        const parameter = useCalendarKeys
          ? { startDateTime: startDatetime, endDateTime: endDatetime }
          : { START_DATETIME: startDatetime, END_DATETIME: endDatetime };

        // 정렬도 환경별로 다를 수 있어 calendar는 scheduledTime asc 기본
        const orderBy = isCalendar ? 'scheduledTime asc' : 'regTimeselectScheduleJobListForDisplay desc';

        return {
          offset,
          limit,
          orderBy,
          parameter
        };
      };

      const fetchAll = async (endpointToUse, overrideCalendarMode = null) => {
        const requestBody = buildRequestBody(endpointToUse, overrideCalendarMode);
        console.log(`📤 요청 본문:`, JSON.stringify(requestBody, null, 2));

        const response = await this._post(endpointToUse, requestBody);

        const rawList = response.data.list || [];
        const totalCount = response.data.totalCount || rawList.length || 0;
        const listCount = response.data.listCount || rawList.length || 0;

        console.log(`✅ API 응답 수신: totalCount=${totalCount}, listCount=${listCount}, list.length=${rawList.length}`);

        let allSchedules = [...rawList];
        let currentOffset = offset + listCount;

        if (totalCount > allSchedules.length) {
          console.log(`📥 Pagination 필요: 현재=${allSchedules.length}개, 전체=${totalCount}개, 남은 건수=${totalCount - allSchedules.length}`);

          if (limit < 100 && totalCount > limit) {
            const newLimit = 100;
            console.log(`📥 limit 증가하여 재조회: limit=${limit} → ${newLimit}`);
            // limit만 올려 동일 endpoint로 다시 호출
            return await this.getSchedulesWithMeta(startDate, endDate, 0, newLimit);
          }

          const maxLimit = limit >= 100 ? 100 : limit;
          while (allSchedules.length < totalCount) {
            const nextOffset = currentOffset;
            console.log(`📥 추가 데이터 조회: offset=${nextOffset}, 현재까지=${allSchedules.length}개, 전체=${totalCount}개, 남은 건수=${totalCount - nextOffset}`);

            const nextRequestBody = {
              offset: nextOffset,
              limit: maxLimit,
              orderBy: requestBody.orderBy,
              parameter: requestBody.parameter
            };

            const nextResponse = await this._post(endpointToUse, nextRequestBody);

            const nextList = nextResponse.data.list || [];
            const nextListCount = nextResponse.data.listCount || nextList.length;

            if (nextList.length === 0) {
              console.log(`⚠️ 더 이상 데이터가 없습니다.`);
              break;
            }

            allSchedules.push(...nextList);
            currentOffset = allSchedules.length;

            console.log(`📥 조회 완료: 이번 배치=${nextList.length}개, 누적=${allSchedules.length}개 / ${totalCount}개`);

            if (allSchedules.length >= totalCount || nextListCount < maxLimit) break;
          }
        }

        return {
          raw: allSchedules,
          meta: {
            endpoint: endpointToUse,
            request: requestBody,
            totalCount,
            listCount,
            fetchedRawCount: allSchedules.length
          }
        };
      };

      let allSchedules;
      let meta;
      try {
        const fetched = await fetchAll(preferredEndpoint);
        allSchedules = fetched.raw;
        meta = fetched.meta;
      } catch (err) {
        const status = err?.response?.status;
        const errData = err?.response?.data;
        const invalidInput =
          status === 400 &&
          (errData?.errorValue === 'INVALID_INPUT' || errData?.errorCode === 'SCHEDULER_I1');

        if (enableFallback && preferredEndpoint.endsWith('/schedulings/calendar/list') && invalidInput) {
          // 1) calendar/list 파라미터 키가 달라서 INVALID_INPUT 나는 환경이 있어, 키를 바꿔 한 번 더 시도
          const mode = String(process.env.BRITY_CALENDAR_PARAM_MODE || 'auto').toLowerCase();
          if (mode === 'auto') {
            try {
              console.warn(`⚠️ calendar/list INVALID_INPUT → calendar 키 모드 전환(START_DATETIME/END_DATETIME) 재시도`);
              const retry = await fetchAll(preferredEndpoint, 'list');
              allSchedules = retry.raw;
              meta = retry.meta;
            } catch (e2) {
              console.warn(`⚠️ calendar/list 재시도 실패 → /schedulings/list 로 폴백합니다.`);
              const fetched = await fetchAll(fallbackEndpoint);
              allSchedules = fetched.raw;
              meta = fetched.meta;
            }
          } else {
            console.warn(`⚠️ calendar/list INVALID_INPUT → /schedulings/list 로 폴백합니다.`);
            const fetched = await fetchAll(fallbackEndpoint);
            allSchedules = fetched.raw;
            meta = fetched.meta;
          }
        } else {
          throw err;
        }
      }
      console.log(`📊 전체 데이터 수집 완료: ${allSchedules.length}개`);

      // 등록 스케줄 데이터 정규화 (✅ 반복 규칙을 범위 내 "개별 일정"으로 전개)
      const normalizedSchedules = [];

      const tz = 'Asia/Seoul';
      const rangeStart = moment.tz(startDate, 'YYYY-MM-DD', tz).startOf('day');
      const rangeEnd = moment.tz(endDate, 'YYYY-MM-DD', tz).endOf('day');

      // 폭발 방지(스케줄 1건당 최대 생성)
      const maxPerSchedule = 5000;

      const parseHashTokens = (v) =>
        String(v || '')
          .split('#')
          .map(x => x.trim())
          .filter(Boolean);

      const parseHashNums = (v) =>
        parseHashTokens(v)
          .map(x => parseInt(x, 10))
          .filter(n => Number.isFinite(n));

      const computeEnd = (startIso) => moment(startIso).add(60, 'minute').toISOString();

      for (const s of allSchedules) {
        if (s.delYn === 'Y' || s.inActiveYn === 'Y') continue;

        const botId = s.botId || '';
        const botName = s.botName || s.botId || '';
        if (!botId && !botName) continue;

        const subject = s.jobScheduleName || s.scheduleName || s.processName || s.id || '제목 없음';

        const baseStartRaw = s.startTime || s.schDetStartDt || s.nextJobTime || s.scheduledTime;
        if (!baseStartRaw) continue;

        const baseStart = moment.tz(baseStartRaw, tz);
        if (!baseStart.isValid()) continue;

        // 종료 경계: schUntil / schDetEndDt 중 더 이른 값을 사용
        const untilCandidates = [s.schUntil, s.schDetEndDt]
          .filter(Boolean)
          .map(x => moment.tz(x, tz))
          .filter(m => m.isValid());
        const ruleUntil = untilCandidates.length > 0 ? moment.min(untilCandidates) : null;

        // 유효 범위(요청 범위와 교집합)
        const effectiveStart = moment.max(rangeStart, baseStart);
        const effectiveEnd = ruleUntil ? moment.min(rangeEnd, ruleUntil) : rangeEnd;
        if (effectiveEnd.isBefore(effectiveStart)) continue;

        const freq = String(s.freq || '').toUpperCase(); // DAILY/WEEKLY/MONTHLY
        const freqIntervalRaw = parseInt(s.freqInterval, 10);
        const freqInterval = Number.isFinite(freqIntervalRaw) && freqIntervalRaw > 0 ? freqIntervalRaw : 1;
        const conditionTokens = parseHashTokens(s.schCondition);

        // timeRepeat(하루 내 반복)
        const repeatYn = String(s.timeRepeatYn || 'N').toUpperCase();
        const repeatPeriodRaw = parseInt(s.timeRepeatPeriod, 10);
        const repeatPeriod = Number.isFinite(repeatPeriodRaw) && repeatPeriodRaw > 1 ? repeatPeriodRaw : 1;
        const repeatIntervalRaw = parseInt(s.timeRepeatInterval, 10);
        const repeatIntervalSeconds = Number.isFinite(repeatIntervalRaw)
          ? (repeatIntervalRaw >= 60 ? Math.max(1, repeatIntervalRaw) : Math.max(1, repeatIntervalRaw) * 60)
          : null;

        const baseTime = { h: baseStart.hour(), m: baseStart.minute(), s: baseStart.second() };

        const dayLevelStarts = [];
        const addDayLevel = (m) => {
          if (m.isBefore(effectiveStart) || m.isAfter(effectiveEnd)) return;
          dayLevelStarts.push(m);
        };

        if (freq === 'DAILY') {
          let cur = effectiveStart.clone().hour(baseTime.h).minute(baseTime.m).second(baseTime.s).millisecond(0);
          if (cur.isBefore(effectiveStart)) cur.add(1, 'day');
          if (cur.isBefore(baseStart)) cur = baseStart.clone();
          while (!cur.isAfter(effectiveEnd) && dayLevelStarts.length < maxPerSchedule) {
            addDayLevel(cur.clone());
            cur.add(freqInterval, 'day');
          }
        } else if (freq === 'WEEKLY') {
          // schCondition 예: "#2#4#6" (가정: 1=일,2=월,...7=토)
          const days = parseHashNums(s.schCondition);
          const wanted = new Set(days.length > 0 ? days : [baseStart.day() === 0 ? 1 : baseStart.day() + 1]);
          const baseWeekStart = baseStart.clone().startOf('week'); // 일요일 기준
          let cur = effectiveStart.clone().startOf('day');
          while (!cur.isAfter(effectiveEnd) && dayLevelStarts.length < maxPerSchedule) {
            const dow = cur.day() === 0 ? 1 : cur.day() + 1;
            if (wanted.has(dow)) {
              const weekDiff = Math.floor(cur.clone().startOf('week').diff(baseWeekStart, 'weeks', true));
              if (weekDiff % freqInterval === 0) {
                addDayLevel(cur.clone().hour(baseTime.h).minute(baseTime.m).second(baseTime.s).millisecond(0));
              }
            }
            cur.add(1, 'day');
          }
        } else if (freq === 'MONTHLY') {
          // schCondition 예: "#D" / "#L" / "#15"
          const hasL = conditionTokens.includes('L');
          const hasD = conditionTokens.includes('D');
          const nums = conditionTokens.map(t => parseInt(t, 10)).filter(n => Number.isFinite(n));
          let dayOfMonth = baseStart.date();
          if (nums.length > 0) dayOfMonth = nums[0];
          if (hasD) dayOfMonth = baseStart.date();

          const baseMonth = baseStart.clone().startOf('month');
          let monthCursor = effectiveStart.clone().startOf('month');
          // base 기준으로 freqInterval 배수 달만 선택
          while ((monthCursor.diff(baseMonth, 'months') % freqInterval) !== 0) {
            monthCursor.add(1, 'month');
          }

          while (!monthCursor.isAfter(effectiveEnd) && dayLevelStarts.length < maxPerSchedule) {
            const endOfMonth = monthCursor.clone().endOf('month').date();
            const dom = hasL ? endOfMonth : Math.min(dayOfMonth, endOfMonth);
            const occ = monthCursor
              .clone()
              .date(dom)
              .hour(baseTime.h)
              .minute(baseTime.m)
              .second(baseTime.s)
              .millisecond(0);
            addDayLevel(occ);
            monthCursor.add(freqInterval, 'month');
          }
        } else {
          // freq가 없거나 알 수 없는 경우: 1회만 (start/nextJob 기준)
          addDayLevel(baseStart.clone());
        }

        // timeRepeat 확장 + push
        let emitted = 0;
        let suffix = 0;
        for (const dl of dayLevelStarts) {
          if (repeatYn === 'Y' && repeatIntervalSeconds) {
            const count = Math.min(repeatPeriod, 2000);
            for (let i = 0; i < count; i++) {
              const occ = dl.clone().add(i * repeatIntervalSeconds, 'seconds');
              if (ruleUntil && occ.isAfter(ruleUntil)) break;
              if (occ.isBefore(effectiveStart) || occ.isAfter(effectiveEnd)) continue;
              const startIso = occ.toISOString();
              normalizedSchedules.push({
                id: `${s.id}_${suffix++}`,
                botId,
                botName,
                processId: s.processId,
                processName: s.processName,
                subject,
                start: startIso,
                end: computeEnd(startIso),
                body: s.description || s.processName || '',
                sourceSystem: 'BRITY_RPA',
                nextJobTime: s.nextJobTime,
                startTime: s.startTime,
                schUntil: s.schUntil,
                schDetEndDt: s.schDetEndDt,
                freq: s.freq,
                freqInterval: s.freqInterval,
                schCondition: s.schCondition,
                timeRepeatYn: s.timeRepeatYn,
                timeRepeatInterval: s.timeRepeatInterval,
                timeRepeatPeriod: s.timeRepeatPeriod,
                regTime: s.regTimeselectScheduleJobListForDisplay
              });
              emitted++;
              if (emitted >= maxPerSchedule) break;
            }
          } else {
            const startIso = dl.toISOString();
            normalizedSchedules.push({
              id: `${s.id}_${suffix++}`,
              botId,
              botName,
              processId: s.processId,
              processName: s.processName,
              subject,
              start: startIso,
              end: computeEnd(startIso),
              body: s.description || s.processName || '',
              sourceSystem: 'BRITY_RPA',
              nextJobTime: s.nextJobTime,
              startTime: s.startTime,
              schUntil: s.schUntil,
              schDetEndDt: s.schDetEndDt,
              freq: s.freq,
              freqInterval: s.freqInterval,
              schCondition: s.schCondition,
              timeRepeatYn: s.timeRepeatYn,
              timeRepeatInterval: s.timeRepeatInterval,
              timeRepeatPeriod: s.timeRepeatPeriod,
              regTime: s.regTimeselectScheduleJobListForDisplay
            });
            emitted++;
          }
          if (emitted >= maxPerSchedule) break;
        }
      }

      return {
        items: normalizedSchedules,
        meta: {
          ...meta,
          endpointPreferred: preferredEndpoint,
          endpointFallback: fallbackEndpoint,
          usedFallback: meta?.endpoint === fallbackEndpoint
        }
      };
    } catch (error) {
      console.error('Brity RPA 스케줄 조회 실패:', error.message);
      
      if (error.response) {
        console.error('응답 상태:', error.response.status);
        console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
        
        // 토큰 만료 오류 처리
        if (error.response.status === 401) {
          const tokenStatus = process.env.BRITY_RPA_TOKEN 
            ? '설정됨 (만료되었을 수 있음)' 
            : '설정되지 않음 (기본 토큰 사용 중)';
          throw new Error(
            `Brity RPA 인증 토큰이 만료되었거나 유효하지 않습니다.\n` +
            `토큰 상태: ${tokenStatus}\n` +
            `해결 방법:\n` +
            `1. Brity RPA 포털에서 새 토큰을 발급받으세요.\n` +
            `2. backend/.env 파일의 BRITY_RPA_TOKEN 값을 업데이트하세요.\n` +
            `3. 서버를 재시작하세요.`
          );
        }
        
        // 기타 HTTP 오류
        if (error.response.status >= 400) {
          throw new Error(
            `Brity RPA API 오류 (${error.response.status}): ${JSON.stringify(error.response.data)}`
          );
        }
      }
      
      // 네트워크 오류 등
      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        throw new Error(
          `Brity RPA 서버에 연결할 수 없습니다.\n` +
          `URL: ${endpoint}\n` +
          `오류: ${error.message}`
        );
      }
      
      throw new Error(`Brity RPA API 오류: ${error.message}`);
    }
  }
}

module.exports = BrityRpaService;

