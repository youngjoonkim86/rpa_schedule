# Brity RPA API 테스트 가이드

## 수정 사항

1. **API 엔드포인트 수정**
   - `/schedulings/calendar/list` → `/schedulings/list`로 변경
   - 실제 API 명세에 맞게 수정

2. **데이터 매핑 개선**
   - `nextJobTime` 우선 사용 (다음 실행 시간)
   - `schDetStartDt`, `schDetEndDt` 지원
   - 종료 시간이 없을 경우 시작 시간 + 1시간으로 기본 설정

3. **로깅 추가**
   - API 호출 시 상세 로그 출력
   - 조회된 스케줄 개수 표시

## 테스트 방법

### 1. API 직접 테스트

```powershell
cd E:\rpa\rpa-schedule-manager\backend
npm run test-brity
```

### 2. 수동 동기화 (API 엔드포인트)

```powershell
# PowerShell에서
$body = @{
    startDate = "2025-12-28"
    endDate = "2026-02-07"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/sync/rpa-schedules" `
    -Method POST `
    -ContentType "application/json" `
    -Body $body `
    -UseBasicParsing
```

### 3. 환경 변수 확인

`.env` 파일에 다음이 설정되어 있는지 확인:

```env
BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
BRITY_RPA_TOKEN=Bearer eyJhbGciOiJIUzI1NiJ9...
```

## 응답 데이터 구조

Brity RPA API 응답 예시:

```json
{
  "request": {
    "offset": 0,
    "limit": 100,
    "parameter": {
      "START_DATETIME": "2025-12-28 00:00",
      "END_DATETIME": "2026-02-07 23:59"
    }
  },
  "totalCount": 50,
  "list": [
    {
      "id": "RS_099a86b1155f4f97931bed3737f9a6a5",
      "botId": "BOT-T7C50",
      "botName": "BOT2",
      "processId": "0007ff49-bd60-4ecd-a967-bc40f15375fc",
      "processName": "ajrpa_d0521_P_00유통주문출고요청처리",
      "jobScheduleName": "ajrpa_d0521_로지스_유통주문출고요청처리",
      "startTime": "2026-01-06T21:00:00Z",
      "nextJobTime": "2026-01-13T21:00:00Z",
      "schDetStartDt": "2026-01-06T21:00:00Z",
      "schDetEndDt": "2027-01-06T04:00:00Z",
      "description": "",
      "freq": "DAILY",
      "inActiveYn": "N",
      "delYn": "N"
    }
  ]
}
```

## 문제 해결

### API 호출 실패 시

1. **토큰 확인**
   - `.env` 파일의 `BRITY_RPA_TOKEN`이 올바른지 확인
   - 토큰이 만료되었을 수 있음 (401 오류)

2. **네트워크 확인**
   - `https://bwrpa.samsungsds.com:8777` 접속 가능한지 확인
   - 방화벽 설정 확인

3. **로그 확인**
   - 서버 콘솔에서 상세 에러 메시지 확인
   - `test-brity` 스크립트 실행 시 상세 로그 출력

## 데이터베이스 저장 확인

동기화 후 데이터베이스에서 확인:

```sql
SELECT * FROM bot_schedules 
WHERE source_system = 'BRITY_RPA' 
ORDER BY start_datetime DESC 
LIMIT 10;
```


