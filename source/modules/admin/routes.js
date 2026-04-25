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
   * Return admin panel data as JSON (page rendering handled by Next.js frontend).
   */
  router.get('/', async (req, res) => {
    try {
      const pendingUsers = await adminService.listPendingUsers();
      const repoConfigs = await adminService.listRepoConfigs();
      res.json({ pendingUsers, repoConfigs });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ─── Guest Access Config ───

  /**
   * GET /admin/guest-access
   * Return current guest access setting.
   */
  router.get('/guest-access', async (req, res) => {
    try {
      const value = await adminService._getSetting('guestAccessEnabled');
      res.json({ enabled: value === 'true' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /admin/guest-access
   * Enable or disable guest access.
   */
  router.post('/guest-access', async (req, res) => {
    try {
      const { enabled } = req.body;
      if (typeof enabled !== 'boolean') {
        return res.status(400).json({ error: 'enabled must be a boolean' });
      }
      await adminService._putSetting('guestAccessEnabled', String(enabled));
      res.json({ enabled });
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

  // ─── Sync ───

  /**
   * POST /admin/repos/validate-local
   * Validate that a filesystem path is a valid git repository.
   */
  router.post('/repos/validate-local', async (req, res) => {
    try {
      const { path } = req.body;
      if (!path) {
        return res.status(400).json({ valid: false, error: 'Path is required' });
      }

      const LocalGitProvider = require('../git-connector/LocalGitProvider');
      const provider = new LocalGitProvider();
      const result = await provider.validate({ path });
      return res.json(result);
    } catch (err) {
      return res.status(500).json({ valid: false, error: err.message || 'Validation failed' });
    }
  });

  /**
   * POST /admin/sync/:repoId
   * Trigger a git sync for a repository — fetches commits and stores them.
   */
  router.post('/sync/:repoId', async (req, res) => {
    try {
      const { getProvider } = require('../git-connector');
      const CommitStore = require('../commit-store');
      const { decrypt } = require('../crypto');

      const repoConfig = await adminService.docClient.send(
        new (require('@aws-sdk/lib-dynamodb').GetCommand)({
          TableName: 'RepositoryConfigs',
          Key: { repoId: req.params.repoId }
        })
      );

      if (!repoConfig.Item) {
        return res.status(404).json({ error: 'Repository not found' });
      }

      const config = repoConfig.Item;
      const provider = getProvider(config.providerType);

      // Build provider config
      const providerConfig = {
        repoId: config.repoId,
        ...(config.providerConfig || {})
      };

      // Decrypt PAT if it's encrypted
      if (providerConfig.pat && typeof providerConfig.pat === 'object' && providerConfig.pat.iv) {
        providerConfig.pat = decrypt(providerConfig.pat, adminService.encryptionKey);
      }

      // Fetch commits from provider
      const commits = await provider.fetchLog(providerConfig);

      // Store commits
      const commitStore = new CommitStore({
        endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
        region: process.env.AWS_REGION || 'us-east-1'
      });
      const result = await commitStore.putCommits(commits);

      return res.status(200).json({
        message: 'Sync complete',
        fetched: commits.length,
        created: result.created,
        skipped: result.skipped
      });
    } catch (err) {
      console.error('Sync error:', err);
      return res.status(500).json({ error: err.message || 'Sync failed' });
    }
  });

  return router;
}

module.exports = { createAdminRouter };
