'use strict';

const crypto = require('node:crypto');
const { WebhookHandler, validateGitHubSignature, validateGitLabSignature } = require('../../modules/webhooks');

// Mock DynamoDB
jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const mockSend = jest.fn();
  return {
    DynamoDBDocumentClient: { from: jest.fn(() => ({ send: mockSend })) },
    GetCommand: jest.fn((params) => ({ _type: 'Get', ...params })),
    UpdateCommand: jest.fn((params) => ({ _type: 'Update', ...params })),
    __mockSend: mockSend
  };
});

const { __mockSend } = require('@aws-sdk/lib-dynamodb');

describe('validateGitHubSignature', () => {
  it('returns true for a valid HMAC-SHA256 signature', () => {
    const secret = 'my-secret';
    const payload = Buffer.from('{"action":"push"}');
    const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
    expect(validateGitHubSignature(payload, secret, sig)).toBe(true);
  });

  it('returns false for an invalid signature', () => {
    const payload = Buffer.from('{"action":"push"}');
    expect(validateGitHubSignature(payload, 'secret', 'sha256=bad')).toBe(false);
  });

  it('returns false when signature header is missing', () => {
    expect(validateGitHubSignature(Buffer.from('body'), 'secret', '')).toBe(false);
  });

  it('returns false when secret is empty', () => {
    expect(validateGitHubSignature(Buffer.from('body'), '', 'sha256=abc')).toBe(false);
  });
});

describe('validateGitLabSignature', () => {
  it('returns true when token matches secret', () => {
    expect(validateGitLabSignature('my-token', 'my-token')).toBe(true);
  });

  it('returns false when token does not match', () => {
    expect(validateGitLabSignature('my-token', 'wrong-token')).toBe(false);
  });

  it('returns false when token header is missing', () => {
    expect(validateGitLabSignature('my-token', '')).toBe(false);
  });
});

describe('WebhookHandler', () => {
  let handler;

  beforeEach(() => {
    __mockSend.mockReset();
    handler = new WebhookHandler({
      endpoint: 'http://localhost:8000',
      encryptionKey: 'a'.repeat(64) // 32 bytes hex
    });
  });

  describe('getRepoConfig', () => {
    it('returns the repo config when found', async () => {
      const config = { repoId: 'repo-1', name: 'Test', providerType: 'github' };
      __mockSend.mockResolvedValueOnce({ Item: config });
      const result = await handler.getRepoConfig('repo-1');
      expect(result).toEqual(config);
    });

    it('returns null when repo not found', async () => {
      __mockSend.mockResolvedValueOnce({ Item: undefined });
      const result = await handler.getRepoConfig('unknown');
      expect(result).toBeNull();
    });
  });

  describe('validateSignature', () => {
    const { encrypt } = require('../../modules/crypto');
    const encKey = 'a'.repeat(64);

    it('validates a GitHub signature correctly', () => {
      const secret = 'webhook-secret-123';
      const encrypted = encrypt(secret, encKey);
      const repoConfig = { webhookSecret: encrypted };
      const payload = Buffer.from('test-payload');
      const sig = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');

      const result = handler.validateSignature(repoConfig, payload, {
        'x-hub-signature-256': sig
      });
      expect(result).toBe(true);
    });

    it('rejects an invalid GitHub signature', () => {
      const secret = 'webhook-secret-123';
      const encrypted = encrypt(secret, encKey);
      const repoConfig = { webhookSecret: encrypted };
      const payload = Buffer.from('test-payload');

      const result = handler.validateSignature(repoConfig, payload, {
        'x-hub-signature-256': 'sha256=invalid'
      });
      expect(result).toBe(false);
    });

    it('validates a GitLab token correctly', () => {
      const secret = 'gitlab-token-456';
      const encrypted = encrypt(secret, encKey);
      const repoConfig = { webhookSecret: encrypted };

      const result = handler.validateSignature(repoConfig, Buffer.from('body'), {
        'x-gitlab-token': 'gitlab-token-456'
      });
      expect(result).toBe(true);
    });

    it('rejects an invalid GitLab token', () => {
      const secret = 'gitlab-token-456';
      const encrypted = encrypt(secret, encKey);
      const repoConfig = { webhookSecret: encrypted };

      const result = handler.validateSignature(repoConfig, Buffer.from('body'), {
        'x-gitlab-token': 'wrong-token'
      });
      expect(result).toBe(false);
    });

    it('returns false when no signature header is present', () => {
      const encrypted = encrypt('secret', encKey);
      const repoConfig = { webhookSecret: encrypted };

      const result = handler.validateSignature(repoConfig, Buffer.from('body'), {});
      expect(result).toBe(false);
    });

    it('returns false when webhookSecret is not set', () => {
      const result = handler.validateSignature({}, Buffer.from('body'), {
        'x-hub-signature-256': 'sha256=abc'
      });
      expect(result).toBe(false);
    });
  });
});
