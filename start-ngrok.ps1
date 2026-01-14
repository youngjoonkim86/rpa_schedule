# ngrok 터널 시작 스크립트

Write-Host "🚀 ngrok 터널 시작 중..." -ForegroundColor Green

# MySQL 터널 (포트 3306)
Write-Host "📊 MySQL 터널 시작 (포트 3306)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok tcp 3306" -WindowStyle Normal

Start-Sleep -Seconds 2

# 백엔드 서버 터널 (포트 3000) - 선택사항
Write-Host "🔧 백엔드 서버 터널 시작 (포트 3000)..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 3000" -WindowStyle Normal

Write-Host "✅ ngrok 터널 시작 완료!" -ForegroundColor Green
Write-Host ""
Write-Host "각 PowerShell 창에서 ngrok URL을 확인하세요:" -ForegroundColor Yellow
Write-Host "  - MySQL: tcp://0.tcp.ngrok.io:XXXXX" -ForegroundColor Cyan
Write-Host "  - Backend: https://XXXXX.ngrok.io" -ForegroundColor Cyan
Write-Host ""
Write-Host "이 URL들을 환경 변수에 설정하세요:" -ForegroundColor Yellow
Write-Host "  - DB_HOST: 0.tcp.ngrok.io" -ForegroundColor White
Write-Host "  - DB_PORT: XXXXX (ngrok에서 표시된 포트)" -ForegroundColor White
Write-Host "  - VITE_API_URL: https://XXXXX.ngrok.io/api" -ForegroundColor White

