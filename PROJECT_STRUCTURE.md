# 프로젝트 구조

## 전체 구조

```
rpa-schedule-manager/
├── backend/                    # Node.js 백엔드
│   ├── config/                 # 설정 파일
│   │   ├── database.js         # MySQL 연결 설정
│   │   └── redis.js            # Redis 연결 설정
│   ├── controllers/            # 컨트롤러 (비즈니스 로직)
│   │   └── scheduleController.js
│   ├── models/                 # 데이터 모델
│   │   └── Schedule.js         # 일정 모델
│   ├── routes/                 # API 라우트
│   │   ├── schedules.js        # 일정 관련 라우트
│   │   ├── bots.js             # BOT 관련 라우트
│   │   └── sync.js             # 동기화 라우트
│   ├── services/               # 외부 API 연동
│   │   ├── powerAutomateService.js
│   │   └── brityRpaService.js
│   ├── jobs/                   # 스케줄 작업
│   │   └── syncSchedules.js    # 자동 동기화
│   ├── sql/                    # SQL 스크립트
│   │   └── schema.sql          # 데이터베이스 스키마
│   ├── server.js               # 서버 엔트리포인트
│   ├── package.json
│   └── .env.example
│
├── frontend/                    # React 프론트엔드
│   ├── src/
│   │   ├── components/         # React 컴포넌트
│   │   │   ├── Calendar.tsx    # FullCalendar 컴포넌트
│   │   │   ├── ScheduleModal.tsx # 일정 등록/수정 모달
│   │   │   └── BotFilter.tsx   # BOT 필터 사이드바
│   │   ├── services/           # API 서비스
│   │   │   └── api.ts          # Axios 클라이언트
│   │   ├── App.tsx             # 메인 앱 컴포넌트
│   │   ├── main.tsx            # 엔트리포인트
│   │   ├── App.css
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
│
├── README.md
├── INSTALL.md                  # 설치 가이드
└── .gitignore
```

## 주요 기능

### 백엔드

1. **일정 관리 API**
   - GET `/api/schedules` - 일정 조회
   - POST `/api/schedules` - 일정 생성
   - PUT `/api/schedules/:id` - 일정 수정
   - DELETE `/api/schedules/:id` - 일정 삭제

2. **외부 API 연동**
   - Power Automate API (일정 등록/조회)
   - Samsung SDS Brity RPA API (스케줄 조회)

3. **자동 동기화**
   - 매시간 정각에 Brity RPA 스케줄 자동 동기화

4. **캐싱**
   - Redis를 사용한 일정 데이터 캐싱 (5분 TTL)

### 프론트엔드

1. **캘린더 뷰**
   - FullCalendar를 사용한 월/주/일 뷰
   - 드래그앤드롭으로 일정 시간 변경

2. **일정 관리**
   - 일정 등록/수정/삭제 모달
   - BOT별 필터링

3. **동기화**
   - 수동 동기화 버튼

## 데이터베이스 스키마

### bot_schedules
- 일정 정보 저장
- BOT별, 날짜별 인덱스

### rpa_processes
- RPA 프로세스 메타데이터

### sync_logs
- 동기화 이력 기록

## 다음 단계

1. 환경 변수 설정 (`.env` 파일)
2. 데이터베이스 스키마 실행
3. 백엔드 및 프론트엔드 서버 실행
4. 브라우저에서 테스트

자세한 내용은 `INSTALL.md`를 참고하세요.


