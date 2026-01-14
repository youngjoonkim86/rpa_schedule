# Cloudflare Tunnel 설정 가이드 (로컬 MySQL)

## 🆓 완전 무료, 카드 불필요

## 1단계: Cloudflared 설치

### Windows (Chocolatey)
```powershell
choco install cloudflared -y
```

### 수동 설치
1. https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/ 접속
2. Windows용 다운로드
3. 압축 해제 후 PATH에 추가

### 확인
```powershell
cloudflared --version
```

## 2단계: Cloudflare 계정 생성

1. https://cloudflare.com 접속
2. "Sign Up" 클릭
3. 무료 계정 생성 (이메일 인증)

## 3단계: Cloudflare Tunnel 로그인

```powershell
cloudflared tunnel login
```

브라우저가 열리면 Cloudflare 계정으로 로그인하고 도메인 선택

## 4단계: Tunnel 생성

```powershell
cloudflared tunnel create rpa-mysql
```

출력 예시:
```
Created tunnel rpa-mysql with id xxxxx-xxxxx-xxxxx
```

## 5단계: Config 파일 생성

터널 ID를 확인한 후 config 파일 생성:

```powershell
# config 파일 위치: %USERPROFILE%\.cloudflared\config.yml
```

config.yml 내용:
```yaml
tunnel: xxxxx-xxxxx-xxxxx  # 위에서 생성한 tunnel id
credentials-file: %USERPROFILE%\.cloudflared\xxxxx-xxxxx-xxxxx.json

ingress:
  - hostname: rpa-mysql.your-domain.com  # 선택사항: 커스텀 도메인
    service: tcp://localhost:3306
  - service: http_status:404
```

## 6단계: Tunnel 실행

```powershell
cloudflared tunnel run rpa-mysql
```

또는 config 파일 사용:
```powershell
cloudflared tunnel --config %USERPROFILE%\.cloudflared\config.yml run rpa-mysql
```

출력 예시:
```
+--------------------------------------------------------------------------------------------+
|  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable): |
|  https://xxxxx.trycloudflare.com                                                          |
+--------------------------------------------------------------------------------------------+
```

## 7단계: Railway/Render 환경 변수 설정

Cloudflare Tunnel이 제공하는 호스트와 포트를 사용:

```
DB_HOST=xxxxx.trycloudflare.com
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_local_mysql_password
DB_NAME=rpa_schedule_db
```

## 8단계: 자동 시작 스크립트

`start-cloudflare-tunnel.ps1` 파일 생성:

```powershell
# Cloudflare Tunnel 시작 스크립트
Write-Host "🚀 Cloudflare Tunnel 시작 중..." -ForegroundColor Green

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cloudflared tunnel run rpa-mysql" -WindowStyle Normal

Write-Host "✅ Cloudflare Tunnel 시작 완료!" -ForegroundColor Green
Write-Host "연결 정보를 Railway/Render 환경 변수에 설정하세요." -ForegroundColor Yellow
```

## ⚠️ 주의사항

1. **터널 유지**: Railway/Render에서 접근하려면 터널이 계속 실행되어야 함
2. **로컬 MySQL 실행**: 로컬 MySQL 서비스가 실행 중이어야 함
3. **방화벽**: 로컬 방화벽에서 MySQL 포트(3306)를 차단하는 것을 권장

## 🔧 문제 해결

### Tunnel 연결 실패
- 로컬 MySQL이 실행 중인지 확인
- 방화벽 설정 확인
- Cloudflare 로그 확인

### Railway/Render에서 연결 실패
- Tunnel이 실행 중인지 확인
- 환경 변수 확인
- Cloudflare 대시보드에서 터널 상태 확인

## 📝 체크리스트

- [ ] Cloudflared 설치 완료
- [ ] Cloudflare 계정 생성 완료
- [ ] Tunnel 로그인 완료
- [ ] Tunnel 생성 완료
- [ ] Tunnel 실행 중
- [ ] Railway/Render 환경 변수 설정 완료
- [ ] 연결 테스트 완료

