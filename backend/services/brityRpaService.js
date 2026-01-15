const axios = require('axios');
require('dotenv').config();

class BrityRpaService {
  /**
   * Brity RPA API를 통해 Job 수행 결과(이력) 조회
   * API: POST /scheduler/api/v1/jobs/list
   *
   * @param {string} startIso UTC ISO 8601 (예: 2026-01-15T00:00:00.000Z)
   * @param {string} endIso   UTC ISO 8601
   */
  static async getJobResults(startIso, endIso, offset = 0, limit = 100) {
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

      const requestBody = {
        offset,
        limit,
        orderBy: 'startTime desc',
        parameter: {
          startDatetime: startIso,
          endDatetime: endIso
        }
      };

      const response = await axios.post(endpoint, requestBody, {
        headers: {
          Authorization: process.env.BRITY_RPA_TOKEN,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      });

      const list = response.data.list || [];
      const totalCount = response.data.totalCount || list.length || 0;
      const listCount = response.data.listCount || list.length || 0;

      let all = [...list];
      let currentOffset = offset + listCount;

      if (totalCount > all.length) {
        const maxLimit = 100;
        if (limit < maxLimit && totalCount > limit) {
          return await this.getJobResults(startIso, endIso, 0, maxLimit);
        }

        while (all.length < totalCount) {
          const nextBody = {
            offset: currentOffset,
            limit: maxLimit,
            orderBy: 'startTime desc',
            parameter: {
              startDatetime: startIso,
              endDatetime: endIso
            }
          };
          const nextRes = await axios.post(endpoint, nextBody, {
            headers: {
              Authorization: process.env.BRITY_RPA_TOKEN,
              'Content-Type': 'application/json'
            },
            timeout: 30000
          });

          const nextList = nextRes.data.list || [];
          const nextListCount = nextRes.data.listCount || nextList.length;
          if (nextList.length === 0) break;
          all.push(...nextList);
          currentOffset += nextListCount;
        }
      }

      // 정규화
      return all
        .filter(j => j.startTime)
        .map(j => {
          const start = j.startTime;
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
      const endpoint = `${apiUrl}/schedulings/list`;
      
      if (!process.env.BRITY_RPA_TOKEN) {
        throw new Error('BRITY_RPA_TOKEN이 설정되어 있지 않습니다. backend/.env에 BRITY_RPA_TOKEN을 설정해주세요.');
      }

      console.log(`📡 Brity RPA 등록 스케줄 API 호출: ${endpoint}`);
      console.log(`📅 기간: ${startDate} ~ ${endDate}`);
      
      // schedulings/list 는 보통 "YYYY-MM-DD HH:mm" 형태를 기대 (명세/샘플 기준)
      const startDatetime = `${startDate} 00:00`;
      const endDatetime = `${endDate} 23:59`;
      
      // 요청 본문 구성
      const requestBody = {
        offset: offset,
        limit: limit,
        // 최신 등록/표시 기준 정렬(환경마다 다를 수 있어, 없으면 scheduledTime asc로 바꿔도 됨)
        orderBy: 'regTimeselectScheduleJobListForDisplay desc',
        parameter: {
          START_DATETIME: startDatetime,
          END_DATETIME: endDatetime
        }
      };
      
      console.log(`📤 요청 본문:`, JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(
        endpoint,
        requestBody,
        {
          headers: {
            'Authorization': process.env.BRITY_RPA_TOKEN,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      const rawList = response.data.list || [];
      const totalCount = response.data.totalCount || rawList.length || 0;
      const listCount = response.data.listCount || rawList.length || 0;

      console.log(`✅ API 응답 수신: totalCount=${totalCount}, listCount=${listCount}, list.length=${rawList.length}`);

      // 모든 데이터를 수집할 배열
      let allSchedules = [...rawList];
      let currentOffset = offset + listCount;

      // totalCount가 현재까지 가져온 데이터보다 크면 추가 조회 필요
      if (totalCount > allSchedules.length) {
        console.log(`📥 Pagination 필요: 현재=${allSchedules.length}개, 전체=${totalCount}개, 남은 건수=${totalCount - allSchedules.length}`);
        
        // limit이 100 미만이고 totalCount가 limit보다 크면 100으로 증가하여 재조회 (더 효율적)
        if (limit < 100 && totalCount > limit) {
          const newLimit = 100;
          console.log(`📥 limit 증가하여 재조회: limit=${limit} → ${newLimit}`);
          return await this.getSchedules(startDate, endDate, 0, newLimit);
        }
        
        // limit이 100이거나 이미 최대인 경우, offset 기반 pagination
        // 모든 데이터를 가져올 때까지 반복
        const maxLimit = limit >= 100 ? 100 : limit;
        while (allSchedules.length < totalCount) {
          const nextOffset = currentOffset;
          console.log(`📥 추가 데이터 조회: offset=${nextOffset}, 현재까지=${allSchedules.length}개, 전체=${totalCount}개, 남은 건수=${totalCount - nextOffset}`);
          
          // 다음 배치 조회
          const nextRequestBody = {
            offset: nextOffset,
            limit: maxLimit, // 최대 100
            orderBy: 'regTimeselectScheduleJobListForDisplay desc',
            parameter: {
              START_DATETIME: `${startDate} 00:00`,
              END_DATETIME: `${endDate} 23:59`
            }
          };
          
          const nextResponse = await axios.post(
            endpoint,
            nextRequestBody,
            {
              headers: {
                'Authorization': process.env.BRITY_RPA_TOKEN,
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );
          
          const nextList = nextResponse.data.list || [];
          const nextListCount = nextResponse.data.listCount || nextList.length;
          
          if (nextList.length === 0) {
            console.log(`⚠️ 더 이상 데이터가 없습니다.`);
            break;
          }
          
          allSchedules.push(...nextList);
          currentOffset = allSchedules.length; // 실제 수집된 데이터 수로 업데이트
          
          console.log(`📥 조회 완료: 이번 배치=${nextList.length}개, 누적=${allSchedules.length}개 / ${totalCount}개`);
          
          // 더 이상 가져올 데이터가 없으면 종료
          if (nextList.length === 0 || allSchedules.length >= totalCount || nextListCount < maxLimit) {
            break;
          }
        }
      }
      
      console.log(`📊 전체 데이터 수집 완료: ${allSchedules.length}개 / ${totalCount}개`);

      // 등록 스케줄 데이터 정규화
      const normalizedSchedules = [];
      
      for (const s of allSchedules) {
        // 삭제/비활성 스케줄 제외
        if (s.delYn === 'Y' || s.inActiveYn === 'Y') continue;

        const startTime = s.nextJobTime || s.startTime || s.scheduledTime;
        if (!startTime) {
          console.log(`⏭️ 스케줄 건너뜀 (startTime/nextJobTime 없음): ${s.id}`);
          continue;
        }
        
        // botId 또는 botName이 없는 경우 제외
        const botId = s.botId || '';
        const botName = s.botName || s.botId || '';
        
        if (!botId && !botName) {
          console.log(`⏭️ 스케줄 건너뜀 (botId/botName 없음): ${s.id}`);
          continue;
        }

        // 종료 시간은 등록 스케줄 API에 명확히 없을 수 있어 기본 1시간으로 잡음
        const endTime = (() => {
          const start = new Date(startTime);
          start.setMinutes(start.getMinutes() + 60);
          return start.toISOString();
        })();

        // 제목은 jobScheduleName/processName 우선
        const subject = s.jobScheduleName || s.scheduleName || s.processName || s.id || '제목 없음';

        normalizedSchedules.push({
          id: s.id,
          botId: botId,
          botName: botName,
          processId: s.processId,
          processName: s.processName,
          subject: subject,
          start: startTime,
          end: endTime,
          body: s.description || s.processName || '',
          sourceSystem: 'BRITY_RPA',
          // 추가 필드(디버깅/표시용)
          nextJobTime: s.nextJobTime,
          startTime: s.startTime,
          schUntil: s.schUntil,
          timeRepeatYn: s.timeRepeatYn,
          timeRepeatInterval: s.timeRepeatInterval,
          regTime: s.regTimeselectScheduleJobListForDisplay
        });
      }
      
      return normalizedSchedules;
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

