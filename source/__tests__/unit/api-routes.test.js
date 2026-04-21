'use strict';

// Mock DynamoDB before requiring anything
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
    DeleteCommand: jest.fn(),
    QueryCommand: jest.fn(),
    BatchWriteCommand: jest.fn()
  };
});

const request = require('supertest');
const express = require('express');
const { createApiRouter } = require('../../modules/api');

// Build a minimal test app with a fake auth user
function buildTestApp(commitStoreMock) {
  const app = express();
  app.use(express.json());
  // Simulate authenticated user
  app.use((req, res, next) => {
    req.isAuthenticated = () => true;
    req.user = { userId: 'u1', status: 'approved', role: 'user' };
    next();
  });
  const apiRouter = createApiRouter({ commitStore: commitStoreMock });
  app.use('/api/v1', apiRouter);
  return app;
}

describe('API routes', () => {
  describe('GET /api/v1/docs', () => {
    test('returns API documentation JSON', async () => {
      const app = buildTestApp({});
      const res = await request(app).get('/api/v1/docs');
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('GInaTor Visualization API');
      expect(res.body.version).toBe('v1');
      expect(res.body.endpoints).toBeDefined();
      expect(Array.isArray(res.body.endpoints)).toBe(true);
    });
  });

  describe('GET /api/v1/commits', () => {
    test('returns 400 when repoId is missing', async () => {
      const app = buildTestApp({});
      const res = await request(app).get('/api/v1/commits');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/repoId/);
    });

    test('returns 400 for invalid from date', async () => {
      const app = buildTestApp({});
      const res = await request(app).get('/api/v1/commits?repoId=r1&from=bad-date');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/from/i);
    });

    test('returns 400 when from > to', async () => {
      const app = buildTestApp({});
      const res = await request(app).get('/api/v1/commits?repoId=r1&from=2024-12-31&to=2024-01-01');
      expect(res.status).toBe(400);
    });

    test('returns paginated commits with date range', async () => {
      const commits = [
        { commitHash: 'a1', commitDate: '2024-06-15' },
        { commitHash: 'a2', commitDate: '2024-06-14' }
      ];
      const mockStore = {
        getCommitsByDateRange: jest.fn().mockResolvedValue(commits)
      };
      const app = buildTestApp(mockStore);
      const res = await request(app).get('/api/v1/commits?repoId=r1&from=2024-01-01&to=2024-12-31');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(commits);
      expect(res.body.total).toBe(2);
      expect(res.body.limit).toBe(50);
      expect(res.body.offset).toBe(0);
    });

    test('returns paginated commits without date range', async () => {
      const commits = [{ commitHash: 'b1' }];
      const mockStore = {
        getCommitsByRepo: jest.fn().mockResolvedValue({ items: commits, total: 1 })
      };
      const app = buildTestApp(mockStore);
      const res = await request(app).get('/api/v1/commits?repoId=r1');
      expect(res.status).toBe(200);
      expect(res.body.items).toEqual(commits);
      expect(res.body.total).toBe(1);
    });

    test('respects limit and offset params', async () => {
      const commits = Array.from({ length: 10 }, (_, i) => ({ commitHash: `c${i}` }));
      const mockStore = {
        getCommitsByRepo: jest.fn().mockResolvedValue({ items: commits, total: 10 })
      };
      const app = buildTestApp(mockStore);
      const res = await request(app).get('/api/v1/commits?repoId=r1&limit=3&offset=2');
      expect(res.status).toBe(200);
      expect(res.body.items).toHaveLength(3);
      expect(res.body.items[0].commitHash).toBe('c2');
      expect(res.body.limit).toBe(3);
      expect(res.body.offset).toBe(2);
    });

    test('returns 500 on store error', async () => {
      const mockStore = {
        getCommitsByRepo: jest.fn().mockRejectedValue(new Error('DB down'))
      };
      const app = buildTestApp(mockStore);
      const res = await request(app).get('/api/v1/commits?repoId=r1');
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/internal/i);
    });

    test('handles from-only date filter', async () => {
      const mockStore = {
        getCommitsByDateRange: jest.fn().mockResolvedValue([])
      };
      const app = buildTestApp(mockStore);
      const res = await request(app).get('/api/v1/commits?repoId=r1&from=2024-06-01');
      expect(res.status).toBe(200);
      expect(mockStore.getCommitsByDateRange).toHaveBeenCalledWith(
        'r1',
        '2024-06-01',
        '9999-12-31T23:59:59.999Z'
      );
    });

    test('handles to-only date filter', async () => {
      const mockStore = {
        getCommitsByDateRange: jest.fn().mockResolvedValue([])
      };
      const app = buildTestApp(mockStore);
      const res = await request(app).get('/api/v1/commits?repoId=r1&to=2024-06-30');
      expect(res.status).toBe(200);
      expect(mockStore.getCommitsByDateRange).toHaveBeenCalledWith(
        'r1',
        '0000-01-01T00:00:00.000Z',
        '2024-06-30'
      );
    });
  });
});
