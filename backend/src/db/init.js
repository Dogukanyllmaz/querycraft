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
  `);

  database.exec(`
    CREATE INDEX IF NOT EXISTS idx_connections_user_id ON connections(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_user_id ON reports(user_id);
    CREATE INDEX IF NOT EXISTS idx_reports_connection_id ON reports(connection_id);
    CREATE INDEX IF NOT EXISTS idx_report_runs_report_id ON report_runs(report_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_rp_report ON report_permissions(report_id);
    CREATE INDEX IF NOT EXISTS idx_rp_user ON report_permissions(user_id);
  `);

  // Migration: add role column to users if missing (existing DBs)
  const userCols = database.prepare('PRAGMA table_info(users)').all();
  if (!userCols.some((c) => c.name === 'role')) {
    database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'viewer'");
    // Treat all existing users as admins — they were the original setup users
    database.exec("UPDATE users SET role = 'admin'");
    logger.info('Migration: added role column to users, set all existing users to admin');
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
