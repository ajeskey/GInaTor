'use strict';

const fc = require('fast-check');
const { requireApproved, isPublicRoute } = require('../../modules/middleware/authGuard');

/**
 * Property 4: Pending User Access Denial
 * **Validates: Requirements 2.3**
 *
 * For any protected application route and any user with `pending` status,
 * the request SHALL be denied access and redirected to the pending approval page.
 * No protected route SHALL return a 200 status to a pending user.
 */
describe('Property 4: Pending User Access Denial', () => {
  // --- Helpers ---

  function mockReq(overrides = {}) {
    return {
      path: overrides.path || '/',
      user: overrides.user || null,
      ...overrides
    };
  }

  function mockRes() {
    const res = {
      statusCode: null,
      body: null,
      redirectUrl: null,
      status(code) { res.statusCode = code; return res; },
      json(data) { res.body = data; return res; },
      redirect(url) { res.redirectUrl = url; return res; }
    };
    return res;
  }

  function pendingUser() {
    return { userId: 'user-123', email: 'pending@example.com', status: 'pending', role: 'user' };
  }

  // --- Generators ---

  const pathSegmentArb = fc.stringOf(
    fc.char().filter(c => /[a-z0-9-]/.test(c)),
    { minLength: 1, maxLength: 15 }
  );

  // Protected page routes (non-API, non-public, not /auth/pending)
  const protectedPageRouteArb = fc.tuple(
    fc.constantFrom('/dashboard', '/admin', '/settings', '/profile', '/repos'),
    fc.option(pathSegmentArb, { nil: undefined })
  ).map(([base, suffix]) => suffix ? `${base}/${suffix}` : base)
    .filter(path => !isPublicRoute(path) && path !== '/auth/pending');

  // Protected API routes
  const protectedApiRouteArb = fc.tuple(
    fc.constantFrom(
      '/api/v1/commits', '/api/v1/stats', '/api/v1/heatmap',
      '/api/v1/treemap', '/api/v1/sunburst', '/api/v1/branches',
      '/api/v1/pulse', '/api/v1/impact', '/api/v1/collaboration',
      '/api/v1/filetypes', '/api/v1/activity-matrix', '/api/v1/bookmarks',
      '/api/v1/annotations', '/api/v1/docs'
    ),
    fc.option(pathSegmentArb, { nil: undefined })
  ).map(([base, suffix]) => suffix ? `${base}/${suffix}` : base);

  // Arbitrary non-public, non-pending route paths
  const arbitraryProtectedRouteArb = fc.tuple(
    pathSegmentArb,
    fc.array(pathSegmentArb, { minLength: 0, maxLength: 3 })
  ).map(([first, rest]) => '/' + [first, ...rest].join('/'))
    .filter(path =>
      !isPublicRoute(path) &&
      !path.startsWith('/public/') &&
      !path.startsWith('/public') &&
      path !== '/auth/pending'
    );

  // --- Property Tests ---

  it('pending user page requests to protected routes get redirected to /auth/pending', () => {
    fc.assert(
      fc.property(protectedPageRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, user: pendingUser() });
        const res = mockRes();
        const next = jest.fn();

        requireApproved(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.redirectUrl).toBe('/auth/pending');
        expect(res.statusCode).not.toBe(200);
      }),
      { numRuns: 200 }
    );
  });

  it('pending user API requests to protected routes get 403 status', () => {
    fc.assert(
      fc.property(protectedApiRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, user: pendingUser() });
        const res = mockRes();
        const next = jest.fn();

        requireApproved(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ error: 'Account pending approval' });
      }),
      { numRuns: 200 }
    );
  });

  it('no protected route returns 200 or calls next for a pending user', () => {
    const anyProtectedRouteArb = fc.oneof(
      protectedPageRouteArb,
      protectedApiRouteArb,
      arbitraryProtectedRouteArb
    );

    fc.assert(
      fc.property(anyProtectedRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, user: pendingUser() });
        const res = mockRes();
        const next = jest.fn();

        requireApproved(req, res, next);

        // next must NOT be called — pending user must be blocked
        expect(next).not.toHaveBeenCalled();
        // Must not return 200
        expect(res.statusCode).not.toBe(200);
        // Must either redirect to pending page or return 403
        const wasRedirected = res.redirectUrl === '/auth/pending';
        const was403 = res.statusCode === 403;
        expect(wasRedirected || was403).toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it('pending user with no user object is also denied access', () => {
    const anyProtectedRouteArb = fc.oneof(
      protectedPageRouteArb,
      protectedApiRouteArb
    );

    fc.assert(
      fc.property(anyProtectedRouteArb, (routePath) => {
        // req.user is null (e.g. session expired but middleware still runs)
        const req = mockReq({ path: routePath, user: null });
        const res = mockRes();
        const next = jest.fn();

        requireApproved(req, res, next);

        expect(next).not.toHaveBeenCalled();
        const wasRedirected = res.redirectUrl === '/auth/pending';
        const was403 = res.statusCode === 403;
        expect(wasRedirected || was403).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('public routes allow pending user access (control group)', () => {
    const PUBLIC_ROUTES = ['/auth/register', '/auth/login', '/health', '/csrf-token'];
    const publicRouteArb = fc.constantFrom(...PUBLIC_ROUTES);

    fc.assert(
      fc.property(publicRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, user: pendingUser() });
        const res = mockRes();
        const next = jest.fn();

        requireApproved(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(res.redirectUrl).toBeNull();
        expect(res.statusCode).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('/auth/pending route allows pending user access (control group)', () => {
    const req = mockReq({ path: '/auth/pending', user: pendingUser() });
    const res = mockRes();
    const next = jest.fn();

    requireApproved(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.redirectUrl).toBeNull();
    expect(res.statusCode).toBeNull();
  });
});
