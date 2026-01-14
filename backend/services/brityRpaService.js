const axios = require('axios');
require('dotenv').config();

class BrityRpaService {
  /**
   * Brity RPA API를 통해 Job 수행 결과 조회
   * API: POST /scheduler/api/v1/jobs/list
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
      const endpoint = `${apiUrl}/jobs/list`;
      
      console.log(`📡 Brity RPA Job 수행 결과 API 호출: ${endpoint}`);
      console.log(`📅 기간: ${startDate} ~ ${endDate}`);
      
      // 날짜를 UTC ISO 8601 형식으로 변환
      const startDatetime = `${startDate}T00:00:00Z`;
      const endDatetime = `${endDate}T23:59:59Z`;
      
      // 요청 본문 구성
      const requestBody = {
        offset: offset,
        limit: limit,
        orderBy: 'startTime desc',
        parameter: {
          startDatetime: startDatetime,
          endDatetime: endDatetime
        }
      };
      
      console.log(`📤 요청 본문:`, JSON.stringify(requestBody, null, 2));
      
      const response = await axios.post(
        endpoint,
        requestBody,
        {
          headers: {
            'Authorization': process.env.BRITY_RPA_TOKEN || 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiIxNzY4Mjg1MjE4MTE3LWNiODBkMzQwLWEzMDVlN2I5IiwiaXNzIjoiQVVUSF9DTElFTlRfQ0VSVElGSUNBVEUiLCJhdWQiOiJBVVRIX0FQSV9TRVJWRVIiLCJzdWIiOiJBQ0NFU1NfVE9LRU4iLCJjbGllbnRUeXBlIjoiQVBJX0tFWSIsImNsaWVudElkIjoiQVVUSF9BUElfU0VSVkVSIiwidXNlcklkIjoieW91bmdqb29uLmtpbUBham5ldC5jby5rciIsImNoYWxsZW5nZSI6IjE3NjgyODUyMTgxMTctNDJlNmJiODgtM2RmODUyNjciLCJpcEFkZHIiOiIxODIuMTk1LjgzLjQiLCJ0ZW5hbnRJZCI6IlROXzljN2Y0NTU0MDcyODQzMDU5NDhmYTI0OTkyNjhmYTZkIiwic2VjdXJpdHlUeXBlIjoidjIiLCJpYXQiOjE3NjgyODUyMTgsImV4cCI6MTc5ODcyOTE5OX0.yDJaRz9oTq1cyjleFSoTHBpicd9LM810jRcQIpNfTE0',
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      console.log(`✅ API 응답 수신: totalCount=${response.data.totalCount}, listCount=${response.data.listCount}, list.length=${response.data.list?.length || 0}`);

      const jobs = response.data.list || [];
      const totalCount = response.data.totalCount || 0;
      const listCount = response.data.listCount || jobs.length;

      // 모든 데이터를 수집할 배열
      let allJobs = [...jobs];
      let currentOffset = offset + listCount;

      // totalCount가 현재까지 가져온 데이터보다 크면 추가 조회 필요
      if (totalCount > allJobs.length) {
        console.log(`📥 Pagination 필요: 현재=${allJobs.length}개, 전체=${totalCount}개, 남은 건수=${totalCount - allJobs.length}`);
        
        // limit이 100 미만이고 totalCount가 limit보다 크면 100으로 증가하여 재조회 (더 효율적)
        if (limit < 100 && totalCount > limit) {
          const newLimit = 100;
          console.log(`📥 limit 증가하여 재조회: limit=${limit} → ${newLimit}`);
          return await this.getSchedules(startDate, endDate, 0, newLimit);
        }
        
        // limit이 100이거나 이미 최대인 경우, offset 기반 pagination
        // 모든 데이터를 가져올 때까지 반복
        const maxLimit = limit >= 100 ? 100 : limit;
        while (allJobs.length < totalCount) {
          const nextOffset = currentOffset;
          console.log(`📥 추가 데이터 조회: offset=${nextOffset}, 현재까지=${allJobs.length}개, 전체=${totalCount}개, 남은 건수=${totalCount - nextOffset}`);
          
          // 다음 배치 조회
          const nextRequestBody = {
            offset: nextOffset,
            limit: maxLimit, // 최대 100
            orderBy: 'startTime desc',
            parameter: {
              startDatetime: `${startDate}T00:00:00Z`,
              endDatetime: `${endDate}T23:59:59Z`
            }
          };
          
          const nextResponse = await axios.post(
            endpoint,
            nextRequestBody,
            {
              headers: {
                'Authorization': process.env.BRITY_RPA_TOKEN || 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiIxNzY4Mjg1MjE4MTE3LWNiODBkMzQwLWEzMDVlN2I5IiwiaXNzIjoiQVVUSF9DTElFTlRfQ0VSVElGSUNBVEUiLCJhdWQiOiJBVVRIX0FQSV9TRVJWRVIiLCJzdWIiOiJBQ0NFU1NfVE9LRU4iLCJjbGllbnRUeXBlIjoiQVBJX0tFWSIsImNsaWVudElkIjoiQVVUSF9BUElfU0VSVkVSIiwidXNlcklkIjoieW91bmdqb29uLmtpbUBham5ldC5jby5rciIsImNoYWxsZW5nZSI6IjE3NjgyODUyMTgxMTctNDJlNmJiODgtM2RmODUyNjciLCJpcEFkZHIiOiIxODIuMTk1LjgzLjQiLCJ0ZW5hbnRJZCI6IlROXzljN2Y0NTU0MDcyODQzMDU5NDhmYTI0OTkyNjhmYTZkIiwic2VjdXJpdHlUeXBlIjoidjIiLCJpYXQiOjE3NjgyODUyMTgsImV4cCI6MTc5ODcyOTE5OX0.yDJaRz9oTq1cyjleFSoTHBpicd9LM810jRcQIpNfTE0',
                'Content-Type': 'application/json'
              },
              timeout: 30000
            }
          );
          
          const nextJobs = nextResponse.data.list || [];
          const nextListCount = nextResponse.data.listCount || nextJobs.length;
          
          if (nextJobs.length === 0) {
            console.log(`⚠️ 더 이상 데이터가 없습니다.`);
            break;
          }
          
          allJobs.push(...nextJobs);
          currentOffset = allJobs.length; // 실제 수집된 데이터 수로 업데이트
          
          console.log(`📥 조회 완료: 이번 배치=${nextJobs.length}개, 누적=${allJobs.length}개 / ${totalCount}개`);
          
          // 더 이상 가져올 데이터가 없으면 종료
          if (nextJobs.length === 0 || allJobs.length >= totalCount || nextListCount < maxLimit) {
            break;
          }
        }
      }
      
      console.log(`📊 전체 데이터 수집 완료: ${allJobs.length}개 / ${totalCount}개`);

      // Job 수행 결과 데이터 정규화
      const normalizedSchedules = [];
      
      for (const job of allJobs) {
        // startTime이 없는 경우 제외
        if (!job.startTime) {
          console.log(`⏭️ Job 건너뜀 (startTime 없음): ${job.jobId}`);
          continue;
        }
        
        // botId 또는 botName이 없는 경우 제외
        const botId = job.botId || '';
        const botName = job.botName || job.botId || '';
        
        if (!botId && !botName) {
          console.log(`⏭️ Job 건너뜀 (botId/botName 없음): ${job.jobId}`);
          continue;
        }

        // startTime과 endTime 사용
        const startTime = job.startTime;
        // endTime이 없으면 startTime + 기본 1분 (실제 실행 시간이 짧을 수 있음)
        const endTime = job.endTime || (() => {
          const start = new Date(startTime);
          start.setMinutes(start.getMinutes() + 1);
          return start.toISOString();
        })();

        // processName을 subject로 사용
        const subject = job.processName || job.jobId || '제목 없음';

        // resultCode 매핑 (detailCode: "1" = SUCCESS, "2" = FAIL 등)
        // statusCode: "4" = JOB_END
        let resultCode = null;
        if (job.detailCode) {
          // detailCode를 resultCode로 매핑
          // "1" = SUCCESS → 1, 그 외는 2 (실패)
          resultCode = job.detailCode === "1" ? 1 : 2;
        }

        normalizedSchedules.push({
          id: job.jobId,
          botId: botId,
          botName: botName,
          processId: job.processId,
          processName: job.processName,
          subject: subject,
          start: startTime,
          end: endTime,
          body: job.processName || '',
          sourceSystem: 'BRITY_RPA',
          // Job 수행 결과 추가 정보
          jobId: job.jobId,
          scheduledTime: job.scheduledTime,
          statusCode: job.statusCode,
          statusName: job.statusName,
          detailCode: job.detailCode,
          detailName: job.detailName,
          resultCode: resultCode,
          jobUser: job.jobUser,
          projectName: job.projectName,
          version: job.version
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

