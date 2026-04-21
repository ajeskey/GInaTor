'use strict';

const bcrypt = require('bcrypt');
const { AuthService, isValidEmail, isValidPassword } = require('../../modules/auth');

// Mock DynamoDB document client
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
  ScanCommand: jest.fn().mockImplementation((params) => ({ _type: 'Scan', ...params }))
}));

describe('isValidEmail', () => {
  test('accepts well-formed emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('a@b.co')).toBe(true);
    expect(isValidEmail('user.name+tag@domain.org')).toBe(true);
  });

  test('rejects emails without @', () => {
    expect(isValidEmail('userexample.com')).toBe(false);
  });

  test('rejects emails with multiple @', () => {
    expect(isValidEmail('user@@example.com')).toBe(false);
    expect(isValidEmail('a@b@c.com')).toBe(false);
  });

  test('rejects emails with empty local part', () => {
    expect(isValidEmail('@example.com')).toBe(false);
  });

  test('rejects emails without dot in domain', () => {
    expect(isValidEmail('user@localhost')).toBe(false);
  });

  test('rejects emails with dot at start/end of domain', () => {
    expect(isValidEmail('user@.example.com')).toBe(false);
    expect(isValidEmail('user@example.')).toBe(false);
  });

  test('rejects non-string inputs', () => {
    expect(isValidEmail(null)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
    expect(isValidEmail(123)).toBe(false);
  });
});

describe('isValidPassword', () => {
  test('accepts passwords with 8+ characters', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('a very long password')).toBe(true);
  });

  test('rejects passwords shorter than 8 characters', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });

  test('rejects non-string inputs', () => {
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(12345678)).toBe(false);
  });
});

describe('AuthService', () => {
  let authService;

  beforeEach(() => {
    mockSend.mockReset();
    authService = new AuthService({ endpoint: 'http://localhost:8000' });
  });

  describe('register', () => {
    test('rejects invalid email', async () => {
      await expect(authService.register('bad-email', 'password123'))
        .rejects.toThrow('Invalid email format');
    });

    test('rejects short password', async () => {
      await expect(authService.register('user@example.com', 'short'))
        .rejects.toThrow('Password must be at least 8 characters');
    });

    test('rejects duplicate email', async () => {
      // email lookup returns existing user
      mockSend.mockResolvedValueOnce({ Items: [{ userId: 'existing', email: 'user@example.com' }] });

      await expect(authService.register('user@example.com', 'password123'))
        .rejects.toThrow('Email already registered');
    });

    test('first user gets admin role and approved status', async () => {
      // email lookup: no existing user
      mockSend.mockResolvedValueOnce({ Items: [] });
      // scan for first user check: empty table
      mockSend.mockResolvedValueOnce({ Count: 0 });
      // put command
      mockSend.mockResolvedValueOnce({});

      const user = await authService.register('admin@example.com', 'password123');

      expect(user.role).toBe('admin');
      expect(user.status).toBe('approved');
      expect(user.email).toBe('admin@example.com');
      expect(user.userId).toBeDefined();
      expect(user.passwordHash).toBeUndefined();
    });

    test('subsequent users get user role and pending status', async () => {
      // email lookup: no existing user
      mockSend.mockResolvedValueOnce({ Items: [] });
      // scan for first user check: table has users
      mockSend.mockResolvedValueOnce({ Count: 1 });
      // put command
      mockSend.mockResolvedValueOnce({});

      const user = await authService.register('user@example.com', 'password123');

      expect(user.role).toBe('user');
      expect(user.status).toBe('pending');
    });

    test('hashes password with bcrypt cost factor >= 10', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      mockSend.mockResolvedValueOnce({ Count: 0 });
      mockSend.mockResolvedValueOnce({});

      await authService.register('admin@example.com', 'password123');

      // Verify the PutCommand was called with a bcrypt hash
      const putCall = mockSend.mock.calls[2][0];
      const storedHash = putCall.Item.passwordHash;
      expect(storedHash).toMatch(/^\$2[aby]\$/);

      // Verify cost factor
      const rounds = parseInt(storedHash.split('$')[2], 10);
      expect(rounds).toBeGreaterThanOrEqual(10);
    });
  });

  describe('login', () => {
    test('returns user on valid credentials', async () => {
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

      const user = await authService.login('user@example.com', 'password123');

      expect(user.userId).toBe('user-1');
      expect(user.email).toBe('user@example.com');
      expect(user.passwordHash).toBeUndefined();
    });

    test('throws generic error on wrong email', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      await expect(authService.login('wrong@example.com', 'password123'))
        .rejects.toThrow('Invalid credentials');
    });

    test('throws generic error on wrong password', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockSend.mockResolvedValueOnce({
        Items: [{ userId: 'user-1', email: 'user@example.com', passwordHash: hash }]
      });

      await expect(authService.login('user@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('isApproved', () => {
    test('returns true for approved user', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { userId: 'user-1', status: 'approved' }
      });

      expect(await authService.isApproved('user-1')).toBe(true);
    });

    test('returns false for pending user', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { userId: 'user-1', status: 'pending' }
      });

      expect(await authService.isApproved('user-1')).toBe(false);
    });

    test('returns false for non-existent user', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });

      expect(await authService.isApproved('nonexistent')).toBe(false);
    });
  });
});
