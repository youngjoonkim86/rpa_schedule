# 빠른 배포 가이드

## 🚀 GitHub + 로컬 DB 배포 방법

### 옵션 1: ngrok 사용 (가장 간단)

#### 1. ngrok 설치 및 설정
```powershell
# Chocolatey로 설치
choco install ngrok

# 또는 수동 설치: https://ngrok.com/download

# 인증 토큰 설정 (ngrok.com에서 무료 계정 생성 후)
ngrok config add-authtoken YOUR_TOKEN
```

#### 2. 로컬 DB 터널링
```powershell
# PowerShell에서 실행
.\start-ngrok.ps1

# 또는 수동 실행
ngrok tcp 3306
```

ngrok 출력 예시:
```
Forwarding  tcp://0.tcp.ngrok.io:12345 -> localhost:3306
```

#### 3. GitHub에 푸시
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/your-username/your-repo.git
git push -u origin main
```

#### 4. Vercel에 프론트엔드 배포
1. https://vercel.com 접속 → 로그인
2. "New Project" 클릭
3. GitHub 저장소 선택
4. 설정:
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Environment Variables 추가:
   ```
   VITE_API_URL=https://your-backend-url.railway.app/api
   ```

#### 5. Railway에 백엔드 배포
1. https://railway.app 접속 → 로그인
2. "New Project" → "Deploy from GitHub repo"
3. 저장소 선택, `backend` 폴더 선택
4. Environment Variables 설정:
   ```
   DB_HOST=0.tcp.ngrok.io
   DB_PORT=12345
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=rpa_schedule_db
   BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
   BRITY_RPA_TOKEN=your_token
   POWER_AUTOMATE_CREATE_URL=your_url
   POWER_AUTOMATE_QUERY_URL=your_url
   CORS_ORIGIN=https://your-frontend.vercel.app
   REDIS_ENABLED=false
   ```

### 옵션 2: Railway MySQL 사용 (권장)

ngrok 대신 Railway의 MySQL을 사용하면 더 안정적입니다.

1. Railway에서 "New" → "Database" → "Add MySQL"
2. 생성된 MySQL 연결 정보를 백엔드 환경 변수에 설정
3. 스키마 마이그레이션:
   ```bash
   mysql -h railway-host -u railway -p railway < backend/sql/schema.sql
   ```

## 📋 체크리스트

### 배포 전
- [ ] GitHub 저장소 생성 및 푸시 완료
- [ ] ngrok 설치 및 인증 완료
- [ ] 로컬 MySQL 실행 중
- [ ] 환경 변수 값 준비 완료

### Vercel 설정
- [ ] Root Directory: `frontend`
- [ ] Build Command: `npm run build`
- [ ] Output Directory: `dist`
- [ ] Environment Variable: `VITE_API_URL`

### Railway 설정
- [ ] GitHub 저장소 연결
- [ ] Root Directory: `backend`
- [ ] 모든 환경 변수 설정 완료
- [ ] 배포 성공 확인

## 🔧 문제 해결

### ngrok 연결 끊김
- 무료 계정은 8시간마다 재연결 필요
- `start-ngrok.ps1` 재실행

### DB 연결 실패
- ngrok URL이 변경되었는지 확인
- Railway 환경 변수 업데이트 필요

### CORS 오류
- `CORS_ORIGIN`에 정확한 Vercel URL 설정

## 📝 참고 문서

- 상세 가이드: `DEPLOYMENT.md`
- ngrok 설정: `NGROK_SETUP.md`
- 환경 변수 예시: `backend/.env.example` (직접 생성 필요)

