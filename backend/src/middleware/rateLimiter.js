'use strict';

const rateLimit = require('express-rate-limit');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many attempts. Please wait 15 minutes before trying again.',
  },
});

const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    data: null,
    error: 'TOO_MANY_REQUESTS',
    message: 'Too many requests. Please slow down.',
  },
});

module.exports = { authLimiter, generalLimiter };
