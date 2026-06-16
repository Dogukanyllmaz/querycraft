'use strict';

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { reportSchema } = require('../utils/validators');
const { successResponse, errorResponse } = require('../utils/helpers');
const { exportToCSV, exportToExcel } = require('../services/exportService');
const {
  getReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  executeReport,
  previewReport,
} = require('../services/reportService');

router.use(requireAuth);

// GET /api/reports
router.get('/', (req, res) => {
  const reports = getReports(req.userId);
  return successResponse(res, { reports });
});

// POST /api/reports/preview  — static route must be declared before /:id
const previewSchema = Joi.object({
  connection_id: Joi.string().uuid().required(),
  config: Joi.object().required(),
});

router.post('/preview', validate(previewSchema), async (req, res, next) => {
  try {
    const { connection_id, config } = req.body;
    const result = await previewReport(req.userId, config, connection_id);
    return successResponse(res, result);
  } catch (err) {
    if (err.statusCode === 404) return errorResponse(res, err.message, err.code, 404);
    if (!err.statusCode) err.message = 'Preview failed. Try adjusting your filters.';
    next(err);
  }
});

// GET /api/reports/:id
router.get('/:id', (req, res) => {
  const report = getReportById(req.params.id, req.userId);
  if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
  return successResponse(res, { report });
});

// POST /api/reports
router.post('/', validate(reportSchema), async (req, res, next) => {
  try {
    const report = createReport(req.userId, req.body);
    return successResponse(res, { report }, 'Report saved', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/reports/:id
router.put('/:id', validate(reportSchema), async (req, res, next) => {
  try {
    const report = updateReport(req.params.id, req.userId, req.body);
    if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
    return successResponse(res, { report }, 'Report updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reports/:id
router.delete('/:id', (req, res) => {
  const deleted = deleteReport(req.params.id, req.userId);
  if (!deleted) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
  return successResponse(res, null, 'Report deleted');
});

// POST /api/reports/:id/execute
router.post('/:id/execute', async (req, res, next) => {
  try {
    const result = await executeReport(req.params.id, req.userId);
    return successResponse(res, result);
  } catch (err) {
    if (err.statusCode === 404) return errorResponse(res, err.message, err.code, 404);
    if (!err.statusCode) err.message = 'Report failed. Try adjusting your filters or check the connection.';
    next(err);
  }
});

// GET /api/reports/:id/export?format=csv|xlsx
router.get('/:id/export', async (req, res, next) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    if (!['csv', 'xlsx'].includes(format)) {
      return errorResponse(res, 'Invalid format. Use csv or xlsx.', 'INVALID_FORMAT', 400);
    }

    const result = await executeReport(req.params.id, req.userId);
    const report = getReportById(req.params.id, req.userId);
    const filename = `${report.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}`;

    if (format === 'csv') {
      const csv = exportToCSV(result.rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(csv);
    }

    const buffer = exportToExcel(result.rows, report.name.slice(0, 31));
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
    return res.send(buffer);
  } catch (err) {
    if (err.statusCode === 404) return errorResponse(res, err.message, err.code, 404);
    next(err);
  }
});

module.exports = router;
