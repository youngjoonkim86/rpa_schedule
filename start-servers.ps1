# RPA 스케줄 관리 시스템 서버 시작 스크립트

Write-Host "🛑 기존 서버(포트 기준) 종료 중..." -ForegroundColor Yellow

function Stop-ProcessByPort {
  param(
    [Parameter(Mandatory=$true)][int]$Port
  )

  try {
    $pids = netstat -ano | Select-String (":$Port") | Select-String "LISTENING" | ForEach-Object {
      ($_ -split "\s+")[-1]
    } | Sort-Object -Unique

    if ($pids -and $pids.Count -gt 0) {
      foreach ($procId in $pids) {
        try {
          taskkill /F /PID $procId | Out-Null
          Write-Host " - 포트 $Port 종료: PID $procId" -ForegroundColor DarkYellow
        } catch {
          Write-Host " - 포트 $Port 종료 실패: PID $procId ($($_.Exception.Message))" -ForegroundColor Red
        }
      }
    } else {
      Write-Host " - 포트 $Port: 종료할 프로세스 없음" -ForegroundColor DarkGray
    }
  } catch {
    Write-Host " - 포트 $Port 프로세스 조회 실패: $($_.Exception.Message)" -ForegroundColor Red
  }
}

# ⚠️ node.exe 전체 Kill은 cloudflared/Vite/다른 작업까지 같이 죽일 수 있어 위험합니다.
# 필요한 포트(백엔드 3000, 프론트 5173)만 정리합니다.
Stop-ProcessByPort -Port 3000
Stop-ProcessByPort -Port 5173
Start-Sleep -Seconds 2

Write-Host "🚀 백엔드 서버 시작 중..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\backend'; npm run dev" -WindowStyle Normal

Start-Sleep -Seconds 3

Write-Host "🚀 프론트엔드 서버 시작 중..." -ForegroundColor Green
# npm run dev에 인자 전달이 환경에 따라 깨질 수 있어, npx vite로 명시 실행
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$PSScriptRoot\frontend'; npx --yes vite --host 0.0.0.0 --port 5173" -WindowStyle Normal

Write-Host "✅ 서버 시작 완료!" -ForegroundColor Green
Write-Host "📍 백엔드: http://localhost:3000" -ForegroundColor Cyan
Write-Host "📍 프론트엔드: http://localhost:5173" -ForegroundColor Cyan
Write-Host ""
Write-Host "각 서버의 로그는 별도 PowerShell 창에서 확인할 수 있습니다." -ForegroundColor Yellow

