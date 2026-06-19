'use strict';

const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

/** True if userId has individual or group-based access to the report (or owns it). */
function hasAccess(reportId, userId) {
  const row = db().prepare(
    `SELECT 1 FROM report_permissions WHERE report_id = ? AND user_id = ?
     UNION
     SELECT 1 FROM group_report_permissions grp
       JOIN group_members gm ON gm.group_id = grp.group_id
     WHERE grp.report_id = ? AND gm.user_id = ?
     LIMIT 1`
  ).get(reportId, userId, reportId, userId);
  return Boolean(row);
}

/** Individual user permissions for a report. */
function getPermissions(reportId) {
  return db()
    .prepare(
      `SELECT u.id, u.email, u.role, u.display_name, rp.created_at as granted_at, gb.email as granted_by_email
       FROM report_permissions rp
       JOIN users u  ON u.id  = rp.user_id
       JOIN users gb ON gb.id = rp.granted_by
       WHERE rp.report_id = ?
       ORDER BY rp.created_at ASC`
    )
    .all(reportId);
}

function grantAccess(reportId, email, grantedBy) {
  const user = db()
    .prepare('SELECT id, role FROM users WHERE email = ?')
    .get(email.toLowerCase());

  if (!user) {
    const err = new Error(`No user found with email: ${email}`);
    err.statusCode = 404; err.code = 'USER_NOT_FOUND';
    throw err;
  }

  if (hasAccess(reportId, user.id)) {
    const err = new Error('User already has access to this report');
    err.statusCode = 409; err.code = 'PERMISSION_EXISTS';
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

function revokeAccess(reportId, userId) {
  const result = db()
    .prepare('DELETE FROM report_permissions WHERE report_id = ? AND user_id = ?')
    .run(reportId, userId);
  return Number(result.changes) > 0;
}

module.exports = { hasAccess, getPermissions, grantAccess, revokeAccess };
