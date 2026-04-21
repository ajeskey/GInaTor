'use strict';

/**
 * Base class defining the GitConnector interface.
 * All git provider implementations must extend this class
 * and implement validate(), fetchLog(), and parseWebhookPayload().
 */
class GitConnector {
  /**
   * Validate connectivity and configuration for the provider.
   * @param {object} config - Provider-specific configuration.
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async validate(config) {
    throw new Error('validate() must be implemented by subclass');
  }

  /**
   * Fetch commit log from the provider, returning normalized CommitRecord[].
   * Supports incremental sync when sinceCommitHash is provided.
   * @param {object} config - Provider-specific configuration.
   * @param {string} [sinceCommitHash] - If provided, fetch only commits after this hash.
   * @returns {Promise<Array<import('./index').CommitRecord>>}
   */
  async fetchLog(config, sinceCommitHash) {
    throw new Error('fetchLog() must be implemented by subclass');
  }

  /**
   * Parse a webhook payload into commit references.
   * @param {object} payload - The raw webhook payload body.
   * @returns {{ commits: Array<{ commitHash: string, message: string, authorName: string, authorEmail: string, timestamp: string }> }}
   */
  parseWebhookPayload(payload) {
    throw new Error('parseWebhookPayload() must be implemented by subclass');
  }
}

module.exports = GitConnector;
