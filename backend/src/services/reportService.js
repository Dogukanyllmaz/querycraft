'use strict';

const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const knex   = require('knex');
const { db } = require('../db/init');
const { getConnectionWithCredentials, buildKnexConfig } = require('./connectionManager');
const { buildQuery } = require('./queryBuilder');
const { hasAccess } = require('./reportPermissionsService');
const { getSetting } = require('./settingsService');

// ── Cross-connection JOIN helpers ─────────────────────────────────────────────

async function fetchForeignTable(conn, tableName) {
  const k = knex(buildKnexConfig(conn));
  try {
    return await k(tableName).select('*').limit(50_000);
  } finally {
    await k.destroy();
  }
}

function colName(qualified) {
  return qualified.includes('.') ? qualified.split('.').pop() : qualified;
}

function performHashJoin(leftRows, rightRows, join) {
  const { type, on } = join;
  const leftCol  = colName(on.leftColumn);
  const rightCol = colName(on.rightColumn);

  if (type === 'RIGHT') {
    const leftMap = new Map();
    for (const l of leftRows) {
      const key = String(l[leftCol] ?? '');
      if (!leftMap.has(key)) leftMap.set(key, []);
      leftMap.get(key).push(l);
    }
    const result = [];
    for (const right of rightRows) {
      const key = String(right[rightCol] ?? '');
      const matches = leftMap.get(key) ?? [];
      if (matches.length > 0) {
        for (const left of matches) result.push({ ...left, ...right });
      } else {
        result.push({ ...right });
      }
    }
    return result;
  }

  const rightMap = new Map();
  for (const r of rightRows) {
    const key = String(r[rightCol] ?? '');
    if (!rightMap.has(key)) rightMap.set(key, []);
    rightMap.get(key).push(r);
  }
  const result = [];
  for (const left of leftRows) {
    const key = String(left[leftCol] ?? '');
    const matches = rightMap.get(key) ?? [];
    if (matches.length > 0) {
      for (const right of matches) result.push({ ...left, ...right });
    } else if (type === 'LEFT') {
      result.push({ ...left });
    }
  }
  return result;
}

function safeParseJson(str) {
  try { return str ? JSON.parse(str) : {} } catch { return {} }
}

// Admin: own reports only
function getReports(userId) {
  return db()
    .prepare(
      `SELECT r.id, r.name, r.connection_id, r.config, r.created_at, r.updated_at, r.last_run,
              c.name as connection_name, c.connection_type
       FROM reports r
       JOIN connections c ON c.id = r.connection_id
       WHERE r.user_id = ?
       ORDER BY r.updated_at DESC`
    )
    .all(userId)
    .map((row) => ({ ...row, config: safeParseJson(row.config) }));
}

// Viewer: only reports with a permission entry
function getReportsForViewer(userId) {
  return db()
    .prepare(
      `SELECT r.id, r.name, r.connection_id, r.config, r.created_at, r.updated_at, r.last_run,
              c.name as connection_name, c.connection_type
       FROM reports r
       JOIN connections c ON c.id = r.connection_id
       JOIN report_permissions rp ON rp.report_id = r.id AND rp.user_id = ?
       ORDER BY r.updated_at DESC`
    )
    .all(userId)
    .map((row) => ({ ...row, config: safeParseJson(row.config) }));
}

// Admin: own report by ID
function getReportById(id, userId) {
  const row = db()
    .prepare(
      `SELECT r.*, c.name as connection_name, c.connection_type
       FROM reports r
       JOIN connections c ON c.id = r.connection_id
       WHERE r.id = ? AND r.user_id = ?`
    )
    .get(id, userId);

  if (!row) return null;
  return { ...row, config: safeParseJson(row.config) };
}

// Internal: get report without user_id restriction (used when a viewer executes/views a report)
function getReportByIdRaw(id) {
  const row = db()
    .prepare(
      `SELECT r.*, c.name as connection_name, c.connection_type
       FROM reports r
       JOIN connections c ON c.id = r.connection_id
       WHERE r.id = ?`
    )
    .get(id);

  if (!row) return null;
  return { ...row, config: safeParseJson(row.config) };
}

// ── Query cache helpers ────────────────────────────────────────────────────────

