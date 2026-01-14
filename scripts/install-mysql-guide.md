# MySQL 설치 가이드 (Windows)

## 방법 1: MySQL 공식 설치 프로그램 (권장)

### 1단계: 다운로드

1. 브라우저에서 다음 주소 접속:
   ```
   https://dev.mysql.com/downloads/mysql/
   ```

2. **MySQL Installer for Windows** 선택
3. **Windows (x86, 64-bit), MSI Installer** 다운로드
   - 또는 **ZIP Archive** 다운로드 (수동 설치)

### 2단계: 설치

#### MSI Installer 사용 시:

1. 다운로드한 `.msi` 파일 실행
2. 설치 타입 선택: **Custom** (권장) 또는 **Developer Default**
3. 설치할 제품 선택:
   - ✅ MySQL Server 8.0.x
   - ✅ MySQL Workbench (선택사항, GUI 도구)
   - ✅ MySQL Shell (선택사항)
4. **Execute** 클릭하여 설치 진행

#### 설치 설정:

1. **Config Type**: `Development Computer` 선택
2. **Connectivity**: 
   - Port: `3306` (기본값)
   - ✅ TCP/IP 체크
3. **Authentication Method**: 
   - `Use Strong Password Encryption` 선택
4. **Accounts and Roles**:
   - Root Password 설정: **기억해두세요!**
   - ✅ Add User (선택사항)
5. **Windows Service**:
   - ✅ Configure MySQL Server as a Windows Service 체크
   - Service Name: `MySQL80` (기본값)
   - ✅ Start the MySQL Server at System Startup 체크
6. **Apply Configuration** 클릭

### 3단계: 설치 확인

```powershell
# MySQL 버전 확인
mysql --version

# MySQL 서비스 상태 확인
Get-Service MySQL80

# MySQL 서비스 시작 (필요한 경우)
Start-Service MySQL80
```

### 4단계: 연결 테스트

```powershell
# MySQL 접속 테스트
mysql -u root -p
# 비밀번호 입력 후 접속 확인

# MySQL 종료
exit
```

## 방법 2: Chocolatey 사용 (자동화)

### 1단계: Chocolatey 설치

PowerShell을 **관리자 권한**으로 실행 후:

```powershell
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
```

### 2단계: MySQL 설치

```powershell
choco install mysql -y
```

### 3단계: MySQL 서비스 시작

```powershell
Start-Service MySQL80
```

## 방법 3: ZIP Archive (수동 설치)

### 1단계: 다운로드 및 압축 해제

1. MySQL ZIP Archive 다운로드
2. `C:\mysql` 또는 원하는 위치에 압축 해제

### 2단계: 설정 파일 생성

`C:\mysql\my.ini` 파일 생성:

```ini
[mysqld]
basedir=C:/mysql
datadir=C:/mysql/data
port=3306
```

### 3단계: 초기화 및 설치

```powershell
cd C:\mysql\bin
.\mysqld --initialize-insecure
.\mysqld --install MySQL80
```

### 4단계: 서비스 시작

```powershell
Start-Service MySQL80
```

## 설치 후 설정

### 1. 환경 변수 설정 (선택사항)

시스템 환경 변수 `Path`에 추가:
```
C:\Program Files\MySQL\MySQL Server 8.0\bin
```

### 2. root 비밀번호 설정

```powershell
mysql -u root
```

MySQL 프롬프트에서:

```sql
ALTER USER 'root'@'localhost' IDENTIFIED BY 'your_password';
FLUSH PRIVILEGES;
exit;
```

### 3. .env 파일 업데이트

`backend/.env` 파일에서:

```env
DB_PASSWORD=your_password
```

## 문제 해결

### MySQL 서비스를 찾을 수 없습니다

```powershell
# 서비스 이름 확인
Get-Service | Where-Object {$_.DisplayName -like "*MySQL*"}

# 서비스 시작
Start-Service MySQL80
# 또는
net start MySQL80
```

### 포트 3306이 이미 사용 중입니다

```powershell
# 포트 사용 중인 프로세스 확인
netstat -ano | findstr :3306

# 프로세스 종료 (PID 확인 후)
taskkill /PID <PID번호> /F
```

### 비밀번호를 잊었습니다

1. MySQL 서비스 중지
2. `--skip-grant-tables` 옵션으로 시작
3. 비밀번호 재설정
4. 서비스 재시작

자세한 내용은 MySQL 공식 문서를 참고하세요.


