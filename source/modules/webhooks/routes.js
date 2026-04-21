'use strict';

const express = require('express');

/**
 * Create webhook router.
 * Webhook routes are public (authenticated by signature, not session).
 * @param {import('./webhookHandler').WebhookHandler} webhookHandler
 * @returns {express.Router}
 */
function createWebhookRouter(webhookHandler) {
  const router = express.Router();

  // We need the raw body for HMAC signature validation.
  // The raw body is attached by express.json({ verify }) in app.js.

  /**
   * POST /webhooks/:repoId
   * Receive GitHub/GitLab webhook, validate signature, trigger incremental sync.
   */
  router.post('/:repoId', async (req, res) => {
    const { repoId } = req.params;

    try {
      // Look up repo config
      const repoConfig = await webhookHandler.getRepoConfig(repoId);
      if (!repoConfig) {
        // 404 — no details revealed about configured repos
        return res.status(404).json({ error: 'Not found' });
      }

      // Validate webhook signature
      const rawBody = req.rawBody;
      if (!rawBody) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const isValid = webhookHandler.validateSignature(repoConfig, rawBody, req.headers);
      if (!isValid) {
        // 401 — log the failed attempt, no details revealed
        console.error(`Webhook signature validation failed for repo ${repoId}`);
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Process the webhook
      const result = await webhookHandler.processWebhook(repoConfig, req.body);
      return res.status(200).json({ message: 'Webhook processed', synced: result.synced });
    } catch (err) {
      console.error(`Webhook processing error for repo ${repoId}:`, err.message);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

module.exports = { createWebhookRouter };
