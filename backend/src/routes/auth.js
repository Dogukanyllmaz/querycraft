'use strict';

const express = require('express');
const router = express.Router();
const { signup, login, getUserById, getUserCount, generateTokens, verifyRefreshToken } = require('../services/authService');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validation');
const { authLimiter } = require('../middleware/rateLimiter');
const { signupSchema, loginSchema } = require('../utils/validators');
const { successResponse, errorResponse } = require('../utils/helpers');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

function setTokenCookies(res, accessToken, refreshToken) {
  res.cookie('accessToken', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60 * 1000, // 15 min
  });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
}

function clearTokenCookies(res) {
  res.clearCookie('accessToken', COOKIE_OPTIONS);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
}

// GET /api/auth/setup-status — public, tells frontend whether first-user setup is still open
router.get('/setup-status', (req, res) => {
  const registrationOpen = getUserCount() === 0;
  return successResponse(res, { registrationOpen });
});

// POST /api/auth/signup — only allowed when no users exist (first admin setup)
router.post('/signup', authLimiter, validate(signupSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, tokens } = await signup(email, password);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    return successResponse(res, { user }, 'Account created successfully', 201);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, tokens } = await login(email, password);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    return successResponse(res, { user }, 'Login successful');
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  clearTokenCookies(res);
  return successResponse(res, null, 'Logged out successfully');
});

// POST /api/auth/refresh — re-issues tokens using latest role from DB
router.post('/refresh', (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return errorResponse(res, 'No refresh token', 'UNAUTHORIZED', 401);

    const payload = verifyRefreshToken(token);
    const user = getUserById(payload.sub);
    if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);

    // Always generate tokens with the latest role from DB (catches role changes)
    const tokens = generateTokens(user.id, user.role);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    return successResponse(res, { user }, 'Token refreshed');
  } catch (err) {
    clearTokenCookies(res);
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
  return successResponse(res, { user });
});

module.exports = router;
