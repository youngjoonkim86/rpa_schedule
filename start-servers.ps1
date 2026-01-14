# RPA 스케줄 관리 시스템 서버 시작 스크립트

Write-Host "🛑 기존 Node.js 프로세스 종료 중..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "🚀 백엔드 서버 시작 중..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "🚀 프론트엔드 서버 시작 중..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npm run dev" -WindowStyle Normal

Write-Host "✅ 서버 시작 완료!" -ForegroundColor Green
Write-Host "📍 백엔드: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📍 프론트엔드: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "각 서버의 로그는 별도 PowerShell 창에서 확인할 수 있습니다." -ForegroundColor Yellow

