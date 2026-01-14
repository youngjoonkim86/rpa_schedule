# Render 무료 배포 가이드

## 🚀 Render 백엔드 배포 (무료)

### 1단계: Render 계정 생성

1. https://render.com 접속
2. "Get Started for Free" 클릭
3. GitHub 계정으로 로그인

### 2단계: Web Service 생성

1. Dashboard → "New +" → "Web Service" 클릭
2. GitHub 저장소 연결:
   - "Connect account" 클릭 (처음만)
   - 저장소 선택: `youngjoonkim86/rpa_schedule`
   - "Connect" 클릭

3. 서비스 설정:
   ```
   Name: rpa-schedule-backend
   Region: Singapore (또는 가장 가까운 지역)
   Branch: main
   Root Directory: backend
   Runtime: Node
   Build Command: npm install
   Start Command: npm start
   Plan: Free
   ```

4. "Create Web Service" 클릭

### 3단계: 환경 변수 설정

서비스 생성 후 "Environment" 탭에서 추가:

**데이터베이스 연결 (PlanetScale 또는 다른 MySQL):**
```
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=rpa_schedule_db
DB_CONNECTION_LIMIT=10
```

**기타 필수 변수:**
```
BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
BRITY_RPA_TOKEN=your_token
POWER_AUTOMATE_CREATE_URL=your_url
POWER_AUTOMATE_QUERY_URL=your_url
PORT=3000
NODE_ENV=production
REDIS_ENABLED=false
AUTO_REGISTER_TO_POWER_AUTOMATE=true
```

**CORS (Vercel 배포 후 추가):**
```
CORS_ORIGIN=https://your-frontend.vercel.app
```

### 4단계: 배포 확인

1. "Events" 탭에서 배포 로그 확인
2. 배포 완료 후 "Settings" → "Custom Domain" 또는 기본 URL 확인
3. `https://your-service.onrender.com/health` 접속하여 확인

## ⚠️ Render 무료 티어 주의사항

1. **자동 스핀다운**: 15분 비활성 시 자동 종료
2. **콜드 스타트**: 첫 요청 시 약 30초 소요 가능
3. **월 750시간**: 충분히 사용 가능 (24시간/일 기준)

## 🔧 문제 해결

### 배포 실패
- 로그 확인: "Events" 탭
- 환경 변수 확인
- `package.json`의 `start` 스크립트 확인

### 콜드 스타트 느림
- 무료 티어 제한사항
- Keep-alive 서비스 사용 (유료)
- 또는 Fly.io 사용 고려

