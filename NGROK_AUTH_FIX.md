# ngrok 인증 토큰 오류 해결

## 문제
```
ERROR: authentication failed: The authtoken you specified does not look like a proper ngrok authtoken.
```

## 해결 방법

### 1. 올바른 토큰 가져오기

1. https://dashboard.ngrok.com/get-started/your-authtoken 접속
2. 로그인 (또는 무료 계정 생성)
3. **"Your Authtoken"** 섹션에서 토큰 복사
   - 토큰은 보통 `2`로 시작하는 긴 문자열입니다
   - 예: `2abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567`

### 2. 토큰 설정

PowerShell에서 실행:
```powershell
ngrok config add-authtoken YOUR_ACTUAL_TOKEN
```

**중요**: 
- `YOUR_ACTUAL_TOKEN`을 대시보드에서 복사한 실제 토큰으로 변경
- 토큰 전체를 정확히 복사해야 합니다
- 공백이나 줄바꿈이 포함되지 않도록 주의

### 3. 확인

```powershell
ngrok version
```

성공하면 버전 정보가 표시됩니다.

### 4. 터널 재시작

토큰 설정 후:
```powershell
.\start-ngrok.ps1
```

## 토큰 형식

올바른 ngrok 토큰은:
- 보통 `2`로 시작
- 약 40-50자 정도의 문자열
- 하이픈이나 특수문자 없음 (영문자와 숫자만)

## 문제가 계속되면

1. ngrok 대시보드에서 새 토큰 생성
2. 기존 설정 삭제:
   ```powershell
   Remove-Item $env:USERPROFILE\.ngrok2\ngrok.yml -ErrorAction SilentlyContinue
   ```
3. 새 토큰으로 다시 설정

