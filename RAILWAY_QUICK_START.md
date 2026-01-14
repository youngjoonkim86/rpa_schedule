# Railway 빠른 시작 가이드

## 🚀 Railway 배포 단계

### 1단계: Railway 프로젝트 생성

1. https://railway.app 접속
2. "Start a New Project" 클릭
3. "Deploy from GitHub repo" 선택
4. GitHub 저장소 선택: `youngjoonkim86/rpa_schedule`

### 2단계: MySQL 데이터베이스 추가

1. Railway 프로젝트에서 "New" 클릭
2. "Database" → "Add MySQL" 선택
3. MySQL 서비스 생성 완료 대기 (1-2분)

### 3단계: MySQL 스키마 생성

**방법 1: Railway 웹 인터페이스 (권장)**

1. MySQL 서비스 클릭
2. "Data" 탭 클릭
3. "Query" 버튼 클릭
4. 아래 SQL 실행 (또는 `backend/sql/schema.sql` 파일 내용 복사):

```sql
CREATE DATABASE IF NOT EXISTS rpa_schedule_db;
USE rpa_schedule_db;

CREATE TABLE IF NOT EXISTS bot_schedules (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  bot_id VARCHAR(100) NOT NULL,
  bot_name VARCHAR(100) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  body TEXT,
  process_id VARCHAR(100),
  source_system VARCHAR(50) DEFAULT 'MANUAL',
  status VARCHAR(20) DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_bot_id (bot_id),
  INDEX idx_start_datetime (start_datetime),
  INDEX idx_end_datetime (end_datetime),
  INDEX idx_process_id (process_id),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS rpa_processes (
  process_id INT AUTO_INCREMENT PRIMARY KEY,
  process_name VARCHAR(255) NOT NULL,
  process_type VARCHAR(50),
  bot_id VARCHAR(100),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sync_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL,
  sync_status VARCHAR(20) NOT NULL,
  records_synced INT DEFAULT 0,
  records_failed INT DEFAULT 0,
  error_message TEXT,
  sync_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  sync_completed_at TIMESTAMP NULL,
  INDEX idx_sync_type (sync_type),
  INDEX idx_sync_status (sync_status),
  INDEX idx_sync_started_at (sync_started_at)
);
```

### 4단계: 백엔드 서비스 추가

1. Railway 프로젝트에서 "New" 클릭
2. "GitHub Repo" 선택
3. 같은 저장소 선택: `youngjoonkim86/rpa_schedule`
4. "Settings" → "Root Directory" → `backend` 설정

### 5단계: 환경 변수 설정

백엔드 서비스의 "Variables" 탭에서:

**MySQL 연결 (Railway Variables 참조):**
```
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASSWORD=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
DB_CONNECTION_LIMIT=10
```

**기타 필수 환경 변수:**
```
BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
BRITY_RPA_TOKEN=your_brity_token_here
POWER_AUTOMATE_CREATE_URL=your_power_automate_create_url
POWER_AUTOMATE_QUERY_URL=your_power_automate_query_url
PORT=3000
HOST=0.0.0.0
NODE_ENV=production
REDIS_ENABLED=false
AUTO_REGISTER_TO_POWER_AUTOMATE=true
```

**CORS (Vercel 배포 후 추가):**
```
CORS_ORIGIN=https://your-frontend.vercel.app
```

### 6단계: 배포 확인

1. Railway 대시보드에서 배포 상태 확인
2. "Deployments" 탭에서 로그 확인
3. 배포 완료 후 "Settings" → "Generate Domain" 클릭하여 URL 확인
4. `https://your-backend.railway.app/health` 접속하여 헬스체크 확인

## ✅ 체크리스트

- [ ] Railway 프로젝트 생성
- [ ] MySQL 데이터베이스 추가
- [ ] MySQL 스키마 생성 완료
- [ ] 백엔드 서비스 추가
- [ ] Root Directory: `backend` 설정
- [ ] 환경 변수 설정 완료
- [ ] 배포 완료 및 헬스체크 성공

## 🔗 다음 단계

Railway 백엔드 배포 완료 후:
1. Vercel 프론트엔드 배포 (`DEPLOY_WITHOUT_NGROK.md` 참고)
2. CORS 설정 업데이트

