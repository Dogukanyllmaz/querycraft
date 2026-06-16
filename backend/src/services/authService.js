'use strict';

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

const SALT_ROUNDS = 12;

function generateTokens(userId) {
  const payload = { sub: userId };

  const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
  });

  const refreshToken = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  });

  return { accessToken, refreshToken };
}

async function signup(email, password) {
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

  db().prepare(
    'INSERT INTO users (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, email.toLowerCase(), passwordHash, now, now);

  const user = { id, email: email.toLowerCase(), created_at: now };
  const tokens = generateTokens(id);
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

  const user = { id: row.id, email: row.email, created_at: row.created_at };
  const tokens = generateTokens(row.id);
  return { user, tokens };
}

function getUserById(id) {
  const row = db().prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(id);
  return row || null;
}

function verifyAccessToken(token) {
  return jwt.verify(token, process.env.JWT_SECRET);
}

function verifyRefreshToken(token) {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
}

module.exports = { signup, login, getUserById, generateTokens, verifyAccessToken, verifyRefreshToken };
