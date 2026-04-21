'use strict';

const GitConnector = require('./GitConnector');
const LocalGitProvider = require('./LocalGitProvider');
const GitHubProvider = require('./GitHubProvider');
const GitLabProvider = require('./GitLabProvider');
const CodeCommitProvider = require('./CodeCommitProvider');
const { parseGitLog, parseNumstat, normalizeChangeType } = require('./parseGitLog');

/**
 * @typedef {object} CommitRecord
 * @property {string} repositoryId
 * @property {string} commitHash
 * @property {string} authorName
 * @property {string} authorEmail
 * @property {string} commitDate - ISO 8601
 * @property {string} message
 * @property {Array<{ path: string, changeType: 'added' | 'modified' | 'deleted', additions?: number, deletions?: number }>} changedFiles
 */

/**
 * Factory function that returns the appropriate provider instance.
 * @param {'local' | 'github' | 'gitlab' | 'codecommit'} providerType
 * @returns {GitConnector}
 * @throws {Error} If providerType is not recognized.
 */
function getProvider(providerType) {
  switch (providerType) {
    case 'local':
      return new LocalGitProvider();
    case 'github':
      return new GitHubProvider();
    case 'gitlab':
      return new GitLabProvider();
    case 'codecommit':
      return new CodeCommitProvider();
    default:
      throw new Error(`Unknown provider type: ${providerType}`);
  }
}

module.exports = {
  GitConnector,
  LocalGitProvider,
  GitHubProvider,
  GitLabProvider,
  CodeCommitProvider,
  getProvider,
  parseGitLog,
  parseNumstat,
  normalizeChangeType
};
