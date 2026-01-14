# ngrok 없이 배포하기 (Railway MySQL 사용)

## 🎯 배포 전략

ngrok TCP 터널은 카드 등록이 필요하므로, **Railway MySQL**을 사용하는 방법으로 진행합니다.

## 📋 배포 단계

### 1단계: GitHub 저장소 생성 및 푸시

1. https://github.com 접속 → 로그인
2. "New repository" 클릭
3. 저장소 이름 입력 (예: `rpa-schedule-manager`)
4. "Create repository" 클릭
5. 아래 명령어 실행:

```powershell
git remote add origin https://github.com/YOUR_USERNAME/rpa-schedule-manager.git
git branch -M main
git push -u origin main
```

### 2단계: Railway 프로젝트 생성

1. https://railway.app 접속 → GitHub 로그인
2. "New Project" 클릭
3. "Empty Project" 선택

### 3단계: Railway MySQL 추가

1. Railway 프로젝트에서 "New" 클릭
2. "Database" → "Add MySQL" 선택
3. MySQL 서비스 생성 완료 대기 (1-2분)

### 4단계: MySQL 스키마 생성

**방법 1: Railway 웹 인터페이스 사용 (권장)**

1. MySQL 서비스 클릭
2. "Data" 탭 클릭
3. "Query" 버튼 클릭
4. `backend/sql/schema.sql` 파일 내용 복사하여 실행

**방법 2: 로컬 MySQL 클라이언트 사용**

Railway MySQL의 연결 정보를 확인한 후:

```powershell
# MySQL 연결 정보 확인 (Railway Variables 탭)
# MYSQLHOST, MYSQLPORT, MYSQLUSER, MYSQLPASSWORD, MYSQLDATABASE

mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < backend/sql/schema.sql
```

### 5단계: Railway 백엔드 배포

1. Railway 프로젝트에서 "New" 클릭
2. "GitHub Repo" 선택
3. 저장소 선택
4. "Settings" → "Root Directory" → `backend` 설정
5. "Variables" 탭에서 환경 변수 추가:

```
# MySQL 연결 (Railway MySQL Variables에서 복사)
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_CONNECTION_LIMIT=10

# 기타 설정
BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
BRITY_RPA_TOKEN=your_brity_token
POWER_AUTOMATE_CREATE_URL=your_power_automate_create_url
POWER_AUTOMATE_QUERY_URL=your_power_automate_query_url
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
REDIS_ENABLED=false
AUTO_REGISTER_TO_POWER_AUTOMATE=true
```

**중요**: `CORS_ORIGIN`은 Vercel 프론트엔드 URL을 설정한 후 추가하세요.

6. 자동 배포 시작 (GitHub 푸시 시 자동 배포)

### 6단계: Vercel 프론트엔드 배포

1. https://vercel.com 접속 → GitHub 로그인
2. "Add New..." → "Project" 클릭
3. 저장소 선택
4. 프로젝트 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Environment Variables:
   ```
   VITE_API_URL=https://your-railway-backend.railway.app/api
   ```
   (Railway 백엔드 URL은 배포 후 확인)
6. "Deploy" 클릭

### 7단계: CORS 설정 업데이트

1. Railway 백엔드 → "Variables" 탭
2. `CORS_ORIGIN` 추가/수정:
   ```
   CORS_ORIGIN=https://your-frontend.vercel.app
   ```
3. 재배포 (자동 또는 수동)

## ✅ 확인 사항

- [ ] GitHub 저장소 푸시 완료
- [ ] Railway MySQL 생성 및 스키마 생성 완료
- [ ] Railway 백엔드 배포 완료
- [ ] Vercel 프론트엔드 배포 완료
- [ ] CORS 설정 완료
- [ ] 프론트엔드에서 일정 조회 테스트

## 🔧 문제 해결

### MySQL 연결 실패
- Railway Variables에서 연결 정보 확인
- 스키마가 생성되었는지 확인

### CORS 오류
- Railway `CORS_ORIGIN`에 정확한 Vercel URL 설정
- 재배포 필요

### 배포 실패
- Railway 로그 확인
- 환경 변수 확인
- `package.json`의 `start` 스크립트 확인

