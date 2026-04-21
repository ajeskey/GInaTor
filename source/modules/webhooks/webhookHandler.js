'use strict';

const crypto = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, GetCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { decrypt } = require('../crypto');
const { getProvider } = require('../git-connector');

const REPO_CONFIGS_TABLE = 'RepositoryConfigs';

/**
 * Validates an HMAC-SHA256 signature (GitHub style: sha256=<hex>).
 * @param {string|Buffer} payload - Raw request body.
 * @param {string} secret - The webhook secret.
 * @param {string} signatureHeader - The signature from the request header.
 * @returns {boolean}
 */
function validateGitHubSignature(payload, secret, signatureHeader) {
  if (!signatureHeader || !secret) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(payload).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  } catch {
    return false;
  }
}

/**
 * Validates a GitLab webhook token (plain comparison).
 * @param {string} secret - The stored webhook secret.
 * @param {string} tokenHeader - The X-Gitlab-Token header value.
 * @returns {boolean}
 */
function validateGitLabSignature(secret, tokenHeader) {
  if (!tokenHeader || !secret) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(secret), Buffer.from(tokenHeader));
  } catch {
    return false;
  }
}

/**
 * Webhook handler service for processing GitHub/GitLab webhook requests.
 */
class WebhookHandler {
  /**
   * @param {object} [options]
   * @param {string} [options.endpoint] - DynamoDB endpoint (for local dev).
   * @param {string} [options.region='us-east-1'] - AWS region.
   * @param {string} [options.encryptionKey] - Hex-encoded 256-bit encryption key.
   */
  constructor(options = {}) {
    this.encryptionKey = options.encryptionKey || process.env.ENCRYPTION_KEY;

    const clientConfig = {
      region: options.region || process.env.AWS_REGION || 'us-east-1'
    };
    if (options.endpoint || process.env.DYNAMODB_ENDPOINT) {
      clientConfig.endpoint = options.endpoint || process.env.DYNAMODB_ENDPOINT;
    }

    const client = new DynamoDBClient(clientConfig);
    this.docClient = DynamoDBDocumentClient.from(client);
  }

  /**
   * Look up a repository config by repoId.
   * @param {string} repoId
   * @returns {Promise<object|null>}
   */
  async getRepoConfig(repoId) {
    const result = await this.docClient.send(
      new GetCommand({ TableName: REPO_CONFIGS_TABLE, Key: { repoId } })
    );
    return result.Item || null;
  }

  /**
   * Validate the webhook signature for a given request.
   * @param {object} repoConfig - The repository configuration from DynamoDB.
   * @param {string|Buffer} rawBody - The raw request body.
   * @param {object} headers - The request headers (lowercased keys).
   * @returns {boolean}
   */
  validateSignature(repoConfig, rawBody, headers) {
    if (!repoConfig.webhookSecret) return false;

    const secret = decrypt(repoConfig.webhookSecret, this.encryptionKey);

    // GitHub: X-Hub-Signature-256 header
    const githubSig = headers['x-hub-signature-256'];
    if (githubSig) {
      return validateGitHubSignature(rawBody, secret, githubSig);
    }

    // GitLab: X-Gitlab-Token header
    const gitlabToken = headers['x-gitlab-token'];
    if (gitlabToken) {
      return validateGitLabSignature(secret, gitlabToken);
    }

    // No recognized signature header
    return false;
  }

  /**
   * Process a validated webhook payload: extract commits and trigger incremental sync.
   * @param {object} repoConfig - The repository configuration.
   * @param {object} payload - The parsed webhook body.
   * @returns {Promise<{ synced: number }>}
   */
  async processWebhook(repoConfig, payload) {
    const provider = getProvider(repoConfig.providerType);
    const parsed = provider.parseWebhookPayload(payload);

    if (!parsed.commits || parsed.commits.length === 0) {
      return { synced: 0 };
    }

    // Trigger incremental sync via the provider's fetchLog
    const config = {
      repoId: repoConfig.repoId,
      ...repoConfig.providerConfig
    };

    // Decrypt PAT if present
    if (config.pat && typeof config.pat === 'object' && config.pat.iv) {
      config.pat = decrypt(config.pat, this.encryptionKey);
    }

    const commits = await provider.fetchLog(config);

    // Update lastWebhookAt timestamp
    const now = new Date().toISOString();
    await this.docClient.send(
      new UpdateCommand({
        TableName: REPO_CONFIGS_TABLE,
        Key: { repoId: repoConfig.repoId },
        UpdateExpression: 'SET lastWebhookAt = :ts',
        ExpressionAttributeValues: { ':ts': now }
      })
    );

    return { synced: commits.length };
  }
}

module.exports = { WebhookHandler, validateGitHubSignature, validateGitLabSignature };
