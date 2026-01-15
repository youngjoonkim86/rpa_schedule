const moment = require('moment-timezone');

/**
 * 일정(실행/스케줄) 목록을 시간 버킷으로 그룹핑합니다.
 * - 저장(캘린더 표시)용으로 "비슷한 시간대"를 합쳐 row 수를 줄이기 위한 용도
 * - 원본 상세(개별 실행 시간)는 body에 요약으로 남깁니다.
 *
 * 그룹 기준:
 * - botId/botName + subject + processId + (버킷 시작 시각)
 *
 * @param {Array} schedules
 * @param {number} bucketMinutes 30 또는 60 권장
 * @param {string} tz
 * @returns {Array} grouped schedules
 */
function groupSchedulesByTimeBucket(schedules, bucketMinutes, tz = 'Asia/Seoul') {
  const m = parseInt(bucketMinutes, 10);
  if (!Number.isFinite(m) || m <= 0) return schedules;

  const map = new Map();

  for (const s of schedules || []) {
    if (!s || !s.start) continue;

    const start = moment.tz(s.start, tz);
    if (!start.isValid()) continue;

    const bucketStart = start
      .clone()
      .minute(Math.floor(start.minute() / m) * m)
      .second(0)
      .millisecond(0);

    const bot = s.botId || s.botName || '';
    const subject = s.subject || '';
    const processId = s.processId || '';
    const key = `${bot}||${subject}||${processId}||${bucketStart.toISOString()}`;

    const entry = map.get(key);
    if (!entry) {
      map.set(key, {
        botId: s.botId,
        botName: s.botName,
        subject,
        processId,
        processName: s.processName,
        sourceSystem: s.sourceSystem,
        bucketStart,
        bucketEnd: bucketStart.clone().add(m, 'minute'),
        earliest: start.clone(),
        latest: moment.tz(s.end || s.start, tz),
        count: 1,
        // 대표 텍스트
        bodySamples: [s.body].filter(Boolean).slice(0, 1)
      });
      continue;
    }

    entry.count += 1;
    if (start.isBefore(entry.earliest)) entry.earliest = start.clone();

    const end = moment.tz(s.end || s.start, tz);
    if (end.isValid() && end.isAfter(entry.latest)) entry.latest = end.clone();

    if (s.body && entry.bodySamples.length < 1) entry.bodySamples.push(s.body);
  }

  const out = [];
  for (const g of map.values()) {
    const body =
      g.count > 1
        ? `[그룹 ${g.count}건/${m}분] 실제범위: ${g.earliest.toISOString()} ~ ${g.latest.toISOString()}\n` +
          (g.bodySamples[0] ? String(g.bodySamples[0]) : '')
        : (g.bodySamples[0] ? String(g.bodySamples[0]) : null);

    out.push({
      // id는 DB에서 부여되므로 임시값(동기화 dedupe용으로만 사용)
      id: `bucket:${g.bucketStart.toISOString()}:${g.processId || g.subject}`,
      botId: g.botId || g.botName,
      botName: g.botName,
      processId: g.processId,
      processName: g.processName,
      subject: g.subject,
      start: g.bucketStart.toISOString(),
      end: g.bucketEnd.toISOString(),
      body,
      sourceSystem: g.sourceSystem
    });
  }

  // 안정적 출력(시간순)
  out.sort((a, b) => new Date(a.start) - new Date(b.start));
  return out;
}

module.exports = { groupSchedulesByTimeBucket };


