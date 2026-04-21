'use strict';

const GitConnector = require('./GitConnector');

const GITLAB_API_BASE = 'https://gitlab.com/api/v4';

/**
 * Git provider that uses the GitLab REST API with PAT authentication.
 */
class GitLabProvider extends GitConnector {
  /**
   * Validate connectivity to a GitLab repository using the provided PAT.
   * @param {object} config - { repoId, url, pat }
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async validate(config) {
    const projectPath = parseGitLabUrl(config.url);
    if (!projectPath) {
      return { valid: false, error: 'Invalid GitLab repository URL' };
    }
    if (!config.pat) {
      return { valid: false, error: 'Personal Access Token is required for GitLab repositories' };
    }

    try {
      const encodedPath = encodeURIComponent(projectPath);
      const apiBase = getApiBase(config.url);
      const response = await fetch(`${apiBase}/projects/${encodedPath}`, {
        headers: buildHeaders(config.pat)
      });

      if (response.ok) {
        return { valid: true };
      }
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Authentication failed for GitLab' };
      }
      return { valid: false, error: `GitLab API returned status ${response.status}` };
    } catch (err) {
      return { valid: false, error: `Failed to connect to GitLab: ${err.message}` };
    }
  }

  /**
   * Fetch commit log from GitLab REST API.
   * @param {object} config - { repoId, url, pat }
   * @param {string} [sinceCommitHash] - Fetch commits after this hash (uses its date for since param).
   * @returns {Promise<Array<import('./index').CommitRecord>>}
   */
  async fetchLog(config, sinceCommitHash) {
    const projectPath = parseGitLabUrl(config.url);
    const repositoryId = config.repoId;
    const encodedPath = encodeURIComponent(projectPath);
    const apiBase = getApiBase(config.url);
    const headers = buildHeaders(config.pat);

    let sinceDate;
    if (sinceCommitHash) {
      sinceDate = await this._getCommitDate(encodedPath, sinceCommitHash, apiBase, headers);
    }

    const commits = await this._fetchAllCommits(encodedPath, apiBase, headers, sinceDate);

    // Filter out the sinceCommitHash itself
    const filtered = sinceCommitHash
      ? commits.filter(c => c.id !== sinceCommitHash)
      : commits;

    const records = [];
    for (const commit of filtered) {
      const diff = await this._fetchCommitDiff(encodedPath, commit.id, apiBase, headers);
      records.push(toCommitRecord(commit, diff, repositoryId));
    }

    return records;
  }

  /**
   * Parse a GitLab webhook push payload.
   * @param {object} payload - GitLab webhook payload.
   * @returns {{ commits: Array<{ commitHash: string, message: string, authorName: string, authorEmail: string, timestamp: string }> }}
   */
  parseWebhookPayload(payload) {
    if (!payload || !Array.isArray(payload.commits)) {
      return { commits: [] };
    }

    return {
      commits: payload.commits.map(c => ({
        commitHash: c.id,
        message: c.message || '',
        authorName: c.author?.name || '',
        authorEmail: c.author?.email || '',
        timestamp: c.timestamp || ''
      }))
    };
  }

  /** @private */
  async _getCommitDate(encodedPath, sha, apiBase, headers) {
    const response = await fetch(
      `${apiBase}/projects/${encodedPath}/repository/commits/${sha}`,
      { headers }
    );
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.authored_date || data.created_at;
  }

  /** @private */
  async _fetchAllCommits(encodedPath, apiBase, headers, since) {
    const allCommits = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      let url = `${apiBase}/projects/${encodedPath}/repository/commits?per_page=${perPage}&page=${page}`;
      if (since) {
        url += `&since=${since}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed for GitLab');
        }
        throw new Error(`GitLab API returned status ${response.status}`);
      }

      const commits = await response.json();
      if (!Array.isArray(commits) || commits.length === 0) break;

      allCommits.push(...commits);
      if (commits.length < perPage) break;
      page++;
    }

    return allCommits;
  }

  /** @private */
  async _fetchCommitDiff(encodedPath, sha, apiBase, headers) {
    const response = await fetch(
      `${apiBase}/projects/${encodedPath}/repository/commits/${sha}/diff`,
      { headers }
    );
    if (!response.ok) return [];
    return response.json();
  }
}

/**
 * Parse a GitLab URL into a project path (owner/repo).
 * @param {string} url
 * @returns {string|null}
 */
function parseGitLabUrl(url) {
  if (!url) return null;
  const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
  // Match gitlab.com/owner/repo or self-hosted gitlab instances
  const match = cleaned.match(/(?:gitlab\.[^/]+|[^/]+)\/([^/]+\/[^/]+(?:\/[^/]+)*)$/);
  if (match) {
    // Remove protocol and domain
    const parts = cleaned.split('/');
    const domainIndex = parts.findIndex(p => p.includes('.'));
    if (domainIndex >= 0) {
      return parts.slice(domainIndex + 1).join('/');
    }
  }
  return null;
}

/**
 * Determine the API base URL from the repository URL.
 * Supports self-hosted GitLab instances.
 * @param {string} url
 * @returns {string}
 */
function getApiBase(url) {
  if (!url) return GITLAB_API_BASE;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    if (parsed.hostname === 'gitlab.com') {
      return GITLAB_API_BASE;
    }
    return `${parsed.protocol}//${parsed.hostname}/api/v4`;
  } catch {
    return GITLAB_API_BASE;
  }
}

/**
 * Build authorization headers for GitLab API.
 * @param {string} pat
 * @returns {object}
 */
function buildHeaders(pat) {
  return {
    'PRIVATE-TOKEN': pat,
    'Content-Type': 'application/json'
  };
}

/**
 * Convert a GitLab commit + diff to a normalized CommitRecord.
 * @param {object} commit - GitLab commit object.
 * @param {Array} diff - GitLab commit diff array.
 * @param {string} repositoryId
 * @returns {import('./index').CommitRecord}
 */
function toCommitRecord(commit, diff, repositoryId) {
  const changedFiles = (diff || []).map(d => ({
    path: d.new_path || d.old_path,
    changeType: normalizeGitLabStatus(d.new_file, d.deleted_file, d.renamed_file),
    additions: countLines(d.diff, '+'),
    deletions: countLines(d.diff, '-')
  }));

  return {
    repositoryId,
    commitHash: commit.id,
    authorName: commit.author_name || '',
    authorEmail: commit.author_email || '',
    commitDate: commit.authored_date || commit.created_at || '',
    message: commit.message || '',
    changedFiles
  };
}

/**
 * Normalize GitLab diff flags to change type.
 * @param {boolean} newFile
 * @param {boolean} deletedFile
 * @param {boolean} renamedFile
 * @returns {'added' | 'modified' | 'deleted'}
 */
function normalizeGitLabStatus(newFile, deletedFile, _renamedFile) {
  if (newFile) return 'added';
  if (deletedFile) return 'deleted';
  return 'modified';
}

/**
 * Count added or deleted lines from a unified diff string.
 * @param {string} diffStr - Unified diff content.
 * @param {string} prefix - '+' for additions, '-' for deletions.
 * @returns {number}
 */
function countLines(diffStr, prefix) {
  if (!diffStr) return 0;
  const lines = diffStr.split('\n');
  let count = 0;
  for (const line of lines) {
    if (line.startsWith(prefix) && !line.startsWith(prefix + prefix)) {
      count++;
    }
  }
  return count;
}

module.exports = GitLabProvider;
