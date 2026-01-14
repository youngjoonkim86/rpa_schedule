# 동기화 플로우 가이드

## 개요

RPA 스케줄 동기화는 다음 3단계 플로우로 진행됩니다:

1. **RPA 등록 스케줄 조회** (Brity RPA API)
2. **BOT 일정 조회** (Power Automate API)
3. **BOT 일정 등록** (없는 경우만, Power Automate API)

## 플로우 상세

```
┌─────────────────────────────────────┐
│ 1. RPA 등록 스케줄 조회              │
│    (Brity RPA API)                  │
│    POST /schedulings/list           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ 2. 각 스케줄에 대해:                │
│    BOT 일정 조회                    │
│    (Power Automate API)            │
│    POST /query                      │
└──────────────┬──────────────────────┘
               │
               ├─ 일정 있음 ──┐
               │              │
               ▼              ▼
          ┌─────────┐   ┌──────────────┐
          │ 건너뜀  │   │ 3. 일정 등록 │
          └─────────┘   │ (Power Auto.) │
                        └──────┬───────┘
                               │
                               ▼
                        ┌──────────────┐
                        │ 4. DB 저장   │
                        └──────────────┘
```

## 사용 방법

### 수동 동기화 (API 호출)

```powershell
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

**응답 예시:**
```json
{
  "success": true,
  "message": "동기화가 완료되었습니다.",
  "recordsSynced": 50,
  "recordsRegistered": 10,
  "recordsSkipped": 40,
  "recordsFailed": 0,
  "totalRecords": 50
}
```

### 자동 동기화 (스케줄러)

매시간 정각에 자동으로 실행됩니다.

**Power Automate 자동 등록 활성화:**

`.env` 파일에 추가:
```env
AUTO_REGISTER_TO_POWER_AUTOMATE=true
```

**비활성화 (기본값):**
```env
AUTO_REGISTER_TO_POWER_AUTOMATE=false
```

## 동작 방식

### 1. RPA 등록 스케줄 조회

Brity RPA API에서 지정된 기간의 스케줄을 조회합니다.

**API 엔드포인트:**
- `POST https://bwrpa.samsungsds.com:8777/scheduler/api/v1/schedulings/list`

**요청:**
```json
{
  "offset": 0,
  "limit": 100,
  "parameter": {
    "START_DATETIME": "2025-12-28 00:00",
    "END_DATETIME": "2026-02-07 23:59"
  }
}
```

### 2. BOT 일정 조회

각 스케줄에 대해 Power Automate에서 동일한 BOT과 시간대의 일정이 있는지 확인합니다.

**확인 조건:**
- BOT ID 일치
- 시간대 겹침 (시작 시간 ~ 종료 시간)

### 3. BOT 일정 등록

Power Automate에 일정이 없으면 자동으로 등록합니다.

**등록 데이터:**
```json
{
  "bot": "BOT-T7C50",
  "subject": "ajrpa_d0521_로지스_유통주문출고요청처리",
  "start": {
    "dateTime": "2026-01-06T21:00:00Z",
    "timeZone": "Asia/Seoul"
  },
  "end": {
    "dateTime": "2026-01-07T04:00:00Z",
    "timeZone": "Asia/Seoul"
  },
  "body": "프로세스: ajrpa_d0521_P_00유통주문출고요청처리"
}
```

## 환경 변수 설정

### 필수 설정

```env
# Brity RPA API
BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
BRITY_RPA_TOKEN=Bearer eyJhbGciOiJIUzI1NiJ9...

# Power Automate API
POWER_AUTOMATE_CREATE_URL=https://...
POWER_AUTOMATE_QUERY_URL=https://...
```

### 선택 설정

```env
# Power Automate 자동 등록 (자동 동기화 시)
AUTO_REGISTER_TO_POWER_AUTOMATE=false
```

## 로그 확인

동기화 진행 상황은 서버 콘솔에서 확인할 수 있습니다:

```
🔄 Brity RPA 동기화 시작: 2025-12-28 ~ 2026-02-07
📋 1단계: RPA 등록 스케줄 조회 (Brity RPA API)
✅ 50개 스케줄 조회 완료

✅ 일정 등록: BOT-T7C50 - ajrpa_d0521_로지스_유통주문출고요청처리
⏭️ 일정 건너뜀 (이미 존재): BOT-P2OXI - 가마감
...

✅ 동기화 완료:
   - 총 스케줄: 50개
   - DB 저장: 50개
   - Power Automate 등록: 10개
   - 건너뜀 (이미 존재): 40개
   - 실패: 0개
```

## 문제 해결

### Power Automate API 호출 실패

- Power Automate URL이 올바른지 확인
- 네트워크 연결 확인
- API 권한 확인

### 중복 등록 방지

- 동일한 BOT과 시간대의 일정이 있으면 자동으로 건너뜀
- 시간 겹침 검사 로직으로 중복 방지

### 성능 최적화

- 대량 스케줄 처리 시 배치 처리 고려
- Power Automate API 호출 제한 고려


