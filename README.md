# RPA BOT 스케줄 관리 시스템

AJ Networks의 RPA BOT 스케줄을 통합 관리하기 위한 웹 기반 캘린더 시스템

## 기술 스택

- **프론트엔드**: React 18 + TypeScript + FullCalendar + Ant Design
- **백엔드**: Node.js 18+ + Express.js
- **데이터베이스**: MySQL 8.0 + Redis
- **외부 연동**: Power Automate API + Samsung SDS Brity RPA API

## 프로젝트 구조

```
rpa-schedule-manager/
├── backend/          # Node.js 백엔드
├── frontend/         # React 프론트엔드
└── docs/             # 문서
```

## 설치 및 실행

### 백엔드
```bash
cd backend
npm install
npm run dev
```

### 프론트엔드
```bash
cd frontend
npm install
npm run dev
```

## 환경 변수 설정

백엔드 `.env` 파일과 프론트엔드 `.env` 파일을 참고하세요.


