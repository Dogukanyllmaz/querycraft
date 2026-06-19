'use strict';

const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/init');

function listGroups() {
  return db().prepare(
    `SELECT g.id, g.name, g.description, g.created_at,
            COUNT(DISTINCT gm.user_id) AS member_count
     FROM groups g
     LEFT JOIN group_members gm ON gm.group_id = g.id
     GROUP BY g.id
     ORDER BY g.name ASC`
  ).all();
}

function getGroupById(id) {
  return db().prepare('SELECT * FROM groups WHERE id = ?').get(id) ?? null;
}

function createGroup(name, description, createdBy) {
  const existing = db().prepare('SELECT id FROM groups WHERE name = ?').get(name);
  if (existing) {
    const err = new Error(`A group named "${name}" already exists`);
    err.statusCode = 409; err.code = 'GROUP_EXISTS';
    throw err;
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  db().prepare(
    'INSERT INTO groups (id, name, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, name, description ?? null, createdBy, now);
  return getGroupById(id);
}

function updateGroup(id, name, description) {
  const group = getGroupById(id);
  if (!group) {
    const err = new Error('Group not found'); err.statusCode = 404; err.code = 'NOT_FOUND'; throw err;
  }
  if (name && name !== group.name) {
    const collision = db().prepare('SELECT id FROM groups WHERE name = ? AND id != ?').get(name, id);
    if (collision) {
      const err = new Error(`A group named "${name}" already exists`);
      err.statusCode = 409; err.code = 'GROUP_EXISTS'; throw err;
    }
  }
  db().prepare('UPDATE groups SET name = ?, description = ? WHERE id = ?')
    .run(name ?? group.name, description ?? group.description, id);
  return getGroupById(id);
}

function deleteGroup(id) {
  const result = db().prepare('DELETE FROM groups WHERE id = ?').run(id);
  return Number(result.changes) > 0;
}

function getGroupMembers(groupId) {
  return db().prepare(
    `SELECT u.id, u.email, u.role, u.display_name, gm.added_at
     FROM group_members gm
     JOIN users u ON u.id = gm.user_id
     WHERE gm.group_id = ?
     ORDER BY gm.added_at ASC`
  ).all(groupId);
}

function addGroupMember(groupId, userId, addedBy) {
  const group = getGroupById(groupId);
  if (!group) { const err = new Error('Group not found'); err.statusCode = 404; err.code = 'NOT_FOUND'; throw err; }

  const user = db().prepare('SELECT id FROM users WHERE id = ?').get(userId);
  if (!user) { const err = new Error('User not found'); err.statusCode = 404; err.code = 'USER_NOT_FOUND'; throw err; }

  const already = db().prepare('SELECT 1 FROM group_members WHERE group_id = ? AND user_id = ?').get(groupId, userId);
  if (already) { const err = new Error('User is already a member'); err.statusCode = 409; err.code = 'ALREADY_MEMBER'; throw err; }

  const now = new Date().toISOString();
  db().prepare('INSERT INTO group_members (group_id, user_id, added_by, added_at) VALUES (?, ?, ?, ?)')
    .run(groupId, userId, addedBy, now);
}

function removeGroupMember(groupId, userId) {
  const result = db().prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(groupId, userId);
  return Number(result.changes) > 0;
}

function getGroupsForUser(userId) {
  return db().prepare(
    `SELECT g.id, g.name, g.description FROM groups g
     JOIN group_members gm ON gm.group_id = g.id
     WHERE gm.user_id = ?
     ORDER BY g.name ASC`
  ).all(userId);
}

// Report-level group permissions
function grantGroupAccess(reportId, groupId, grantedBy) {
  const group = getGroupById(groupId);
  if (!group) { const err = new Error('Group not found'); err.statusCode = 404; err.code = 'NOT_FOUND'; throw err; }

  const already = db().prepare('SELECT 1 FROM group_report_permissions WHERE group_id = ? AND report_id = ?').get(groupId, reportId);
  if (already) { const err = new Error('Group already has access'); err.statusCode = 409; err.code = 'PERMISSION_EXISTS'; throw err; }

  const now = new Date().toISOString();
  db().prepare('INSERT INTO group_report_permissions (group_id, report_id, granted_by, created_at) VALUES (?, ?, ?, ?)')
    .run(groupId, reportId, grantedBy, now);
  return { groupId, reportId, grantedAt: now };
}

function revokeGroupAccess(reportId, groupId) {
  const result = db().prepare('DELETE FROM group_report_permissions WHERE group_id = ? AND report_id = ?').run(groupId, reportId);
  return Number(result.changes) > 0;
}

function getGroupPermissionsForReport(reportId) {
  return db().prepare(
    `SELECT g.id, g.name, g.description, grp.created_at AS granted_at
     FROM group_report_permissions grp
     JOIN groups g ON g.id = grp.group_id
     WHERE grp.report_id = ?
     ORDER BY grp.created_at ASC`
  ).all(reportId);
}

module.exports = {
  listGroups, getGroupById, createGroup, updateGroup, deleteGroup,
  getGroupMembers, addGroupMember, removeGroupMember, getGroupsForUser,
  grantGroupAccess, revokeGroupAccess, getGroupPermissionsForReport,
};
