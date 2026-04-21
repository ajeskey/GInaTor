'use strict';

const {
  requireAuth,
  requireApproved,
  requireAdmin,
  isPublicRoute,
  isApiRequest
} = require('../../modules/middleware/authGuard');

/**
 * Helper to create a mock request object.
 */
function mockReq(overrides = {}) {
  return {
    path: overrides.path || '/',
    isAuthenticated: overrides.isAuthenticated || (() => false),
    user: overrides.user || null,
    ...overrides
  };
}

/**
 * Helper to create a mock response object.
 */
function mockRes() {
  const res = {
    statusCode: null,
    body: null,
    redirectUrl: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.body = data;
      return res;
    },
    redirect(url) {
      res.redirectUrl = url;
      return res;
    }
  };
  return res;
}

describe('isPublicRoute', () => {
  test('returns true for /auth/register', () => {
    expect(isPublicRoute('/auth/register')).toBe(true);
  });

  test('returns true for /auth/login', () => {
    expect(isPublicRoute('/auth/login')).toBe(true);
  });

  test('returns true for /health', () => {
    expect(isPublicRoute('/health')).toBe(true);
  });

  test('returns true for /csrf-token', () => {
    expect(isPublicRoute('/csrf-token')).toBe(true);
  });

  test('returns true for static assets under /public/', () => {
    expect(isPublicRoute('/public/js/app.js')).toBe(true);
    expect(isPublicRoute('/public/css/style.css')).toBe(true);
  });

  test('returns false for protected routes', () => {
    expect(isPublicRoute('/dashboard')).toBe(false);
    expect(isPublicRoute('/admin')).toBe(false);
    expect(isPublicRoute('/api/v1/commits')).toBe(false);
  });
});

describe('isApiRequest', () => {
  test('returns true for /api/ paths', () => {
    expect(isApiRequest({ path: '/api/v1/commits' })).toBe(true);
    expect(isApiRequest({ path: '/api/v1/stats' })).toBe(true);
  });

  test('returns false for non-api paths', () => {
    expect(isApiRequest({ path: '/dashboard' })).toBe(false);
    expect(isApiRequest({ path: '/admin' })).toBe(false);
  });
});

describe('requireAuth', () => {
  test('calls next() for public routes', () => {
    const next = jest.fn();
    const req = mockReq({ path: '/auth/login' });
    const res = mockRes();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('returns 401 JSON for unauthenticated API requests', () => {
    const next = jest.fn();
    const req = mockReq({ path: '/api/v1/commits' });
    const res = mockRes();
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Authentication required' });
  });

  test('redirects unauthenticated page requests to /auth/login', () => {
    const next = jest.fn();
    const req = mockReq({ path: '/dashboard' });
    const res = mockRes();
    requireAuth(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.redirectUrl).toBe('/auth/login');
  });

  test('calls next() for authenticated requests', () => {
    const next = jest.fn();
    const req = mockReq({
      path: '/dashboard',
      isAuthenticated: () => true,
      user: { userId: '1', role: 'user', status: 'approved' }
    });
    const res = mockRes();
    requireAuth(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireApproved', () => {
  test('calls next() for public routes', () => {
    const next = jest.fn();
    const req = mockReq({ path: '/auth/login' });
    const res = mockRes();
    requireApproved(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('calls next() for /auth/pending path', () => {
    const next = jest.fn();
    const req = mockReq({ path: '/auth/pending', user: { status: 'pending' } });
    const res = mockRes();
    requireApproved(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('redirects pending users to /auth/pending for page requests', () => {
    const next = jest.fn();
    const req = mockReq({
      path: '/dashboard',
      user: { userId: '1', role: 'user', status: 'pending' }
    });
    const res = mockRes();
    requireApproved(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.redirectUrl).toBe('/auth/pending');
  });

  test('returns 403 JSON for pending users on API requests', () => {
    const next = jest.fn();
    const req = mockReq({
      path: '/api/v1/commits',
      user: { userId: '1', role: 'user', status: 'pending' }
    });
    const res = mockRes();
    requireApproved(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Account pending approval' });
  });

  test('calls next() for approved users', () => {
    const next = jest.fn();
    const req = mockReq({
      path: '/dashboard',
      user: { userId: '1', role: 'user', status: 'approved' }
    });
    const res = mockRes();
    requireApproved(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('requireAdmin', () => {
  test('returns 403 for non-admin users', () => {
    const next = jest.fn();
    const req = mockReq({
      path: '/admin',
      user: { userId: '1', role: 'user', status: 'approved' }
    });
    const res = mockRes();
    requireAdmin(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: 'Forbidden' });
  });

  test('returns 403 when no user is present', () => {
    const next = jest.fn();
    const req = mockReq({ path: '/admin' });
    const res = mockRes();
    requireAdmin(req, res, next);
    expect(res.statusCode).toBe(403);
  });

  test('calls next() for admin users', () => {
    const next = jest.fn();
    const req = mockReq({
      path: '/admin',
      user: { userId: '1', role: 'admin', status: 'approved' }
    });
    const res = mockRes();
    requireAdmin(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
