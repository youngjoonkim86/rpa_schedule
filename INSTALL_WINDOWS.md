# Windows 설치 가이드

## MySQL 스키마 실행 방법

PowerShell에서는 `<` 리다이렉션이 다르게 작동하므로 다음 방법 중 하나를 사용하세요:

### 방법 1: 배치 파일 사용 (권장)

```powershell
cd backend\sql
.\run_schema.bat
```

비밀번호를 입력하라는 프롬프트가 나타나면 MySQL root 비밀번호를 입력하세요.

### 방법 2: PowerShell 스크립트 사용

```powershell
cd backend\sql
.\run_schema.ps1
```

### 방법 3: MySQL 명령어 직접 실행

```powershell
# MySQL 접속
mysql -u root -p

# MySQL 프롬프트에서 실행
USE rpa_schedule_db;
SOURCE schema.sql;
```

또는:

```powershell
Get-Content backend\sql\schema.sql | mysql -u root -p
```

### 방법 4: MySQL Workbench 사용

1. MySQL Workbench 실행
2. `backend/sql/schema.sql` 파일 열기
3. 전체 스크립트 실행 (Ctrl+Shift+Enter)

## MySQL 연결 문제 해결

### 1. MySQL 서비스 확인

```powershell
# 서비스 확인
Get-Service MySQL*

# 서비스 시작 (필요한 경우)
Start-Service MySQL80
```

또는:

```cmd
net start MySQL80
```

### 2. .env 파일 확인

`backend/.env` 파일이 존재하고 다음 설정이 올바른지 확인:

```env
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_actual_password
DB_NAME=rpa_schedule_db
```

### 3. 데이터베이스 생성 확인

```powershell
mysql -u root -p
```

MySQL 프롬프트에서:

```sql
SHOW DATABASES;
-- rpa_schedule_db가 있는지 확인

-- 없으면 생성
CREATE DATABASE IF NOT EXISTS rpa_schedule_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;
```

### 4. 연결 테스트

```powershell
mysql -u root -p -D rpa_schedule_db -e "SELECT 1;"
```

## 서버 실행

MySQL 연결이 실패해도 서버는 계속 실행됩니다 (일부 기능 제한).

```powershell
cd backend
npm run dev
```

서버가 시작되면:
- MySQL 연결 성공 시: 모든 기능 사용 가능
- MySQL 연결 실패 시: API는 작동하지만 데이터베이스 기능은 사용 불가

## 다음 단계

1. MySQL 스키마 실행
2. `.env` 파일 설정 확인
3. 서버 재시작
4. `http://localhost:3000/health` 접속하여 상태 확인


