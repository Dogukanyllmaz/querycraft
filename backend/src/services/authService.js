'use strict';

const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const crypto   = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { db }   = require('../db/init');
const { getSetting, parseDurationMs } = require('./settingsService');

const SALT_ROUNDS = 12;

// ── Helpers ──────────────────────────────────────────────────────────────────

function sha256(str) {
  return crypto.createHash('sha256').update(str).digest('hex');
}

function getJwtExpiry()        { return getSetting('jwt_expires_in', '15m'); }
function getRefreshExpiry()    { return getSetting('jwt_refresh_expires_in', '7d'); }
function getMaxAttempts()      { return parseInt(getSetting('max_login_attempts', '5'), 10); }
function getLockoutMinutes()   { return parseInt(getSetting('lockout_duration_minutes', '15'), 10); }

// ── Token generation ─────────────────────────────────────────────────────────

function generateTokens(userId, role, meta = {}) {
  const payload = { sub: userId, role };
  const expiresIn = getJwtExpiry();
  const refreshExpiresIn = getRefreshExpiry();

  const accessToken  = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });

  const rawRefreshToken = crypto.randomBytes(40).toString('hex');
  const tokenHash       = sha256(rawRefreshToken);
  const id              = uuidv4();
  const now             = new Date().toISOString();
  const expiresAt       = new Date(Date.now() + parseDurationMs(refreshExpiresIn)).toISOString();

  // Refresh token in signed JWT form (for cookie transport) + stored hash in DB
  const refreshToken = jwt.sign(
    { sub: userId, role, jti: id },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: refreshExpiresIn }
  );

  db().prepare(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, user_agent, ip, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, userId, sha256(refreshToken), meta.userAgent ?? null, meta.ip ?? null, now, expiresAt);

  return { accessToken, refreshToken };
}

// ── Account lockout ───────────────────────────────────────────────────────────

function checkLockout(email) {
  const row = db().prepare('SELECT * FROM login_attempts WHERE email = ?').get(email.toLowerCase());
  if (!row) return;
  if (row.locked_until && new Date(row.locked_until) > new Date()) {
    const unlockAt = new Date(row.locked_until).toLocaleTimeString('tr-TR');
    const err = new Error(`Hesap kilitlendi. ${unlockAt} sonra tekrar deneyin.`);
    err.statusCode = 429; err.code = 'ACCOUNT_LOCKED';
    throw err;
  }
}

function recordFailedAttempt(email) {
  const max = getMaxAttempts();
  const lockoutMs = getLockoutMinutes() * 60 * 1000;
  const now = new Date().toISOString();
  const existing = db().prepare('SELECT * FROM login_attempts WHERE email = ?').get(email.toLowerCase());

  if (!existing) {
    db().prepare(
      'INSERT INTO login_attempts (email, failed_count, last_attempt) VALUES (?, 1, ?)'
    ).run(email.toLowerCase(), now);
    return;
  }

  const newCount = (existing.failed_count ?? 0) + 1;
  const lockedUntil = newCount >= max
    ? new Date(Date.now() + lockoutMs).toISOString()
    : null;

  db().prepare(
    'UPDATE login_attempts SET failed_count = ?, last_attempt = ?, locked_until = ? WHERE email = ?'
  ).run(newCount, now, lockedUntil, email.toLowerCase());
}

function clearLoginAttempts(email) {
  db().prepare(
    'UPDATE login_attempts SET failed_count = 0, locked_until = NULL WHERE email = ?'
  ).run(email.toLowerCase());
}

// ── Auth operations ───────────────────────────────────────────────────────────

function getUserCount() {
  const row = db().prepare('SELECT COUNT(*) as count FROM users').get();
  return Number(row.count);
}

