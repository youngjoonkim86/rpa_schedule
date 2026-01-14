# Brity RPA 토큰 갱신 가이드

## 문제 상황

동기화 실행 시 다음과 같은 오류가 발생하는 경우:

```
Brity RPA 인증 토큰이 만료되었습니다. 토큰을 갱신해주세요.
```

## 해결 방법

### 1. 새 토큰 발급받기

1. **Brity RPA 포털 접속**
   - URL: `https://bwrpa.samsungsds.com:8777`
   - 로그인 후 API 토큰 발급 메뉴로 이동

2. **API 토큰 생성**
   - API 키 생성 또는 갱신
   - 토큰은 `Bearer ` 접두사가 포함된 전체 문자열입니다

### 2. .env 파일 업데이트

`rpa-schedule-manager/backend/.env` 파일을 열어서 다음 값을 업데이트하세요:

```env
BRITY_RPA_TOKEN=Bearer YOUR_NEW_TOKEN_HERE
```

**중요:**
- `Bearer ` 접두사를 포함해야 합니다
- 따옴표 없이 입력하세요
- 토큰 전체를 한 줄에 입력하세요

**예시:**
```env
BRITY_RPA_TOKEN=Bearer eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiIxNzY4Mjg1MjE4MTE3LWNiODBkMzQwLWEzMDVlN2I5IiwiaXNzIjoiQVVUSF9DTElFTlRfQ0VSVElGSUNBVEUiLCJhdWQiOiJBVVRIX0FQSV9TRVJWRVIiLCJzdWIiOiJBQ0NFU1NfVE9LRU4iLCJjbGllbnRUeXBlIjoiQVBJX0tFWSIsImNsaWVudElkIjoiQVVUSF9BUElfU0VSVkVSIiwidXNlcklkIjoieW91bmdqb29uLmtpbUBham5ldC5jby5rciIsImNoYWxsZW5nZSI6IjE3NjgyODUyMTgxMTctNDJlNmJiODgtM2RmODUyNjciLCJpcEFkZHIiOiIxODIuMTk1LjgzLjQiLCJ0ZW5hbnRJZCI6IlROXzljN2Y0NTU0MDcyODQzMDU5NDhmYTI0OTkyNjhmYTZkIiwic2VjdXJpdHlUeXBlIjoidjIiLCJpYXQiOjE3NjgyODUyMTgsImV4cCI6MTc5ODcyOTE5OX0.yDJaRz9oTq1cyjleFSoTHBpicd9LM810jRcQIpNfTE0
```

### 3. 서버 재시작

`.env` 파일을 수정한 후에는 **반드시 서버를 재시작**해야 합니다:

```powershell
# 백엔드 서버 중지 (Ctrl+C)
# 그 다음 다시 시작
cd rpa-schedule-manager/backend
npm run dev
```

### 4. 토큰 확인

서버를 재시작한 후, 서버 콘솔에서 다음 로그를 확인하세요:

```
📡 Brity RPA API 호출: https://bwrpa.samsungsds.com:8777/scheduler/api/v1/schedulings/list
```

오류가 없으면 토큰이 정상적으로 적용된 것입니다.

## 토큰 테스트

토큰이 올바르게 설정되었는지 테스트하려면:

```powershell
cd rpa-schedule-manager/backend
npm run test-brity
```

이 명령어는 Brity RPA API를 직접 호출하여 토큰이 유효한지 확인합니다.

## 자주 발생하는 문제

### 문제 1: 토큰이 설정되지 않음

**증상:**
```
토큰 상태: 설정되지 않음 (기본 토큰 사용 중)
```

**해결:**
- `.env` 파일에 `BRITY_RPA_TOKEN`이 있는지 확인
- 파일 경로가 올바른지 확인 (`backend/.env`)

### 문제 2: 토큰 형식 오류

**증상:**
- 401 오류가 계속 발생
- 토큰은 설정되어 있음

**해결:**
- `Bearer ` 접두사가 포함되어 있는지 확인
- 토큰에 공백이나 줄바꿈이 없는지 확인
- 따옴표로 감싸지 않았는지 확인

### 문제 3: 토큰이 만료됨

**증상:**
- 처음에는 작동했지만 시간이 지나면서 오류 발생

**해결:**
- Brity RPA 포털에서 새 토큰 발급
- `.env` 파일 업데이트
- 서버 재시작

## 보안 주의사항

⚠️ **중요:**
- `.env` 파일은 절대 Git에 커밋하지 마세요
- 토큰을 공유하거나 노출하지 마세요
- 프로덕션 환경에서는 환경 변수로 관리하세요

## 추가 도움말

토큰 발급 방법이 명확하지 않은 경우:
1. Brity RPA 관리자에게 문의
2. Brity RPA API 문서 확인
3. 프로젝트 관리자에게 문의

