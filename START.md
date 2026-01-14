# 서버 실행 가이드

## 백엔드 서버 실행

```powershell
cd backend
npm run dev
```

서버가 `http://localhost:3000`에서 실행됩니다.

## 프론트엔드 서버 실행

새 터미널에서:

```powershell
cd frontend
npm run dev
```

프론트엔드가 `http://localhost:5173`에서 실행됩니다.

## 동시 실행 (권장)

### 터미널 1: 백엔드
```powershell
cd rpa-schedule-manager\backend
npm run dev
```

### 터미널 2: 프론트엔드
```powershell
cd rpa-schedule-manager\frontend
npm run dev
```

## 접속

브라우저에서 `http://localhost:5173` 접속

## API 테스트

### 헬스체크
```powershell
Invoke-WebRequest -Uri http://localhost:3000/health -UseBasicParsing
```

### 일정 조회
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/schedules?startDate=2026-01-01&endDate=2026-01-31" -UseBasicParsing
```

### BOT 목록
```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/bots -UseBasicParsing
```


