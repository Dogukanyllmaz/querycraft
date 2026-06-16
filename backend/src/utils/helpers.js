'use strict';

function successResponse(res, data, message = null, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    error: null,
    message,
  });
}

function errorResponse(res, message, errorCode = 'INTERNAL_ERROR', statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    data: null,
    error: errorCode,
    message,
  });
}

module.exports = { successResponse, errorResponse };
