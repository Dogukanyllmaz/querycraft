'use strict';

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');
const { DB_PATH } = require('../config/database');
const logger = require('../utils/logger');

function openDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const database = new DatabaseSync(DB_PATH);
  database.exec('PRAGMA journal_mode = WAL');
  database.exec('PRAGMA foreign_keys = ON');
  return database;
}

function initDb() {
  const database = openDb();

  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role TEXT NOT NULL DEFAULT 'viewer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      connection_type VARCHAR(50) NOT NULL,
      host VARCHAR(255) NOT NULL,
      port INTEGER NOT NULL,
      database VARCHAR(255) NOT NULL,
      username VARCHAR(255) NOT NULL,
      password_encrypted VARCHAR(500) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      connection_id TEXT NOT NULL,
      name VARCHAR(255) NOT NULL,
      config TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_run DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (connection_id) REFERENCES connections(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS report_runs (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      row_count INTEGER,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS report_permissions (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(report_id, user_id)
    );

    -- ── Enterprise extensions ────────────────────────────────────────────────

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      user_agent TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked INTEGER DEFAULT 0,
      revoked_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      email TEXT PRIMARY KEY,
      failed_count INTEGER DEFAULT 0,
      last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
      locked_until DATETIME
    );

    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      added_by TEXT,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, user_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS group_report_permissions (
      group_id TEXT NOT NULL,
      report_id TEXT NOT NULL,
      granted_by TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (group_id, report_id),
      FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      FOREIGN KEY (granted_by) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_email TEXT,
      action TEXT NOT NULL,
      resource_type TEXT,
      resource_id TEXT,
      resource_name TEXT,
      metadata TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS report_cache (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      config_hash TEXT NOT NULL,
      row_count INTEGER,
      data TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE,
      UNIQUE(report_id, config_hash)
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      description TEXT,
      updated_by TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_connection_id ON reports(connection_id);
    CREATE INDEX IF NOT EXISTS idx_report_runs_report_id ON report_runs(report_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_rp_report ON report_permissions(report_id);
    CREATE INDEX IF NOT EXISTS idx_rp_user ON report_permissions(user_id);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_groups_name ON groups(name);
    CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
    CREATE INDEX IF NOT EXISTS idx_grp_perms_report ON group_report_permissions(report_id);
    CREATE INDEX IF NOT EXISTS idx_rt_user ON refresh_tokens(user_id);
    CREATE INDEX IF NOT EXISTS idx_rt_hash ON refresh_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_prt_hash ON password_reset_tokens(token_hash);
    CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    CREATE INDEX IF NOT EXISTS idx_reports_updated ON reports(updated_at);
    CREATE INDEX IF NOT EXISTS idx_report_cache_expires ON report_cache(expires_at);
  `);

  // ── Migrations ────────────────────────────────────────────────────────────
  const userCols = database.prepare('PRAGMA table_info(users)').all();

  if (!userCols.some((c) => c.name === 'role')) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'");
    database.exec("UPDATE users SET role = 'admin'");
    logger.info('Migration: added role column to users');
  }

  if (!userCols.some((c) => c.name === 'display_name')) {
    database.exec('ALTER TABLE users ADD COLUMN display_name VARCHAR(100)');
    logger.info('Migration: added display_name column to users');
  }

  // ── Seed default system_settings ─────────────────────────────────────────
  const settingsSeed = [
    ['jwt_expires_in',            '15m',     'Access token süresi'],
    ['jwt_refresh_expires_in',    '7d',      'Refresh token süresi'],
    ['auth_rate_limit_max',       '20',      'Auth endpoint max istek (pencere başına)'],
    ['auth_rate_limit_window_ms', '900000',  'Auth limiter penceresi (ms)'],
    ['max_login_attempts',        '5',       'Kilitlenmeden önce max hatalı giriş'],
    ['lockout_duration_minutes',  '15',      'Hesap kilitlenme süresi (dakika)'],
    ['query_cache_ttl_seconds',   '300',     'Rapor önbellek süresi (saniye, 0=kapalı)'],
    ['query_timeout_ms',          '30000',   'Sorgu zaman aşımı (ms)'],
    ['pool_min',                  '1',       'DB bağlantı havuzu minimum'],
    ['pool_max',                  '5',       'DB bağlantı havuzu maksimum'],
    ['smtp_enabled',              'false',   'E-posta gönderimini etkinleştir'],
    ['smtp_host',                 '',        'SMTP sunucu adresi'],
    ['smtp_port',                 '587',     'SMTP port (587=TLS, 465=SSL, 25=düz)'],
    ['smtp_user',                 '',        'SMTP kullanıcı adı'],
    ['smtp_pass',                 '',        'SMTP şifresi (şifreli saklanır)'],
    ['smtp_from',                 '',        'Gönderen e-posta adresi'],
  ];
  const seedStmt = database.prepare(
    'INSERT OR IGNORE INTO system_settings (key, value, description) VALUES (?, ?, ?)'
  );
  for (const [key, value, description] of settingsSeed) {
    seedStmt.run(key, value, description);
  }

  logger.info('Database initialized at', DB_PATH);
  return database;
}

let _db = null;

function db() {
  if (!_db) {
    _db = initDb();
  }
  return _db;
}

module.exports = { db, initDb };

if (require.main === module) {
  initDb();
  process.exit(0);
}
