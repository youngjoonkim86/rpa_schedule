const db = require('../config/database');

// ISO 8601 -> MySQL DATETIME
const toMySQLDateTime = (isoString) => {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
};

let ensured = false;
async function ensureTable() {
  if (ensured) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS pa_registrations (
      id INT AUTO_INCREMENT PRIMARY KEY,
      bot_id VARCHAR(50) NOT NULL,
      subject VARCHAR(255) NOT NULL,
      start_datetime DATETIME NOT NULL,
      end_datetime DATETIME NOT NULL,
      status ENUM('REGISTERED','FAILED') NOT NULL DEFAULT 'REGISTERED',
      attempt_count INT NOT NULL DEFAULT 0,
      last_error TEXT,
      last_attempt_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_pa_reg (bot_id, subject, start_datetime, end_datetime),
      INDEX idx_pa_reg_status (status),
      INDEX idx_pa_reg_start (start_datetime)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  ensured = true;
}

class PowerAutomateRegistration {
  static buildKeyFromIso({ subject, startIso, endIso }) {
    const mysqlStart = toMySQLDateTime(startIso);
    const mysqlEnd = toMySQLDateTime(endIso);
    if (!mysqlStart || !mysqlEnd) return null;
    return `${subject}||${mysqlStart}||${mysqlEnd}`;
  }

  static async isRegistered({ botId, subject, startIso, endIso }) {
    await ensureTable();
    const mysqlStart = toMySQLDateTime(startIso);
    const mysqlEnd = toMySQLDateTime(endIso);
    if (!mysqlStart || !mysqlEnd) return false;

    const [rows] = await db.execute(
      `SELECT id
       FROM pa_registrations
       WHERE bot_id = ?
         AND subject = ?
         AND start_datetime = ?
         AND end_datetime = ?
         AND status = 'REGISTERED'
       LIMIT 1`,
      [botId, subject, mysqlStart, mysqlEnd]
    );
    return rows.length > 0;
  }

  static async markRegistered({ botId, subject, startIso, endIso }) {
    await ensureTable();
    const mysqlStart = toMySQLDateTime(startIso);
    const mysqlEnd = toMySQLDateTime(endIso);
    if (!mysqlStart || !mysqlEnd) return false;

    await db.execute(
      `INSERT INTO pa_registrations (bot_id, subject, start_datetime, end_datetime, status, attempt_count, last_attempt_at, last_error)
       VALUES (?, ?, ?, ?, 'REGISTERED', 1, CURRENT_TIMESTAMP, NULL)
       ON DUPLICATE KEY UPDATE
         status = 'REGISTERED',
         attempt_count = attempt_count + 1,
         last_attempt_at = CURRENT_TIMESTAMP,
         last_error = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [botId, subject, mysqlStart, mysqlEnd]
    );
    return true;
  }

  static async markFailed({ botId, subject, startIso, endIso, errorMessage }) {
    await ensureTable();
    const mysqlStart = toMySQLDateTime(startIso);
    const mysqlEnd = toMySQLDateTime(endIso);
    if (!mysqlStart || !mysqlEnd) return false;

    await db.execute(
      `INSERT INTO pa_registrations (bot_id, subject, start_datetime, end_datetime, status, attempt_count, last_attempt_at, last_error)
       VALUES (?, ?, ?, ?, 'FAILED', 1, CURRENT_TIMESTAMP, ?)
       ON DUPLICATE KEY UPDATE
         status = 'FAILED',
         attempt_count = attempt_count + 1,
         last_attempt_at = CURRENT_TIMESTAMP,
         last_error = ?,
         updated_at = CURRENT_TIMESTAMP`,
      [botId, subject, mysqlStart, mysqlEnd, errorMessage || null, errorMessage || null]
    );
    return true;
  }

  static async listRegisteredKeySetInRange({ botId, startIso, endIso }) {
    await ensureTable();
    const mysqlStart = toMySQLDateTime(startIso);
    const mysqlEnd = toMySQLDateTime(endIso);
    if (!mysqlStart || !mysqlEnd) return new Set();

    const [rows] = await db.execute(
      `SELECT subject, start_datetime as startDt, end_datetime as endDt
       FROM pa_registrations
       WHERE bot_id = ?
         AND status = 'REGISTERED'
         AND start_datetime >= ?
         AND end_datetime <= ?`,
      [botId, mysqlStart, mysqlEnd]
    );

    const set = new Set();
    for (const r of rows) {
      set.add(`${r.subject}||${r.startDt}||${r.endDt}`);
    }
    return set;
  }

  static async deleteInRange({ botId, startIso, endIso }) {
    await ensureTable();
    const mysqlStart = toMySQLDateTime(startIso);
    const mysqlEnd = toMySQLDateTime(endIso);
    if (!mysqlStart || !mysqlEnd) return 0;

    const [result] = await db.execute(
      `DELETE FROM pa_registrations
       WHERE bot_id = ?
         AND start_datetime >= ?
         AND end_datetime <= ?`,
      [botId, mysqlStart, mysqlEnd]
    );

    return result?.affectedRows || 0;
  }
}

module.exports = PowerAutomateRegistration;


