'use strict';

const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

/**
 * @param {import('express').Request} req  — for ip + user context
 * @param {string} action                  — e.g. 'LOGIN', 'RUN_REPORT'
 * @param {string} [resourceType]          — 'report' | 'connection' | 'user' | 'group'
 * @param {string} [resourceId]
 * @param {string} [resourceName]
 * @param {object} [metadata]
 */
function log(req, action, resourceType, resourceId, resourceName, metadata) {
  try {
    const id        = uuidv4();
    const userId    = req?.userId    ?? null;
    const userEmail = req?.userEmail ?? null;
    const ip        = req?.ip        ?? req?.connection?.remoteAddress ?? null;
    const now       = new Date().toISOString();

    db().prepare(
      `INSERT INTO audit_logs
         (id, user_id, user_email, action, resource_type, resource_id, resource_name, metadata, ip, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, userId, userEmail, action,
      resourceType ?? null, resourceId ?? null, resourceName ?? null,
      metadata ? JSON.stringify(metadata) : null,
      ip, now
    );
  } catch (err) {
    // Never let audit failure break the request
    console.error('[auditService] log error:', err.message);
  }
}

function getAuditLogs({ userId, action, from, to, limit = 100, offset = 0 } = {}) {
  let query = `SELECT * FROM audit_logs WHERE 1=1`;
  const params = [];

  if (userId)  { query += ` AND user_id = ?`;                params.push(userId); }
  if (action)  { query += ` AND action = ?`;                 params.push(action); }
  if (from)    { query += ` AND created_at >= ?`;            params.push(from); }
  if (to)      { query += ` AND created_at <= ?`;            params.push(to); }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Math.min(Number(limit), 500), Number(offset));

  const rows = db().prepare(query).all(...params);

  // Count for pagination
  let countQuery = `SELECT COUNT(*) as total FROM audit_logs WHERE 1=1`;
  const countParams = [];
  if (userId)  { countQuery += ` AND user_id = ?`;  countParams.push(userId); }
  if (action)  { countQuery += ` AND action = ?`;   countParams.push(action); }
  if (from)    { countQuery += ` AND created_at >= ?`; countParams.push(from); }
  if (to)      { countQuery += ` AND created_at <= ?`; countParams.push(to); }

  const { total } = db().prepare(countQuery).get(...countParams);

  return {
    logs: rows.map((r) => ({ ...r, metadata: r.metadata ? JSON.parse(r.metadata) : null })),
    total: Number(total),
  };
}

module.exports = { log, getAuditLogs };
