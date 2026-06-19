'use strict';

const express = require('express');
const router  = express.Router();
const Joi     = require('joi');

const {
  signup, login, getUserById, getUserCount, generateTokens,
  verifyRefreshToken, revokeToken, revokeAllUserTokens,
  changePassword, createPasswordResetToken, resetPassword,
  getActiveSessions,
} = require('../services/authService');
const { sendPasswordReset } = require('../services/emailService');
const auditService           = require('../services/auditService');
const { requireAuth }        = require('../middleware/auth');
const { validate }           = require('../middleware/validation');
const { authLimiter }        = require('../middleware/rateLimiter');
const { signupSchema, loginSchema } = require('../utils/validators');
const { successResponse, errorResponse } = require('../utils/helpers');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/',
};

function parseDurationMs(str) {
  if (!str) return 15 * 60 * 1000;
  const m = String(str).match(/^(\d+)([smhd])$/);
  if (!m) return 15 * 60 * 1000;
  const n = parseInt(m[1], 10);
  return n * { s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
}

function setTokenCookies(res, accessToken, refreshToken) {
  const { getSetting } = require('../services/settingsService');
  res.cookie('accessToken', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: parseDurationMs(getSetting('jwt_expires_in', '15m')),
  });
  res.cookie('refreshToken', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: parseDurationMs(getSetting('jwt_refresh_expires_in', '7d')),
  });
}

function clearTokenCookies(res) {
  res.clearCookie('accessToken', COOKIE_OPTIONS);
  res.clearCookie('refreshToken', COOKIE_OPTIONS);
}

// ── Public routes ─────────────────────────────────────────────────────────────

router.get('/setup-status', (req, res) => {
  return successResponse(res, { registrationOpen: getUserCount() === 0 });
});

router.post('/signup', authLimiter, validate(signupSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const { user, tokens } = await signup(email, password);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    auditService.log(
      { ...req, userId: user.id, userEmail: user.email },
      'SIGNUP', 'user', user.id, user.email
    );
    return successResponse(res, { user }, 'Account created successfully', 201);
  } catch (err) { next(err); }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
    const { user, tokens } = await login(email, password, meta);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    auditService.log(
      { ...req, userId: user.id, userEmail: user.email },
      'LOGIN', 'user', user.id, user.email
    );
    return successResponse(res, { user }, 'Login successful');
  } catch (err) {
    if (err.code === 'INVALID_CREDENTIALS' || err.code === 'ACCOUNT_LOCKED') {
      auditService.log(req, 'LOGIN_FAILED', 'user', null, req.body?.email, { reason: err.code });
    }
    next(err);
  }
});

router.post('/logout', (req, res) => {
  const token = req.cookies?.refreshToken;
  if (token) {
    try { revokeToken(token); } catch { /* already invalid */ }
  }
  clearTokenCookies(res);
  if (req.userId) {
    auditService.log(req, 'LOGOUT', 'user', req.userId, req.userEmail);
  }
  return successResponse(res, null, 'Logged out successfully');
});

router.post('/refresh', (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) return errorResponse(res, 'No refresh token', 'UNAUTHORIZED', 401);

    const payload = verifyRefreshToken(token);
    const user = getUserById(payload.sub);
    if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);

    const meta = { userAgent: req.headers['user-agent'], ip: req.ip };
    revokeToken(token); // rotate: old token revoked, new one issued
    const tokens = generateTokens(user.id, user.role, meta);
    setTokenCookies(res, tokens.accessToken, tokens.refreshToken);
    return successResponse(res, { user }, 'Token refreshed');
  } catch (err) {
    clearTokenCookies(res);
    next(err);
  }
});

router.post('/forgot-password', authLimiter, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return successResponse(res, null, 'If that email exists, a reset link was sent');

    const result = await createPasswordResetToken(email);
    if (result) {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${result.rawToken}`;
      await sendPasswordReset(result.email, resetUrl).catch((e) =>
        console.error('[auth] email send failed:', e.message)
      );
      auditService.log(req, 'PASSWORD_RESET_REQUEST', 'user', null, email);
    }
    // Always 200 — never reveal if user exists
    return successResponse(res, null, 'If that email exists, a reset link was sent');
  } catch (err) { next(err); }
});

router.post('/reset-password', authLimiter, async (req, res, next) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return errorResponse(res, 'Token and newPassword required', 'BAD_REQUEST', 400);
    if (newPassword.length < 8) return errorResponse(res, 'Password must be at least 8 characters', 'WEAK_PASSWORD', 400);

    await resetPassword(token, newPassword);
    auditService.log(req, 'PASSWORD_RESET', 'user', null, null);
    return successResponse(res, null, 'Password reset successful');
  } catch (err) { next(err); }
});

// ── Authenticated routes ───────────────────────────────────────────────────────

router.get('/me', requireAuth, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);
  return successResponse(res, { user });
});

router.get('/profile', requireAuth, (req, res) => {
  const user = getUserById(req.userId);
  if (!user) return errorResponse(res, 'User not found', 'NOT_FOUND', 404);

  const { getGroupsForUser } = require('../services/groupsService');
  const groups = getGroupsForUser(req.userId);
  const sessions = getActiveSessions(req.userId);
  return successResponse(res, { user, groups, sessions });
});

router.put(
  '/profile',
  requireAuth,
  validate(Joi.object({ display_name: Joi.string().max(100).allow('', null) })),
  (req, res, next) => {
    try {
      const { display_name } = req.body;
      const now = new Date().toISOString();
      require('../db/init').db().prepare(
        'UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?'
      ).run(display_name ?? null, now, req.userId);
      const user = getUserById(req.userId);
      return successResponse(res, { user }, 'Profile updated');
    } catch (err) { next(err); }
  }
);

router.post(
  '/change-password',
  requireAuth,
  validate(Joi.object({
    currentPassword: Joi.string().required(),
    newPassword:     Joi.string().min(8).max(128).required(),
  })),
  async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      await changePassword(req.userId, currentPassword, newPassword);
      clearTokenCookies(res);
      auditService.log(req, 'CHANGE_PASSWORD', 'user', req.userId, req.userEmail);
      return successResponse(res, null, 'Password changed. Please log in again.');
    } catch (err) { next(err); }
  }
);

module.exports = router;
