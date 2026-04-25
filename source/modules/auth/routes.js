'use strict';

const express = require('express');
const passport = require('passport');

/**
 * Create auth router with register, login, logout, and status endpoints.
 * @param {import('./AuthService').AuthService} authService
 * @returns {express.Router}
 */
function createAuthRouter(authService) {
  const router = express.Router();

  /**
   * GET /auth/setup-available
   * Returns whether initial setup (first user registration) is available.
   */
  router.get('/setup-available', async (req, res) => {
    try {
      const isFirst = await authService._isFirstUser();
      return res.json({ available: isFirst });
    } catch {
      return res.json({ available: false });
    }
  });

  /**
   * POST /auth/register
   * Register the first admin user only. Blocked once any user exists.
   * Returns 201 on success, 403 if registration is closed, 400/409 on validation errors.
   */
  router.post('/register', async (req, res) => {
    try {
      // Only allow registration if no users exist yet (initial admin setup)
      const isFirst = await authService._isFirstUser();
      if (!isFirst) {
        return res.status(403).json({ error: 'Registration is closed. Contact an administrator.' });
      }
      const { email, password } = req.body;
      const user = await authService.register(email, password);
      return res.status(201).json({ user });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  /**
   * POST /auth/login
   * Authenticate with email and password via Passport.js local strategy.
   * Creates a session on success, returns 200 with user data.
   * Returns generic 401 error on invalid credentials.
   */
  router.post('/login', (req, res, next) => {
    const wantsJson =
      req.headers['content-type']?.includes('application/json') ||
      req.xhr ||
      req.headers.accept?.includes('application/json');
    passport.authenticate('local', (err, user, _info) => {
      if (err) {
        if (wantsJson) return res.status(500).json({ error: 'Internal server error' });
        return res.redirect('/login?error=Internal+server+error');
      }
      if (!user) {
        if (wantsJson) return res.status(401).json({ error: 'Invalid credentials' });
        return res.redirect('/login?error=Invalid+credentials');
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          if (wantsJson) return res.status(500).json({ error: 'Internal server error' });
          return res.redirect('/login?error=Internal+server+error');
        }
        if (wantsJson) return res.status(200).json({ user });
        return res.redirect('/dashboard');
      });
    })(req, res, next);
  });

  /**
   * POST /auth/logout
   * Invalidate session, destroy it, and clear the session cookie.
   * Returns 200 on success.
   */
  router.post('/logout', (req, res) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          return res.status(500).json({ error: 'Internal server error' });
        }
        res.clearCookie('connect.sid');
        return res.status(200).json({ message: 'Logged out' });
      });
    });
  });

  /**
   * GET /auth/status
   * Return current user info if authenticated, 401 if not.
   */
  router.get('/status', (req, res) => {
    if (req.isAuthenticated && req.isAuthenticated() && req.user) {
      return res.status(200).json({ user: req.user });
    }
    return res.status(401).json({ error: 'Not authenticated' });
  });

  return router;
}

module.exports = { createAuthRouter };
