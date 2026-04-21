'use strict';

const session = require('express-session');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

/**
 * A DynamoDB-backed session store for express-session.
 * Stores sessions in a DynamoDB table with TTL-based expiration.
 */
class DynamoDBStore extends session.Store {
  /**
   * @param {object} options
   * @param {string} [options.tableName='Sessions'] - DynamoDB table name.
   * @param {string} [options.endpoint] - DynamoDB endpoint (for local dev).
   * @param {string} [options.region='us-east-1'] - AWS region.
   * @param {number} [options.ttl=86400] - Session TTL in seconds (default 24h).
   */
  constructor(options = {}) {
    super();
    this.tableName = options.tableName || 'Sessions';
    this.ttl = options.ttl || 86400;

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
   * Get a session by session ID.
   * @param {string} sid - Session ID.
   * @param {function} callback - Callback(err, session).
   */
  async get(sid, callback) {
    try {
      const result = await this.docClient.send(
        new GetCommand({
          TableName: this.tableName,
          Key: { sessionId: sid }
        })
      );

      if (!result.Item) {
        return callback(null, null);
      }

      // Check if session has expired
      if (result.Item.expires && result.Item.expires < Math.floor(Date.now() / 1000)) {
        await this.destroy(sid, () => {});
        return callback(null, null);
      }

      const sessionData = JSON.parse(result.Item.sessionData);
      callback(null, sessionData);
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Store a session.
   * @param {string} sid - Session ID.
   * @param {object} sessionData - Session data object.
   * @param {function} callback - Callback(err).
   */
  async set(sid, sessionData, callback) {
    try {
      const expires = Math.floor(Date.now() / 1000) + this.ttl;

      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            sessionId: sid,
            sessionData: JSON.stringify(sessionData),
            expires
          }
        })
      );

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Destroy a session.
   * @param {string} sid - Session ID.
   * @param {function} callback - Callback(err).
   */
  async destroy(sid, callback) {
    try {
      await this.docClient.send(
        new DeleteCommand({
          TableName: this.tableName,
          Key: { sessionId: sid }
        })
      );

      callback(null);
    } catch (err) {
      callback(err);
    }
  }

  /**
   * Refresh the TTL on a session (touch).
   * @param {string} sid - Session ID.
   * @param {object} sessionData - Session data object.
   * @param {function} callback - Callback(err).
   */
  async touch(sid, sessionData, callback) {
    // Re-set with updated TTL
    await this.set(sid, sessionData, callback);
  }
}

module.exports = DynamoDBStore;
