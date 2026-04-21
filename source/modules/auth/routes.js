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
   * POST /auth/register
   * Register a new user with email and password.
   * Returns 201 on success, 400 on validation error, 409 on duplicate email.
   */
  router.post('/register', async (req, res) => {
    try {
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
    passport.authenticate('local', (err, user, _info) => {
      if (err) {
        return res.status(500).json({ error: 'Internal server error' });
      }
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      req.logIn(user, (loginErr) => {
        if (loginErr) {
          return res.status(500).json({ error: 'Internal server error' });
        }
        return res.status(200).json({ user });
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
