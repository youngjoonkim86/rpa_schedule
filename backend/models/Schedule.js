const db = require('../config/database');

// 데이터베이스 연결 확인 헬퍼
const ensureConnection = async () => {
  try {
    await db.execute('SELECT 1');
    return true;
  } catch (error) {
    console.error('데이터베이스 연결 확인 실패:', error.message);
    return false;
  }
};

// ISO 8601 형식을 MySQL DATETIME 형식으로 변환
const toMySQLDateTime = (isoString) => {
  if (!isoString) return null;
  
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      console.warn(`⚠️ 잘못된 날짜 형식: ${isoString}`);
      return null;
    }
    
    // MySQL DATETIME 형식: YYYY-MM-DD HH:mm:ss
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch (error) {
    console.error(`날짜 변환 오류 (${isoString}):`, error.message);
    return null;
  }
};

class Schedule {
  /**
   * 날짜 범위로 일정 조회
   */
  static async findByDateRange(startDate, endDate, botId = null) {
    if (!(await ensureConnection())) {
      throw new Error('데이터베이스 연결이 없습니다.');
    }
    let query = `
      SELECT 
        schedule_id as id,
        bot_id as botId,
        bot_name as botName,
        subject,
        start_datetime as start,
        end_datetime as end,
        body,
        process_id as processId,
        source_system as sourceSystem,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM bot_schedules
      WHERE start_datetime < DATE_ADD(?, INTERVAL 1 DAY)
        AND end_datetime > ?
        AND status = 'ACTIVE'
    `;
    
    // 조회 기간과 겹치는 일정 조회
    // start_datetime < endDate+1일 AND end_datetime > startDate
    const params = [endDate, startDate];
    
    if (botId) {
      query += ' AND bot_id = ?';
      params.push(botId);
    }
    
    query += ' ORDER BY start_datetime ASC';
    
    const [rows] = await db.execute(query, params);
    return rows;
  }

  /**
   * ID로 일정 조회
   */
  static async findById(id) {
    const [rows] = await db.execute(
      `SELECT 
        schedule_id as id,
        bot_id as botId,
        bot_name as botName,
        subject,
        start_datetime as start,
        end_datetime as end,
        body,
        process_id as processId,
        source_system as sourceSystem,
        status,
        created_at as createdAt,
        updated_at as updatedAt
      FROM bot_schedules
      WHERE schedule_id = ? AND status = 'ACTIVE'`,
      [id]
    );
    return rows[0] || null;
  }

