# 완전 무료 배포 가이드

## 🆓 무료 서비스 조합

### 옵션 1: Vercel + Render + PlanetScale (권장) ⭐

- **프론트엔드**: Vercel (무료, 무제한)
- **백엔드**: Render (무료, 750시간/월)
- **데이터베이스**: PlanetScale (무료, 5GB 스토리지)

### 옵션 2: Vercel + Fly.io + Supabase

- **프론트엔드**: Vercel (무료)
- **백엔드**: Fly.io (무료, 3개 앱)
- **데이터베이스**: Supabase (무료, 500MB)

### 옵션 3: Vercel + Railway (무료 티어)

- **프론트엔드**: Vercel (무료)
- **백엔드**: Railway (무료, $5 크레딧/월)
- **데이터베이스**: Railway MySQL (무료 티어 포함)

## 🚀 옵션 1: Vercel + Render + PlanetScale (가장 안정적)

### 1단계: PlanetScale MySQL 설정 (무료)

1. https://planetscale.com 접속 → GitHub 로그인
2. "Create database" 클릭
3. Database name: `rpa_schedule_db`
4. Region: 가장 가까운 지역 선택
5. "Create database" 클릭
6. "Connect" 버튼 클릭 → "Connect with" → "Prisma" 선택
7. 연결 정보 복사:
   ```
   DATABASE_URL=mysql://xxxxx:xxxxx@xxxxx.psdb.cloud/rpa_schedule_db?sslaccept=strict
   ```

### 2단계: PlanetScale 스키마 생성

1. PlanetScale 대시보드 → "Console" 클릭
2. `backend/sql/schema.sql` 파일 내용 복사하여 실행
3. 또는 "Branches" → "main" → "Schema" 탭에서 SQL 실행

### 3단계: Render 백엔드 배포 (무료)

1. https://render.com 접속 → GitHub 로그인
2. "New +" → "Web Service" 클릭
3. GitHub 저장소 연결: `youngjoonkim86/rpa_schedule`
4. 설정:
   - **Name**: `rpa-schedule-backend`
   - **Root Directory**: `backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` 선택

5. Environment Variables 추가:
   ```
   DB_HOST=xxxxx.psdb.cloud
   DB_PORT=3306
   DB_USER=xxxxx
   DB_PASSWORD=xxxxx
   DB_NAME=rpa_schedule_db
   DB_CONNECTION_LIMIT=10
   
   BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
   BRITY_RPA_TOKEN=your_token
   POWER_AUTOMATE_CREATE_URL=your_url
   POWER_AUTOMATE_QUERY_URL=your_url
   PORT=3000
   NODE_ENV=production
   REDIS_ENABLED=false
   AUTO_REGISTER_TO_POWER_AUTOMATE=true
   ```

6. "Create Web Service" 클릭

### 4단계: Vercel 프론트엔드 배포 (무료)

1. https://vercel.com 접속 → GitHub 로그인
2. "Add New..." → "Project" 클릭
3. 저장소 선택: `youngjoonkim86/rpa_schedule`
4. 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

5. Environment Variables:
   ```
   VITE_API_URL=https://rpa-schedule-backend.onrender.com/api
   ```
   (Render 백엔드 URL)

6. "Deploy" 클릭

### 5단계: CORS 설정

Render 백엔드 → Environment Variables:
```
CORS_ORIGIN=https://your-frontend.vercel.app
```

## 🚀 옵션 2: Vercel + Fly.io + Supabase

### Supabase 설정

1. https://supabase.com 접속 → GitHub 로그인
2. "New Project" 클릭
3. 프로젝트 생성
4. "Settings" → "Database" → 연결 정보 확인
5. PostgreSQL이므로 스키마를 MySQL에서 PostgreSQL로 변환 필요

### Fly.io 백엔드 배포

1. https://fly.io 접속 → GitHub 로그인
2. `flyctl` 설치 및 로그인
3. 프로젝트 디렉토리에서:
   ```bash
   fly launch
   ```

## 🚀 옵션 3: Railway 무료 티어 (가장 간단)

Railway는 월 $5 크레딧을 무료로 제공합니다.

1. https://railway.app 접속
2. GitHub 로그인
3. 프로젝트 생성 및 배포
4. 무료 크레딧으로 충분히 사용 가능

## 💰 무료 티어 제한사항

### Render
- ✅ 750시간/월 (약 24시간/일)
- ✅ 자동 스핀다운 (15분 비활성 시)
- ⚠️ 첫 요청 시 느릴 수 있음 (콜드 스타트)

### PlanetScale
- ✅ 5GB 스토리지
- ✅ 무제한 읽기
- ✅ 1개 프로덕션 브랜치
- ⚠️ 월 10억 쿼리 제한

### Vercel
- ✅ 무제한 배포
- ✅ 무제한 대역폭
- ✅ 자동 HTTPS

### Fly.io
- ✅ 3개 앱 무료
- ✅ 3GB 공유 RAM
- ✅ 160GB 공유 볼륨

## 🎯 권장: 옵션 1 (Render + PlanetScale)

**이유:**
- ✅ 완전 무료
- ✅ 안정적
- ✅ MySQL 호환 (스키마 변경 불필요)
- ✅ 빠른 설정

## 📋 빠른 시작 체크리스트

- [ ] PlanetScale 계정 생성 및 데이터베이스 생성
- [ ] PlanetScale 스키마 생성
- [ ] Render 백엔드 배포
- [ ] Vercel 프론트엔드 배포
- [ ] CORS 설정
- [ ] 연결 테스트

