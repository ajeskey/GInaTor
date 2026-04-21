'use strict';

const { AdminService } = require('../../modules/admin');

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
  DeleteCommand: jest.fn().mockImplementation((params) => ({ _type: 'Delete', ...params })),
  ScanCommand: jest.fn().mockImplementation((params) => ({ _type: 'Scan', ...params })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ _type: 'Query', ...params })),
  UpdateCommand: jest.fn().mockImplementation((params) => ({ _type: 'Update', ...params }))
}));

// Mock crypto module
jest.mock('../../modules/crypto', () => ({
  encrypt: jest.fn((plaintext) => ({ iv: 'mock-iv', ciphertext: 'mock-ct', authTag: 'mock-tag' })),
  decrypt: jest.fn(() => 'decrypted-value')
}));

// Valid 64-char hex key (32 bytes)
const TEST_KEY = 'a'.repeat(64);

describe('AdminService', () => {
  let adminService;

  beforeEach(() => {
    mockSend.mockReset();
    adminService = new AdminService({
      endpoint: 'http://localhost:8000',
      encryptionKey: TEST_KEY
    });
  });

  // ─── User Management ───

  describe('listPendingUsers', () => {
    test('returns pending users without passwordHash', async () => {
      mockSend.mockResolvedValueOnce({
        Items: [
          { userId: 'u1', email: 'a@b.com', status: 'pending', passwordHash: 'secret' },
          { userId: 'u2', email: 'c@d.com', status: 'pending', passwordHash: 'secret2' }
        ]
      });

      const users = await adminService.listPendingUsers();
      expect(users).toHaveLength(2);
      expect(users[0].passwordHash).toBeUndefined();
      expect(users[1].passwordHash).toBeUndefined();
      expect(users[0].userId).toBe('u1');
    });

    test('returns empty array when no pending users', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });
      const users = await adminService.listPendingUsers();
      expect(users).toEqual([]);
    });
  });

  describe('approveUser', () => {
    test('approves a pending user', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { userId: 'u1', email: 'a@b.com', status: 'pending', passwordHash: 'h' }
      });
      mockSend.mockResolvedValueOnce({}); // update

      const user = await adminService.approveUser('u1');
      expect(user.status).toBe('approved');
      expect(user.passwordHash).toBeUndefined();
    });

    test('throws 404 for non-existent user', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      await expect(adminService.approveUser('nope')).rejects.toThrow('User not found');
    });

    test('throws 400 for already approved user', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { userId: 'u1', status: 'approved' }
      });
      await expect(adminService.approveUser('u1')).rejects.toThrow('User is not in pending status');
    });
  });

  describe('rejectUser', () => {
    test('deletes a pending user', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { userId: 'u1', status: 'pending' }
      });
      mockSend.mockResolvedValueOnce({}); // delete

      await adminService.rejectUser('u1');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    test('throws 404 for non-existent user', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      await expect(adminService.rejectUser('nope')).rejects.toThrow('User not found');
    });

    test('throws 400 for non-pending user', async () => {
      mockSend.mockResolvedValueOnce({
        Item: { userId: 'u1', status: 'approved' }
      });
      await expect(adminService.rejectUser('u1')).rejects.toThrow('User is not in pending status');
    });
  });

  // ─── Repository Config CRUD ───

  describe('saveRepoConfig', () => {
    test('creates a new repo config', async () => {
      mockSend.mockResolvedValueOnce({}); // put

      const result = await adminService.saveRepoConfig({
        name: 'My Repo',
        providerType: 'github',
        providerConfig: { url: 'https://github.com/org/repo', pat: 'ghp_secret' }
      });

      expect(result.name).toBe('My Repo');
      expect(result.providerType).toBe('github');
      expect(result.repoId).toBeDefined();
    });

    test('updates an existing repo config', async () => {
      mockSend.mockResolvedValueOnce({}); // update

      const result = await adminService.saveRepoConfig({
        repoId: 'existing-id',
        name: 'Updated Repo',
        providerType: 'gitlab',
        providerConfig: { url: 'https://gitlab.com/org/repo' }
      });

      expect(result.repoId).toBe('existing-id');
      expect(result.name).toBe('Updated Repo');
    });

    test('throws 400 when name is missing', async () => {
      await expect(adminService.saveRepoConfig({ providerType: 'local', providerConfig: {} }))
        .rejects.toThrow('name and providerType are required');
    });

    test('throws 400 when providerType is missing', async () => {
      await expect(adminService.saveRepoConfig({ name: 'Repo', providerConfig: {} }))
        .rejects.toThrow('name and providerType are required');
    });
  });

  describe('deleteRepoConfig', () => {
    test('deletes an existing repo config', async () => {
      mockSend.mockResolvedValueOnce({ Item: { repoId: 'r1' } }); // get
      mockSend.mockResolvedValueOnce({}); // delete

      await adminService.deleteRepoConfig('r1');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    test('throws 404 for non-existent repo', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      await expect(adminService.deleteRepoConfig('nope')).rejects.toThrow('Repository config not found');
    });
  });

  // ─── AI Provider Config ───

  describe('saveAiConfig', () => {
    test('saves openai provider selection', async () => {
      mockSend.mockResolvedValueOnce({}); // put aiProvider

      const result = await adminService.saveAiConfig({ provider: 'openai' });
      expect(result.provider).toBe('openai');
    });

    test('saves provider with API keys', async () => {
      mockSend.mockResolvedValueOnce({}); // put aiProvider
      mockSend.mockResolvedValueOnce({}); // put openaiApiKey
      mockSend.mockResolvedValueOnce({}); // put anthropicApiKey

      const result = await adminService.saveAiConfig({
        provider: 'anthropic',
        openaiApiKey: 'sk-test',
        anthropicApiKey: 'ant-test'
      });
      expect(result.provider).toBe('anthropic');
      expect(mockSend).toHaveBeenCalledTimes(3);
    });

    test('throws 400 for invalid provider', async () => {
      await expect(adminService.saveAiConfig({ provider: 'invalid' }))
        .rejects.toThrow('provider must be "openai" or "anthropic"');
    });
  });

  // ─── Prompt Template ───

  describe('savePromptTemplate', () => {
    test('saves a prompt template', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await adminService.savePromptTemplate({ promptTemplate: 'Generate notes for: {{commits}}' });
      expect(result.promptTemplate).toBe('Generate notes for: {{commits}}');
    });

    test('throws 400 for missing template', async () => {
      await expect(adminService.savePromptTemplate({}))
        .rejects.toThrow('promptTemplate is required and must be a string');
    });
  });

  // ─── Sprint Markers ───

  describe('saveSprintMarker', () => {
    test('creates a new sprint marker', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await adminService.saveSprintMarker({
        repositoryId: 'repo-1',
        label: 'Sprint 1',
        date: '2024-01-15T00:00:00.000Z',
        description: 'First sprint'
      });

      expect(result.repositoryId).toBe('repo-1');
      expect(result.label).toBe('Sprint 1');
      expect(result.markerId).toBeDefined();
    });

    test('throws 400 when required fields missing', async () => {
      await expect(adminService.saveSprintMarker({ repositoryId: 'r1' }))
        .rejects.toThrow('repositoryId, label, and date are required');
    });
  });

  // ─── Digest Config ───

  describe('saveDigestConfig', () => {
    test('saves digest config', async () => {
      mockSend.mockResolvedValueOnce({}); // digestEnabled
      mockSend.mockResolvedValueOnce({}); // digestFrequency
      mockSend.mockResolvedValueOnce({}); // digestRepoIds

      const result = await adminService.saveDigestConfig({
        enabled: true,
        frequency: 'weekly',
        repoIds: ['repo-1', 'repo-2']
      });

      expect(result.enabled).toBe(true);
      expect(result.frequency).toBe('weekly');
    });

    test('throws 400 when enabled is not boolean', async () => {
      await expect(adminService.saveDigestConfig({ enabled: 'yes' }))
        .rejects.toThrow('enabled must be a boolean');
    });
  });

  // ─── Webhook Config ───

  describe('saveWebhookConfig', () => {
    test('configures webhook for existing repo', async () => {
      mockSend.mockResolvedValueOnce({ Item: { repoId: 'r1' } }); // get repo
      mockSend.mockResolvedValueOnce({}); // update

      const result = await adminService.saveWebhookConfig('r1', {});
      expect(result.repoId).toBe('r1');
      expect(result.webhookUrl).toBe('/webhooks/r1');
      expect(result.webhookSecret).toBeDefined();
    });

    test('uses provided webhook secret', async () => {
      mockSend.mockResolvedValueOnce({ Item: { repoId: 'r1' } });
      mockSend.mockResolvedValueOnce({});

      const result = await adminService.saveWebhookConfig('r1', { webhookSecret: 'my-secret' });
      expect(result.webhookSecret).toBe('my-secret');
    });

    test('throws 404 for non-existent repo', async () => {
      mockSend.mockResolvedValueOnce({ Item: undefined });
      await expect(adminService.saveWebhookConfig('nope', {}))
        .rejects.toThrow('Repository config not found');
    });
  });
});
