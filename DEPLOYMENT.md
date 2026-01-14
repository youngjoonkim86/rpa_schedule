# 배포 가이드

## 배포 옵션

### 옵션 1: Vercel (프론트엔드) + Railway/Render (백엔드) + 로컬 DB (ngrok)

#### 1. 프론트엔드 배포 (Vercel)

1. GitHub에 프로젝트 푸시
2. [Vercel](https://vercel.com)에 로그인
3. "New Project" 클릭
4. GitHub 저장소 선택
5. 설정:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`
6. 환경 변수 추가:
   ```
   VITE_API_URL=https://your-backend-url.railway.app/api
   ```

#### 2. 백엔드 배포 (Railway)

1. [Railway](https://railway.app)에 로그인
2. "New Project" → "Deploy from GitHub repo"
3. 저장소 선택 후 `backend` 폴더 선택
4. 환경 변수 설정:
   ```
   DB_HOST=your-ngrok-url.ngrok.io
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=your-password
   DB_NAME=rpa_schedule_db
   BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
   BRITY_RPA_TOKEN=your-token
   POWER_AUTOMATE_CREATE_URL=your-url
   POWER_AUTOMATE_QUERY_URL=your-url
   CORS_ORIGIN=https://your-frontend.vercel.app
   REDIS_ENABLED=false
   ```

#### 3. 로컬 DB 외부 접근 설정 (ngrok)

1. [ngrok](https://ngrok.com) 다운로드 및 설치
2. ngrok 실행:
   ```bash
   ngrok tcp 3306
   ```
3. 생성된 URL을 Railway 환경 변수 `DB_HOST`에 설정
   - 예: `0.tcp.ngrok.io:12345` → `DB_HOST=0.tcp.ngrok.io`, `DB_PORT=12345`

### 옵션 2: 전체 로컬 + ngrok (간단한 방법)

#### 1. 백엔드 외부 접근 설정

```bash
# 백엔드 포트 3000을 외부에 노출
ngrok http 3000
```

#### 2. 프론트엔드 환경 변수 설정

`frontend/.env` 파일 생성:
```
VITE_API_URL=https://your-ngrok-url.ngrok.io/api
```

#### 3. 프론트엔드 배포 (Vercel)

- Vercel에서 프론트엔드만 배포
- 환경 변수에 ngrok URL 설정

### 옵션 3: Railway MySQL 사용 (권장)

로컬 DB 대신 Railway의 MySQL 서비스를 사용:

1. Railway에서 "New" → "Database" → "Add MySQL"
2. 생성된 MySQL 연결 정보를 백엔드 환경 변수에 설정
3. 로컬 DB 마이그레이션:
   ```bash
   mysql -h railway-host -u railway -p railway < backend/sql/schema.sql
   ```

## 보안 주의사항

1. **환경 변수**: `.env` 파일은 절대 GitHub에 커밋하지 마세요
2. **DB 접근**: ngrok 사용 시 비밀번호를 강력하게 설정하세요
3. **CORS**: `CORS_ORIGIN`에 정확한 프론트엔드 URL만 설정하세요

## 배포 후 확인

1. 프론트엔드: `https://your-app.vercel.app`
2. 백엔드 헬스체크: `https://your-backend.railway.app/health`
3. API 테스트: 브라우저 개발자 도구에서 네트워크 탭 확인

