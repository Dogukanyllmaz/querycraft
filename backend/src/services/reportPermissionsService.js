'use strict';

const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

/** Returns true if userId has permission to view the given report (or owns it as admin). */
function hasAccess(reportId, userId) {
  const row = db()
    .prepare('SELECT id FROM report_permissions WHERE report_id = ? AND user_id = ?')
    .get(reportId, userId);
  return Boolean(row);
}

/** List all users who have been granted access to a report. */
function getPermissions(reportId) {
  return db()
    .prepare(
      `SELECT u.id, u.email, u.role, rp.created_at as granted_at, gb.email as granted_by_email
       FROM report_permissions rp
       JOIN users u  ON u.id  = rp.user_id
       JOIN users gb ON gb.id = rp.granted_by
       WHERE rp.report_id = ?
       ORDER BY rp.created_at ASC`
    )
    .all(reportId);
}

/**
 * Grant a viewer access to a report.
 * Looks up the viewer by email and inserts a permission row.
 * Throws if user not found, user is an admin, or permission already exists.
 */
function grantAccess(reportId, email, grantedBy) {
  const user = db()
    .prepare("SELECT id, role FROM users WHERE email = ?")
    .get(email.toLowerCase());

  if (!user) {
    const err = new Error(`No user found with email: ${email}`);
    err.statusCode = 404;
    err.code = 'USER_NOT_FOUND';
    throw err;
  }

  // Already has permission?
  if (hasAccess(reportId, user.id)) {
    const err = new Error('User already has access to this report');
    err.statusCode = 409;
    err.code = 'PERMISSION_EXISTS';
    throw err;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  db()
    .prepare(
      'INSERT INTO report_permissions (id, report_id, user_id, granted_by, created_at) VALUES (?, ?, ?, ?, ?)'
    )
    .run(id, reportId, user.id, grantedBy, now);

  return { id, reportId, userId: user.id, email: user.email, grantedAt: now };
}

/** Revoke a viewer's access to a report. Returns true if a row was deleted. */
function revokeAccess(reportId, userId) {
  const result = db()
    .prepare('DELETE FROM report_permissions WHERE report_id = ? AND user_id = ?')
    .run(reportId, userId);
  return Number(result.changes) > 0;
}

module.exports = { hasAccess, getPermissions, grantAccess, revokeAccess };
