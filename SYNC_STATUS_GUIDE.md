# Brity RPA 동기화 상태 확인 가이드

## 동기화 상태 확인 방법

### 1. 서버 콘솔 로그 (실시간)

백엔드 서버를 실행한 터미널에서 실시간으로 동기화 진행 상황을 확인할 수 있습니다.

**예시 출력:**
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

### 2. API를 통한 동기화 로그 조회

#### 최근 동기화 상태 조회

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/sync/status" -UseBasicParsing | Select-Object -ExpandProperty Content
```

**응답 예시:**
```json
{
  "success": true,
  "data": {
    "logId": 5,
    "syncType": "BRITY_RPA",
    "syncStatus": "SUCCESS",
    "recordsSynced": 50,
    "errorMessage": null,
    "syncDatetime": "2026-01-14T01:30:00.000Z"
  }
}
```

#### 동기화 로그 목록 조회

```powershell
# 최근 50개 로그 조회
Invoke-WebRequest -Uri "http://localhost:3000/api/sync/logs?limit=50" -UseBasicParsing | Select-Object -ExpandProperty Content

# Brity RPA 로그만 조회
Invoke-WebRequest -Uri "http://localhost:3000/api/sync/logs?limit=20&syncType=BRITY_RPA" -UseBasicParsing | Select-Object -ExpandProperty Content
```

**응답 예시:**
```json
{
  "success": true,
  "data": [
    {
      "logId": 5,
      "syncType": "BRITY_RPA",
      "syncStatus": "SUCCESS",
      "recordsSynced": 50,
      "errorMessage": null,
      "syncDatetime": "2026-01-14T01:30:00.000Z"
    },
    {
      "logId": 4,
      "syncType": "BRITY_RPA",
      "syncStatus": "PARTIAL",
      "recordsSynced": 45,
      "errorMessage": "5개 레코드 저장 실패",
      "syncDatetime": "2026-01-14T00:30:00.000Z"
    }
  ],
  "count": 2
}
```

### 3. 데이터베이스 직접 조회

MySQL에 직접 접속하여 `sync_logs` 테이블을 조회할 수 있습니다.

```sql
-- 최근 동기화 로그 조회
SELECT * FROM sync_logs 
WHERE sync_type = 'BRITY_RPA' 
ORDER BY sync_datetime DESC 
LIMIT 10;

-- 오늘의 동기화 통계
SELECT 
    sync_status,
    COUNT(*) as count,
    SUM(records_synced) as total_records
FROM sync_logs
WHERE sync_type = 'BRITY_RPA' 
  AND DATE(sync_datetime) = CURDATE()
GROUP BY sync_status;
```

### 4. 프론트엔드에서 확인 (향후 구현)

프론트엔드에 동기화 상태 표시 UI를 추가할 예정입니다.

## 동기화 상태 값 설명

### sync_status

- **SUCCESS**: 모든 스케줄이 성공적으로 동기화됨
- **PARTIAL**: 일부 스케줄만 성공적으로 동기화됨 (일부 실패)
- **FAILED**: 동기화 실패

### syncType

- **BRITY_RPA**: Brity RPA에서 스케줄을 가져와 동기화
- **POWER_AUTOMATE**: Power Automate에서 일정을 가져와 동기화 (향후 구현)

## 자동 동기화 확인

매시간 정각에 자동으로 동기화가 실행됩니다. 자동 동기화 로그도 `sync_logs` 테이블에 기록됩니다.

**자동 동기화 시간 확인:**
```sql
SELECT sync_datetime, sync_status, records_synced 
FROM sync_logs 
WHERE sync_type = 'BRITY_RPA' 
ORDER BY sync_datetime DESC 
LIMIT 24;  -- 최근 24시간
```

## 문제 해결

### 동기화가 실행되지 않는 경우

1. **서버 로그 확인**: 백엔드 서버 콘솔에서 오류 메시지 확인
2. **환경 변수 확인**: `.env` 파일의 `BRITY_RPA_URL`, `BRITY_RPA_TOKEN` 확인
3. **네트워크 확인**: Brity RPA API 서버 접근 가능 여부 확인

### 동기화는 실행되지만 실패하는 경우

1. **로그 확인**: `sync_logs` 테이블의 `error_message` 확인
2. **API 토큰 확인**: Brity RPA API 토큰이 만료되지 않았는지 확인
3. **데이터베이스 확인**: MySQL 연결 및 테이블 상태 확인

## 빠른 확인 명령어

```powershell
# 최근 동기화 상태 한 번에 확인
$status = Invoke-WebRequest -Uri "http://localhost:3000/api/sync/status" -UseBasicParsing | ConvertFrom-Json
Write-Host "최근 동기화: $($status.data.syncStatus) - $($status.data.recordsSynced)개 레코드 - $($status.data.syncDatetime)"
```

