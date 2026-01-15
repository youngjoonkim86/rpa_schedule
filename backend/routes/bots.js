const express = require('express');
const router = express.Router();
const db = require('../config/database');

// BOT 색상 매핑
const BOT_COLORS = {
  'BOT1': '#3498DB',
  'BOT2': '#2ECC71',
  'BOT3': '#E74C3C',
  'BOT4': '#F39C12',
  'BOT5': '#9B59B6',
  'ALL': '#95A5A6',
  '일정등록': '#95A5A6',
  'BOT-T7C50': '#3498DB',
  'BOT-P2OXI': '#2ECC71',
  'BOT-X1G3Z': '#E74C3C',
  'BOT-UGG3O': '#F39C12',
  'BOT-RIGTM': '#9B59B6'
};

/**
 * GET /api/bots - 사용 가능한 BOT 목록 조회 (DB에서 실제 사용 중인 BOT 조회)
 */
router.get('/', async (req, res) => {
  try {
    // 기본 BOT 목록 (항상 포함)
    const defaultBots = [
      { id: 'BOT1', name: 'BOT1', color: BOT_COLORS.BOT1 },
      { id: 'BOT2', name: 'BOT2', color: BOT_COLORS.BOT2 },
      { id: 'BOT3', name: 'BOT3', color: BOT_COLORS.BOT3 },
      { id: 'BOT4', name: 'BOT4', color: BOT_COLORS.BOT4 },
      { id: 'BOT5', name: 'BOT5', color: BOT_COLORS.BOT5 },
      // 수동 등록 카테고리도 항상 보이게 (해당 일정이 0건이어도 필터에서 선택 가능)
      { id: '일정등록', name: '일정등록', color: BOT_COLORS['일정등록'] }
    ];

    // DB에서 실제 사용 중인 BOT 목록 조회
    const [rows] = await db.execute(
      `SELECT DISTINCT 
        COALESCE(bot_id, bot_name) as botId,
        COALESCE(bot_name, bot_id) as botName
      FROM bot_schedules
      WHERE status = 'ACTIVE'
      ORDER BY botId`
    );

    // BOT 목록 생성 (botName 기준으로 중복 제거)
    const botMap = new Map();
    
    // 기본 BOT 목록 먼저 추가
    defaultBots.forEach(bot => {
      botMap.set(bot.id, bot);
    });
    
    // DB에서 조회한 BOT 추가 (기본 BOT과 중복되지 않는 것만)
    rows.forEach(row => {
      const botId = row.botId || row.botName;
      const botName = row.botName || row.botId;
      
      // botName을 기준으로 정규화 (BOT1, BOT2 등으로 매핑)
      let normalizedId = botId;
      let normalizedName = botName;
      
      // botName이 BOT1~BOT5 형식이면 그대로 사용
      if (/^BOT[1-5]$/i.test(botName)) {
        normalizedId = botName.toUpperCase();
        normalizedName = botName.toUpperCase();
      } else if (/^BOT[1-5]$/i.test(botId)) {
        normalizedId = botId.toUpperCase();
        normalizedName = botId.toUpperCase();
      }
      
      // 중복 제거: botName 기준으로 정리
      if (normalizedName && !botMap.has(normalizedName)) {
        botMap.set(normalizedName, {
          id: normalizedId,
          name: normalizedName,
          color: BOT_COLORS[normalizedId] || BOT_COLORS[normalizedName] || '#95A5A6'
        });
      }
    });

    // BOT 목록을 정렬 (BOT1, BOT2, ... 순서)
    const bots = Array.from(botMap.values()).sort((a, b) => {
      const aNum = parseInt(a.id.replace(/[^0-9]/g, '')) || 999;
      const bNum = parseInt(b.id.replace(/[^0-9]/g, '')) || 999;
      return aNum - bNum;
    });

    res.json({
      success: true,
      data: bots
    });
  } catch (error) {
    console.error('Error fetching bots:', error);
    
    // 오류 발생 시 기본 BOT 목록 반환
    const defaultBots = [
      { id: 'BOT1', name: 'BOT1', color: BOT_COLORS.BOT1 },
      { id: 'BOT2', name: 'BOT2', color: BOT_COLORS.BOT2 },
      { id: 'BOT3', name: 'BOT3', color: BOT_COLORS.BOT3 },
      { id: 'BOT4', name: 'BOT4', color: BOT_COLORS.BOT4 },
      { id: 'BOT5', name: 'BOT5', color: BOT_COLORS.BOT5 }
    ];
    
    res.json({
      success: true,
      data: defaultBots
    });
  }
});

module.exports = router;


