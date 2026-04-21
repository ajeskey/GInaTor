'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand
} = require('@aws-sdk/lib-dynamodb');

const TABLE_NAME = 'Commits';
const GSI_NAME = 'repo-date-index';

/**
 * DynamoDB-backed store for git commit records.
 * Uses repositoryId (PK) + commitHash (SK) composite key for deduplication.
 * Supports date range queries via the repo-date-index GSI.
 */
class CommitStore {
  /**
   * @param {object} [options]
   * @param {string} [options.tableName='Commits'] - DynamoDB table name.
   * @param {string} [options.endpoint] - DynamoDB endpoint (for local dev).
   * @param {string} [options.region='us-east-1'] - AWS region.
   */
  constructor(options = {}) {
    this.tableName = options.tableName || TABLE_NAME;

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
   * Store a single commit record. Skips duplicates (idempotent).
   * Uses a condition expression to prevent overwriting existing records.
   * ConditionalCheckFailedException is treated as success (dedup).
   *
   * @param {object} record - Commit record.
   * @param {string} record.repositoryId - Repository identifier.
   * @param {string} record.commitHash - Unique commit SHA.
   * @param {string} record.authorName - Commit author name.
   * @param {string} record.authorEmail - Commit author email.
   * @param {string} record.commitDate - ISO 8601 date string.
   * @param {string} record.message - Commit message.
   * @param {Array} record.changedFiles - List of changed files.
   * @param {string} [record.branch] - Branch name.
   * @returns {Promise<{created: boolean}>} Whether a new record was created.
   */
  async putCommit(record) {
    try {
      await this.docClient.send(
        new PutCommand({
          TableName: this.tableName,
          Item: {
            repositoryId: record.repositoryId,
            commitHash: record.commitHash,
            authorName: record.authorName,
            authorEmail: record.authorEmail,
            commitDate: record.commitDate,
            message: record.message,
            changedFiles: record.changedFiles || [],
            ...(record.branch != null && { branch: record.branch })
          },
          ConditionExpression: 'attribute_not_exists(repositoryId) AND attribute_not_exists(commitHash)'
        })
      );
      return { created: true };
    } catch (err) {
      if (err.name === 'ConditionalCheckFailedException') {
        // Duplicate — treat as success
        return { created: false };
      }
      throw err;
    }
  }

  /**
   * Store multiple commit records in batch. Skips duplicates individually.
   * Falls back to individual putCommit calls since BatchWriteItem does not
   * support condition expressions.
   *
   * @param {Array<object>} records - Array of commit records.
   * @returns {Promise<{created: number, skipped: number}>} Counts of created and skipped records.
   */
  async putCommits(records) {
    let created = 0;
    let skipped = 0;

    for (const record of records) {
      const result = await this.putCommit(record);
      if (result.created) {
        created++;
      } else {
        skipped++;
      }
    }

    return { created, skipped };
  }

  /**
   * Query commits by repository and date range using the repo-date-index GSI.
   * Returns results in descending order by commitDate.
   *
   * @param {string} repositoryId - Repository identifier.
   * @param {string} from - Start date (ISO 8601, inclusive).
   * @param {string} to - End date (ISO 8601, inclusive).
   * @returns {Promise<Array<object>>} Commit records sorted by commitDate descending.
   */
  async getCommitsByDateRange(repositoryId, from, to) {
    const items = [];
    let exclusiveStartKey;

    do {
      const params = {
        TableName: this.tableName,
        IndexName: GSI_NAME,
        KeyConditionExpression: 'repositoryId = :repoId AND commitDate BETWEEN :from AND :to',
        ExpressionAttributeValues: {
          ':repoId': repositoryId,
          ':from': from,
          ':to': to
        },
        ScanIndexForward: false // descending order by commitDate
      };

      if (exclusiveStartKey) {
        params.ExclusiveStartKey = exclusiveStartKey;
      }

      const result = await this.docClient.send(new QueryCommand(params));
      if (result.Items) {
        items.push(...result.Items);
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    return items;
  }

  /**
   * Query all commits for a repository, ordered by commitDate descending.
   * Supports optional limit and offset for pagination.
   *
   * @param {string} repositoryId - Repository identifier.
   * @param {number} [limit] - Maximum number of records to return.
   * @param {number} [offset=0] - Number of records to skip.
   * @returns {Promise<{items: Array<object>, total: number}>} Paginated commit records.
   */
  async getCommitsByRepo(repositoryId, limit, offset = 0) {
    const allItems = [];
    let exclusiveStartKey;

    do {
      const params = {
        TableName: this.tableName,
        IndexName: GSI_NAME,
        KeyConditionExpression: 'repositoryId = :repoId',
        ExpressionAttributeValues: {
          ':repoId': repositoryId
        },
        ScanIndexForward: false // descending order by commitDate
      };

      if (exclusiveStartKey) {
        params.ExclusiveStartKey = exclusiveStartKey;
      }

      const result = await this.docClient.send(new QueryCommand(params));
      if (result.Items) {
        allItems.push(...result.Items);
      }
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const total = allItems.length;

    if (limit != null) {
      return {
        items: allItems.slice(offset, offset + limit),
        total
      };
    }

    return {
      items: offset > 0 ? allItems.slice(offset) : allItems,
      total
    };
  }

  /**
   * Get the most recent commit for a repository.
   * Queries the repo-date-index GSI in descending order with limit 1.
   *
   * @param {string} repositoryId - Repository identifier.
   * @returns {Promise<object|null>} The latest commit record, or null if none exist.
   */
  async getLatestCommit(repositoryId) {
    const result = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: GSI_NAME,
        KeyConditionExpression: 'repositoryId = :repoId',
        ExpressionAttributeValues: {
          ':repoId': repositoryId
        },
        ScanIndexForward: false,
        Limit: 1
      })
    );

    return (result.Items && result.Items.length > 0) ? result.Items[0] : null;
  }
}

module.exports = CommitStore;
