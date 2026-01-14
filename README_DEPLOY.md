# GitHub 배포 가이드 (로컬 DB 사용)

## 빠른 시작

### 방법 1: ngrok 사용 (가장 간단)

#### 1단계: ngrok 설정
```powershell
# ngrok 설치 (Chocolatey)
choco install ngrok

# ngrok 계정 생성 후 인증 토큰 설정
ngrok config add-authtoken YOUR_TOKEN

# MySQL 터널 시작
.\start-ngrok.ps1
```

#### 2단계: 환경 변수 설정

**백엔드 (.env):**
```
DB_HOST=0.tcp.ngrok.io  # ngrok에서 표시된 호스트
DB_PORT=12345          # ngrok에서 표시된 포트
DB_USER=root
DB_PASSWORD=your-password
DB_NAME=rpa_schedule_db
```

**프론트엔드 (.env):**
```
VITE_API_URL=https://your-backend-ngrok.ngrok.io/api
```

#### 3단계: GitHub에 푸시
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

#### 4단계: Vercel에 프론트엔드 배포
1. [vercel.com](https://vercel.com) 로그인
2. "New Project" → GitHub 저장소 선택
3. 설정:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Environment Variables:
   - `VITE_API_URL`: ngrok 백엔드 URL

#### 5단계: Railway에 백엔드 배포
1. [railway.app](https://railway.app) 로그인
2. "New Project" → "Deploy from GitHub repo"
3. 저장소 선택, `backend` 폴더 선택
4. Environment Variables 설정 (위의 백엔드 .env 내용)

### 방법 2: Railway MySQL 사용 (권장)

로컬 DB 대신 Railway의 MySQL을 사용하면 ngrok 없이도 가능합니다.

1. Railway에서 "New" → "Database" → "Add MySQL"
2. 생성된 MySQL 연결 정보를 백엔드 환경 변수에 설정
3. 스키마 마이그레이션:
   ```bash
   mysql -h railway-host -u railway -p railway < backend/sql/schema.sql
   ```

## 배포 구조

```
GitHub Repository
├── frontend/          → Vercel 배포
├── backend/          → Railway 배포
└── 로컬 MySQL        → ngrok 터널링 (또는 Railway MySQL)
```

## 환경 변수 체크리스트

### 백엔드 (Railway)
- [ ] `DB_HOST`
- [ ] `DB_PORT`
- [ ] `DB_USER`
- [ ] `DB_PASSWORD`
- [ ] `DB_NAME`
- [ ] `BRITY_RPA_URL`
- [ ] `BRITY_RPA_TOKEN`
- [ ] `POWER_AUTOMATE_CREATE_URL`
- [ ] `POWER_AUTOMATE_QUERY_URL`
- [ ] `CORS_ORIGIN` (Vercel 프론트엔드 URL)
- [ ] `REDIS_ENABLED=false`

### 프론트엔드 (Vercel)
- [ ] `VITE_API_URL` (Railway 백엔드 URL 또는 ngrok URL)

## 문제 해결

### ngrok 연결 끊김
- 무료 계정은 8시간마다 재연결 필요
- 유료 계정 사용 또는 자동 재연결 스크립트 사용

### DB 연결 실패
- ngrok URL이 변경되었는지 확인
- MySQL이 실행 중인지 확인
- 방화벽 설정 확인

### CORS 오류
- `CORS_ORIGIN`에 정확한 프론트엔드 URL 설정
- Vercel URL이 변경되면 업데이트 필요

