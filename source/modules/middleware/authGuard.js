'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand } = require('@aws-sdk/lib-dynamodb');

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
  '/register',
  '/api/v1/guest-access'
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

// ─── Guest Access Cache ───

/** @type {{ value: boolean, expiresAt: number } | null} */
let _guestAccessCache = null;
const GUEST_CACHE_TTL_MS = 60_000; // 60 seconds

/** @type {DynamoDBDocumentClient | null} */
let _guestDocClient = null;

/**
 * Get (or lazily create) a DynamoDB document client for guest-access lookups.
 * @returns {DynamoDBDocumentClient}
 */
function _getGuestDocClient() {
  if (!_guestDocClient) {
    const clientConfig = { region: process.env.AWS_REGION || 'us-east-1' };
    if (process.env.DYNAMODB_ENDPOINT) {
      clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
    }
    _guestDocClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));
  }
  return _guestDocClient;
}

/**
 * Read the guestAccessEnabled flag from AdminSettings with in-memory caching.
 * @returns {Promise<boolean>}
 */
async function isGuestAccessEnabled() {
  const now = Date.now();
  if (_guestAccessCache && now < _guestAccessCache.expiresAt) {
    return _guestAccessCache.value;
  }
  try {
    const docClient = _getGuestDocClient();
    const result = await docClient.send(
      new GetCommand({ TableName: 'AdminSettings', Key: { settingKey: 'guestAccessEnabled' } })
    );
    const enabled = result.Item?.settingValue === 'true';
    _guestAccessCache = { value: enabled, expiresAt: now + GUEST_CACHE_TTL_MS };
    return enabled;
  } catch {
    return false;
  }
}

/**
 * Check if a route is allowed for guest (unauthenticated) access.
 * Guest users may access read-only visualization API endpoints but never admin routes.
 * @param {string} path
 * @returns {boolean}
 */
function isGuestAllowedRoute(path) {
  if (path.startsWith('/admin')) return false;
  if (path.startsWith('/api/v1/')) return true;
  return false;
}

/**
 * Middleware that checks if the user is authenticated.
 * - Skips public routes (auth endpoints, health, csrf-token, static assets)
 * - If guest access is enabled, allows unauthenticated read-only API access
 * - Redirects unauthenticated page requests to /auth/login
 * - Returns 401 JSON for unauthenticated API requests
 */
function requireAuth(req, res, next) {
  if (isPublicRoute(req.path)) {
    return next();
  }

  if (!req.isAuthenticated || !req.isAuthenticated()) {
    // Check guest access before blocking
    return isGuestAccessEnabled().then((guestEnabled) => {
      if (guestEnabled && isGuestAllowedRoute(req.path)) {
        return next();
      }
      if (isApiRequest(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/auth/login');
    }).catch(() => {
      if (isApiRequest(req)) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/auth/login');
    });
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

module.exports = { requireAuth, requireApproved, requireAdmin, isPublicRoute, isApiRequest, isGuestAccessEnabled, isGuestAllowedRoute };
