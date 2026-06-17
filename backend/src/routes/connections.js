'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { connectionSchema } = require('../utils/validators');
const { successResponse, errorResponse } = require('../utils/helpers');
const {
  testConnection,
  createConnection,
  getConnections,
  getConnectionById,
  getConnectionWithCredentials,
  updateConnection,
  deleteConnection,
} = require('../services/connectionManager');

router.use(requireAuth, requireAdmin);

// GET /api/connections
router.get('/', (req, res) => {
  const connections = getConnections(req.userId);
  return successResponse(res, { connections });
});

// POST /api/connections/test  — test before saving (static route must precede /:id)
router.post('/test', validate(connectionSchema), async (req, res, next) => {
  try {
    const result = await testConnection(req.body);
    if (result.success) return successResponse(res, null, 'Connection successful');
    return errorResponse(res, result.message || 'Unable to connect. Check credentials.', 'CONNECTION_FAILED', 400);
  } catch (err) {
    next(err);
  }
});

// GET /api/connections/:id
router.get('/:id', (req, res) => {
  const connection = getConnectionById(req.params.id, req.userId);
  if (!connection) return errorResponse(res, 'Connection not found', 'NOT_FOUND', 404);
  return successResponse(res, { connection });
});

// POST /api/connections
router.post('/', validate(connectionSchema), async (req, res, next) => {
  try {
    const connection = await createConnection(req.userId, req.body);
    return successResponse(res, { connection }, 'Connection created', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/connections/:id
router.put('/:id', validate(connectionSchema), async (req, res, next) => {
  try {
    const connection = await updateConnection(req.params.id, req.userId, req.body);
    if (!connection) return errorResponse(res, 'Connection not found', 'NOT_FOUND', 404);
    return successResponse(res, { connection }, 'Connection updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/connections/:id
router.delete('/:id', (req, res) => {
  const deleted = deleteConnection(req.params.id, req.userId);
  if (!deleted) return errorResponse(res, 'Connection not found', 'NOT_FOUND', 404);
  return successResponse(res, null, 'Connection deleted');
});

// POST /api/connections/:id/test  — test an existing saved connection
router.post('/:id/test', async (req, res, next) => {
  try {
    const conn = getConnectionWithCredentials(req.params.id, req.userId);
    if (!conn) return errorResponse(res, 'Connection not found', 'NOT_FOUND', 404);

    const result = await testConnection(conn);
    if (result.success) return successResponse(res, null, 'Connection successful');
    return errorResponse(res, result.message || 'Unable to connect. Check credentials.', 'CONNECTION_FAILED', 400);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
