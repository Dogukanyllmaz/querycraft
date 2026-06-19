'use strict';

const { v4: uuidv4 } = require('uuid');
const knex = require('knex');
const { db } = require('../db/init');
const { encryptPassword, decryptPassword } = require('./encryption');

// ─── Connection pool cache ────────────────────────────────────────────────────
// Reuse knex pools across requests so we don't pay TCP handshake cost every time.
const _pools = new Map();

function getPool(conn) {
  if (_pools.has(conn.id)) return _pools.get(conn.id);
  const pool = knex({
    ...buildKnexConfig(conn),
    pool: { min: 1, max: 5, acquireTimeoutMillis: 15000, idleTimeoutMillis: 30000 },
  });
  _pools.set(conn.id, pool);
  return pool;
}

function evictPool(connectionId) {
  if (_pools.has(connectionId)) {
    _pools.get(connectionId).destroy().catch(() => {});
    _pools.delete(connectionId);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

function buildKnexConfig(conn) {
  const base = {
    host: conn.host,
    port: Number(conn.port),
    database: conn.database,
    user: conn.username,
    password: conn.password,
  };

  switch (conn.connection_type) {
    case 'mysql':
      return { client: 'mysql2', connection: { ...base, connectTimeout: 10000 } };
    case 'postgresql':
      return { client: 'pg', connection: { ...base, connectionTimeoutMillis: 10000 } };
    case 'sqlserver':
      return {
        client: 'mssql',
        connection: {
          server: conn.host,
          port: Number(conn.port),
          database: conn.database,
          user: conn.username,
          password: conn.password,
          options: { encrypt: false, trustServerCertificate: true },
          connectionTimeout: 15000,
          requestTimeout: 30000,
        },
      };
    default:
      throw new Error(`Unsupported connection type: ${conn.connection_type}`);
  }
}

async function testConnection(config) {
  // Test uses a throw-away connection — no pool cache needed
  const k = knex(buildKnexConfig({ ...config, id: '__test__' }));
  try {
    await k.raw('SELECT 1');
    return { success: true };
  } catch (err) {
    return { success: false, message: sanitizeDbError(err.message) };
  } finally {
    await k.destroy();
  }
}

async function createConnection(userId, data) {
  const id = uuidv4();
  const now = new Date().toISOString();
  const passwordEncrypted = encryptPassword(data.password);

  db().prepare(`
    INSERT INTO connections (id, user_id, name, connection_type, host, port, database, username, password_encrypted, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, userId, data.name, data.connection_type, data.host, data.port, data.database, data.username, passwordEncrypted, now, now);

  return getConnectionById(id, userId);
}

function getConnections(userId) {
  return db().prepare(
    'SELECT id, name, connection_type, host, port, database, username, created_at, updated_at FROM connections WHERE user_id = ? ORDER BY created_at DESC'
  ).all(userId);
}

function getConnectionById(id, userId) {
  return db().prepare(
    'SELECT id, name, connection_type, host, port, database, username, created_at, updated_at FROM connections WHERE id = ? AND user_id = ?'
  ).get(id, userId);
}

function getConnectionWithCredentials(id, userId) {
  const row = db().prepare('SELECT * FROM connections WHERE id = ? AND user_id = ?').get(id, userId);
  if (!row) return null;
  return { ...row, password: decryptPassword(row.password_encrypted) };
}

async function updateConnection(id, userId, data) {
  const existing = getConnectionById(id, userId);
  if (!existing) return null;

  evictPool(id); // credentials changed — drop old pool

  const passwordEncrypted = encryptPassword(data.password);
  const now = new Date().toISOString();

  db().prepare(`
    UPDATE connections SET name=?, connection_type=?, host=?, port=?, database=?, username=?, password_encrypted=?, updated_at=?
    WHERE id=? AND user_id=?
  `).run(data.name, data.connection_type, data.host, data.port, data.database, data.username, passwordEncrypted, now, id, userId);

  return getConnectionById(id, userId);
}

function deleteConnection(id, userId) {
  evictPool(id);
  const result = db().prepare('DELETE FROM connections WHERE id = ? AND user_id = ?').run(id, userId);
  return Number(result.changes) > 0;
}

async function getTables(connectionId, userId) {
  const conn = getConnectionWithCredentials(connectionId, userId);
  if (!conn) throw notFoundError();

  const k = getPool(conn);
  switch (conn.connection_type) {
    case 'mysql': {
      const rows = await k.raw('SHOW FULL TABLES');
      return rows[0].map((r) => {
        const vals = Object.values(r);
        return { name: String(vals[0]), type: vals[1] === 'VIEW' ? 'view' : 'table' };
      });
    }
    case 'postgresql': {
      const rows = await k.raw(
        "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name"
      );
      return rows.rows.map((r) => ({ name: r.table_name, type: r.table_type === 'VIEW' ? 'view' : 'table' }));
    }
    case 'sqlserver': {
      const rows = await k.raw(
        "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW') ORDER BY TABLE_NAME"
      );
      return rows.map((r) => ({ name: r.TABLE_NAME, type: r.TABLE_TYPE === 'VIEW' ? 'view' : 'table' }));
    }
    default:
      throw new Error('Unsupported DB type');
  }
}

async function getTableSchema(connectionId, userId, tableName) {
  const conn = getConnectionWithCredentials(connectionId, userId);
  if (!conn) throw notFoundError();

  const k = getPool(conn);
  switch (conn.connection_type) {
    case 'mysql': {
      const rows = await k.raw('DESCRIBE ??', [tableName]);
      return rows[0].map((r) => ({ column: r.Field, type: r.Type, nullable: r.Null === 'YES' }));
    }
    case 'postgresql': {
      const rows = await k.raw(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = ? ORDER BY ordinal_position`,
        [tableName]
      );
      return rows.rows.map((r) => ({ column: r.column_name, type: r.data_type, nullable: r.is_nullable === 'YES' }));
    }
    case 'sqlserver': {
      const rows = await k.raw(
        `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? ORDER BY ORDINAL_POSITION`,
        [tableName]
      );
      return rows.map((r) => ({ column: r.COLUMN_NAME, type: r.DATA_TYPE, nullable: r.IS_NULLABLE === 'YES' }));
    }
    default:
      throw new Error('Unsupported DB type');
  }
}

async function getTableData(connectionId, userId, tableName, page = 1, limit = 100) {
  const { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../config/constants');
  const safeLimit = Math.min(Math.max(parseInt(limit) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE);
  const safePage = Math.max(parseInt(page) || 1, 1);
  const offset = (safePage - 1) * safeLimit;

  const conn = getConnectionWithCredentials(connectionId, userId);
  if (!conn) throw notFoundError();

  const k = getPool(conn);
  const [rows, countResult] = await Promise.all([
    k(tableName).select('*').limit(safeLimit).offset(offset),
    k(tableName).count('* as total'),
  ]);
  const total = Number(countResult[0].total);

  return {
    rows,
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  };
}

function sanitizeDbError(msg) {
  return msg
    .replace(/password=[^\s]*/gi, 'password=***')
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '***');
}

function notFoundError() {
  const err = new Error('Connection not found');
  err.statusCode = 404;
  err.code = 'NOT_FOUND';
  return err;
}

module.exports = {
  testConnection,
  createConnection,
  getConnections,
  getConnectionById,
  getConnectionWithCredentials,
  updateConnection,
  deleteConnection,
  getTables,
  getTableSchema,
  getTableData,
  buildKnexConfig,
  evictPool,
};
