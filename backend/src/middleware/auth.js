'use strict';

const { verifyAccessToken } = require('../services/authService');
const { errorResponse } = require('../utils/helpers');

function requireAuth(req, res, next) {
  try {
    // Try cookie first, then Authorization header
    let token = req.cookies?.accessToken;

    if (!token) {
      const header = req.headers.authorization;
      if (header && header.startsWith('Bearer ')) {
        token = header.slice(7);
      }
    }

    if (!token) {
      return errorResponse(res, 'Authentication required', 'UNAUTHORIZED', 401);
    }

    const payload = verifyAccessToken(token);
    req.userId = payload.sub;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return errorResponse(res, 'Session expired. Please log in again.', 'TOKEN_EXPIRED', 401);
    }
    return errorResponse(res, 'Invalid authentication token', 'INVALID_TOKEN', 401);
  }
}

module.exports = { requireAuth };
