'use strict';

const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

const SALT_ROUNDS = 12;
const VALID_ROLES = ['admin', 'viewer'];

function listUsers() {
  return db()
    .prepare('SELECT id, email, role, created_at FROM users ORDER BY created_at ASC')
    .all();
}

async function createUser(email, password, role = 'viewer') {
  if (!VALID_ROLES.includes(role)) {
    const err = new Error(`Invalid role: ${role}`);
    err.statusCode = 400;
    err.code = 'INVALID_ROLE';
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

  db()
    .prepare(
      'INSERT INTO users (id, email, password_hash, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    )
    .run(id, email.toLowerCase(), passwordHash, role, now, now);

  return { id, email: email.toLowerCase(), role, created_at: now };
}

function updateUserRole(id, role, requesterId) {
  if (!VALID_ROLES.includes(role)) {
    const err = new Error(`Invalid role: ${role}`);
    err.statusCode = 400;
    err.code = 'INVALID_ROLE';
    throw err;
  }

  if (id === requesterId) {
    const err = new Error('You cannot change your own role');
    err.statusCode = 403;
    err.code = 'SELF_ROLE_CHANGE';
    throw err;
  }

  const user = db().prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const now = new Date().toISOString();
  db().prepare('UPDATE users SET role = ?, updated_at = ? WHERE id = ?').run(role, now, id);

  return db().prepare('SELECT id, email, role, created_at FROM users WHERE id = ?').get(id);
}

function deleteUser(id, requesterId) {
  if (id === requesterId) {
    const err = new Error('You cannot delete your own account');
    err.statusCode = 403;
    err.code = 'SELF_DELETE';
    throw err;
  }

  const result = db().prepare('DELETE FROM users WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

module.exports = { listUsers, createUser, updateUserRole, deleteUser };
