# MySQL 설치 스크립트 (Windows)
# 관리자 권한으로 실행 필요

Write-Host "🔧 MySQL 설치 스크립트" -ForegroundColor Green
Write-Host ""

# 관리자 권한 확인
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 이 스크립트는 관리자 권한이 필요합니다." -ForegroundColor Red
    Write-Host "💡 PowerShell을 관리자 권한으로 실행한 후 다시 시도하세요." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "방법:" -ForegroundColor Cyan
    Write-Host "  1. 시작 메뉴에서 PowerShell 검색" -ForegroundColor White
    Write-Host "  2. 'Windows PowerShell' 우클릭" -ForegroundColor White
    Write-Host "  3. '관리자 권한으로 실행' 선택" -ForegroundColor White
    exit 1
}

Write-Host "✅ 관리자 권한 확인됨" -ForegroundColor Green
Write-Host ""

# Chocolatey 확인
$chocoInstalled = $false
try {
    $chocoVersion = choco --version 2>$null
    if ($chocoVersion) {
        $chocoInstalled = $true
        Write-Host "✅ Chocolatey 발견: v$chocoVersion" -ForegroundColor Green
    }
} catch {
    $chocoInstalled = $false
}

if ($chocoInstalled) {
    Write-Host ""
    Write-Host "📦 Chocolatey를 사용하여 MySQL 설치" -ForegroundColor Cyan
    Write-Host ""
    
    $install = Read-Host "MySQL을 설치하시겠습니까? (Y/N)"
    if ($install -eq 'Y' -or $install -eq 'y') {
        Write-Host "MySQL 설치 중... (시간이 걸릴 수 있습니다)" -ForegroundColor Yellow
        choco install mysql -y
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ MySQL 설치 완료!" -ForegroundColor Green
            Write-Host ""
            Write-Host "다음 단계:" -ForegroundColor Cyan
            Write-Host "  1. MySQL 서비스 시작: Start-Service MySQL80" -ForegroundColor White
            Write-Host "  2. MySQL root 비밀번호 설정 필요" -ForegroundColor White
        } else {
            Write-Host "❌ MySQL 설치 실패" -ForegroundColor Red
        }
    }
} else {
    Write-Host "⚠️  Chocolatey가 설치되어 있지 않습니다." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "MySQL 설치 방법:" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "방법 1: Chocolatey 설치 후 MySQL 설치 (권장)" -ForegroundColor Green
    Write-Host "  1. Chocolatey 설치:" -ForegroundColor White
    Write-Host "     Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))" -ForegroundColor Gray
    Write-Host "  2. 이 스크립트 다시 실행" -ForegroundColor White
    Write-Host ""
    Write-Host "방법 2: MySQL 공식 설치 프로그램 사용" -ForegroundColor Green
    Write-Host "  1. 다운로드: https://dev.mysql.com/downloads/mysql/" -ForegroundColor White
    Write-Host "  2. MySQL Installer for Windows 다운로드" -ForegroundColor White
    Write-Host "  3. 설치 프로그램 실행 및 설치 진행" -ForegroundColor White
    Write-Host ""
    Write-Host "방법 3: MySQL Workbench 사용 (GUI)" -ForegroundColor Green
    Write-Host "  1. MySQL Workbench 다운로드 및 설치" -ForegroundColor White
    Write-Host "  2. 설치 과정에서 MySQL Server도 함께 설치됨" -ForegroundColor White
    Write-Host ""
    
    $openBrowser = Read-Host "MySQL 다운로드 페이지를 열까요? (Y/N)"
    if ($openBrowser -eq 'Y' -or $openBrowser -eq 'y') {
        Start-Process "https://dev.mysql.com/downloads/mysql/"
    }
}

Write-Host ""
Write-Host "설치 완료 후 다음 명령으로 서비스 시작:" -ForegroundColor Cyan
Write-Host "  Start-Service MySQL80" -ForegroundColor White
Write-Host ""


