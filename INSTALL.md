# RPA BOT 스케줄 관리 시스템 설치 가이드

## 사전 요구사항

- Node.js 18.x 이상
- MySQL 8.0 이상
- Redis 6.x 이상 (선택사항, 캐싱 기능 사용 시)

## 설치 단계

### 1. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 디렉토리로 이동
cd rpa-schedule-manager

# 백엔드 의존성 설치
cd backend
npm install

# 프론트엔드 의존성 설치
cd ../frontend
npm install
```

### 2. 데이터베이스 설정

#### Windows (PowerShell)

PowerShell에서는 `<` 리다이렉션이 다르게 작동하므로 다음 방법을 사용하세요:

```powershell
# 방법 1: 배치 파일 사용 (권장)
cd backend\sql
.\run_schema.bat

# 방법 2: Get-Content 사용
Get-Content backend\sql\schema.sql | mysql -u root -p

# 방법 3: MySQL Workbench에서 파일 열어서 실행
```

자세한 내용은 `INSTALL_WINDOWS.md`를 참고하세요.

#### Linux/Mac

```bash
# MySQL 접속
mysql -u root -p

# 스키마 실행
source backend/sql/schema.sql

# 또는 직접 실행
mysql -u root -p < backend/sql/schema.sql
```

### 3. 환경 변수 설정

#### 백엔드 `.env` 파일 생성

```bash
cd backend
cp .env.example .env
```

`.env` 파일을 열어서 다음 값들을 수정하세요:

```env
DB_PASSWORD=your_mysql_password
BRITY_RPA_TOKEN=Bearer YOUR_ACTUAL_TOKEN
```

#### 프론트엔드 `.env` 파일 생성

```bash
cd frontend
cp .env.example .env
```

### 4. 서버 실행

#### 백엔드 실행

```bash
cd backend
npm run dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

#### 프론트엔드 실행

새 터미널에서:

```bash
cd frontend
npm run dev
```

프론트엔드가 `http://localhost:5173`에서 실행됩니다.

### 5. 브라우저에서 접속

`http://localhost:5173`을 열어서 애플리케이션을 확인하세요.

## 문제 해결

### MySQL 연결 오류

- MySQL 서비스가 실행 중인지 확인
- `.env` 파일의 DB 정보가 올바른지 확인
- 방화벽 설정 확인

### Redis 연결 오류

Redis는 선택사항입니다. 연결 실패해도 서버는 정상 작동합니다.

### 포트 충돌

`.env` 파일에서 포트를 변경하거나, 실행 중인 프로세스를 종료하세요.

