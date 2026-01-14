# MySQL 설치 가이드 (Windows)

## 현재 상황

Chocolatey로 자동 설치를 시도했지만 **관리자 권한**이 필요합니다.

## 설치 방법

### 방법 1: 관리자 권한으로 Chocolatey 설치 (가장 빠름)

1. **PowerShell을 관리자 권한으로 실행**:
   - 시작 메뉴에서 "PowerShell" 검색
   - "Windows PowerShell" 우클릭
   - **"관리자 권한으로 실행"** 선택

2. 다음 명령 실행:
   ```powershell
   cd E:\rpa\rpa-schedule-manager
   choco install mysql -y
   ```

3. 설치 완료 후 서비스 시작:
   ```powershell
   Start-Service MySQL80
   ```

### 방법 2: MySQL 공식 설치 프로그램 사용 (권장)

#### 1단계: 다운로드

브라우저에서 다음 주소로 이동:
```
https://dev.mysql.com/downloads/mysql/
```

**MySQL Installer for Windows** 선택 후:
- **Windows (x86, 64-bit), MSI Installer** 다운로드
- 또는 **ZIP Archive** 다운로드

#### 2단계: 설치

**MSI Installer 사용 시:**

1. 다운로드한 `.msi` 파일 실행
2. 설치 타입: **Custom** 또는 **Developer Default** 선택
3. 설치할 제품:
   - ✅ **MySQL Server 8.0.x** (필수)
   - ✅ MySQL Workbench (선택, GUI 도구)
4. **Execute** 클릭하여 설치

#### 3단계: 설정

1. **Config Type**: `Development Computer`
2. **Port**: `3306` (기본값)
3. **Authentication**: `Use Strong Password Encryption`
4. **Root Password**: **비밀번호 설정 (기억해두세요!)**
5. **Windows Service**: 
   - ✅ Configure MySQL Server as a Windows Service
   - Service Name: `MySQL80`
   - ✅ Start the MySQL Server at System Startup

#### 4단계: 설치 확인

```powershell
# MySQL 버전 확인
mysql --version

# 서비스 상태 확인
Get-Service MySQL80

# 서비스 시작 (필요한 경우)
Start-Service MySQL80
```

### 방법 3: MySQL Workbench 설치 (GUI 포함)

MySQL Workbench를 설치하면 MySQL Server도 함께 설치됩니다.

1. 다운로드: https://dev.mysql.com/downloads/workbench/
2. 설치 프로그램 실행
3. 설치 과정에서 MySQL Server도 함께 설치됨

## 설치 후 설정

### 1. .env 파일 업데이트

`backend/.env` 파일을 열어서 MySQL 비밀번호 설정:

```env
DB_PASSWORD=설치_시_설정한_비밀번호
```

### 2. 데이터베이스 초기화

```powershell
cd backend
npm run init-db
```

### 3. 서버 실행

```powershell
npm run dev
```

## 빠른 설치 (관리자 권한 PowerShell)

PowerShell을 **관리자 권한**으로 실행한 후:

```powershell
# 프로젝트 디렉토리로 이동
cd E:\rpa\rpa-schedule-manager

# MySQL 설치
choco install mysql -y

# 서비스 시작
Start-Service MySQL80

# 데이터베이스 초기화
cd backend
npm run init-db
```

## 문제 해결

### MySQL 서비스를 찾을 수 없습니다

```powershell
# 서비스 이름 확인
Get-Service | Where-Object {$_.DisplayName -like "*MySQL*"}

# 서비스 시작
Start-Service MySQL80
```

### 포트 3306 충돌

```powershell
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3306
```

### 비밀번호를 모르겠습니다

MySQL 설치 시 설정한 root 비밀번호를 사용하세요.
비밀번호를 잊었다면 MySQL 재설치 또는 비밀번호 재설정이 필요합니다.


