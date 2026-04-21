'use strict';

const express = require('express');
const request = require('supertest');
const { createAdminRouter } = require('../../modules/admin');

function createTestApp(adminService) {
  const app = express();
  app.use(express.json());
  // Stub res.render so we don't need actual pug templates
  app.use((req, res, next) => {
    const originalRender = res.render.bind(res);
    res.render = (view, locals) => {
      res.json({ view, ...locals });
    };
    next();
  });
  const router = createAdminRouter(adminService);
  app.use('/admin', router);
  return app;
}

describe('Admin Routes', () => {
  let mockService;
  let app;

  beforeEach(() => {
    mockService = {
      listPendingUsers: jest.fn().mockResolvedValue([]),
      listRepoConfigs: jest.fn().mockResolvedValue([]),
      approveUser: jest.fn(),
      rejectUser: jest.fn(),
      saveRepoConfig: jest.fn(),
      deleteRepoConfig: jest.fn(),
      saveAiConfig: jest.fn(),
      savePromptTemplate: jest.fn(),
      saveSprintMarker: jest.fn(),
      saveDigestConfig: jest.fn(),
      saveWebhookConfig: jest.fn()
    };
    app = createTestApp(mockService);
  });

  describe('GET /admin', () => {
    test('renders admin panel', async () => {
      const res = await request(app).get('/admin');
      expect(res.status).toBe(200);
    });

    test('returns 500 on service error', async () => {
      mockService.listPendingUsers.mockRejectedValue(new Error('DB error'));
      const res = await request(app).get('/admin');
      expect(res.status).toBe(500);
    });
  });

  describe('POST /admin/users/:id/approve', () => {
    test('approves user and returns 200', async () => {
      mockService.approveUser.mockResolvedValue({ userId: 'u1', status: 'approved' });
      const res = await request(app).post('/admin/users/u1/approve');
      expect(res.status).toBe(200);
      expect(res.body.user.status).toBe('approved');
    });

    test('returns 404 for non-existent user', async () => {
      const err = new Error('User not found');
      err.statusCode = 404;
      mockService.approveUser.mockRejectedValue(err);
      const res = await request(app).post('/admin/users/nope/approve');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /admin/users/:id/reject', () => {
    test('rejects user and returns 200', async () => {
      mockService.rejectUser.mockResolvedValue();
      const res = await request(app).post('/admin/users/u1/reject');
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('User rejected');
    });
  });

  describe('POST /admin/repos', () => {
    test('creates repo config', async () => {
      mockService.saveRepoConfig.mockResolvedValue({ repoId: 'r1', name: 'Repo', providerType: 'github' });
      const res = await request(app)
        .post('/admin/repos')
        .send({ name: 'Repo', providerType: 'github', providerConfig: {} });
      expect(res.status).toBe(200);
      expect(res.body.repoId).toBe('r1');
    });
  });

  describe('DELETE /admin/repos/:id', () => {
    test('deletes repo config', async () => {
      mockService.deleteRepoConfig.mockResolvedValue();
      const res = await request(app).delete('/admin/repos/r1');
      expect(res.status).toBe(200);
    });
  });

  describe('POST /admin/ai-config', () => {
    test('saves AI config', async () => {
      mockService.saveAiConfig.mockResolvedValue({ provider: 'openai' });
      const res = await request(app)
        .post('/admin/ai-config')
        .send({ provider: 'openai' });
      expect(res.status).toBe(200);
      expect(res.body.provider).toBe('openai');
    });
  });

  describe('POST /admin/prompt', () => {
    test('saves prompt template', async () => {
      mockService.savePromptTemplate.mockResolvedValue({ promptTemplate: 'test' });
      const res = await request(app)
        .post('/admin/prompt')
        .send({ promptTemplate: 'test' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /admin/markers', () => {
    test('saves sprint marker', async () => {
      mockService.saveSprintMarker.mockResolvedValue({ markerId: 'm1', label: 'Sprint 1' });
      const res = await request(app)
        .post('/admin/markers')
        .send({ repositoryId: 'r1', label: 'Sprint 1', date: '2024-01-01' });
      expect(res.status).toBe(200);
      expect(res.body.label).toBe('Sprint 1');
    });
  });

  describe('POST /admin/digest', () => {
    test('saves digest config', async () => {
      mockService.saveDigestConfig.mockResolvedValue({ enabled: true });
      const res = await request(app)
        .post('/admin/digest')
        .send({ enabled: true, frequency: 'weekly' });
      expect(res.status).toBe(200);
    });
  });

  describe('POST /admin/webhooks/:repoId', () => {
    test('configures webhook', async () => {
      mockService.saveWebhookConfig.mockResolvedValue({
        repoId: 'r1',
        webhookUrl: '/webhooks/r1',
        webhookSecret: 'secret'
      });
      const res = await request(app).post('/admin/webhooks/r1').send({});
      expect(res.status).toBe(200);
      expect(res.body.webhookUrl).toBe('/webhooks/r1');
    });
  });
});
