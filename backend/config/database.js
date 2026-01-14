const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

// 연결 테스트 (서버 시작 시 자동 재시도)
let retryCount = 0;
const maxRetries = 5;
const retryDelay = 3000; // 3초

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL 데이터베이스 연결 성공');
    connection.release();
  } catch (err) {
    retryCount++;
    if (retryCount < maxRetries) {
      console.warn(`⚠️ MySQL 연결 실패 (재시도 ${retryCount}/${maxRetries}):`, err.message);
      console.log(`${retryDelay / 1000}초 후 재시도...`);
      setTimeout(testConnection, retryDelay);
    } else {
      console.error('❌ MySQL 연결 실패: 최대 재시도 횟수 초과');
      console.error('💡 다음을 확인하세요:');
      console.error('   1. MySQL 서비스가 실행 중인지 확인');
      console.error('   2. .env 파일의 DB 설정이 올바른지 확인');
      console.error('   3. 데이터베이스가 생성되었는지 확인');
      // 서버는 계속 실행되도록 함 (Redis처럼)
      console.warn('⚠️ MySQL 없이 서버를 계속 실행합니다. (일부 기능 제한)');
    }
  }
};

testConnection();

module.exports = pool;

