'use strict';

const express = require('express');
const router  = express.Router();
const Joi     = require('joi');

const { requireAuth, requireAdmin }          = require('../middleware/auth');
const { validate }                           = require('../middleware/validation');
const { successResponse, errorResponse }     = require('../utils/helpers');
const { listUsers, createUser, updateUserRole, deleteUser } = require('../services/usersService');
const {
  listGroups, getGroupById, createGroup, updateGroup, deleteGroup,
  getGroupMembers, addGroupMember, removeGroupMember,
} = require('../services/groupsService');
const { getActiveSessions, revokeAllUserTokens } = require('../services/authService');
const { getPublicSettings, updateSettings }  = require('../services/settingsService');
const { getAuditLogs }                       = require('../services/auditService');
const { testSmtp }                           = require('../services/emailService');
const auditService                           = require('../services/auditService');

router.use(requireAuth, requireAdmin);

// ── Joi schemas ───────────────────────────────────────────────────────────────

const createUserSchema = Joi.object({
  email:    Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  role:     Joi.string().valid('admin', 'viewer').default('viewer'),
});

const updateRoleSchema   = Joi.object({ role: Joi.string().valid('admin', 'viewer').required() });
const groupSchema        = Joi.object({ name: Joi.string().max(255).required(), description: Joi.string().max(500).allow('', null) });
const groupUpdateSchema  = Joi.object({ name: Joi.string().max(255), description: Joi.string().max(500).allow('', null) });
const addMemberSchema    = Joi.object({ userId: Joi.string().uuid().required() });

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', (req, res) => {
  const users = listUsers();
  return successResponse(res, { users });
});

router.post('/users', validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const user = await createUser(email, password, role);
    auditService.log(req, 'CREATE_USER', 'user', user.id, user.email, { role });
    return successResponse(res, { user }, 'User created successfully', 201);
  } catch (err) { next(err); }
});

router.put('/users/:id/role', validate(updateRoleSchema), (req, res, next) => {
  try {
    const user = updateUserRole(req.params.id, req.body.role, req.userId);
    auditService.log(req, 'UPDATE_ROLE', 'user', req.params.id, user.email, { role: req.body.role });
    return successResponse(res, { user }, 'Role updated');
  } catch (err) { next(err); }
});

router.delete('/users/:id', (req, res, next) => {
  try {
    const deleted = deleteUser(req.params.id, req.userId);
    if (!deleted) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
    auditService.log(req, 'DELETE_USER', 'user', req.params.id, null);
    return successResponse(res, null, 'User deleted');
  } catch (err) { next(err); }
});

// Sessions
router.get('/users/:id/sessions', (req, res) => {
  const sessions = getActiveSessions(req.params.id);
  return successResponse(res, { sessions });
});

router.delete('/users/:id/sessions', (req, res) => {
  revokeAllUserTokens(req.params.id);
  auditService.log(req, 'REVOKE_SESSIONS', 'user', req.params.id, null);
  return successResponse(res, null, 'All sessions revoked');
});

// ── Groups ────────────────────────────────────────────────────────────────────

router.get('/groups', (req, res) => {
  return successResponse(res, { groups: listGroups() });
});

router.post('/groups', validate(groupSchema), (req, res, next) => {
  try {
    const group = createGroup(req.body.name, req.body.description, req.userId);
    auditService.log(req, 'CREATE_GROUP', 'group', group.id, group.name);
    return successResponse(res, { group }, 'Group created', 201);
  } catch (err) { next(err); }
});

router.get('/groups/:id', (req, res) => {
  const group = getGroupById(req.params.id);
  if (!group) return errorResponse(res, 'Group not found', 'NOT_FOUND', 404);
  const members = getGroupMembers(req.params.id);
  return successResponse(res, { group, members });
});

router.put('/groups/:id', validate(groupUpdateSchema), (req, res, next) => {
  try {
    const group = updateGroup(req.params.id, req.body.name, req.body.description);
    return successResponse(res, { group }, 'Group updated');
  } catch (err) { next(err); }
});

router.delete('/groups/:id', (req, res, next) => {
  try {
    const deleted = deleteGroup(req.params.id);
    if (!deleted) return errorResponse(res, 'Group not found', 'NOT_FOUND', 404);
    auditService.log(req, 'DELETE_GROUP', 'group', req.params.id, null);
    return successResponse(res, null, 'Group deleted');
  } catch (err) { next(err); }
});

router.get('/groups/:id/members', (req, res) => {
  return successResponse(res, { members: getGroupMembers(req.params.id) });
});

router.post('/groups/:id/members', validate(addMemberSchema), (req, res, next) => {
  try {
    addGroupMember(req.params.id, req.body.userId, req.userId);
    return successResponse(res, null, 'Member added', 201);
  } catch (err) { next(err); }
});

router.delete('/groups/:id/members/:userId', (req, res, next) => {
  try {
    const removed = removeGroupMember(req.params.id, req.params.userId);
    if (!removed) return errorResponse(res, 'Member not found', 'NOT_FOUND', 404);
    return successResponse(res, null, 'Member removed');
  } catch (err) { next(err); }
});

// ── System Settings ───────────────────────────────────────────────────────────

router.get('/settings', (req, res) => {
  return successResponse(res, { settings: getPublicSettings() });
});

router.put('/settings', (req, res, next) => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      return errorResponse(res, 'Body must be an object', 'BAD_REQUEST', 400);
    }
    updateSettings(req.body, req.userId);
    auditService.log(req, 'UPDATE_SETTINGS', null, null, null, { keys: Object.keys(req.body) });
    return successResponse(res, { settings: getPublicSettings() }, 'Settings saved');
  } catch (err) { next(err); }
});

router.post('/settings/test-smtp', async (req, res, next) => {
  try {
    const result = await testSmtp();
    return successResponse(res, result, 'SMTP bağlantısı başarılı');
  } catch (err) {
    return errorResponse(res, err.message, 'SMTP_ERROR', 400);
  }
});

// ── Audit Log ─────────────────────────────────────────────────────────────────

router.get('/audit-log', (req, res) => {
  const { userId, action, from, to, limit = 100, offset = 0 } = req.query;
  const result = getAuditLogs({
    userId:  userId  || undefined,
    action:  action  || undefined,
    from:    from    || undefined,
    to:      to      || undefined,
    limit:   Math.min(Number(limit)  || 100, 500),
    offset:  Number(offset)  || 0,
  });
  return successResponse(res, result);
});

module.exports = router;
