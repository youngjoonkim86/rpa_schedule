# ngrok URL 확인 및 설정 가이드

## 📋 ngrok 창에서 URL 확인

두 개의 PowerShell 창이 열려 있을 것입니다:

### 1. MySQL 터널 창
다음과 같은 정보가 표시됩니다:
```
Forwarding  tcp://0.tcp.ngrok.io:12345 -> localhost:3306
```

**복사할 정보:**
- 호스트: `0.tcp.ngrok.io`
- 포트: `12345` (실제 포트 번호로 변경)

### 2. Backend 터널 창
다음과 같은 정보가 표시됩니다:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

**복사할 정보:**
- URL: `https://abc123.ngrok.io` (실제 URL로 변경)

## 🔧 환경 변수 설정

### Railway 백엔드 환경 변수

Railway 프로젝트의 "Variables" 탭에서 다음을 설정:

```
DB_HOST=0.tcp.ngrok.io
DB_PORT=12345
```

(위의 값들을 실제 ngrok에서 표시된 값으로 변경)

### Vercel 프론트엔드 환경 변수

Vercel 프로젝트의 "Settings" → "Environment Variables"에서:

```
VITE_API_URL=https://abc123.ngrok.io/api
```

(위의 URL을 실제 ngrok Backend URL로 변경)

## ⚠️ 중요 사항

1. **ngrok 무료 계정**: 
   - URL이 재시작 시마다 변경됩니다
   - 8시간마다 재연결이 필요할 수 있습니다

2. **URL 변경 시**:
   - Railway와 Vercel의 환경 변수를 업데이트해야 합니다

3. **MySQL 연결 확인**:
   - Railway 배포 후 로그에서 DB 연결 상태 확인
   - 연결 실패 시 ngrok URL이 올바른지 확인

## 📝 체크리스트

- [ ] MySQL ngrok URL 확인 (호스트 + 포트)
- [ ] Backend ngrok URL 확인
- [ ] Railway 환경 변수 설정 (DB_HOST, DB_PORT)
- [ ] Vercel 환경 변수 설정 (VITE_API_URL)
- [ ] Railway 배포 후 DB 연결 확인

