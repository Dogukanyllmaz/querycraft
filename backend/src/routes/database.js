'use strict';

const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const { successResponse, errorResponse } = require('../utils/helpers');
const { getTables, getTableSchema, getTableData } = require('../services/connectionManager');

router.use(requireAuth);

// GET /api/connections/:id/tables
router.get('/:id/tables', async (req, res, next) => {
  try {
    const tables = await getTables(req.params.id, req.userId);
    // Tables rarely change — cache for 60 s on the client
    res.set('Cache-Control', 'private, max-age=60');
    return successResponse(res, { tables });
  } catch (err) {
    if (err.statusCode === 404) return errorResponse(res, err.message, err.code, 404);
    next(err);
  }
});

// GET /api/connections/:id/tables/:name
router.get('/:id/tables/:name', async (req, res, next) => {
  try {
    const schema = await getTableSchema(req.params.id, req.userId, req.params.name);
    // Schema almost never changes — cache for 5 min
    res.set('Cache-Control', 'private, max-age=300');
    return successResponse(res, { schema });
  } catch (err) {
    if (err.statusCode === 404) return errorResponse(res, err.message, err.code, 404);
    next(err);
  }
});

// GET /api/connections/:id/tables/:name/data
router.get('/:id/tables/:name/data', async (req, res, next) => {
  try {
    const { page, limit } = req.query;
    const result = await getTableData(req.params.id, req.userId, req.params.name, page, limit);
    return successResponse(res, result);
  } catch (err) {
    if (err.statusCode === 404) return errorResponse(res, err.message, err.code, 404);
    next(err);
  }
});

module.exports = router;