function configHash(config) {
  return crypto.createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

function getCacheEntry(reportId, config) {
  const hash = configHash(config);
  return db().prepare(
    `SELECT * FROM report_cache
     WHERE report_id = ? AND config_hash = ? AND expires_at > ?`
  ).get(reportId, hash, new Date().toISOString());
}

function setCacheEntry(reportId, config, rows) {
  const ttl = parseInt(getSetting('query_cache_ttl_seconds', '300'), 10);
  if (ttl <= 0 || rows.length > 5000) return;

  const hash      = configHash(config);
  const id        = uuidv4();
  const now       = new Date().toISOString();
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  db().prepare(
    `INSERT INTO report_cache (id, report_id, config_hash, row_count, data, created_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(report_id, config_hash) DO UPDATE SET
       data = excluded.data, row_count = excluded.row_count,
       created_at = excluded.created_at, expires_at = excluded.expires_at`
  ).run(id, reportId, hash, rows.length, JSON.stringify(rows), now, expiresAt);
}

function bustCache(reportId) {
  db().prepare('DELETE FROM report_cache WHERE report_id = ?').run(reportId);
}

function createReport(userId, data) {
  const id = uuidv4();
  const now = new Date().toISOString();

  db()
    .prepare(
      `INSERT INTO reports (id, user_id, connection_id, name, config, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(id, userId, data.connection_id, data.name, JSON.stringify(data.config), now, now);

  return getReportById(id, userId);
}

function updateReport(id, userId, data) {
  const existing = getReportById(id, userId);
  if (!existing) return null;

  const now = new Date().toISOString();
  db()
    .prepare(
      `UPDATE reports SET name=?, connection_id=?, config=?, updated_at=? WHERE id=? AND user_id=?`
    )
    .run(data.name, data.connection_id, JSON.stringify(data.config), now, id, userId);

  bustCache(id);
  return getReportById(id, userId);
}

function deleteReport(id, userId) {
  const result = db().prepare('DELETE FROM reports WHERE id = ? AND user_id = ?').run(id, userId);
  return Number(result.changes) > 0;
}

async function executeReport(id, userId, userRole, { bust = false } = {}) {
  let report;
  if (userRole === 'viewer') {
    if (!hasAccess(id, userId)) {
      const err = new Error('Report not found');
      err.statusCode = 404; err.code = 'NOT_FOUND';
      throw err;
    }
    report = getReportByIdRaw(id);
  } else {
    report = getReportById(id, userId);
  }

  if (!report) {
    const err = new Error('Report not found');
    err.statusCode = 404; err.code = 'NOT_FOUND';
    throw err;
  }

  // Cache check
  if (!bust) {
    const cached = getCacheEntry(id, report.config);
    if (cached) {
      return {
        rows:       JSON.parse(cached.data),
        rowCount:   cached.row_count,
        executedAt: cached.created_at,
        fromCache:  true,
      };
    }
  }

  const conn = getConnectionWithCredentials(report.connection_id, report.user_id);
  if (!conn) {
    const err = new Error('Connection not found or access denied');
    err.statusCode = 404; err.code = 'NOT_FOUND';
    throw err;
  }

  const primaryConnId = report.connection_id;
  const allJoins      = report.config.joins ?? [];
  const localJoins    = allJoins.filter((j) => !j.connectionId || j.connectionId === primaryConnId);
  const foreignJoins  = allJoins.filter((j) => j.connectionId && j.connectionId !== primaryConnId);

  const k = knex(buildKnexConfig(conn));
  try {
    let rows = await buildQuery(k, { ...report.config, joins: localJoins });

    for (const fJoin of foreignJoins) {
      const fConn = getConnectionWithCredentials(fJoin.connectionId, report.user_id);
      if (!fConn) {
        const err = new Error(`Cross-connection not found: ${fJoin.connectionId}`);
        err.statusCode = 404; err.code = 'NOT_FOUND';
        throw err;
      }
      const rightRows = await fetchForeignTable(fConn, fJoin.table);
      rows = performHashJoin(rows, rightRows, fJoin);
    }

    const runId = uuidv4();
    const now   = new Date().toISOString();

    db().prepare(
      `INSERT INTO report_runs (id, report_id, executed_at, row_count) VALUES (?, ?, ?, ?)`
    ).run(runId, id, now, rows.length);

    db().prepare(`UPDATE reports SET last_run=?, updated_at=? WHERE id=?`).run(now, now, id);

    setCacheEntry(id, report.config, rows);

    return { rows, rowCount: rows.length, executedAt: now, fromCache: false };
  } finally {
    await k.destroy();
  }
}

async function previewReport(userId, config, connectionId) {
  const conn = getConnectionWithCredentials(connectionId, userId);
  if (!conn) {
    const err = new Error('Connection not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const allJoins    = config.joins ?? [];
  const localJoins  = allJoins.filter((j) => !j.connectionId || j.connectionId === connectionId);
  const foreignJoins = allJoins.filter((j) => j.connectionId && j.connectionId !== connectionId);

  const previewConfig = { ...config, joins: localJoins, limit: Math.min(config.limit || 50, 50) };
  const k = knex(buildKnexConfig(conn));
  try {
    let rows = await buildQuery(k, previewConfig);

    for (const fJoin of foreignJoins) {
      const fConn = getConnectionWithCredentials(fJoin.connectionId, userId);
      if (!fConn) continue;
      const rightRows = await fetchForeignTable(fConn, fJoin.table);
      rows = performHashJoin(rows, rightRows, fJoin);
    }

    return { rows, rowCount: rows.length };
  } finally {
    await k.destroy();
  }
}

module.exports = {
  getReports, getReportsForViewer, getReportById, getReportByIdRaw,
  createReport, updateReport, deleteReport, executeReport, previewReport,
  bustCache,
};
