'use strict';

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockReturnValue({ send: (...args) => mockSend(...args) })
  },
  PutCommand: jest.fn().mockImplementation((params) => ({ _type: 'Put', ...params })),
  GetCommand: jest.fn().mockImplementation((params) => ({ _type: 'Get', ...params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ _type: 'Query', ...params })),
  ScanCommand: jest.fn().mockImplementation((params) => ({ _type: 'Scan', ...params })),
  DeleteCommand: jest.fn()
}));

const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../app');

describe('Auth Routes', () => {
  beforeEach(() => {
    mockSend.mockReset();
  });

  describe('POST /auth/register', () => {
    test('returns 201 with user data on successful registration', async () => {
      // email lookup: no existing user
      mockSend.mockResolvedValueOnce({ Items: [] });
      // scan for first user check: empty table
      mockSend.mockResolvedValueOnce({ Count: 0 });
      // put command
      mockSend.mockResolvedValueOnce({});

      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'admin@example.com', password: 'password123' });

      expect(res.status).toBe(201);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('admin@example.com');
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    test('returns 400 on invalid email', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'bad-email', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Invalid email format');
    });

    test('returns 400 on short password', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Password must be at least 8 characters');
    });

    test('returns 409 on duplicate email', async () => {
      // email lookup returns existing user
      mockSend.mockResolvedValueOnce({
        Items: [{ userId: 'existing', email: 'user@example.com' }]
      });

      const res = await request(app)
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('Email already registered');
    });
  });

  describe('POST /auth/login', () => {
    test('returns 200 with user data and sets session on valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      // passport authenticate calls authService.login -> _getUserByEmail
      mockSend.mockResolvedValueOnce({
        Items: [{
          userId: 'user-1',
          email: 'user@example.com',
          passwordHash: hash,
          role: 'admin',
          status: 'approved'
        }]
      });
      // passport deserializeUser may call _getUserById for session
      mockSend.mockResolvedValue({
        Item: {
          userId: 'user-1',
          email: 'user@example.com',
          passwordHash: hash,
          role: 'admin',
          status: 'approved'
        }
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('user@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
      // Session cookie should be set
      expect(res.headers['set-cookie']).toBeDefined();
    });

    test('returns 401 with generic error on invalid credentials', async () => {
      // email lookup: no user found
      mockSend.mockResolvedValueOnce({ Items: [] });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'wrong@example.com', password: 'password123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
      // Should NOT reveal whether email or password was wrong
      expect(res.body.error).not.toContain('email');
      expect(res.body.error).not.toContain('password');
    });

    test('returns 401 on wrong password without revealing which field', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockSend.mockResolvedValueOnce({
        Items: [{
          userId: 'user-1',
          email: 'user@example.com',
          passwordHash: hash,
          role: 'user',
          status: 'approved'
        }]
      });

      const res = await request(app)
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });
  });

  describe('POST /auth/logout', () => {
    test('returns 200 and clears session on logout', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const userData = {
        userId: 'user-1',
        email: 'user@example.com',
        passwordHash: hash,
        role: 'admin',
        status: 'approved'
      };

      // Default mock handles session store get/set/destroy and deserializeUser
      mockSend.mockImplementation((cmd) => {
        // QueryCommand for login (email lookup)
        if (cmd._type === 'Query') {
          return Promise.resolve({ Items: [userData] });
        }
        // GetCommand for session store get or deserializeUser
        if (cmd._type === 'Get') {
          if (cmd.TableName === 'Sessions') {
            return Promise.resolve({ Item: null });
          }
          return Promise.resolve({ Item: userData });
        }
        // PutCommand for session store set
        // DeleteCommand for session store destroy
        return Promise.resolve({});
      });

      const agent = request.agent(app);

      // Login
      await agent
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password123' });

      // Logout
      const res = await agent.post('/auth/logout');

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');
    });
  });

  describe('GET /auth/status', () => {
    test('returns 401 when not authenticated', async () => {
      // Session store get returns null (no session)
      mockSend.mockResolvedValue({ Item: null });

      const res = await request(app).get('/auth/status');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Not authenticated');
    });

    test('returns 200 with user info when authenticated', async () => {
      const hash = await bcrypt.hash('password123', 10);
      const userData = {
        userId: 'user-1',
        email: 'user@example.com',
        passwordHash: hash,
        role: 'admin',
        status: 'approved'
      };

      // In-memory session store for this test
      const sessions = {};

      mockSend.mockImplementation((cmd) => {
        if (cmd._type === 'Query') {
          return Promise.resolve({ Items: [userData] });
        }
        if (cmd._type === 'Get') {
          if (cmd.TableName === 'Sessions') {
            const sid = cmd.Key.sessionId;
            return Promise.resolve({ Item: sessions[sid] || null });
          }
          return Promise.resolve({ Item: userData });
        }
        if (cmd._type === 'Put') {
          if (cmd.TableName === 'Sessions') {
            sessions[cmd.Item.sessionId] = cmd.Item;
          }
          return Promise.resolve({});
        }
        return Promise.resolve({});
      });

      const agent = request.agent(app);

      // Login
      await agent
        .post('/auth/login')
        .send({ email: 'user@example.com', password: 'password123' });

      // Check status
      const res = await agent.get('/auth/status');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('user@example.com');
      expect(res.body.user.passwordHash).toBeUndefined();
    });
  });
});
