# 빠른 시작 가이드

## Windows에서 MySQL 스키마 실행하기

### 문제: PowerShell에서 `<` 리다이렉션 오류

PowerShell에서는 `<` 연산자가 다르게 작동합니다. 다음 방법을 사용하세요:

### 해결 방법 1: 배치 파일 사용 (가장 쉬움)

```powershell
cd backend\sql
.\run_schema.bat
```

비밀번호를 입력하라는 프롬프트가 나타나면 MySQL root 비밀번호를 입력하세요.

### 해결 방법 2: Get-Content 사용

```powershell
Get-Content backend\sql\schema.sql | mysql -u root -p
```

### 해결 방법 3: MySQL Workbench 사용

1. MySQL Workbench 실행
2. `backend/sql/schema.sql` 파일 열기
3. 전체 스크립트 실행 (Ctrl+Shift+Enter)

## MySQL 연결 문제 해결

### 1. .env 파일 생성 및 설정

```powershell
cd backend
copy .env.example .env
```

`.env` 파일을 열어서 다음을 수정:

```env
DB_PASSWORD=실제_MySQL_비밀번호
```

### 2. MySQL 서비스 확인

```powershell
# 서비스 확인
Get-Service MySQL*

# 서비스 시작 (필요한 경우)
Start-Service MySQL80
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

### 4. 서버 재시작

```powershell
cd backend
npm run dev
```

이제 MySQL 연결이 성공하면:
```
✅ MySQL 데이터베이스 연결 성공
🚀 서버가 포트 3000에서 실행 중입니다.
```

## 다음 단계

1. ✅ MySQL 스키마 실행 완료
2. ✅ .env 파일 설정 완료
3. ✅ 서버 실행 확인
4. 프론트엔드 실행 (새 터미널)

```powershell
cd frontend
npm install
npm run dev
```

5. 브라우저에서 `http://localhost:5173` 접속


