'use strict';

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { successResponse, errorResponse } = require('../utils/helpers');
const { listUsers, createUser, updateUserRole, deleteUser } = require('../services/usersService');

router.use(requireAuth, requireAdmin);

const createUserSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
  role: Joi.string().valid('admin', 'viewer').default('viewer'),
});

const updateRoleSchema = Joi.object({
  role: Joi.string().valid('admin', 'viewer').required(),
});

// GET /api/admin/users
router.get('/users', (req, res) => {
  const users = listUsers();
  return successResponse(res, { users });
});

// POST /api/admin/users
router.post('/users', validate(createUserSchema), async (req, res, next) => {
  try {
    const { email, password, role } = req.body;
    const user = await createUser(email, password, role);
    return successResponse(res, { user }, 'User created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/admin/users/:id/role
router.put('/users/:id/role', validate(updateRoleSchema), (req, res, next) => {
  try {
    const user = updateUserRole(req.params.id, req.body.role, req.userId);
    return successResponse(res, { user }, 'Role updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', (req, res, next) => {
  try {
    const deleted = deleteUser(req.params.id, req.userId);
    if (!deleted) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
    return successResponse(res, null, 'User deleted');
  } catch (err) {
    next(err);
  }
});

module.exports = router;
