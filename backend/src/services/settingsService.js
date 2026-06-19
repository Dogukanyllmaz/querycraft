'use strict';

const { db } = require('../db/init');

// In-memory cache — avoids DB hit on every request
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 60_000; // 60s

const DEFAULTS = {
  jwt_expires_in:            '15m',
  jwt_refresh_expires_in:    '7d',
  auth_rate_limit_max:       '20',
  auth_rate_limit_window_ms: '900000',
  max_login_attempts:        '5',
  lockout_duration_minutes:  '15',
  query_cache_ttl_seconds:   '300',
  query_timeout_ms:          '30000',
  pool_min:                  '1',
  pool_max:                  '5',
  smtp_enabled:              'false',
  smtp_host:                 '',
  smtp_port:                 '587',
  smtp_user:                 '',
  smtp_pass:                 '',
  smtp_from:                 '',
};

function invalidateCache() {
  _cache = null;
  _cacheTime = 0;
}

function getAllSettings() {
  const now = Date.now();
  if (_cache && now - _cacheTime < CACHE_TTL_MS) return _cache;

  const rows = db().prepare('SELECT key, value FROM system_settings').all();
  const result = { ...DEFAULTS };
  for (const row of rows) result[row.key] = row.value;
  _cache = result;
  _cacheTime = now;
  return result;
}

function getSetting(key, fallback) {
  return getAllSettings()[key] ?? fallback ?? DEFAULTS[key] ?? null;
}

function getPublicSettings() {
  const all = getAllSettings();
  const { smtp_pass, ...rest } = all; // eslint-disable-line no-unused-vars
  return rest;
}

function updateSettings(updates, userId) {
  const now = new Date().toISOString();
  const stmt = db().prepare(
    `INSERT INTO system_settings (key, value, updated_by, updated_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value      = excluded.value,
       updated_by = excluded.updated_by,
       updated_at = excluded.updated_at`
  );
  for (const [key, value] of Object.entries(updates)) {
    stmt.run(key, String(value), userId ?? null, now);
  }
  invalidateCache();
}

// Parses JWT duration strings ("15m", "7d", "1h") to milliseconds
function parseDurationMs(str) {
  if (!str) return 15 * 60 * 1000;
  const match = String(str).match(/^(\d+)([smhd])$/);
  if (!match) return 15 * 60 * 1000;
  const n = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default:  return 15 * 60 * 1000;
  }
}

module.exports = { getSetting, getAllSettings, getPublicSettings, updateSettings, invalidateCache, parseDurationMs };
