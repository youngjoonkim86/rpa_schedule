# ngrok을 사용한 로컬 DB 외부 접근 설정

## 1. ngrok 설치

### Windows (Chocolatey)
```powershell
choco install ngrok
```

### 수동 설치
1. [ngrok.com](https://ngrok.com)에서 다운로드
2. 압축 해제 후 PATH에 추가

## 2. ngrok 계정 생성 및 인증

1. [ngrok.com](https://ngrok.com)에서 무료 계정 생성
2. 인증 토큰 받기
3. 토큰 설정:
   ```bash
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

## 3. MySQL 터널링

### 방법 1: TCP 터널 (권장)

```bash
ngrok tcp 3306
```

출력 예시:
```
Forwarding  tcp://0.tcp.ngrok.io:12345 -> localhost:3306
```

**환경 변수 설정:**
```
DB_HOST=0.tcp.ngrok.io
DB_PORT=12345
```

### 방법 2: HTTP 터널 (MySQL Workbench 등에서 사용)

```bash
ngrok http 3306
```

## 4. 백엔드 서버 터널링

```bash
ngrok http 3000
```

출력 예시:
```
Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

**프론트엔드 환경 변수:**
```
VITE_API_URL=https://abc123.ngrok.io/api
```

## 5. ngrok 세션 유지

### Windows (PowerShell 스크립트)

`start-ngrok.ps1` 파일 생성:
```powershell
# MySQL 터널
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok tcp 3306"

# 백엔드 터널 (선택사항)
Start-Process powershell -ArgumentList "-NoExit", "-Command", "ngrok http 3000"
```

## 6. 주의사항

1. **무료 계정 제한**: 
   - 연결 시간 제한 (8시간)
   - URL이 재시작 시마다 변경됨

2. **고정 URL 사용 (유료)**:
   ```bash
   ngrok http 3000 --domain=your-fixed-domain.ngrok.io
   ```

3. **보안**:
   - ngrok URL을 공개하지 마세요
   - DB 비밀번호를 강력하게 설정하세요

## 7. 자동 재연결 스크립트

`keep-ngrok-alive.ps1`:
```powershell
while ($true) {
    $process = Get-Process ngrok -ErrorAction SilentlyContinue
    if (-not $process) {
        Write-Host "ngrok 재시작 중..."
        Start-Process ngrok -ArgumentList "tcp 3306" -WindowStyle Minimized
    }
    Start-Sleep -Seconds 60
}
```