  /**
   * 일정 생성
   */
  static async create(data) {
    const {
      bot_id,
      bot_name,
      subject,
      start_datetime,
      end_datetime,
      body = null,
      process_id = null,
      source_system = 'MANUAL'
    } = data;

    // ISO 8601 형식을 MySQL DATETIME 형식으로 변환
    const mysqlStart = toMySQLDateTime(start_datetime);
    const mysqlEnd = toMySQLDateTime(end_datetime);

    if (!mysqlStart || !mysqlEnd) {
      throw new Error(`잘못된 날짜 형식: start=${start_datetime}, end=${end_datetime}`);
    }

    const [result] = await db.execute(
      `INSERT INTO bot_schedules 
        (bot_id, bot_name, subject, start_datetime, end_datetime, body, process_id, source_system)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [bot_id, bot_name, subject, mysqlStart, mysqlEnd, body, process_id, source_system]
    );

    return result.insertId;
  }

  /**
   * 일정 수정
   */
  static async update(id, data) {
    const {
      subject,
      start_datetime,
      end_datetime,
      body
    } = data;

    const updateFields = [];
    const params = [];

    if (subject !== undefined) {
      updateFields.push('subject = ?');
      params.push(subject);
    }
    if (start_datetime !== undefined) {
      updateFields.push('start_datetime = ?');
      params.push(toMySQLDateTime(start_datetime));
    }
    if (end_datetime !== undefined) {
      updateFields.push('end_datetime = ?');
      params.push(toMySQLDateTime(end_datetime));
    }
    if (body !== undefined) {
      updateFields.push('body = ?');
      params.push(body);
    }

    if (updateFields.length === 0) {
      throw new Error('수정할 필드가 없습니다.');
    }

    params.push(id);

    await db.execute(
      `UPDATE bot_schedules 
       SET ${updateFields.join(', ')}
       WHERE schedule_id = ? AND status = 'ACTIVE'`,
      params
    );

    return true;
  }

  /**
   * 일정 소프트 삭제
   */
  static async softDelete(id) {
    await db.execute(
      `UPDATE bot_schedules 
       SET status = 'DELETED'
       WHERE schedule_id = ?`,
      [id]
    );
    return true;
  }

  /**
   * Upsert (있으면 업데이트, 없으면 생성)
   * 중복 체크: 
   * 1. bot_id + start_datetime + end_datetime (정확한 시간 일치)
   * 2. process_id + bot_id + start_datetime (동일 프로세스, 동일 BOT, 동일 시간)
   * 3. process_id + bot_id (동일 프로세스와 BOT의 최근 스케줄이 있으면 업데이트)
   */
  static async upsert(data) {
    const {
      bot_id,
      bot_name,
      subject,
      start_datetime,
      end_datetime,
      body = null,
      process_id = null,
      source_system = 'MANUAL'
    } = data;

    // ISO 8601 형식을 MySQL DATETIME 형식으로 변환
    const mysqlStart = toMySQLDateTime(start_datetime);
    const mysqlEnd = toMySQLDateTime(end_datetime);

    if (!mysqlStart || !mysqlEnd) {
      throw new Error(`잘못된 날짜 형식: start=${start_datetime}, end=${end_datetime}`);
    }

    // 1. 정확한 시간 일치 체크: bot_id + start_datetime + end_datetime
    const [existing] = await db.execute(
      `SELECT schedule_id FROM bot_schedules 
       WHERE bot_id = ? 
         AND start_datetime = ? 
         AND end_datetime = ? 
         AND status = 'ACTIVE'`,
      [bot_id, mysqlStart, mysqlEnd]
    );

    if (existing.length > 0) {
      // 이미 존재하는 스케줄이면 업데이트
      await db.execute(
        `UPDATE bot_schedules 
         SET bot_name = ?, subject = ?, body = ?, process_id = ?, source_system = ?, updated_at = CURRENT_TIMESTAMP
         WHERE schedule_id = ?`,
        [bot_name, subject, body, process_id, source_system, existing[0].schedule_id]
      );
      return existing[0].schedule_id;
    }

    // 2. process_id가 있는 경우: process_id + bot_id + start_datetime 체크
    if (process_id) {
      const [existingByProcess] = await db.execute(
        `SELECT schedule_id FROM bot_schedules 
         WHERE process_id = ? 
           AND bot_id = ? 
           AND start_datetime = ? 
           AND status = 'ACTIVE'`,
        [process_id, bot_id, mysqlStart]
      );

      if (existingByProcess.length > 0) {
        // 업데이트
        await db.execute(
          `UPDATE bot_schedules 
           SET bot_name = ?, subject = ?, end_datetime = ?, body = ?, updated_at = CURRENT_TIMESTAMP
           WHERE schedule_id = ?`,
          [bot_name, subject, mysqlEnd, body, existingByProcess[0].schedule_id]
        );
        return existingByProcess[0].schedule_id;
      }

      // 3. 동일한 process_id + bot_id 조합이 최근(24시간 이내)에 등록되었는지 체크
      // 반복 스케줄의 경우 매번 다른 시간이지만, 동일한 프로세스와 BOT이면 업데이트
      const [recentSchedule] = await db.execute(
        `SELECT schedule_id FROM bot_schedules 
         WHERE process_id = ? 
           AND bot_id = ? 
           AND status = 'ACTIVE'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
         ORDER BY created_at DESC
         LIMIT 1`,
        [process_id, bot_id]
      );

      if (recentSchedule.length > 0) {
        // 최근에 등록된 동일 프로세스/BOT 스케줄이 있으면 새로 생성 (반복 스케줄이므로)
        // 또는 업데이트할지 결정 (여기서는 새로 생성)
        // 주석: 반복 스케줄은 각각 다른 시간이므로 새로 생성하는 것이 맞음
      }
    }

    // 중복이 없으면 생성
    return await this.create(data);
  }
}

module.exports = Schedule;

