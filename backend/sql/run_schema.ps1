# PowerShell 스크립트로 MySQL 스키마 실행
# 사용법: .\run_schema.ps1

$mysqlPath = "mysql"
$user = "root"
$database = "rpa_schedule_db"
$schemaFile = "schema.sql"

Write-Host "MySQL 스키마 실행 중..." -ForegroundColor Green

# MySQL 비밀번호 입력
$password = Read-Host "MySQL root 비밀번호를 입력하세요" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$plainPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

# 스키마 파일 내용 읽기
$schemaContent = Get-Content $schemaFile -Raw -Encoding UTF8

# MySQL 실행
$schemaContent | & $mysqlPath -u $user -p$plainPassword

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 스키마 실행 완료!" -ForegroundColor Green
} else {
    Write-Host "❌ 스키마 실행 실패" -ForegroundColor Red
}


