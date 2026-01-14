/**
 * Brity RPA API 테스트 스크립트
 * 
 * 사용법:
 * node scripts/test-brity-api.js
 */

require('dotenv').config();
const brityRpaService = require('../services/brityRpaService');

async function testBrityApi() {
  console.log('🧪 Brity RPA API 테스트 시작\n');
  
  try {
    // 오늘부터 30일 후까지 조회
    const today = new Date();
    const endDate = new Date(today);
    endDate.setDate(endDate.getDate() + 30);
    
    const startDate = today.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    
    console.log(`📅 조회 기간: ${startDate} ~ ${endDateStr}\n`);
    
    const schedules = await brityRpaService.getSchedules(startDate, endDateStr);
    
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


