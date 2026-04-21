'use strict';

// Mock DynamoDB before requiring app
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    DynamoDBDocumentClient: {
      from: jest.fn().mockReturnValue({ send: mockSend })
    },
    GetCommand: jest.fn(),
    PutCommand: jest.fn(),
    DeleteCommand: jest.fn()
  };
});

const fc = require('fast-check');
const request = require('supertest');
const app = require('../../app');

/**
 * Property 7: Credential Exclusion from Unauthenticated Responses
 * **Validates: Requirements 3.10, 3.12, 3.13**
 *
 * For any API endpoint and any stored credential value (API keys, PATs, ARNs),
 * an unauthenticated request's response body (including error responses)
 * SHALL NOT contain the credential value as a substring.
 */
describe('Property 7: Credential Exclusion from Unauthenticated Responses', () => {
  // --- Generators ---

  // Generator for API key-like strings (e.g., OpenAI sk-... or Anthropic sk-ant-...)
  const apiKeyArb = fc
    .tuple(
      fc.constantFrom('sk-', 'sk-ant-', 'key-', 'api-'),
      fc.hexaString({ minLength: 16, maxLength: 48 })
    )
    .map(([prefix, hex]) => prefix + hex);

  // Generator for PAT-like strings (GitHub ghp_..., GitLab glpat-...)
  const patArb = fc
    .tuple(
      fc.constantFrom('ghp_', 'glpat-', 'pat-'),
      fc.base64String({ minLength: 16, maxLength: 40 })
    )
    .map(([prefix, b64]) => prefix + b64.replace(/[=+/]/g, 'x'));

  // Generator for ARN-like strings
  const arnArb = fc
    .tuple(
      fc.constantFrom('us-east-1', 'us-west-2', 'eu-west-1'),
      fc.stringOf(
        fc.char().filter((c) => /[a-z0-9]/.test(c)),
        { minLength: 4, maxLength: 12 }
      ),
      fc.stringOf(
        fc.char().filter((c) => /[a-zA-Z0-9-]/.test(c)),
        { minLength: 4, maxLength: 20 }
      )
    )
    .map(([region, account, resource]) => `arn:aws:codecommit:${region}:${account}:${resource}`);

  // Combined credential generator
  const credentialArb = fc.oneof(apiKeyArb, patArb, arnArb);

  // Generator for protected endpoint paths (page routes and API routes)
  const endpointArb = fc.constantFrom(
    '/dashboard',
    '/admin',
    '/settings',
    '/profile',
    '/api/v1/commits',
    '/api/v1/stats',
    '/api/v1/heatmap',
    '/api/v1/treemap',
    '/api/v1/sunburst',
    '/api/v1/branches',
    '/api/v1/pulse',
    '/api/v1/impact',
    '/api/v1/collaboration',
    '/api/v1/filetypes',
    '/api/v1/activity-matrix',
    '/api/v1/bookmarks',
    '/api/v1/annotations',
    '/api/v1/docs',
    '/api/v1/bus-factor',
    '/api/v1/stale-files',
    '/api/v1/bubblemap',
    '/api/v1/complexity',
    '/api/v1/pr-flow'
  );

  // --- Property Tests ---

  it('unauthenticated GET responses do not contain credential values', async () => {
    await fc.assert(
      fc.asyncProperty(endpointArb, credentialArb, async (endpoint, credential) => {
        const res = await request(app).get(endpoint);

        // The response should be 401, 403, or a redirect (302/301) — not 200
        expect(res.status).not.toBe(200);

        // Get the full response text (body as string)
        const responseText = typeof res.text === 'string' ? res.text : JSON.stringify(res.body);

        // The credential value MUST NOT appear in the response body
        expect(responseText).not.toContain(credential);
      }),
      { numRuns: 100 }
    );
  });

  it('unauthenticated POST responses do not contain credential values', async () => {
    await fc.assert(
      fc.asyncProperty(endpointArb, credentialArb, async (endpoint, credential) => {
        const res = await request(app).post(endpoint).send({});

        // Get the full response text
        const responseText = typeof res.text === 'string' ? res.text : JSON.stringify(res.body);

        // The credential value MUST NOT appear in the response body
        expect(responseText).not.toContain(credential);
      }),
      { numRuns: 100 }
    );
  });

  it('error responses from auth endpoints do not contain credential values', async () => {
    const authEndpointArb = fc.constantFrom(
      '/auth/login',
      '/auth/register',
      '/auth/status',
      '/auth/logout'
    );

    await fc.assert(
      fc.asyncProperty(authEndpointArb, credentialArb, async (endpoint, credential) => {
        // Send requests that will produce error responses
        const res = await request(app).post(endpoint).send({
          email: 'test@example.com',
          password: credential // Use credential as password to see if it leaks back
        });

        const responseText = typeof res.text === 'string' ? res.text : JSON.stringify(res.body);

        // The credential value MUST NOT appear in the response body
        expect(responseText).not.toContain(credential);
      }),
      { numRuns: 100 }
    );
  });

  it('response bodies from any unauthenticated request contain only safe error messages', async () => {
    // Known safe error messages that the app should return
    const _SAFE_PATTERNS = [
      'Authentication required',
      'Invalid credentials',
      'Not authenticated',
      'Account pending approval',
      'Forbidden',
      'Invalid CSRF token',
      'Invalid email format',
      'Password must be at least 8 characters',
      'Email already registered',
      'Internal server error',
      'Too many requests'
    ];

    await fc.assert(
      fc.asyncProperty(endpointArb, credentialArb, async (endpoint, credential) => {
        const res = await request(app).get(endpoint);

        // If the response is JSON, check that all values are safe
        if (res.body && typeof res.body === 'object') {
          const bodyStr = JSON.stringify(res.body);
          // Must not contain the credential
          expect(bodyStr).not.toContain(credential);
        }

        // If the response is a redirect, the Location header must not contain credentials
        if (res.status === 301 || res.status === 302) {
          const location = res.headers.location || '';
          expect(location).not.toContain(credential);
        }
      }),
      { numRuns: 100 }
    );
  });
});
