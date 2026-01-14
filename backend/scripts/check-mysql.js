/**
 * MySQL 연결 테스트 스크립트
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkMySQL() {
  console.log('🔍 MySQL 연결 테스트...\n');
  
  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || ''
  };
  
  console.log('연결 정보:');
  console.log(`  Host: ${config.host}`);
  console.log(`  Port: ${config.port}`);
  console.log(`  User: ${config.user}`);
  console.log(`  Password: ${config.password ? '***' : '(없음)'}\n`);
  
  try {
    const connection = await mysql.createConnection(config);
    console.log('✅ MySQL 연결 성공!');
    
    const [rows] = await connection.execute('SELECT VERSION() as version');
    console.log(`📌 MySQL 버전: ${rows[0].version}`);
    
    const [databases] = await connection.execute('SHOW DATABASES');
    console.log(`\n📋 사용 가능한 데이터베이스:`);
    databases.forEach(db => {
      const dbName = Object.values(db)[0];
      console.log(`   - ${dbName}`);
    });
    
    await connection.end();
    console.log('\n✅ 테스트 완료!');
  } catch (error) {
    console.error('\n❌ MySQL 연결 실패:', error.message);
    console.error('\n💡 해결 방법:');
    console.error('   1. MySQL 서비스가 실행 중인지 확인:');
    console.error('      Get-Service MySQL*');
    console.error('      Start-Service MySQL80');
    console.error('   2. .env 파일의 DB_PASSWORD가 올바른지 확인');
    console.error('   3. MySQL이 설치되어 있고 PATH에 등록되어 있는지 확인');
    process.exit(1);
  }
}

checkMySQL();


