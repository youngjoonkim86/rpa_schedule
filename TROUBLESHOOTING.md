# 문제 해결 가이드

## 백엔드 서버 연결 오류 (ERR_CONNECTION_REFUSED)

### 증상
- 프론트엔드에서 `ERR_CONNECTION_REFUSED` 오류 발생
- API 요청이 실패함

### 해결 방법

1. **백엔드 서버 실행 확인**
   ```powershell
   # 백엔드 디렉토리로 이동
   cd E:\rpa\rpa-schedule-manager\backend
   
   # 서버 실행
   npm run dev
   ```

2. **서버가 실행 중인지 확인**
   ```powershell
   # 헬스체크
   Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing
   ```

3. **포트 충돌 확인**
   ```powershell
   # 포트 3000 사용 중인 프로세스 확인
   netstat -ano | findstr :3000
   ```

4. **Node.js 프로세스 확인**
   ```powershell
   Get-Process node -ErrorAction SilentlyContinue
   ```

## 프론트엔드 서버 연결 오류

### 증상
- `http://localhost:5173` 접속 불가
- Vite 서버 연결 끊김

### 해결 방법

1. **프론트엔드 서버 재시작**
   ```powershell
   cd E:\rpa\rpa-schedule-manager\frontend
   npm run dev
   ```

2. **포트 충돌 확인**
   ```powershell
   netstat -ano | findstr :5173
   ```

## MySQL 연결 오류

### 증상
- `MySQL 연결 실패` 메시지
- 데이터베이스 관련 API 오류

### 해결 방법

1. **MySQL 서비스 확인**
   ```powershell
   Get-Service MySQL*
   ```

2. **MySQL 서비스 시작**
   ```powershell
   Start-Service MySQL*
   ```

3. **데이터베이스 재초기화**
   ```powershell
   cd E:\rpa\rpa-schedule-manager\backend
   npm run init-db
   ```

## Redis 연결 오류

### 증상
- `Redis 연결 실패` 메시지 (선택사항)

### 해결 방법

1. **Redis 비활성화 (권장)**
   - `.env` 파일에 `REDIS_ENABLED=false` 추가

2. **Redis 설치 및 실행**
   - `INSTALL_REDIS.md` 참고

## 일반적인 문제

### 1. 의존성 설치 문제
```powershell
# 백엔드
cd backend
rm -rf node_modules
npm install

# 프론트엔드
cd frontend
rm -rf node_modules
npm install
```

### 2. 환경 변수 문제
- `.env` 파일이 올바른 위치에 있는지 확인
- `.env.example`을 참고하여 필요한 변수 설정

### 3. 포트 충돌
- 다른 애플리케이션이 같은 포트를 사용 중일 수 있음
- `.env`에서 포트 변경 가능

## 로그 확인

### 백엔드 로그
- 터미널에서 `npm run dev` 실행 시 출력되는 로그 확인

### 프론트엔드 로그
- 브라우저 개발자 도구 콘솔 확인 (F12)

## 서버 재시작 순서

1. **백엔드 서버 중지**
   - 터미널에서 `Ctrl+C`

2. **프론트엔드 서버 중지**
   - 터미널에서 `Ctrl+C`

3. **Node.js 프로세스 강제 종료 (필요시)**
   ```powershell
   Get-Process node | Stop-Process -Force
   ```

4. **백엔드 서버 시작**
   ```powershell
   cd E:\rpa\rpa-schedule-manager\backend
   npm run dev
   ```

5. **프론트엔드 서버 시작 (새 터미널)**
   ```powershell
   cd E:\rpa\rpa-schedule-manager\frontend
   npm run dev
   ```
