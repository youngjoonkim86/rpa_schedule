# MySQL 설치 안내

## ⚠️ 중요: 관리자 권한 필요

MySQL 설치를 위해서는 **PowerShell을 관리자 권한으로 실행**해야 합니다.

## 빠른 설치 (관리자 권한 PowerShell)

1. **PowerShell을 관리자 권한으로 실행**:
   - 시작 메뉴 → "PowerShell" 검색
   - "Windows PowerShell" **우클릭**
   - **"관리자 권한으로 실행"** 선택

2. 다음 명령 실행:

```powershell
# 프로젝트 디렉토리로 이동
cd E:\rpa\rpa-schedule-manager

# MySQL 설치 스크립트 실행
.\scripts\install-mysql-admin.ps1
```

또는 직접 Chocolatey로 설치:

```powershell
choco install mysql -y
Start-Service MySQL80
```

## 수동 설치 (권장)

관리자 권한 없이도 설치 가능:

1. **MySQL 다운로드**: https://dev.mysql.com/downloads/mysql/
2. **MySQL Installer for Windows** 다운로드
3. 설치 프로그램 실행 및 설치 진행
4. 설치 시 **root 비밀번호 설정** (기억해두세요!)

## 설치 후 설정

### 1. .env 파일 업데이트

`backend/.env` 파일을 열어서:

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

## 자세한 가이드

- `INSTALL_MYSQL.md` - 상세 설치 가이드
- `TROUBLESHOOTING.md` - 문제 해결 가이드


