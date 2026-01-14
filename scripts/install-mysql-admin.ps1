# MySQL 설치 스크립트 (관리자 권한 필요)
# PowerShell을 관리자 권한으로 실행 후 이 스크립트 실행

Write-Host "🔧 MySQL 설치 스크립트" -ForegroundColor Green
Write-Host ""

# 관리자 권한 확인
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "❌ 이 스크립트는 관리자 권한이 필요합니다." -ForegroundColor Red
    Write-Host ""
    Write-Host "💡 해결 방법:" -ForegroundColor Yellow
    Write-Host "  1. 시작 메뉴에서 'PowerShell' 검색" -ForegroundColor White
    Write-Host "  2. 'Windows PowerShell' 우클릭" -ForegroundColor White
    Write-Host "  3. '관리자 권한으로 실행' 선택" -ForegroundColor White
    Write-Host "  4. 이 스크립트 다시 실행" -ForegroundColor White
    Write-Host ""
    Write-Host "또는 수동 설치:" -ForegroundColor Cyan
    Write-Host "  https://dev.mysql.com/downloads/mysql/" -ForegroundColor White
    exit 1
}

Write-Host "✅ 관리자 권한 확인됨" -ForegroundColor Green
Write-Host ""

# Chocolatey 확인
$chocoInstalled = $false
try {
    $null = choco --version 2>$null
    $chocoInstalled = $true
    Write-Host "✅ Chocolatey 발견" -ForegroundColor Green
} catch {
    $chocoInstalled = $false
    Write-Host "⚠️  Chocolatey가 설치되어 있지 않습니다." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Chocolatey 설치 중..." -ForegroundColor Cyan
    Set-ExecutionPolicy Bypass -Scope Process -Force
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
    iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))
    $chocoInstalled = $true
}

if ($chocoInstalled) {
    Write-Host ""
    Write-Host "📦 MySQL 설치 중... (시간이 걸릴 수 있습니다)" -ForegroundColor Cyan
    Write-Host ""
    
    choco install mysql -y
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ MySQL 설치 완료!" -ForegroundColor Green
        Write-Host ""
        
        # 서비스 시작 시도
        Write-Host "🔄 MySQL 서비스 시작 중..." -ForegroundColor Cyan
        try {
            Start-Service MySQL80 -ErrorAction Stop
            Write-Host "✅ MySQL 서비스 시작 완료" -ForegroundColor Green
        } catch {
            Write-Host "⚠️  서비스 시작 실패 (수동으로 시작 필요)" -ForegroundColor Yellow
            Write-Host "   명령: Start-Service MySQL80" -ForegroundColor White
        }
        
        Write-Host ""
        Write-Host "다음 단계:" -ForegroundColor Cyan
        Write-Host "  1. MySQL root 비밀번호 확인 (설치 시 설정한 비밀번호)" -ForegroundColor White
        Write-Host "  2. backend/.env 파일에서 DB_PASSWORD 설정" -ForegroundColor White
        Write-Host "  3. 데이터베이스 초기화: cd backend && npm run init-db" -ForegroundColor White
    } else {
        Write-Host ""
        Write-Host "❌ MySQL 설치 실패" -ForegroundColor Red
        Write-Host ""
        Write-Host "수동 설치 방법:" -ForegroundColor Yellow
        Write-Host "  https://dev.mysql.com/downloads/mysql/" -ForegroundColor White
    }
}

Write-Host ""


