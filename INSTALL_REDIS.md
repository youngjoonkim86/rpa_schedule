# Redis 설치 가이드

Redis는 캐싱을 위한 선택사항입니다. 설치하지 않아도 서버는 정상 작동합니다.

## Windows에서 Redis 설치

### 방법 1: Chocolatey 사용 (권장)

관리자 권한 PowerShell에서:

```powershell
choco install redis-64 -y
```

설치 후 Redis 서비스 시작:

```powershell
redis-server --service-install
redis-server --service-start
```

### 방법 2: 수동 설치

1. [Redis for Windows 다운로드](https://github.com/microsoftarchive/redis/releases)
2. 압축 해제 후 `redis-server.exe` 실행
3. 또는 Windows 서비스로 설치

### 방법 3: WSL2 사용

WSL2에서 Redis 설치:

```bash
sudo apt update
sudo apt install redis-server -y
sudo service redis-server start
```

## Redis 비활성화 (설치하지 않으려면)

`.env` 파일에 다음 추가:

```env
REDIS_ENABLED=false
```

## Redis 상태 확인

```powershell
redis-cli ping
```

응답: `PONG` (정상)

## Redis 서비스 관리

### 서비스 시작
```powershell
redis-server --service-start
```

### 서비스 중지
```powershell
redis-server --service-stop
```

### 서비스 제거
```powershell
redis-server --service-uninstall
```

## 문제 해결

### Redis 연결 실패 시

1. Redis가 실행 중인지 확인:
   ```powershell
   Get-Service redis*
   ```

2. 포트 확인:
   ```powershell
   netstat -an | findstr 6379
   ```

3. 방화벽 확인:
   - Windows 방화벽에서 포트 6379 허용

4. Redis 비활성화:
   - `.env`에 `REDIS_ENABLED=false` 추가

## 참고

- Redis는 **선택사항**입니다
- Redis 없이도 서버는 정상 작동합니다
- Redis는 캐싱 성능 향상을 위한 것입니다


