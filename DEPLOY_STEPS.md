# 배포 단계별 가이드

## ✅ 완료된 단계

1. ✅ Git 저장소 초기화 및 커밋 완료

## 📋 다음 단계

### 1단계: ngrok 설치 (수동)

**방법 1: 직접 다운로드 (권장)**
1. https://ngrok.com/download 접속
2. Windows ZIP 다운로드
3. 압축 해제 (예: `C:\ngrok\`)
4. 환경 변수 PATH에 추가:
   ```powershell
   [Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\ngrok", "User")
   ```
5. 새 PowerShell 창에서 확인:
   ```powershell
   ngrok version
   ```

**방법 2: Chocolatey (관리자 권한 필요)**
```powershell
# PowerShell을 관리자 권한으로 실행
choco install ngrok -y
```

### 2단계: ngrok 인증 설정

1. https://ngrok.com 에서 무료 계정 생성
2. 대시보드 → "Your Authtoken" 복사
3. 토큰 설정:
   ```powershell
   ngrok config add-authtoken YOUR_AUTH_TOKEN
   ```

### 3단계: GitHub 저장소 생성 및 푸시

1. https://github.com 접속 → 로그인
2. "New repository" 클릭
3. 저장소 이름 입력 (예: `rpa-schedule-manager`)
4. "Create repository" 클릭
5. 아래 명령어 실행:
   ```powershell
   git remote add origin https://github.com/YOUR_USERNAME/rpa-schedule-manager.git
   git branch -M main
   git push -u origin main
   ```

### 4단계: ngrok 터널링 시작

```powershell
# 프로젝트 루트에서 실행
.\start-ngrok.ps1
```

또는 수동 실행:
```powershell
# MySQL 터널 (새 PowerShell 창)
ngrok tcp 3306

# 백엔드 터널 (새 PowerShell 창, 선택사항)
ngrok http 3000
```

**중요**: ngrok 출력에서 다음 정보를 복사하세요:
- MySQL: `tcp://0.tcp.ngrok.io:XXXXX` → 호스트: `0.tcp.ngrok.io`, 포트: `XXXXX`
- Backend: `https://XXXXX.ngrok.io`

### 5단계: Vercel 프론트엔드 배포

1. https://vercel.com 접속 → 로그인 (GitHub 계정으로)
2. "Add New..." → "Project" 클릭
3. GitHub 저장소 선택
4. 프로젝트 설정:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Environment Variables 추가:
   ```
   VITE_API_URL=https://your-backend-ngrok.ngrok.io/api
   ```
   (또는 Railway 백엔드 URL 사용)
6. "Deploy" 클릭

### 6단계: Railway 백엔드 배포

1. https://railway.app 접속 → 로그인 (GitHub 계정으로)
2. "New Project" → "Deploy from GitHub repo" 클릭
3. 저장소 선택
4. "Settings" → "Root Directory" → `backend` 설정
5. "Variables" 탭에서 환경 변수 추가:

   ```
   DB_HOST=0.tcp.ngrok.io
   DB_PORT=12345
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=rpa_schedule_db
   DB_CONNECTION_LIMIT=10
   
   BRITY_RPA_URL=https://bwrpa.samsungsds.com:8777/scheduler/api/v1
   BRITY_RPA_TOKEN=your_brity_token
   
   POWER_AUTOMATE_CREATE_URL=your_power_automate_create_url
   POWER_AUTOMATE_QUERY_URL=your_power_automate_query_url
   
   PORT=3000
   HOST=0.0.0.0
   NODE_ENV=production
   
   CORS_ORIGIN=https://your-frontend.vercel.app
   
   REDIS_ENABLED=false
   AUTO_REGISTER_TO_POWER_AUTOMATE=true
   ```

6. "Deploy" 버튼 클릭 (자동 배포 시작)

### 7단계: 확인

1. **Vercel 프론트엔드**: `https://your-app.vercel.app`
2. **Railway 백엔드**: `https://your-app.railway.app/health`
3. **연결 테스트**: 프론트엔드에서 일정 조회 테스트

## 🔧 문제 해결

### ngrok 연결 끊김
- 무료 계정은 8시간마다 재연결 필요
- `start-ngrok.ps1` 재실행 후 Railway 환경 변수 업데이트

### DB 연결 실패
- ngrok URL이 변경되었는지 확인
- Railway 환경 변수 `DB_HOST`, `DB_PORT` 업데이트

### CORS 오류
- Railway 환경 변수 `CORS_ORIGIN`에 정확한 Vercel URL 설정

## 📝 참고

- ngrok 무료 계정: URL이 재시작 시마다 변경됨
- ngrok 유료 계정: 고정 URL 사용 가능
- Railway MySQL 사용 시: ngrok 없이도 가능 (권장)

