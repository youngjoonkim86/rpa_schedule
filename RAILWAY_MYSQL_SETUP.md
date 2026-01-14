# Railway MySQL 설정 가이드 (ngrok 대체)

## 왜 Railway MySQL을 사용하나요?

- ✅ ngrok TCP 터널은 카드 등록 필요
- ✅ 더 안정적이고 24/7 사용 가능
- ✅ 무료 티어 제공
- ✅ 설정이 간단함

## 단계별 설정

### 1단계: Railway 프로젝트 생성

1. https://railway.app 접속 → 로그인
2. "New Project" 클릭
3. "Empty Project" 선택

### 2단계: MySQL 데이터베이스 추가

1. Railway 프로젝트에서 "New" 클릭
2. "Database" → "Add MySQL" 선택
3. MySQL 서비스 생성 완료 (약 1-2분 소요)

### 3단계: MySQL 연결 정보 확인

1. MySQL 서비스 클릭
2. "Variables" 탭 클릭
3. 다음 정보 확인:
   ```
   MYSQLHOST=containers-us-west-xxx.railway.app
   MYSQLPORT=3306
   MYSQLUSER=root
   MYSQLPASSWORD=xxxxx
   MYSQLDATABASE=railway
   ```

### 4단계: 스키마 마이그레이션

로컬에서 MySQL 클라이언트로 연결하여 스키마 생성:

```powershell
# MySQL이 설치되어 있다면
mysql -h containers-us-west-xxx.railway.app -P 3306 -u root -p railway < backend/sql/schema.sql
```

또는 Railway MySQL 서비스의 "Data" 탭에서 직접 SQL 실행:

1. MySQL 서비스 → "Data" 탭
2. "Query" 클릭
3. `backend/sql/schema.sql` 파일 내용 복사하여 실행

### 5단계: 백엔드 환경 변수 설정

Railway 백엔드 서비스의 "Variables" 탭에서:

```
DB_HOST=containers-us-west-xxx.railway.app
DB_PORT=3306
DB_USER=root
DB_PASSWORD=xxxxx
DB_NAME=railway
DB_CONNECTION_LIMIT=10

# 기타 환경 변수들...
BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
BRITY_RPA_TOKEN=your_token
POWER_AUTOMATE_CREATE_URL=your_url
POWER_AUTOMATE_QUERY_URL=your_url
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
CORS_ORIGIN=https://your-frontend.vercel.app
REDIS_ENABLED=false
AUTO_REGISTER_TO_POWER_AUTOMATE=true
```

### 6단계: 백엔드 서비스 배포

1. Railway 프로젝트에서 "New" → "GitHub Repo" 선택
2. 저장소 선택
3. "Settings" → "Root Directory" → `backend` 설정
4. 환경 변수 설정 (위의 값들)
5. 자동 배포 시작

## 확인

1. Railway 백엔드 로그에서 DB 연결 확인
2. `/health` 엔드포인트로 상태 확인
3. 프론트엔드에서 일정 조회 테스트

## 장점

- ✅ ngrok 불필요
- ✅ 카드 등록 불필요
- ✅ 24/7 안정적
- ✅ 무료 티어 제공
- ✅ 자동 백업 (유료 플랜)

