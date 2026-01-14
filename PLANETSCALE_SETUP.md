# PlanetScale 무료 MySQL 설정 가이드

## 🆓 PlanetScale 특징

- ✅ 완전 무료
- ✅ MySQL 호환
- ✅ 5GB 스토리지
- ✅ 무제한 읽기
- ✅ 자동 백업

## 🚀 설정 단계

### 1단계: 계정 생성

1. https://planetscale.com 접속
2. "Start for free" 클릭
3. GitHub 계정으로 로그인

### 2단계: 데이터베이스 생성

1. Dashboard → "Create database" 클릭
2. 설정:
   ```
   Database name: rpa_schedule_db
   Region: 가장 가까운 지역 선택
   Plan: Free
   ```
3. "Create database" 클릭

### 3단계: 연결 정보 확인

1. 데이터베이스 클릭 → "Connect" 버튼
2. "Connect with" → "General" 선택
3. 연결 정보 복사:
   ```
   Host: xxxxx.psdb.cloud
   Username: xxxxx
   Password: xxxxx
   Database: rpa_schedule_db
   Port: 3306
   ```

### 4단계: 스키마 생성

**방법 1: PlanetScale Console (권장)**

1. 데이터베이스 → "Console" 클릭
2. "main" 브랜치 선택
3. SQL 입력창에 `backend/sql/schema.sql` 내용 복사
4. "Run" 클릭

**방법 2: MySQL 클라이언트**

```bash
mysql -h xxxxx.psdb.cloud -P 3306 -u xxxxx -p rpa_schedule_db < backend/sql/schema.sql
```

### 5단계: 환경 변수 설정

Render 또는 다른 호스팅 서비스의 환경 변수:

```
DB_HOST=xxxxx.psdb.cloud
DB_PORT=3306
DB_USER=xxxxx
DB_PASSWORD=xxxxx
DB_NAME=rpa_schedule_db
DB_CONNECTION_LIMIT=10
```

## 🔒 보안

- SSL 연결 필수
- 비밀번호는 안전하게 보관
- 환경 변수에만 저장

## 📊 무료 티어 제한

- ✅ 5GB 스토리지
- ✅ 무제한 읽기
- ✅ 1개 프로덕션 브랜치
- ⚠️ 월 10억 쿼리 제한 (충분함)

## 🔧 문제 해결

### 연결 실패
- SSL 설정 확인
- 호스트, 포트, 사용자명, 비밀번호 확인
- 방화벽 설정 확인

### 스키마 생성 실패
- SQL 문법 확인
- PlanetScale Console에서 직접 실행 권장

