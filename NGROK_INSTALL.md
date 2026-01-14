# ngrok 수동 설치 가이드

## Windows에서 ngrok 설치

### 방법 1: 직접 다운로드 (권장)

1. https://ngrok.com/download 접속
2. Windows용 ZIP 파일 다운로드
3. 압축 해제 (예: `C:\ngrok\`)
4. 환경 변수 PATH에 추가:
   ```powershell
   # PowerShell (관리자 권한)
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\ngrok", "User")
   ```
5. 새 PowerShell 창에서 확인:
   ```powershell
   ngrok version
   ```

### 방법 2: Chocolatey (관리자 권한 필요)

```powershell
# PowerShell을 관리자 권한으로 실행
choco install ngrok -y
```

## ngrok 인증 설정

1. https://ngrok.com 에서 무료 계정 생성
2. https://dashboard.ngrok.com/get-started/your-authtoken 접속
3. 대시보드에서 **올바른 인증 토큰** 복사 (전체 토큰을 정확히 복사)
4. 토큰 설정:
   ```powershell
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```
   ⚠️ **주의**: `YOUR_AUTH_TOKEN`을 대시보드에서 복사한 실제 토큰으로 변경하세요!

## 확인

```powershell
ngrok version
```

설치가 완료되면 `start-ngrok.ps1` 스크립트를 실행하세요.

