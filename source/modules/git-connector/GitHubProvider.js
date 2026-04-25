'use strict';

const GitConnector = require('./GitConnector');

const GITHUB_API_BASE = 'https://api.github.com';

/**
 * Git provider that uses the GitHub REST API with PAT authentication.
 */
class GitHubProvider extends GitConnector {
  /**
   * Validate connectivity to a GitHub repository using the provided PAT.
   * @param {object} config - { repoId, url, pat }
   * @returns {Promise<{ valid: boolean, error?: string }>}
   */
  async validate(config) {
    const { owner, repo } = parseGitHubUrl(config.url);
    if (!owner || !repo) {
      return { valid: false, error: 'Invalid GitHub repository URL' };
    }
    if (!config.pat) {
      return { valid: false, error: 'Personal Access Token is required for GitHub repositories' };
    }

    try {
      const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
        headers: buildHeaders(config.pat)
      });

      if (response.ok) {
        return { valid: true };
      }
      if (response.status === 401 || response.status === 403) {
        return { valid: false, error: 'Authentication failed for GitHub' };
      }
      return { valid: false, error: `GitHub API returned status ${response.status}` };
    } catch (err) {
      return { valid: false, error: `Failed to connect to GitHub: ${err.message}` };
    }
  }

  /**
   * Fetch commit log from GitHub REST API.
   * @param {object} config - { repoId, url, pat }
   * @param {string} [sinceCommitHash] - Fetch commits after this hash (uses its date for since param).
   * @returns {Promise<Array<import('./index').CommitRecord>>}
   */
  async fetchLog(config, sinceCommitHash) {
    const { owner, repo } = parseGitHubUrl(config.url);
    const repositoryId = config.repoId;
    const headers = buildHeaders(config.pat);

    let sinceDate;
    if (sinceCommitHash) {
      sinceDate = await this._getCommitDate(owner, repo, sinceCommitHash, headers);
    }

    const commits = await this._fetchAllCommits(owner, repo, headers, sinceDate);

    // Filter out the sinceCommitHash itself if present
    const filtered = sinceCommitHash ? commits.filter((c) => c.sha !== sinceCommitHash) : commits;

    const records = [];
    for (const commit of filtered) {
      const detail = await this._fetchCommitDetail(owner, repo, commit.sha, headers);
      records.push(toCommitRecord(detail, repositoryId));
    }

    return records;
  }

  /**
   * Parse a GitHub webhook push payload.
   * @param {object} payload - GitHub webhook payload.
   * @returns {{ commits: Array<{ commitHash: string, message: string, authorName: string, authorEmail: string, timestamp: string }> }}
   */
  parseWebhookPayload(payload) {
    if (!payload || !Array.isArray(payload.commits)) {
      return { commits: [] };
    }

    return {
      commits: payload.commits.map((c) => ({
        commitHash: c.id,
        message: c.message || '',
        authorName: c.author?.name || '',
        authorEmail: c.author?.email || '',
        timestamp: c.timestamp || ''
      }))
    };
  }

  /** @private */
  async _getCommitDate(owner, repo, sha, headers) {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`, {
      headers
    });
    if (!response.ok) return undefined;
    const data = await response.json();
    return data.commit?.author?.date;
  }

  /** @private */
  async _fetchAllCommits(owner, repo, headers, since) {
    const allCommits = [];
    let page = 1;
    const perPage = 100;

    while (true) {
      let url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?per_page=${perPage}&page=${page}`;
      if (since) {
        url += `&since=${since}`;
      }

      const response = await fetch(url, { headers });
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          throw new Error('Authentication failed for GitHub');
        }
        throw new Error(`GitHub API returned status ${response.status}`);
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
  async _fetchCommitDetail(owner, repo, sha, headers) {
    const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${sha}`, {
      headers
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch commit detail for ${sha}`);
    }
    return response.json();
  }
}

/**
 * Parse a GitHub URL into owner and repo.
 * @param {string} url - GitHub repository URL.
 * @returns {{ owner: string, repo: string }}
 */
function parseGitHubUrl(url) {
  if (!url) return { owner: '', repo: '' };
  // Handle https://github.com/owner/repo or github.com/owner/repo
  const cleaned = url.replace(/\.git$/, '').replace(/\/$/, '');
  const match = cleaned.match(/github\.com[/:]([^/]+)\/([^/]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  return { owner: '', repo: '' };
}

/**
 * Build authorization headers for GitHub API.
 * @param {string} pat - Personal Access Token.
 * @returns {object}
 */
function buildHeaders(pat) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  };
  if (pat) {
    headers.Authorization = `Bearer ${pat}`;
  }
  return headers;
}

/**
 * Convert a GitHub commit detail response to a normalized CommitRecord.
 * @param {object} detail - GitHub commit detail API response.
 * @param {string} repositoryId
 * @returns {import('./index').CommitRecord}
 */
function toCommitRecord(detail, repositoryId) {
  const changedFiles = (detail.files || []).map((f) => ({
    path: f.filename,
    changeType: normalizeGitHubStatus(f.status),
    additions: f.additions || 0,
    deletions: f.deletions || 0
  }));

  return {
    repositoryId,
    commitHash: detail.sha,
    authorName: detail.commit?.author?.name || '',
    authorEmail: detail.commit?.author?.email || '',
    commitDate: detail.commit?.author?.date || '',
    message: detail.commit?.message || '',
    changedFiles
  };
}

/**
 * Normalize GitHub file status to standard change type.
 * @param {string} status
 * @returns {'added' | 'modified' | 'deleted'}
 */
function normalizeGitHubStatus(status) {
  switch (status) {
    case 'added':
      return 'added';
    case 'removed':
      return 'deleted';
    case 'modified':
      return 'modified';
    case 'renamed':
      return 'modified';
    case 'copied':
      return 'added';
    default:
      return 'modified';
  }
}

module.exports = GitHubProvider;
