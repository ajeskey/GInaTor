'use strict';

const crypto = require('node:crypto');
const bcrypt = require('bcrypt');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  ScanCommand
} = require('@aws-sdk/lib-dynamodb');

const BCRYPT_COST_FACTOR = 10;
const USERS_TABLE = 'Users';
const EMAIL_INDEX = 'email-index';

/**
 * Validates that an email is well-formed:
 * - Contains exactly one @
 * - Non-empty local part
 * - Domain has at least one dot
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const atIndex = email.indexOf('@');
  if (atIndex < 1) return false; // no @ or empty local part
  if (email.indexOf('@', atIndex + 1) !== -1) return false; // more than one @
  const domain = email.slice(atIndex + 1);
  if (!domain || domain.indexOf('.') === -1) return false; // no domain or no dot
  // Ensure dot is not first or last char of domain
  if (domain.startsWith('.') || domain.endsWith('.')) return false;
  return true;
}

/**
 * Validates that a password meets minimum requirements.
 * @param {string} password
 * @returns {boolean}
 */
function isValidPassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

class AuthService {
  /**
   * @param {object} [options]
   * @param {string} [options.tableName='Users'] - DynamoDB table name.
   * @param {string} [options.endpoint] - DynamoDB endpoint (for local dev).
   * @param {string} [options.region='us-east-1'] - AWS region.
   */
  constructor(options = {}) {
    this.tableName = options.tableName || USERS_TABLE;

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
   * Register a new user with email and password.
   * - Validates email format and password length
   * - Hashes password with bcrypt (cost factor >= 10)
   * - First user is auto-approved as Admin; subsequent users get Pending status
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} The created user record (without passwordHash).
   * @throws {Error} On validation failure or duplicate email.
   */
  async register(email, password) {
    // Validate inputs
    if (!isValidEmail(email)) {
      const err = new Error('Invalid email format');
      err.statusCode = 400;
      throw err;
    }
    if (!isValidPassword(password)) {
      const err = new Error('Password must be at least 8 characters');
      err.statusCode = 400;
      throw err;
    }

    // Check for duplicate email
    const existing = await this._getUserByEmail(email);
    if (existing) {
      const err = new Error('Email already registered');
      err.statusCode = 409;
      throw err;
    }

    // Determine role and status: first user = admin + approved
    const isFirstUser = await this._isFirstUser();
    const role = isFirstUser ? 'admin' : 'user';
    const status = isFirstUser ? 'approved' : 'pending';

    // Hash password
    const passwordHash = await bcrypt.hash(password, BCRYPT_COST_FACTOR);

    const userId = crypto.randomUUID();
    const now = new Date().toISOString();

    const user = {
      userId,
      email,
      passwordHash,
      role,
      status,
      themePreference: 'light',
      digestOptOut: false,
      createdAt: now
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: user
      })
    );

    // Return user without passwordHash
    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Authenticate a user by email and password.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} The user record (without passwordHash).
   * @throws {Error} On invalid credentials (generic message).
   */
  async login(email, password) {
    const user = await this._getUserByEmail(email);
    if (!user) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      const err = new Error('Invalid credentials');
      err.statusCode = 401;
      throw err;
    }

    const { passwordHash: _, ...safeUser } = user;
    return safeUser;
  }

  /**
   * Check if a user is approved.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isApproved(userId) {
    const user = await this._getUserById(userId);
    if (!user) return false;
    return user.status === 'approved';
  }

  /**
   * Get a user by ID (internal, includes passwordHash).
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async _getUserById(userId) {
    const result = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { userId }
      })
    );
    return result.Item || null;
  }

  /**
   * Get a user by email using the email-index GSI.
   * @param {string} email
   * @returns {Promise<object|null>}
   */
  async _getUserByEmail(email) {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: EMAIL_INDEX,
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: { ':email': email },
        Limit: 1
      })
    );
    return (result.Items && result.Items.length > 0) ? result.Items[0] : null;
  }

  /**
   * Check if the Users table is empty (for first-user detection).
   * @returns {Promise<boolean>}
   */
  async _isFirstUser() {
    const result = await this.docClient.send(
      new ScanCommand({
        TableName: this.tableName,
        Limit: 1,
        Select: 'COUNT'
      })
    );
    return result.Count === 0;
  }
}

module.exports = { AuthService, isValidEmail, isValidPassword };
