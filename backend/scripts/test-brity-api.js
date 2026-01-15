/**
 * Brity RPA API 테스트 스크립트
 * 
 * 사용법:
 * node scripts/test-brity-api.js
 */

require('dotenv').config();
const brityRpaService = require('../services/brityRpaService');
const moment = require('moment-timezone');

async function testBrityApi() {
  console.log('🧪 Brity RPA API 테스트 시작\n');
  
  try {
    // /jobs/list 는 "실행 결과" 조회이므로 미래 기간을 넣어도 결과가 거의 없습니다.
    // 기본은 최근 7일 실행 이력 조회로 설정합니다.
    const tz = 'Asia/Seoul';
    const startIso = moment.tz(tz).subtract(7, 'day').startOf('day').toISOString();
    const endIso = moment.tz(tz).endOf('day').toISOString();

    console.log(`📅 조회 기간(실행 이력): ${startIso} ~ ${endIso}\n`);

    const schedules = await brityRpaService.getJobResults(startIso, endIso);
    
    console.log(`\n✅ 조회 성공: ${schedules.length}개 스케줄 발견\n`);
    
    // 처음 5개만 출력
    console.log('📋 샘플 데이터 (처음 5개):');
    schedules.slice(0, 5).forEach((schedule, index) => {
      console.log(`\n[${index + 1}] ${schedule.subject}`);
      console.log(`   BOT: ${schedule.botId} (${schedule.botName})`);
      console.log(`   시작: ${schedule.start}`);
      console.log(`   종료: ${schedule.end}`);
      console.log(`   프로세스: ${schedule.processName}`);
    });
    
    if (schedules.length > 5) {
      console.log(`\n... 외 ${schedules.length - 5}개 더 있음`);
    }
    
  } catch (error) {
    console.error('\n❌ 테스트 실패:', error.message);
    if (error.response) {
      console.error('응답 상태:', error.response.status);
      console.error('응답 데이터:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

testBrityApi();


