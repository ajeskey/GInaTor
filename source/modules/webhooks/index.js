'use strict';

const {
  WebhookHandler,
  validateGitHubSignature,
  validateGitLabSignature
} = require('./webhookHandler');
const { createWebhookRouter } = require('./routes');

module.exports = {
  WebhookHandler,
  createWebhookRouter,
  validateGitHubSignature,
  validateGitLabSignature
};
