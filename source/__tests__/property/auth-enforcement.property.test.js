'use strict';

const fc = require('fast-check');
const { requireAuth, isPublicRoute } = require('../../modules/middleware/authGuard');

/**
 * Property 3: Protected Route Authentication Enforcement
 * **Validates: Requirements 3.4**
 *
 * For any route path not in the public whitelist (/auth/register, /auth/login,
 * static assets), an unauthenticated request SHALL receive either a 401 status
 * or a redirect to the login page. No protected route SHALL return a 200 status
 * to an unauthenticated request.
 */
describe('Property 3: Protected Route Authentication Enforcement', () => {
  // --- Helpers ---

  function mockReq(overrides = {}) {
    return {
      path: overrides.path || '/',
      isAuthenticated: overrides.isAuthenticated || (() => false),
      user: overrides.user || null,
      ...overrides
    };
  }

  function mockRes() {
    const res = {
      statusCode: null,
      body: null,
      redirectUrl: null,
      nextCalled: false,
      status(code) { res.statusCode = code; return res; },
      json(data) { res.body = data; return res; },
      redirect(url) { res.redirectUrl = url; return res; }
    };
    return res;
  }

  // --- Generators ---

  // Known public routes that should be skipped by auth middleware
  const PUBLIC_ROUTES = ['/auth/register', '/auth/login', '/health', '/csrf-token'];

  // Generator for path segments (alphanumeric + hyphens)
  const pathSegmentArb = fc.stringOf(
    fc.char().filter(c => /[a-z0-9-]/.test(c)),
    { minLength: 1, maxLength: 15 }
  );

  // Generator for protected page routes (non-API, non-public)
  const protectedPageRouteArb = fc.tuple(
    fc.constantFrom('/dashboard', '/admin', '/settings', '/profile', '/repos'),
    fc.option(pathSegmentArb, { nil: undefined })
  ).map(([base, suffix]) => suffix ? `${base}/${suffix}` : base)
    .filter(path => !isPublicRoute(path));

  // Generator for protected API routes
  const protectedApiRouteArb = fc.tuple(
    fc.constantFrom('/api/v1/commits', '/api/v1/stats', '/api/v1/heatmap',
      '/api/v1/treemap', '/api/v1/sunburst', '/api/v1/branches',
      '/api/v1/pulse', '/api/v1/impact', '/api/v1/collaboration',
      '/api/v1/filetypes', '/api/v1/activity-matrix', '/api/v1/bookmarks',
      '/api/v1/annotations', '/api/v1/docs'),
    fc.option(pathSegmentArb, { nil: undefined })
  ).map(([base, suffix]) => suffix ? `${base}/${suffix}` : base);

  // Generator for arbitrary non-public route paths
  const arbitraryProtectedRouteArb = fc.tuple(
    pathSegmentArb,
    fc.array(pathSegmentArb, { minLength: 0, maxLength: 3 })
  ).map(([first, rest]) => '/' + [first, ...rest].join('/'))
    .filter(path => !isPublicRoute(path) && !path.startsWith('/public/') && !path.startsWith('/public'));

  // --- Property Tests ---

  it('unauthenticated page requests to protected routes get redirected to /auth/login', () => {
    fc.assert(
      fc.property(protectedPageRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, isAuthenticated: () => false });
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        // Must NOT call next (no access granted)
        expect(next).not.toHaveBeenCalled();
        // Must redirect to login
        expect(res.redirectUrl).toBe('/auth/login');
        // Must NOT return 200
        expect(res.statusCode).not.toBe(200);
      }),
      { numRuns: 200 }
    );
  });

  it('unauthenticated API requests to protected routes get 401 status', () => {
    fc.assert(
      fc.property(protectedApiRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, isAuthenticated: () => false });
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        // Must NOT call next
        expect(next).not.toHaveBeenCalled();
        // Must return 401
        expect(res.statusCode).toBe(401);
        // Must include error message
        expect(res.body).toEqual({ error: 'Authentication required' });
      }),
      { numRuns: 200 }
    );
  });

  it('no protected route returns 200 or calls next for unauthenticated requests', () => {
    // Combine page and API routes into one universal check
    const anyProtectedRouteArb = fc.oneof(
      protectedPageRouteArb,
      protectedApiRouteArb,
      arbitraryProtectedRouteArb
    );

    fc.assert(
      fc.property(anyProtectedRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, isAuthenticated: () => false });
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        // next must NOT be called — request must be blocked
        expect(next).not.toHaveBeenCalled();
        // Must not return 200
        expect(res.statusCode).not.toBe(200);
        // Must either redirect or return 401
        const wasRedirected = res.redirectUrl === '/auth/login';
        const was401 = res.statusCode === 401;
        expect(wasRedirected || was401).toBe(true);
      }),
      { numRuns: 300 }
    );
  });

  it('unauthenticated requests without isAuthenticated function are blocked', () => {
    const anyProtectedRouteArb = fc.oneof(
      protectedPageRouteArb,
      protectedApiRouteArb
    );

    fc.assert(
      fc.property(anyProtectedRouteArb, (routePath) => {
        // Simulate a request where isAuthenticated is not set (no passport)
        const req = mockReq({ path: routePath, isAuthenticated: undefined });
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        const wasRedirected = res.redirectUrl === '/auth/login';
        const was401 = res.statusCode === 401;
        expect(wasRedirected || was401).toBe(true);
      }),
      { numRuns: 200 }
    );
  });

  it('public routes allow unauthenticated access (control group)', () => {
    const publicRouteArb = fc.constantFrom(...PUBLIC_ROUTES);

    fc.assert(
      fc.property(publicRouteArb, (routePath) => {
        const req = mockReq({ path: routePath, isAuthenticated: () => false });
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        // Public routes MUST call next
        expect(next).toHaveBeenCalled();
        // No redirect or status set
        expect(res.redirectUrl).toBeNull();
        expect(res.statusCode).toBeNull();
      }),
      { numRuns: 100 }
    );
  });

  it('static asset routes allow unauthenticated access (control group)', () => {
    const staticAssetArb = pathSegmentArb.map(seg => `/public/${seg}`);

    fc.assert(
      fc.property(staticAssetArb, (routePath) => {
        const req = mockReq({ path: routePath, isAuthenticated: () => false });
        const res = mockRes();
        const next = jest.fn();

        requireAuth(req, res, next);

        // Static assets MUST call next
        expect(next).toHaveBeenCalled();
      }),
      { numRuns: 100 }
    );
  });
});
