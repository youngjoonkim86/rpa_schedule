@echo off
REM Windows 배치 파일로 MySQL 스키마 실행
REM 사용법: run_schema.bat

echo MySQL 스키마 실행 중...
mysql -u root -p rpa_schedule_db < schema.sql

if %ERRORLEVEL% EQU 0 (
    echo ✅ 스키마 실행 완료!
) else (
    echo ❌ 스키마 실행 실패
    pause
)


