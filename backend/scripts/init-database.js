/**
 * 데이터베이스 초기화 스크립트
 * Node.js를 사용하여 MySQL 스키마 실행
 * 
 * 사용법: node scripts/init-database.js
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  let connection;
  
  try {
    console.log('📊 데이터베이스 초기화 시작...\n');
    
    // 환경 변수 확인
    const dbHost = process.env.DB_HOST || 'localhost';
    const dbPort = parseInt(process.env.DB_PORT) || 3306;
    const dbUser = process.env.DB_USER || 'root';
    const dbPassword = process.env.DB_PASSWORD || '';
    
    console.log(`📡 MySQL 연결 정보:`);
    console.log(`   Host: ${dbHost}`);
    console.log(`   Port: ${dbPort}`);
    console.log(`   User: ${dbUser}`);
    console.log(`   Password: ${dbPassword ? '***' : '(없음)'}\n`);
    
    // MySQL 연결 (데이터베이스 없이)
    connection = await mysql.createConnection({
      host: dbHost,
      port: dbPort,
      user: dbUser,
      password: dbPassword
    });
    
    console.log('✅ MySQL 서버 연결 성공\n');
    
    // 데이터베이스 생성
    const dbName = process.env.DB_NAME || 'rpa_schedule_db';
    console.log(`📦 데이터베이스 생성 중: ${dbName}...`);
    
    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS ${dbName} 
       CHARACTER SET utf8mb4 
       COLLATE utf8mb4_unicode_ci`
    );
    
    console.log(`✅ 데이터베이스 생성 완료: ${dbName}\n`);
    
    // 데이터베이스 선택 (query 사용, execute 아님)
    await connection.query(`USE ${dbName}`);
    console.log(`📂 데이터베이스 선택: ${dbName}\n`);
    
    // 스키마 파일 읽기
    const schemaPath = path.join(__dirname, '../sql/schema.sql');
    console.log(`📄 스키마 파일 읽기: ${schemaPath}...`);
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`스키마 파일을 찾을 수 없습니다: ${schemaPath}`);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // SQL 문을 세미콜론으로 분리하고 정리
    let statements = schemaSQL
      .split(';')
      .map(s => {
        // 여러 줄 주석 제거
        s = s.replace(/\/\*[\s\S]*?\*\//g, '');
        // 한 줄 주석 제거
        const lines = s.split('\n').map(line => {
          const commentIndex = line.indexOf('--');
          if (commentIndex >= 0) {
            return line.substring(0, commentIndex);
          }
          return line;
        });
        return lines.join('\n').trim();
      })
      .filter(s => {
        // 빈 문자열 제거
        if (s.length === 0) return false;
        // CREATE DATABASE와 USE는 이미 실행했으므로 제외
        if (s.match(/^(CREATE DATABASE|USE)/i)) return false;
        return true;
      });
    
    console.log(`📝 SQL 문 ${statements.length}개 실행 중...\n`);
    
    // 각 SQL 문 실행 (query 사용 - prepared statement 제한 회피)
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.length > 0) {
        try {
          // query 사용 (execute 대신) - 모든 SQL 문 지원
          await connection.query(statement);
          console.log(`✅ [${i + 1}/${statements.length}] 실행 완료`);
        } catch (error) {
          // 테이블이 이미 존재하는 경우는 무시
          if (error.code === 'ER_TABLE_EXISTS_ERROR' || error.message.includes('already exists')) {
            console.log(`⚠️  [${i + 1}/${statements.length}] 테이블이 이미 존재합니다 (건너뜀)`);
          } else if (error.code === 'ER_DUP_ENTRY') {
            // 중복 데이터는 무시
            console.log(`⚠️  [${i + 1}/${statements.length}] 중복 데이터 (건너뜀)`);
          } else {
            console.error(`❌ [${i + 1}/${statements.length}] 실행 실패:`, error.message);
            console.error(`   SQL: ${statement.substring(0, 100)}...`);
            throw error;
          }
        }
      }
    }
    
    console.log('\n✅ 데이터베이스 초기화 완료!\n');
    
    // 테이블 확인
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📋 생성된 테이블:');
    tables.forEach((table, index) => {
      const tableName = Object.values(table)[0];
      console.log(`   ${index + 1}. ${tableName}`);
    });
    
    console.log('\n🎉 모든 작업이 완료되었습니다!');
    
  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
    console.error('\n💡 다음을 확인하세요:');
    console.error('   1. MySQL 서비스가 실행 중인지 확인');
    console.error('   2. backend/.env 파일이 존재하고 DB 설정이 올바른지 확인');
    console.error('   3. MySQL 사용자 권한 확인');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 연결 종료');
    }
  }
}

// 실행
initDatabase();

