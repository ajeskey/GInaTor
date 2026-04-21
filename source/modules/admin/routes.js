'use strict';

const express = require('express');

/**
 * Create admin router with all admin panel endpoints.
 * @param {import('./AdminService').AdminService} adminService
 * @returns {express.Router}
 */
function createAdminRouter(adminService) {
  const router = express.Router();

  /**
   * GET /admin
   * Render the admin panel page.
   */
  router.get('/', async (req, res) => {
    try {
      const pendingUsers = await adminService.listPendingUsers();
      const repoConfigs = await adminService.listRepoConfigs();
      res.render('pages/admin', { pendingUsers, repoConfigs });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── User Management ───

  /**
   * POST /admin/users/:id/approve
   * Approve a pending user.
   */
  router.post('/users/:id/approve', async (req, res) => {
    try {
      const user = await adminService.approveUser(req.params.id);
      return res.status(200).json({ user });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  /**
   * POST /admin/users/:id/reject
   * Reject (delete) a pending user.
   */
  router.post('/users/:id/reject', async (req, res) => {
    try {
      await adminService.rejectUser(req.params.id);
      return res.status(200).json({ message: 'User rejected' });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ─── Repository Config CRUD ───

  /**
   * POST /admin/repos
   * Create or update a repository configuration.
   */
  router.post('/repos', async (req, res) => {
    try {
      const result = await adminService.saveRepoConfig(req.body);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  /**
   * DELETE /admin/repos/:id
   * Delete a repository configuration.
   */
  router.delete('/repos/:id', async (req, res) => {
    try {
      await adminService.deleteRepoConfig(req.params.id);
      return res.status(200).json({ message: 'Repository config deleted' });
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ─── AI Provider Config ───

  /**
   * POST /admin/ai-config
   * Set AI provider selection and store encrypted API keys.
   */
  router.post('/ai-config', async (req, res) => {
    try {
      const result = await adminService.saveAiConfig(req.body);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ─── Prompt Template Config ───

  /**
   * POST /admin/prompt
   * Set release notes prompt template.
   */
  router.post('/prompt', async (req, res) => {
    try {
      const result = await adminService.savePromptTemplate(req.body);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ─── Sprint Marker CRUD ───

  /**
   * POST /admin/markers
   * Create or update a sprint/release marker.
   */
  router.post('/markers', async (req, res) => {
    try {
      const result = await adminService.saveSprintMarker(req.body);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ─── Digest Email Config ───

  /**
   * POST /admin/digest
   * Configure digest email settings.
   */
  router.post('/digest', async (req, res) => {
    try {
      const result = await adminService.saveDigestConfig(req.body);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  // ─── Webhook Config ───

  /**
   * POST /admin/webhooks/:repoId
   * Configure webhook for a repository.
   */
  router.post('/webhooks/:repoId', async (req, res) => {
    try {
      const result = await adminService.saveWebhookConfig(req.params.repoId, req.body);
      return res.status(200).json(result);
    } catch (err) {
      const status = err.statusCode || 500;
      return res.status(status).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