async function signup(email, password) {
  if (getUserCount() > 0) {
    const err = new Error('Registration is closed. Contact your administrator to create an account.');
    err.statusCode = 403; err.code = 'REGISTRATION_CLOSED';
    throw err;
  }

  const existing = db().prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409; err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uuidv4();
  const now = new Date().toISOString();
  const role = 'admin';

  db().prepare(
    'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase(), passwordHash, role, now, now);

  const user = { id, email: email.toLowerCase(), role, created_at: now };
  const tokens = generateTokens(id, role);
  return { user, tokens };
}

async function login(email, password, meta = {}) {
  const emailLower = email.toLowerCase();

  checkLockout(emailLower);

  const row = db().prepare('SELECT * FROM users WHERE email = ?').get(emailLower);
  const hashToCheck = row ? row.password_hash : '$2a$12$invaliddummyhashfortimingatk.';
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!row || !valid) {
    recordFailedAttempt(emailLower);
    const err = new Error('Invalid email or password');
    err.statusCode = 401; err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  clearLoginAttempts(emailLower);

  const user   = { id: row.id, email: row.email, role: row.role, display_name: row.display_name, created_at: row.created_at };
  const tokens = generateTokens(row.id, row.role, meta);
  return { user, tokens };
}

function getUserById(id) {
  const row = db().prepare(
    'SELECT id, email, role, display_name, created_at FROM users WHERE id = ?'
  ).get(id);
  return row || null;
}

// ── Token operations ──────────────────────────────────────────────────────────

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyRefreshToken(token) {
  const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

  // DB check — must not be revoked
  const tokenHash = sha256(token);
  const stored = db().prepare(
    `SELECT * FROM refresh_tokens WHERE token_hash = ? AND revoked = 0`
  ).get(tokenHash);

  if (!stored) {
    const err = new Error('Refresh token revoked or invalid');
    err.statusCode = 401; err.code = 'TOKEN_REVOKED';
    throw err;
  }

  if (new Date(stored.expires_at) < new Date()) {
    const err = new Error('Refresh token expired');
    err.statusCode = 401; err.code = 'TOKEN_EXPIRED';
    throw err;
  }

  return payload;
}

function revokeToken(rawToken) {
  const tokenHash = sha256(rawToken);
  const now = new Date().toISOString();
  db().prepare(
    'UPDATE refresh_tokens SET revoked = 1, revoked_at = ? WHERE token_hash = ?'
  ).run(now, tokenHash);
}

function revokeAllUserTokens(userId) {
  const now = new Date().toISOString();
  db().prepare(
    'UPDATE refresh_tokens SET revoked = 1, revoked_at = ? WHERE user_id = ? AND revoked = 0'
  ).run(now, userId);
}

function getActiveSessions(userId) {
  return db().prepare(
    `SELECT id, user_agent, ip, created_at, expires_at
     FROM refresh_tokens
     WHERE user_id = ? AND revoked = 0 AND expires_at > ?
     ORDER BY created_at DESC`
  ).all(userId, new Date().toISOString());
}

// ── Password management ───────────────────────────────────────────────────────

async function changePassword(userId, currentPassword, newPassword) {
  const row = db().prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!row) { const err = new Error('User not found'); err.statusCode = 404; err.code = 'NOT_FOUND'; throw err; }

  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) {
    const err = new Error('Current password is incorrect');
    err.statusCode = 400; err.code = 'INVALID_PASSWORD';
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const now = new Date().toISOString();
  db().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(newHash, now, userId);
  revokeAllUserTokens(userId);
}

async function createPasswordResetToken(email) {
  const user = db().prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  // Always resolve successfully to prevent user enumeration
  if (!user) return null;

  // Invalidate any existing tokens for this user
  db().prepare('UPDATE password_reset_tokens SET used = 1 WHERE user_id = ?').run(user.id);

  const rawToken  = crypto.randomBytes(32).toString('hex');
  const tokenHash = sha256(rawToken);
  const id        = uuidv4();
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour
  const now       = new Date().toISOString();

  db().prepare(
    `INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, used, created_at)
     VALUES (?, ?, ?, ?, 0, ?)`
  ).run(id, user.id, tokenHash, expiresAt, now);

  return { rawToken, email: email.toLowerCase() };
}

async function resetPassword(rawToken, newPassword) {
  const tokenHash = sha256(rawToken);

  const tokenRow = db().prepare(
    `SELECT * FROM password_reset_tokens
     WHERE token_hash = ? AND used = 0 AND expires_at > ?`
  ).get(tokenHash, new Date().toISOString());

  if (!tokenRow) {
    const err = new Error('Geçersiz veya süresi dolmuş sıfırlama bağlantısı');
    err.statusCode = 400; err.code = 'INVALID_TOKEN';
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const now = new Date().toISOString();

  db().prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(newHash, now, tokenRow.user_id);
  db().prepare('UPDATE password_reset_tokens SET used = 1 WHERE id = ?')
    .run(tokenRow.id);

  revokeAllUserTokens(tokenRow.user_id);
}

module.exports = {
  signup, login, getUserById, getUserCount, generateTokens,
  verifyAccessToken, verifyRefreshToken,
  revokeToken, revokeAllUserTokens, getActiveSessions,
  changePassword, createPasswordResetToken, resetPassword,
};
