'use strict';

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  logger.error(err.message, { stack: err.stack, path: req.path });

  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';

  // Never expose internal error details in production
  const message = statusCode < 500
    ? err.message
    : 'An unexpected error occurred. Please try again.';

  return res.status(statusCode).json({
    success: false,
    data: null,
    error: errorCode,
    message,
  });
}

module.exports = { errorHandler };
