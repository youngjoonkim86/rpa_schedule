# Cloudflare Tunnel 시작 스크립트 (로컬 MySQL)

Write-Host "🚀 Cloudflare Tunnel 시작 중..." -ForegroundColor Green
Write-Host ""

# 로컬 MySQL 실행 확인
$mysqlProcess = Get-Process mysqld -ErrorAction SilentlyContinue
if (-not $mysqlProcess) {
    Write-Host "⚠️ 경고: MySQL이 실행 중이지 않을 수 있습니다." -ForegroundColor Yellow
    Write-Host "   MySQL 서비스를 시작하세요." -ForegroundColor Yellow
    Write-Host ""
}

# Cloudflared 설치 확인
$cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
if (-not $cloudflared) {
    Write-Host "❌ Cloudflared가 설치되어 있지 않습니다." -ForegroundColor Red
    Write-Host "   설치: choco install cloudflared -y" -ForegroundColor Yellow
    Write-Host "   또는: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/" -ForegroundColor Yellow
    exit 1
}

# Tunnel 실행
Write-Host "📡 Cloudflare Tunnel 실행 중..." -ForegroundColor Cyan
Write-Host "   (터널이 실행되면 연결 정보가 표시됩니다)" -ForegroundColor Gray
Write-Host ""

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cloudflared tunnel run rpa-mysql" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "✅ Cloudflare Tunnel 시작 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "📋 다음 단계:" -ForegroundColor Yellow
Write-Host "1. 새로 열린 PowerShell 창에서 연결 정보 확인" -ForegroundColor White
Write-Host "2. Railway/Render 환경 변수에 다음 설정:" -ForegroundColor White
Write-Host "   DB_HOST=xxxxx.trycloudflare.com (터널에서 표시된 호스트)" -ForegroundColor Cyan
Write-Host "   DB_PORT=3306" -ForegroundColor Cyan
Write-Host "   DB_USER=root" -ForegroundColor Cyan
Write-Host "   DB_PASSWORD=your_local_mysql_password" -ForegroundColor Cyan
Write-Host "   DB_NAME=rpa_schedule_db" -ForegroundColor Cyan
Write-Host ""
Write-Host "⚠️ 중요: 터널이 실행 중이어야 Railway/Render에서 접근 가능합니다." -ForegroundColor Yellow

