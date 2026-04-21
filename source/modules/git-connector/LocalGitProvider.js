'use strict';

const { execSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const GitConnector = require('./GitConnector');
const {
  parseGitLog,
  parseNumstat,
  GIT_LOG_FORMAT,
  FIELD_DELIMITER,
  RECORD_DELIMITER
} = require('./parseGitLog');

/**
 * Git provider that executes `git log` via child_process on a local repository.
 */
class LocalGitProvider extends GitConnector {
  /**
   * Validate that the configured path exists and is a git repository.
   * @param {object} config - { repoId, path }
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async validate(config) {
    const repoPath = config.path;

    if (!repoPath) {
      return { valid: false, error: 'Path is required for local repositories' };
    }

    if (!fs.existsSync(repoPath)) {
      return { valid: false, error: 'Path does not exist or is not a git repository' };
    }

    try {
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: repoPath,
        stdio: 'pipe',
        timeout: 10000
      });
      return { valid: true };
    } catch {
      return { valid: false, error: 'Path does not exist or is not a git repository' };
    }
  }

  /**
   * Fetch commit log from a local git repository.
   * @param {object} config - { repoId, path }
   * @param {string} [sinceCommitHash] - Fetch commits after this hash.
   * @returns {Promise<Array<import('./index').CommitRecord>>}
   */
  async fetchLog(config, sinceCommitHash) {
    const repoPath = config.path;
    const repositoryId = config.repoId;
    const execOpts = { cwd: repoPath, stdio: 'pipe', maxBuffer: 50 * 1024 * 1024, timeout: 120000 };

    const format = `${RECORD_DELIMITER}${GIT_LOG_FORMAT}`;
    let logCmd = `git log --format="${format}"`;

    if (sinceCommitHash) {
      logCmd += ` ${sinceCommitHash}..HEAD`;
    }

    let rawLog;
    try {
      rawLog = execSync(logCmd, execOpts).toString('utf-8');
    } catch (err) {
      throw new Error(`Failed to fetch git log: ${err.message}`);
    }

    // Get file changes per commit using --numstat and --name-status
    const commits = parseGitLog(rawLog, repositoryId);

    const fileChanges = [];
    for (const commit of commits) {
      try {
        const numstatOut = execSync(
          `git diff-tree --no-commit-id --numstat -r ${commit.commitHash}`,
          execOpts
        ).toString('utf-8');

        const statusOut = execSync(
          `git diff-tree --no-commit-id --name-status -r ${commit.commitHash}`,
          execOpts
        ).toString('utf-8');

        commit.changedFiles = parseNumstat(numstatOut, statusOut);
      } catch {
        commit.changedFiles = [];
      }
    }

    return commits;
  }

  /**
   * Local git does not support webhooks.
   * @param {object} payload
   * @returns {{ commits: Array }}
   */
  parseWebhookPayload(payload) {
    throw new Error('Webhooks are not supported for local git repositories');
  }
}

module.exports = LocalGitProvider;
