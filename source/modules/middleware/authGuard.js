'use strict';

/**
 * Routes that do not require authentication.
 * @type {string[]}
 */
const PUBLIC_ROUTES = [
  '/auth/register',
  '/auth/login',
  '/auth/setup-available',
  '/auth/github',
  '/auth/github/callback',
  '/auth/github/status',
  '/health',
  '/csrf-token',
  '/login',
  '/register'
];

/**
 * Check if a request path is a public route (no auth required).
 * @param {string} path
 * @returns {boolean}
 */
function isPublicRoute(path) {
  if (PUBLIC_ROUTES.includes(path)) return true;
  // Static assets served from /public
  if (path.startsWith('/public/') || path.startsWith('/public')) return true;
  return false;
}

/**
 * Check if a request is an API request (expects JSON responses).
 * @param {import('express').Request} req
 * @returns {boolean}
 */
function isApiRequest(req) {
  return (
    req.path.startsWith('/api/') ||
    req.path.startsWith('/api') ||
    req.path.startsWith('/admin') ||
    req.headers.accept?.includes('application/json')
  );
}

/**
 * Middleware that checks if the user is authenticated.
 * - Skips public routes (auth endpoints, health, csrf-token, static assets)
 * - Redirects unauthenticated page requests to /auth/login
 * - Returns 401 JSON for unauthenticated API requests
 */
function requireAuth(req, res, next) {
  if (isPublicRoute(req.path)) {
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (isApiRequest(req)) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/auth/login');
  }

  return next();
}

/**
 * Middleware that checks if the authenticated user has 'approved' status.
 * - Redirects pending users to /auth/pending for page requests
 * - Returns 403 JSON for pending users on API requests
 */
function requireApproved(req, res, next) {
  if (isPublicRoute(req.path)) {
    return next();
  }

  // Allow access to the pending page itself
  if (req.path === '/auth/pending') {
    return next();
  }

  if (!req.user || req.user.status !== 'approved') {
    if (isApiRequest(req)) {
      return res.status(403).json({ error: 'Account pending approval' });
    }
    return res.redirect('/auth/pending');
  }

  return next();
}

/**
 * Middleware that checks if the authenticated user has 'admin' role.
 * - Returns 403 for non-admin users
 * - Redirects unauthenticated page requests to login (handled by requireAuth first)
 */
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    if (isApiRequest(req)) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    return res.status(403).json({ error: 'Forbidden' });
  }

  return next();
}

module.exports = { requireAuth, requireApproved, requireAdmin, isPublicRoute, isApiRequest };
