'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

const SALT_ROUNDS = 12;

function generateTokens(userId, role) {
  const payload = { sub: userId, role };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  return { accessToken, refreshToken };
}

function getUserCount() {
  const row = db().prepare('SELECT COUNT(*) as count FROM users').get();
  return Number(row.count);
}

async function signup(email, password) {
  // Signup is only allowed for the very first user (who becomes admin)
  if (getUserCount() > 0) {
    const err = new Error('Registration is closed. Contact your administrator to create an account.');
    err.statusCode = 403;
    err.code = 'REGISTRATION_CLOSED';
    throw err;
  }

  const existing = db().prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    const err = new Error('Email already registered');
    err.statusCode = 409;
    err.code = 'EMAIL_EXISTS';
    throw err;
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = uuidv4();
  const now = new Date().toISOString();
  const role = 'admin'; // First user is always admin

  db().prepare(
    'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase(), passwordHash, role, now, now);

  const user = { id, email: email.toLowerCase(), role, created_at: now };
  const tokens = generateTokens(id, role);
  return { user, tokens };
}

async function login(email, password) {
  const row = db().prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());

  // constant-time to prevent user enumeration
  const hashToCheck = row ? row.password_hash : '$2a$12$invaliddummyhashfortimingatk.';
  const valid = await bcrypt.compare(password, hashToCheck);

  if (!row || !valid) {
    const err = new Error('Invalid email or password');
    err.statusCode = 401;
    err.code = 'INVALID_CREDENTIALS';
    throw err;
  }

  const user = { id: row.id, email: row.email, role: row.role, created_at: row.created_at };
  const tokens = generateTokens(row.id, row.role);
  return { user, tokens };
}

function getUserById(id) {
  const row = db().prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(id);
  return row || null;
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = { signup, login, getUserById, getUserCount, generateTokens, verifyAccessToken, verifyRefreshToken };
