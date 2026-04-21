'use strict';

const crypto = require('node:crypto');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand,
  ScanCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');
const { encrypt } = require('../crypto');

const USERS_TABLE = 'Users';
const REPO_CONFIGS_TABLE = 'RepositoryConfigs';
const ADMIN_SETTINGS_TABLE = 'AdminSettings';
const SPRINT_MARKERS_TABLE = 'SprintMarkers';

/**
 * Admin service for managing users, repository configs, AI settings,
 * sprint markers, digest email config, and webhooks.
 * All sensitive values (PATs, ARNs, API keys) are encrypted at rest via AES-256-GCM.
 */
class AdminService {
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

  // ─── User Management ───

  /**
   * List all users with 'pending' status.
   * @returns {Promise<object[]>} Array of pending user records (without passwordHash).
   */
  async listPendingUsers() {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: '#s = :pending',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':pending': 'pending' }
      })
    );
    return (result.Items || []).map(({ passwordHash: _passwordHash, ...user }) => user);
  }

  /**
   * Approve a pending user by setting status to 'approved'.
   * @param {string} userId
   * @returns {Promise<object>} Updated user (without passwordHash).
   * @throws {Error} If user not found or not pending.
   */
  async approveUser(userId) {
    const user = await this._getUser(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.status !== 'pending') {
      const err = new Error('User is not in pending status');
      err.statusCode = 400;
      throw err;
    }

    await this.docClient.send(
      new UpdateCommand({
        TableName: USERS_TABLE,
        Key: { userId },
        UpdateExpression: 'SET #s = :approved',
        ExpressionAttributeNames: { '#s': 'status' },
        ExpressionAttributeValues: { ':approved': 'approved' }
      })
    );

    const { passwordHash: _passwordHash, ...safeUser } = { ...user, status: 'approved' };
    return safeUser;
  }

  /**
   * Reject (delete) a pending user.
   * @param {string} userId
   * @returns {Promise<void>}
   * @throws {Error} If user not found or not pending.
   */
  async rejectUser(userId) {
    const user = await this._getUser(userId);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    if (user.status !== 'pending') {
      const err = new Error('User is not in pending status');
      err.statusCode = 400;
      throw err;
    }

    await this.docClient.send(
      new DeleteCommand({
        TableName: USERS_TABLE,
        Key: { userId }
      })
    );
  }

  /**
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async _getUser(userId) {
    const result = await this.docClient.send(
      new GetCommand({ TableName: USERS_TABLE, Key: { userId } })
    );
    return result.Item || null;
  }

  // ─── Repository Config CRUD ───

  /**
   * Create or update a repository configuration.
   * If repoId is provided, updates; otherwise creates with a new UUID.
   * Encrypts PAT/ARN fields in providerConfig.
   * @param {object} data - { repoId?, name, providerType, providerConfig }
   * @returns {Promise<object>} The saved repo config (sensitive fields encrypted).
   */
  async saveRepoConfig(data) {
    const { name, providerType, providerConfig } = data;
    if (!name || !providerType) {
      const err = new Error('name and providerType are required');
      err.statusCode = 400;
      throw err;
    }

    const repoId = data.repoId || crypto.randomUUID();
    const now = new Date().toISOString();

    // Encrypt sensitive fields in providerConfig
    const encryptedConfig = { ...providerConfig };
    if (encryptedConfig.pat) {
      encryptedConfig.pat = encrypt(encryptedConfig.pat, this.encryptionKey);
    }
    if (encryptedConfig.arn) {
      encryptedConfig.arn = encrypt(encryptedConfig.arn, this.encryptionKey);
    }

    const item = {
      repoId,
      name,
      providerType,
      providerConfig: encryptedConfig,
      createdAt: data.repoId ? undefined : now
    };

    // Remove undefined fields
    Object.keys(item).forEach((k) => item[k] === undefined && delete item[k]);

    if (data.repoId) {
      // Update existing
      await this.docClient.send(
        new UpdateCommand({
          TableName: REPO_CONFIGS_TABLE,
          Key: { repoId },
          UpdateExpression: 'SET #n = :name, providerType = :pt, providerConfig = :pc',
          ExpressionAttributeNames: { '#n': 'name' },
          ExpressionAttributeValues: {
            ':name': name,
            ':pt': providerType,
            ':pc': encryptedConfig
          }
        })
      );
    } else {
      await this.docClient.send(new PutCommand({ TableName: REPO_CONFIGS_TABLE, Item: item }));
    }

    return { repoId, name, providerType };
  }

  /**
   * Delete a repository configuration.
   * @param {string} repoId
   * @returns {Promise<void>}
   * @throws {Error} If repo not found.
   */
  async deleteRepoConfig(repoId) {
    const result = await this.docClient.send(
      new GetCommand({ TableName: REPO_CONFIGS_TABLE, Key: { repoId } })
    );
    if (!result.Item) {
      const err = new Error('Repository config not found');
      err.statusCode = 404;
      throw err;
    }

    await this.docClient.send(
      new DeleteCommand({ TableName: REPO_CONFIGS_TABLE, Key: { repoId } })
    );
  }

  /**
   * List all repository configurations (without decrypted secrets).
   * @returns {Promise<object[]>}
   */
  async listRepoConfigs() {
    const result = await this.docClient.send(new ScanCommand({ TableName: REPO_CONFIGS_TABLE }));
    return result.Items || [];
  }

  // ─── AI Provider Config ───

  /**
   * Set AI provider configuration: provider selection and encrypted API keys.
   * @param {object} data - { provider, openaiApiKey?, anthropicApiKey? }
   * @returns {Promise<object>} Saved settings summary.
   */
  async saveAiConfig(data) {
    const { provider, openaiApiKey, anthropicApiKey } = data;
    if (!provider || !['openai', 'anthropic'].includes(provider)) {
      const err = new Error('provider must be "openai" or "anthropic"');
      err.statusCode = 400;
      throw err;
    }

    // Save provider selection
    await this._putSetting('aiProvider', provider);

    // Save encrypted API keys if provided
    if (openaiApiKey) {
      const encrypted = encrypt(openaiApiKey, this.encryptionKey);
      await this._putSetting('openaiApiKey', JSON.stringify(encrypted));
    }
    if (anthropicApiKey) {
      const encrypted = encrypt(anthropicApiKey, this.encryptionKey);
      await this._putSetting('anthropicApiKey', JSON.stringify(encrypted));
    }

    return { provider };
  }

  // ─── Prompt Template Config ───

  /**
   * Save the release notes prompt template.
   * @param {object} data - { promptTemplate }
   * @returns {Promise<object>}
   */
  async savePromptTemplate(data) {
    const { promptTemplate } = data;
    if (!promptTemplate || typeof promptTemplate !== 'string') {
      const err = new Error('promptTemplate is required and must be a string');
      err.statusCode = 400;
      throw err;
    }

    await this._putSetting('releaseNotesPrompt', promptTemplate);
    return { promptTemplate };
  }

  // ─── Sprint Marker CRUD ───

  /**
   * Create or update a sprint/release marker.
   * @param {object} data - { markerId?, repositoryId, label, date, description? }
   * @returns {Promise<object>} The saved marker.
   */
  async saveSprintMarker(data) {
    const { repositoryId, label, date } = data;
    if (!repositoryId || !label || !date) {
      const err = new Error('repositoryId, label, and date are required');
      err.statusCode = 400;
      throw err;
    }

    const markerId = data.markerId || crypto.randomUUID();
    const item = {
      repositoryId,
      markerId,
      label,
      date,
      description: data.description || ''
    };

    await this.docClient.send(new PutCommand({ TableName: SPRINT_MARKERS_TABLE, Item: item }));

    return item;
  }

  // ─── Digest Email Config ───

  /**
   * Save digest email configuration.
   * @param {object} data - { enabled, frequency?, repoIds? }
   * @returns {Promise<object>}
   */
  async saveDigestConfig(data) {
    const { enabled, frequency, repoIds } = data;
    if (typeof enabled !== 'boolean') {
      const err = new Error('enabled must be a boolean');
      err.statusCode = 400;
      throw err;
    }

    await this._putSetting('digestEnabled', String(enabled));
    if (frequency) {
      await this._putSetting('digestFrequency', frequency);
    }
    if (repoIds) {
      await this._putSetting('digestRepoIds', JSON.stringify(repoIds));
    }

    return { enabled, frequency, repoIds };
  }

  // ─── Webhook Config ───

  /**
   * Configure webhook for a repository (generate/store secret).
   * @param {string} repoId
   * @param {object} data - { webhookSecret? }
   * @returns {Promise<object>} Webhook config with URL and secret.
   */
  async saveWebhookConfig(repoId, data) {
    const repo = await this.docClient.send(
      new GetCommand({ TableName: REPO_CONFIGS_TABLE, Key: { repoId } })
    );
    if (!repo.Item) {
      const err = new Error('Repository config not found');
      err.statusCode = 404;
      throw err;
    }

    const secret = data.webhookSecret || crypto.randomUUID();
    const encryptedSecret = encrypt(secret, this.encryptionKey);

    await this.docClient.send(
      new UpdateCommand({
        TableName: REPO_CONFIGS_TABLE,
        Key: { repoId },
        UpdateExpression: 'SET webhookSecret = :ws',
        ExpressionAttributeValues: { ':ws': encryptedSecret }
      })
    );

    return {
      repoId,
      webhookUrl: `/webhooks/${repoId}`,
      webhookSecret: secret
    };
  }

  // ─── Admin Settings Helpers ───

  /**
   * Put a setting into AdminSettings table.
   * @param {string} settingKey
   * @param {string} settingValue
   */
  async _putSetting(settingKey, settingValue) {
    await this.docClient.send(
      new PutCommand({
        TableName: ADMIN_SETTINGS_TABLE,
        Item: { settingKey, settingValue }
      })
    );
  }

  /**
   * Get a setting from AdminSettings table.
   * @param {string} settingKey
   * @returns {Promise<string|null>}
   */
  async _getSetting(settingKey) {
    const result = await this.docClient.send(
      new GetCommand({ TableName: ADMIN_SETTINGS_TABLE, Key: { settingKey } })
    );
    return result.Item ? result.Item.settingValue : null;
  }
}

module.exports = { AdminService };
