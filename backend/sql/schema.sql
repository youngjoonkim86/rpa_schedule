-- 데이터베이스 생성 (이미 생성했다면 생략)
CREATE DATABASE IF NOT EXISTS rpa_schedule_db 
CHARACTER SET utf8mb4 
COLLATE utf8mb4_unicode_ci;

USE rpa_schedule_db;

-- bot_schedules 테이블
CREATE TABLE IF NOT EXISTS bot_schedules (
  schedule_id INT AUTO_INCREMENT PRIMARY KEY,
  bot_id VARCHAR(50) NOT NULL,
  bot_name VARCHAR(100),
  subject VARCHAR(255) NOT NULL,
  start_datetime DATETIME NOT NULL,
  end_datetime DATETIME NOT NULL,
  body TEXT,
  process_id VARCHAR(100),
  source_system ENUM('POWER_AUTOMATE', 'BRITY_RPA', 'MANUAL') NOT NULL,
  status ENUM('ACTIVE', 'INACTIVE', 'DELETED') DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  INDEX idx_bot_id (bot_id),
  INDEX idx_start_datetime (start_datetime),
  INDEX idx_process_id (process_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- rpa_processes 테이블
CREATE TABLE IF NOT EXISTS rpa_processes (
  process_id VARCHAR(100) PRIMARY KEY,
  process_name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  metadata_json JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sync_logs 테이블
CREATE TABLE IF NOT EXISTS sync_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  sync_type ENUM('POWER_AUTOMATE', 'BRITY_RPA') NOT NULL,
  sync_status ENUM('SUCCESS', 'FAILED', 'PARTIAL') NOT NULL,
  records_synced INT DEFAULT 0,
  error_message TEXT,
  sync_datetime TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX idx_sync_datetime (sync_datetime),
  INDEX idx_sync_type (sync_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Power Automate 등록 상태 추적 테이블
-- - Brity(DB)에는 있지만 PA에 아직 등록되지 않은 스케줄(특히 미래)을 재시도하기 위해 필요
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

-- 초기 테스트 데이터
INSERT INTO bot_schedules (bot_id, bot_name, subject, start_datetime, end_datetime, source_system) VALUES
('BOT1', 'BOT1', '테스트 일정 1', '2026-01-15 09:00:00', '2026-01-15 10:00:00', 'MANUAL'),
('BOT2', 'BOT2', '테스트 일정 2', '2026-01-15 14:00:00', '2026-01-15 15:00:00', 'MANUAL'),
('BOT3', 'BOT3', '테스트 일정 3', '2026-01-16 11:00:00', '2026-01-16 12:00:00', 'MANUAL');


