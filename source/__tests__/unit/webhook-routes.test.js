'use strict';

const crypto = require('node:crypto');
const express = require('express');
const request = require('supertest');
const { encrypt } = require('../../modules/crypto');
const { createWebhookRouter } = require('../../modules/webhooks/routes');

const ENC_KEY = 'a'.repeat(64);
const WEBHOOK_SECRET = 'test-webhook-secret';

function createMockHandler() {
  const encryptedSecret = encrypt(WEBHOOK_SECRET, ENC_KEY);
  const repoConfig = {
    repoId: 'repo-1',
    name: 'Test Repo',
    providerType: 'github',
    providerConfig: {},
    webhookSecret: encryptedSecret
  };

  return {
    getRepoConfig: jest.fn(async (repoId) => {
      if (repoId === 'repo-1') return repoConfig;
      return null;
    }),
    validateSignature: jest.fn((config, rawBody, headers) => {
      if (!config.webhookSecret) return false;
      const secret = require('../../modules/crypto').decrypt(config.webhookSecret, ENC_KEY);
      const sig = headers['x-hub-signature-256'];
      if (!sig) return false;
      const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
      } catch { return false; }
    }),
    processWebhook: jest.fn(async () => ({ synced: 3 }))
  };
}

function createApp(handler) {
  const app = express();
  app.use(express.json({
    verify: (req, res, buf) => { req.rawBody = buf; }
  }));
  app.use('/webhooks', createWebhookRouter(handler));
  return app;
}

describe('POST /webhooks/:repoId', () => {
  let handler;
  let app;

  beforeEach(() => {
    handler = createMockHandler();
    app = createApp(handler);
  });

  it('returns 404 for unknown repo without revealing details', async () => {
    const res = await request(app)
      .post('/webhooks/unknown-repo')
      .send({ commits: [] });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
    // Must not reveal any configured repo details
    expect(JSON.stringify(res.body)).not.toContain('repo-1');
  });

  it('returns 401 for invalid signature', async () => {
    const res = await request(app)
      .post('/webhooks/repo-1')
      .set('X-Hub-Signature-256', 'sha256=invalid')
      .send({ commits: [] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 401 when no signature header is present', async () => {
    const res = await request(app)
      .post('/webhooks/repo-1')
      .send({ commits: [] });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Unauthorized');
  });

  it('returns 200 and processes webhook with valid GitHub signature', async () => {
    const payload = JSON.stringify({ commits: [{ id: 'abc123' }] });
    const sig = 'sha256=' + crypto.createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');

    const res = await request(app)
      .post('/webhooks/repo-1')
      .set('Content-Type', 'application/json')
      .set('X-Hub-Signature-256', sig)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Webhook processed');
    expect(res.body.synced).toBe(3);
    expect(handler.processWebhook).toHaveBeenCalled();
  });
});
