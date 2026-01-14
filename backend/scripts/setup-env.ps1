# .env 파일 설정 스크립트
# 사용법: .\scripts\setup-env.ps1

Write-Host "🔧 .env 파일 설정" -ForegroundColor Green
Write-Host ""

# .env 파일이 없으면 생성
if (-not (Test-Path .env)) {
    Write-Host "📄 .env 파일 생성 중..." -ForegroundColor Yellow
    Copy-Item .env.example .env -ErrorAction SilentlyContinue
    if (-not (Test-Path .env)) {
        Write-Host "❌ .env.example 파일을 찾을 수 없습니다." -ForegroundColor Red
        exit 1
    }
}

Write-Host "MySQL 설정을 입력하세요:" -ForegroundColor Cyan
Write-Host ""

# 현재 설정 읽기
$envContent = Get-Content .env -Raw

# 비밀번호 입력
$password = Read-Host "MySQL root 비밀번호 (없으면 Enter)" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# 비밀번호 업데이트
if ($plainPassword) {
    $envContent = $envContent -replace "DB_PASSWORD=.*", "DB_PASSWORD=$plainPassword"
    Set-Content .env -Value $envContent -NoNewline
    Write-Host "✅ DB_PASSWORD가 설정되었습니다." -ForegroundColor Green
} else {
    Write-Host "⚠️  비밀번호가 설정되지 않았습니다. (비밀번호 없이 시도)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "다음 단계:" -ForegroundColor Cyan
Write-Host "  1. MySQL 서비스가 실행 중인지 확인: Get-Service MySQL*" -ForegroundColor White
Write-Host "  2. 데이터베이스 초기화: npm run init-db" -ForegroundColor White
Write-Host ""


