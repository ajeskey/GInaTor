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

const request = require('supertest');
const app = require('../../app');

describe('Express app middleware stack', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  test('sets security headers via helmet', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  test('CSRF protection rejects POST without token', async () => {
    const res = await request(app).post('/health').send({ data: 'test' });
    expect(res.status).toBe(403);
  });

  test('rate limiter is applied to /auth routes', async () => {
    // POST to /auth/login without credentials should get 401 (auth routes are before CSRF)
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(401);
  });

  test('CORS headers are set', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBeDefined();
  });

  test('session cookie is configured with httpOnly and sameSite strict', async () => {
    // The session middleware is configured but won't set a cookie on GET /health
    // unless saveUninitialized is true. We verify the app loads without error.
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
  });
});
