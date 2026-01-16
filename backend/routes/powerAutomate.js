const express = require('express');
const router = express.Router();
const powerAutomateService = require('../services/powerAutomateService');
const moment = require('moment-timezone');

/**
 * GET /api/power-automate/query?start=YYYY-MM-DDTHH:mm:ss&end=YYYY-MM-DDTHH:mm:ss
 * - Power Automate에 실제로 일정이 존재하는지 빠르게 확인하는 디버그용 API
 * - 기본 타임존: Asia/Seoul
 */
router.get('/query', async (req, res) => {
  try {
    const tz = String(req.query?.tz || 'Asia/Seoul');
    const start = String(req.query?.start || '');
    const end = String(req.query?.end || '');

    // 기본값: 오늘 00:00~23:59(KST)
    const startIso = start
      ? new Date(start).toISOString()
      : moment.tz(tz).startOf('day').toISOString();
    const endIso = end
      ? new Date(end).toISOString()
      : moment.tz(tz).endOf('day').toISOString();

    const result = await powerAutomateService.querySchedules(startIso, endIso);
    const events = Array.isArray(result.events) ? result.events : [];

    return res.json({
      success: true,
      data: {
        range: { startIso, endIso, tz },
        count: result.count ?? events.length,
        treatedAsEmpty: !!result.treatedAsEmpty,
        treatedAs: result.treatedAs || null,
        sample: events.slice(0, 5)
      }
    });
  } catch (error) {
    console.error('PA query debug 오류:', error);
    const status = error?.status || error?.response?.status || 500;
    return res.status(status).json({
      success: false,
      message: 'Power Automate query debug 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      meta: {
        status: error?.status,
        code: error?.code
      }
    });
  }
});

module.exports = router;


