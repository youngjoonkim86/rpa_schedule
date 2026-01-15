const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// 데이터베이스 및 Redis 연결 (초기화)
require('./config/database');
require('./config/redis');

// 자동 동기화 작업 시작
require('./jobs/syncSchedules');

// 라우트
const schedulesRouter = require('./routes/schedules');
const botsRouter = require('./routes/bots');
const syncRouter = require('./routes/sync');
const brityRouter = require('./routes/brity');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

// 미들웨어
app.use(helmet());
// CORS
// - 개발 환경에서 로컬/사설IP로 접속할 수 있도록 5173 포트를 기본 허용
// - 운영 환경에서는 CORS_ORIGIN을 명시적으로 설정하는 것을 권장
const parseAllowedOrigins = () => {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return null;
  return raw
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
};

const allowedOrigins = parseAllowedOrigins();

app.use(cors({
  origin: (origin, cb) => {
    // same-origin / curl / server-to-server
    if (!origin) return cb(null, true);

    // env로 명시된 origin이 있으면 그 목록만 허용
    if (allowedOrigins && allowedOrigins.length > 0) {
      return cb(null, allowedOrigins.includes(origin));
    }

    // 기본 개발 허용: localhost + 사설IP로 접속하는 Vite(5173)
    // 예: http://localhost:5173, http://127.0.0.1:5173, http://192.168.0.10:5173
    const devAllowed = /^http:\/\/(localhost|127\.0\.0\.1|(\d{1,3}\.){3}\d{1,3})(:5173)?$/.test(origin);
    return cb(null, devAllowed);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15분
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 최대 100 요청
  // ✅ 프론트가 동기화 완료까지 폴링(/api/sync/status) 하므로 기본 rate limit에 걸리기 쉬움
  // - status는 읽기 전용이며 비용이 낮아 예외 처리
  skip: (req) => req.path === '/sync/status'
});
app.use('/api/', limiter);

// 헬스체크
app.get('/health', async (req, res) => {
  const db = require('./config/database');
  const redis = require('./config/redis');
  
  const health = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: 'unknown',
      redis: 'unknown'
    }
  };
  
  // 데이터베이스 상태 확인
  try {
    await db.execute('SELECT 1');
    health.services.database = 'connected';
  } catch (error) {
    health.services.database = 'disconnected';
    health.status = 'DEGRADED';
  }
  
  // Redis 상태 확인
  try {
    if (redis && typeof redis.ping === 'function') {
      await redis.ping();
      health.services.redis = 'connected';
    } else {
      health.services.redis = 'not_configured';
    }
  } catch (error) {
    health.services.redis = 'disconnected';
    // Redis는 선택사항이므로 상태만 기록
  }
  
  const statusCode = health.status === 'OK' ? 200 : 503;
  res.status(statusCode).json(health);
});

// API 라우트
app.use('/api/schedules', schedulesRouter);
app.use('/api/bots', botsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/brity', brityRouter);

// 404 핸들러
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 리소스를 찾을 수 없습니다.'
  });
});

// 에러 핸들러
app.use((err, req, res, next) => {
  console.error('서버 오류:', err);
  res.status(500).json({
    success: false,
    message: '서버 오류가 발생했습니다.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 서버 시작 (IP 접속을 위해 기본 0.0.0.0 바인딩)
app.listen(PORT, HOST, () => {
  console.log(`🚀 서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`📍 환경: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 바인딩: ${HOST}:${PORT}`);
  console.log(`🔗 헬스체크: http://localhost:${PORT}/health`);
  console.log(`📡 API 엔드포인트: http://localhost:${PORT}/api`);
});

// 우아한 종료
process.on('SIGTERM', () => {
  console.log('SIGTERM 신호 수신. 서버를 종료합니다...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT 신호 수신. 서버를 종료합니다...');
  process.exit(0);
});

