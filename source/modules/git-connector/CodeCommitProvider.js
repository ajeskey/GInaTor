'use strict';

const GitConnector = require('./GitConnector');

/**
 * Git provider that uses AWS SDK v3 CodeCommitClient.
 */
class CodeCommitProvider extends GitConnector {
  /**
   * Validate connectivity to a CodeCommit repository using the provided ARN/config.
   * @param {object} config - { repoId, repositoryName, region }
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async validate(config) {
    if (!config.repositoryName) {
      return { valid: false, error: 'Repository name is required for CodeCommit' };
    }

    try {
      const client = await this._createClient(config);
      const { GetRepositoryCommand } = await import('@aws-sdk/client-codecommit');
      await client.send(new GetRepositoryCommand({
        repositoryName: config.repositoryName
      }));
      return { valid: true };
    } catch (err) {
      if (err.name === 'RepositoryDoesNotExistException') {
        return { valid: false, error: 'CodeCommit repository does not exist' };
      }
      if (err.name === 'InvalidRepositoryNameException') {
        return { valid: false, error: 'Invalid CodeCommit repository name' };
      }
      if (err.name === 'CredentialsProviderError' || err.name === 'AccessDeniedException') {
        return { valid: false, error: 'Authentication failed for CodeCommit' };
      }
      return { valid: false, error: `Failed to connect to CodeCommit: ${err.message}` };
    }
  }

  /**
   * Fetch commit log from CodeCommit using AWS SDK.
   * @param {object} config - { repoId, repositoryName, region, branchName }
   * @param {string} [sinceCommitHash] - Fetch commits after this hash.
   * @returns {Promise<Array<import('./index').CommitRecord>>}
   */
  async fetchLog(config, sinceCommitHash) {
    const repositoryId = config.repoId;
    const client = await this._createClient(config);
    const {
      GetBranchCommand,
      GetCommitCommand,
      GetDifferencesCommand
    } = await import('@aws-sdk/client-codecommit');

    const branchName = config.branchName || 'main';

    // Get the tip of the branch
    const branchResult = await client.send(new GetBranchCommand({
      repositoryName: config.repositoryName,
      branchName
    }));

    const tipCommitId = branchResult.branch?.commitId;
    if (!tipCommitId) {
      return [];
    }

    // Walk the commit history
    const commits = [];
    let currentId = tipCommitId;
    const visited = new Set();

    while (currentId && !visited.has(currentId)) {
      if (currentId === sinceCommitHash) break;

      visited.add(currentId);

      const commitResult = await client.send(new GetCommitCommand({
        repositoryName: config.repositoryName,
        commitId: currentId
      }));

      const commit = commitResult.commit;
      if (!commit) break;

      // Get file changes
      const changedFiles = await this._getChangedFiles(
        client, config.repositoryName, currentId, commit.parents, GetDifferencesCommand
      );

      commits.push({
        repositoryId,
        commitHash: currentId,
        authorName: commit.author?.name || '',
        authorEmail: commit.author?.email || '',
        commitDate: commit.author?.date
          ? new Date(parseInt(commit.author.date, 10) * 1000).toISOString()
          : '',
        message: commit.message || '',
        changedFiles
      });

      // Move to first parent
      currentId = commit.parents?.[0] || null;
    }

    return commits;
  }

  /**
   * CodeCommit does not natively support webhooks in the same way.
   * This is a placeholder for SNS/EventBridge integration.
   * @param {object} payload
   * @returns {{ commits: Array }}
   */
  parseWebhookPayload(payload) {
    // CodeCommit uses SNS notifications or EventBridge events
    if (!payload || !payload.Records) {
      return { commits: [] };
    }

    const commits = [];
    for (const record of payload.Records) {
      try {
        const message = typeof record.Sns?.Message === 'string'
          ? JSON.parse(record.Sns.Message)
          : record.Sns?.Message;

        if (message?.detail?.commitId) {
          commits.push({
            commitHash: message.detail.commitId,
            message: '',
            authorName: '',
            authorEmail: '',
            timestamp: record.Sns?.Timestamp || ''
          });
        }
      } catch {
        // Skip malformed records
      }
    }

    return { commits };
  }

  /** @private */
  async _createClient(config) {
    const { CodeCommitClient } = await import('@aws-sdk/client-codecommit');
    const clientConfig = {};
    if (config.region) {
      clientConfig.region = config.region;
    }
    return new CodeCommitClient(clientConfig);
  }

  /** @private */
  async _getChangedFiles(client, repositoryName, commitId, parents, GetDifferencesCommand) {
    try {
      const params = {
        repositoryName,
        afterCommitSpecifier: commitId
      };

      if (parents && parents.length > 0) {
        params.beforeCommitSpecifier = parents[0];
      }

      const result = await client.send(new GetDifferencesCommand(params));
      return (result.differences || []).map(d => ({
        path: d.afterBlob?.path || d.beforeBlob?.path || '',
        changeType: normalizeCodeCommitChangeType(d.changeType),
        additions: 0, // CodeCommit API doesn't provide line counts in differences
        deletions: 0
      }));
    } catch {
      return [];
    }
  }
}

/**
 * Normalize CodeCommit change type to standard format.
 * @param {string} changeType - CodeCommit change type (A, M, D)
 * @returns {'added' | 'modified' | 'deleted'}
 */
function normalizeCodeCommitChangeType(changeType) {
  switch (changeType) {
    case 'A': return 'added';
    case 'D': return 'deleted';
    case 'M': return 'modified';
    default: return 'modified';
  }
}

module.exports = CodeCommitProvider;
