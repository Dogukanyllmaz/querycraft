'use strict';

const { v4: uuidv4 } = require('uuid');
const knex = require('knex');
const { db } = require('../db/init');
const { getConnectionWithCredentials, buildKnexConfig } = require('./connectionManager');
const { buildQuery } = require('./queryBuilder');
const { hasAccess } = require('./reportPermissionsService');

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

  return getReportById(id, userId);
}

function deleteReport(id, userId) {
  const result = db().prepare('DELETE FROM reports WHERE id = ? AND user_id = ?').run(id, userId);
  return Number(result.changes) > 0;
}

async function executeReport(id, userId, userRole) {
  let report;
  if (userRole === 'viewer') {
    if (!hasAccess(id, userId)) {
      const err = new Error('Report not found');
      err.statusCode = 404;
      err.code = 'NOT_FOUND';
      throw err;
    }
    report = getReportByIdRaw(id);
  } else {
    report = getReportById(id, userId);
  }

  if (!report) {
    const err = new Error('Report not found');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Connection is always fetched using the admin owner's user_id (viewers don't own the connection)
  const conn = getConnectionWithCredentials(report.connection_id, report.user_id);
  if (!conn) {
    const err = new Error('Connection not found or access denied');
    err.statusCode = 404;
    err.code = 'NOT_FOUND';
    throw err;
  }

  const k = knex(buildKnexConfig(conn));
  try {
    const rows = await buildQuery(k, report.config);
    const runId = uuidv4();
    const now = new Date().toISOString();

    db()
      .prepare(
        `INSERT INTO report_runs (id, report_id, executed_at, row_count) VALUES (?, ?, ?, ?)`
      )
      .run(runId, id, now, rows.length);

    db()
      .prepare(`UPDATE reports SET last_run=?, updated_at=? WHERE id=?`)
      .run(now, now, id);

    return { rows, rowCount: rows.length, executedAt: now };
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

  const previewConfig = { ...config, limit: Math.min(config.limit || 50, 50) };
  const k = knex(buildKnexConfig(conn));
  try {
    const rows = await buildQuery(k, previewConfig);
    return { rows, rowCount: rows.length };
  } finally {
    await k.destroy();
  }
}

module.exports = {
  getReports,
  getReportsForViewer,
  getReportById,
  getReportByIdRaw,
  createReport,
  updateReport,
  deleteReport,
  executeReport,
  previewReport,
};
