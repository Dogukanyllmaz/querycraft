'use strict';

const express = require('express');
const router = express.Router();
const Joi = require('joi');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { reportSchema } = require('../utils/validators');
const { successResponse, errorResponse } = require('../utils/helpers');
const { exportToCSV, exportToExcel } = require('../services/exportService');
const {
  getReports,
  getReportsForViewer,
  getReportById,
  getReportByIdRaw,
  createReport,
  updateReport,
  deleteReport,
  executeReport,
  previewReport,
} = require('../services/reportService');
const {
  hasAccess,
  getPermissions,
  grantAccess,
  revokeAccess,
} = require('../services/reportPermissionsService');

router.use(requireAuth);

// GET /api/reports
router.get('/', (req, res) => {
  const reports = req.userRole === 'admin'
    ? getReports(req.userId)
    : getReportsForViewer(req.userId);
  return successResponse(res, { reports });
});

// POST /api/reports/preview — admin only (viewers don't build reports)
const previewSchema = Joi.object({
  connection_id: Joi.string().uuid().required(),
  config: Joi.object().required(),
});

router.post('/preview', requireAdmin, validate(previewSchema), async (req, res, next) => {
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
  if (req.userRole === 'admin') {
    const report = getReportById(req.params.id, req.userId);
    if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
    return successResponse(res, { report });
  }
  // Viewer: must have permission
  if (!hasAccess(req.params.id, req.userId)) {
    return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
  }
  const report = getReportByIdRaw(req.params.id);
  if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
  return successResponse(res, { report });
});

// POST /api/reports — admin only
router.post('/', requireAdmin, validate(reportSchema), async (req, res, next) => {
  try {
    const report = createReport(req.userId, req.body);
    return successResponse(res, { report }, 'Report saved', 201);
  } catch (err) {
    next(err);
  }
});

// PUT /api/reports/:id — admin + owner only
router.put('/:id', requireAdmin, validate(reportSchema), async (req, res, next) => {
  try {
    const report = updateReport(req.params.id, req.userId, req.body);
    if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
    return successResponse(res, { report }, 'Report updated');
  } catch (err) {
    next(err);
  }
});

// DELETE /api/reports/:id — admin + owner only
router.delete('/:id', requireAdmin, (req, res) => {
  const deleted = deleteReport(req.params.id, req.userId);
  if (!deleted) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
  return successResponse(res, null, 'Report deleted');
});

// POST /api/reports/:id/execute — admin owner OR viewer with permission
router.post('/:id/execute', async (req, res, next) => {
  try {
    const result = await executeReport(req.params.id, req.userId, req.userRole);
    return successResponse(res, result);
  } catch (err) {
    if (err.statusCode === 404) return errorResponse(res, err.message, err.code, 404);
    if (!err.statusCode) err.message = 'Report failed. Try adjusting your filters or check the connection.';
    next(err);
  }
});

// GET /api/reports/:id/export?format=csv|xlsx — admin owner OR viewer with permission
router.get('/:id/export', async (req, res, next) => {
  try {
    const format = (req.query.format || 'csv').toLowerCase();
    if (!['csv', 'xlsx'].includes(format)) {
      return errorResponse(res, 'Invalid format. Use csv or xlsx.', 'INVALID_FORMAT', 400);
    }

    const result = await executeReport(req.params.id, req.userId, req.userRole);

    // Get report for the filename (admin: own, viewer: raw)
    const report = req.userRole === 'admin'
      ? getReportById(req.params.id, req.userId)
      : getReportByIdRaw(req.params.id);
    if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);

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

// ── Permission management (admin + owner only) ────────────────────────────────

// GET /api/reports/:id/permissions
router.get('/:id/permissions', requireAdmin, (req, res) => {
  const report = getReportById(req.params.id, req.userId);
  if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);
  const permissions = getPermissions(req.params.id);
  return successResponse(res, { permissions });
});

// POST /api/reports/:id/permissions  — body: { email }
router.post('/:id/permissions', requireAdmin, async (req, res, next) => {
  try {
    const report = getReportById(req.params.id, req.userId);
    if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);

    const { email } = req.body;
    if (!email) return errorResponse(res, 'email is required', 'VALIDATION_ERROR', 400);

    const permission = grantAccess(req.params.id, email, req.userId);
    return successResponse(res, { permission }, 'Access granted', 201);
  } catch (err) {
    if (err.statusCode) return errorResponse(res, err.message, err.code, err.statusCode);
    next(err);
  }
});

// DELETE /api/reports/:id/permissions/:userId
router.delete('/:id/permissions/:userId', requireAdmin, (req, res) => {
  const report = getReportById(req.params.id, req.userId);
  if (!report) return errorResponse(res, 'Report not found', 'NOT_FOUND', 404);

  const revoked = revokeAccess(req.params.id, req.params.userId);
  if (!revoked) return errorResponse(res, 'Permission not found', 'NOT_FOUND', 404);
  return successResponse(res, null, 'Access revoked');
});

module.exports = router;
