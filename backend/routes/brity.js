const express = require('express');
const router = express.Router();
const BrityRpaService = require('../services/brityRpaService');
const moment = require('moment-timezone');

/**
 * 금일 Brity RPA "실행 결과(job)" 중 실패 목록 조회 (10분 버킷)
 *
 * GET /api/brity/failures?date=YYYY-MM-DD&intervalMinutes=10
 *
 * - date 미지정 시 Asia/Seoul 기준 오늘
 * - intervalMinutes 기본 10
 */
router.get('/failures', async (req, res) => {
  try {
    const tz = 'Asia/Seoul';
    const dateStr = (req.query.date && String(req.query.date)) || moment.tz(tz).format('YYYY-MM-DD');
    const intervalMinutes = Math.max(1, parseInt(req.query.intervalMinutes || '10', 10) || 10);

    // "오늘" 하루 범위를 Asia/Seoul 기준으로 잡고, Brity jobs/list는 UTC ISO로 전달
    const startIso = moment.tz(dateStr, 'YYYY-MM-DD', tz).startOf('day').toISOString();
    const endIso = moment.tz(dateStr, 'YYYY-MM-DD', tz).endOf('day').toISOString();

    // Brity 실행 결과 조회 (/jobs/list)
    const jobs = await BrityRpaService.getJobResults(startIso, endIso);

    // ✅ "지정된 일자"만 보이도록 한번 더 필터링
    // - Brity가 범위 밖 데이터도 섞어 내려주는 환경이 있어 안전장치 추가
    const jobsForDate = jobs.filter(j => {
      const t = moment.tz(j.start || j.scheduledTime, tz);
      if (!t.isValid()) return false;
      return t.format('YYYY-MM-DD') === dateStr;
    });

    // 실패만 필터링: detailCode === "1" 이 성공(기존 매핑 기준), 그 외는 실패로 간주
    const failed = jobsForDate.filter(j => {
      if (j.detailCode == null) return false;
      return String(j.detailCode) !== '1';
    });

    // 10분 단위 버킷팅 (Asia/Seoul 기준)
    const bucketMap = new Map();
    for (const job of failed) {
      const t = moment.tz(job.start, tz);
      if (!t.isValid()) continue;
      const flooredMinute = Math.floor(t.minute() / intervalMinutes) * intervalMinutes;
      const bucketStart = t.clone().minute(flooredMinute).second(0).millisecond(0);
      const key = bucketStart.format('HH:mm');

      if (!bucketMap.has(key)) {
        bucketMap.set(key, {
          key,
          start: bucketStart.toISOString(),
          end: bucketStart.clone().add(intervalMinutes, 'minute').toISOString(),
          count: 0,
          items: []
        });
      }
      const b = bucketMap.get(key);
      b.count += 1;
      b.items.push(job);
    }

    const buckets = Array.from(bucketMap.values()).sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json({
      success: true,
      date: dateStr,
      timeZone: tz,
      intervalMinutes,
      totalFailed: failed.length,
      buckets
    });
  } catch (error) {
    console.error('Brity 실패 목록 조회 오류:', error);
    res.status(500).json({
      success: false,
      message: 'Brity 실패 목록 조회 중 오류가 발생했습니다.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

module.exports = router;


