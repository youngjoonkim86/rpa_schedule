const redis = require('redis');
require('dotenv').config();

// Redis 사용 여부 확인 (환경변수로 제어 가능)
const REDIS_ENABLED = process.env.REDIS_ENABLED !== 'false';

// Redis가 없을 때를 대비한 더미 객체
const dummyClient = {
  get: async () => null,
  set: async () => true,
  setEx: async () => true,
  del: async () => true,
  keys: async () => [],
  exists: async () => false,
  ping: async () => { throw new Error('Redis not available'); },
  isReady: false
};

let client = dummyClient;
let isConnected = false;

// Redis가 비활성화되어 있으면 더미 클라이언트 반환
if (!REDIS_ENABLED) {
  console.log('ℹ️ Redis가 비활성화되어 있습니다. (REDIS_ENABLED=false)');
  module.exports = dummyClient;
} else {
  // Redis 클라이언트 생성 (비동기 연결, 블로킹하지 않음)
  try {
    client = redis.createClient({
      socket: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        connectTimeout: 2000, // 2초 타임아웃
        reconnectStrategy: (retries) => {
          if (retries > 2) {
            console.warn('⚠️ Redis 재연결 시도 실패. Redis 없이 계속 진행합니다.');
            return false; // 재연결 중단
          }
          return Math.min(retries * 100, 2000);
        }
      },
      password: process.env.REDIS_PASSWORD || undefined,
      database: parseInt(process.env.REDIS_DB) || 0
    });

    // 에러 핸들러 (서버 크래시 방지)
    client.on('error', (err) => {
      if (!isConnected) {
        // 초기 연결 실패는 한 번만 로그
        return;
      }
      console.warn('⚠️ Redis 연결 오류:', err.message);
    });

    client.on('connect', () => {
      isConnected = true;
      console.log('✅ Redis 연결 성공');
    });

    client.on('ready', () => {
      client.isReady = true;
    });

    client.on('disconnect', () => {
      isConnected = false;
      client.isReady = false;
    });

    // 비동기로 연결 시도 (블로킹하지 않음, 실패해도 서버는 계속 실행)
    setTimeout(() => {
      client.connect().catch(err => {
        console.warn('⚠️ Redis 연결 실패 (선택사항이므로 계속 진행)');
        console.warn('💡 Redis 설치: choco install redis-64 -y 또는 https://redis.io/download');
        console.warn('💡 또는 .env 파일에 REDIS_ENABLED=false 추가하여 비활성화 가능');
        // 연결 실패 시 더미 클라이언트로 전환
        client = dummyClient;
      });
    }, 100); // 서버 시작 후 100ms 후 연결 시도

  } catch (error) {
    console.warn('⚠️ Redis 클라이언트 생성 실패 (선택사항이므로 계속 진행):', error.message);
    client = dummyClient;
  }

  module.exports = client;
}

