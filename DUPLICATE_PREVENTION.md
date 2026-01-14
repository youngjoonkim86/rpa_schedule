# 중복 방지 및 반복 스케줄 처리 가이드

## 개요

Brity RPA에서 스케줄을 동기화할 때 다음 두 가지 문제를 해결했습니다:

1. **중복 스케줄 방지**: 동일한 BOT이 동일한 시간에 실행되는 스케줄은 중복으로 간주하여 업데이트만 수행
2. **반복 스케줄 처리**: 반복 스케줄의 경우 실제 실행 예정 시간(`nextJobTime`)만 등록

## 중복 방지 로직

### DB 레벨 중복 체크

`Schedule.upsert()` 메서드에서 다음 조건으로 중복을 체크합니다:

1. **주요 중복 체크**: `bot_id` + `start_datetime` + `end_datetime`
   - 동일한 BOT이 동일한 시작/종료 시간에 실행되는 스케줄은 중복으로 간주
   - 중복이 발견되면 기존 레코드를 업데이트

2. **추가 안전장치**: `process_id` + `start_datetime` (process_id가 있는 경우)
   - 프로세스 ID와 시작 시간이 동일하면 중복으로 간주

### 중복 체크 예시

```javascript
// 다음 두 스케줄은 중복으로 간주됨:
// 1. bot_id: "BOT1", start: "2026-01-15 09:00", end: "2026-01-15 10:00"
// 2. bot_id: "BOT1", start: "2026-01-15 09:00", end: "2026-01-15 10:00"
// → 두 번째는 등록되지 않고 첫 번째가 업데이트됨
```

## 반복 스케줄 처리

### nextJobTime 필터링

Brity RPA API 응답에서:

- **`nextJobTime`이 있는 경우**: 실제 실행 예정 시간이므로 등록
- **`nextJobTime`이 없는 경우**: 반복 스케줄의 템플릿이므로 등록하지 않음

### 필터링 로직

```javascript
// brityRpaService.js에서 필터링
schedules.filter(schedule => {
  // nextJobTime이 있는 경우만 처리
  if (!schedule.nextJobTime) {
    return false; // 건너뜀
  }
  
  // 비활성화되거나 삭제된 스케줄 제외
  if (schedule.inActiveYn === 'Y' || schedule.delYn === 'Y') {
    return false; // 건너뜀
  }
  
  return true; // 등록
});
```

### 반복 스케줄 예시

**Brity RPA 응답 예시:**
```json
{
  "id": 123,
  "botId": "BOT1",
  "processId": "PROC001",
  "freq": "DAILY",
  "nextJobTime": "2026-01-15T09:00:00Z",  // 실제 실행 시간
  "schDetStartDt": "2026-01-01T09:00:00Z", // 반복 시작 시간
  "schDetEndDt": "2026-01-15T10:00:00Z"
}
```

**처리 결과:**
- `nextJobTime`이 있으므로 등록됨
- 등록되는 시간: `2026-01-15T09:00:00Z` (nextJobTime)
- 반복 템플릿 정보(`schDetStartDt`)는 무시됨

## 동작 흐름

```
1. Brity RPA API에서 스케줄 조회
   ↓
2. nextJobTime 필터링 (nextJobTime이 있는 것만)
   ↓
3. 각 스케줄에 대해:
   a. Power Automate에서 중복 체크
   b. 없으면 Power Automate에 등록
   c. DB에 upsert (중복 체크 포함)
   ↓
4. 완료
```

## 로그 확인

동기화 실행 시 서버 콘솔에서 다음 로그를 확인할 수 있습니다:

```
📡 Brity RPA API 호출: ...
📅 기간: 2025-12-28 ~ 2026-02-07
⏭️ 스케줄 건너뜀 (nextJobTime 없음): 123 - 일일 작업
✅ 일정 등록: BOT1 - 작업명
⏭️ 일정 건너뜀 (이미 존재): BOT2 - 작업명

✅ 동기화 완료:
   - 총 스케줄 (nextJobTime 있음): 50개
   - DB 저장/업데이트: 50개 (중복은 자동으로 업데이트됨)
   - Power Automate 등록: 10개
   - Power Automate 건너뜀 (이미 존재): 40개
   - 실패: 0개
```

## 문제 해결

### 중복 스케줄이 계속 생성되는 경우

1. **중복 체크 조건 확인**
   - `bot_id`, `start_datetime`, `end_datetime`이 정확히 일치하는지 확인
   - 시간 형식이 일치하는지 확인 (ISO 8601 형식)

2. **DB 확인**
   ```sql
   SELECT bot_id, start_datetime, end_datetime, COUNT(*) as count
   FROM bot_schedules
   WHERE status = 'ACTIVE'
   GROUP BY bot_id, start_datetime, end_datetime
   HAVING count > 1;
   ```

### 반복 스케줄이 모두 등록되는 경우

1. **nextJobTime 확인**
   - Brity RPA API 응답에 `nextJobTime` 필드가 있는지 확인
   - 서버 로그에서 "nextJobTime 없음" 메시지 확인

2. **필터링 로직 확인**
   - `brityRpaService.js`의 필터링 로직이 올바르게 작동하는지 확인

## 추가 개선 사항

향후 개선 가능한 사항:

1. **반복 스케줄 자동 생성**: `freq`, `freqInterval`, `schUntil` 정보를 사용하여 미래 일정 자동 생성
2. **더 정교한 중복 체크**: 시간 범위가 겹치는 경우도 중복으로 간주
3. **중복 리포트**: 중복으로 감지된 스케줄 목록 제공

