'use strict';

const {
  GitConnector,
  LocalGitProvider,
  GitHubProvider,
  GitLabProvider,
  CodeCommitProvider,
  getProvider,
  parseGitLog,
  parseNumstat,
  normalizeChangeType
} = require('../../modules/git-connector');
const { FIELD_DELIMITER, RECORD_DELIMITER } = require('../../modules/git-connector/parseGitLog');

describe('Git Connector Module', () => {
  describe('GitConnector base class', () => {
    test('validate() throws not implemented', async () => {
      const connector = new GitConnector();
      await expect(connector.validate({})).rejects.toThrow('validate() must be implemented');
    });

    test('fetchLog() throws not implemented', async () => {
      const connector = new GitConnector();
      await expect(connector.fetchLog({})).rejects.toThrow('fetchLog() must be implemented');
    });

    test('parseWebhookPayload() throws not implemented', () => {
      const connector = new GitConnector();
      expect(() => connector.parseWebhookPayload({})).toThrow('parseWebhookPayload() must be implemented');
    });
  });

  describe('getProvider factory', () => {
    test('returns LocalGitProvider for "local"', () => {
      expect(getProvider('local')).toBeInstanceOf(LocalGitProvider);
    });

    test('returns GitHubProvider for "github"', () => {
      expect(getProvider('github')).toBeInstanceOf(GitHubProvider);
    });

    test('returns GitLabProvider for "gitlab"', () => {
      expect(getProvider('gitlab')).toBeInstanceOf(GitLabProvider);
    });

    test('returns CodeCommitProvider for "codecommit"', () => {
      expect(getProvider('codecommit')).toBeInstanceOf(CodeCommitProvider);
    });

    test('throws for unknown provider type', () => {
      expect(() => getProvider('bitbucket')).toThrow('Unknown provider type: bitbucket');
    });

    test('all providers extend GitConnector', () => {
      expect(getProvider('local')).toBeInstanceOf(GitConnector);
      expect(getProvider('github')).toBeInstanceOf(GitConnector);
      expect(getProvider('gitlab')).toBeInstanceOf(GitConnector);
      expect(getProvider('codecommit')).toBeInstanceOf(GitConnector);
    });
  });

  describe('parseGitLog', () => {
    function makeRawEntry(hash, name, email, date, message) {
      return [hash, name, email, date, message].join(FIELD_DELIMITER);
    }

    test('parses a single commit entry', () => {
      const raw = RECORD_DELIMITER + makeRawEntry(
        'abc123def456', 'John Doe', 'john@example.com',
        '2024-01-15T10:30:00+00:00', 'Initial commit'
      );
      const result = parseGitLog(raw, 'repo-1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        repositoryId: 'repo-1',
        commitHash: 'abc123def456',
        authorName: 'John Doe',
        authorEmail: 'john@example.com',
        commitDate: '2024-01-15T10:30:00+00:00',
        message: 'Initial commit',
        changedFiles: []
      });
    });

    test('parses multiple commit entries', () => {
      const raw = [
        RECORD_DELIMITER + makeRawEntry('hash1', 'Alice', 'alice@test.com', '2024-01-01T00:00:00Z', 'First'),
        RECORD_DELIMITER + makeRawEntry('hash2', 'Bob', 'bob@test.com', '2024-01-02T00:00:00Z', 'Second')
      ].join('');
      const result = parseGitLog(raw, 'repo-2');
      expect(result).toHaveLength(2);
      expect(result[0].commitHash).toBe('hash1');
      expect(result[1].commitHash).toBe('hash2');
    });

    test('returns empty array for empty input', () => {
      expect(parseGitLog('', 'repo-1')).toEqual([]);
      expect(parseGitLog(null, 'repo-1')).toEqual([]);
      expect(parseGitLog(undefined, 'repo-1')).toEqual([]);
    });

    test('returns empty array for whitespace-only input', () => {
      expect(parseGitLog('   \n  ', 'repo-1')).toEqual([]);
    });

    test('skips malformed entries with too few fields', () => {
      const raw = RECORD_DELIMITER + 'only-one-field';
      const result = parseGitLog(raw, 'repo-1');
      expect(result).toHaveLength(0);
    });

    test('attaches file changes from fileChanges parameter', () => {
      const raw = RECORD_DELIMITER + makeRawEntry(
        'hash1', 'Alice', 'alice@test.com', '2024-01-01T00:00:00Z', 'Add file'
      );
      const fileChanges = [{
        hash: 'hash1',
        files: [{ path: 'src/index.js', changeType: 'added', additions: 10, deletions: 0 }]
      }];
      const result = parseGitLog(raw, 'repo-1', fileChanges);
      expect(result[0].changedFiles).toHaveLength(1);
      expect(result[0].changedFiles[0].path).toBe('src/index.js');
    });
  });

  describe('parseNumstat', () => {
    test('parses numstat and status output', () => {
      const numstat = '10\t5\tsrc/app.js\n3\t0\tREADME.md';
      const status = 'M\tsrc/app.js\nA\tREADME.md';
      const result = parseNumstat(numstat, status);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ path: 'src/app.js', changeType: 'modified', additions: 10, deletions: 5 });
      expect(result[1]).toEqual({ path: 'README.md', changeType: 'added', additions: 3, deletions: 0 });
    });

    test('handles deleted files', () => {
      const numstat = '0\t20\told-file.js';
      const status = 'D\told-file.js';
      const result = parseNumstat(numstat, status);
      expect(result[0].changeType).toBe('deleted');
    });

    test('handles binary files (- for additions/deletions)', () => {
      const numstat = '-\t-\timage.png';
      const status = 'A\timage.png';
      const result = parseNumstat(numstat, status);
      expect(result[0]).toEqual({ path: 'image.png', changeType: 'added', additions: 0, deletions: 0 });
    });

    test('returns empty array for empty input', () => {
      expect(parseNumstat('', '')).toEqual([]);
      expect(parseNumstat(null, null)).toEqual([]);
    });

    test('defaults to modified when status is missing', () => {
      const numstat = '5\t3\tsrc/utils.js';
      const result = parseNumstat(numstat, '');
      expect(result[0].changeType).toBe('modified');
    });
  });

  describe('normalizeChangeType', () => {
    test('maps A to added', () => expect(normalizeChangeType('A')).toBe('added'));
    test('maps D to deleted', () => expect(normalizeChangeType('D')).toBe('deleted'));
    test('maps M to modified', () => expect(normalizeChangeType('M')).toBe('modified'));
    test('maps R to modified (rename)', () => expect(normalizeChangeType('R100')).toBe('modified'));
    test('maps C to added (copy)', () => expect(normalizeChangeType('C')).toBe('added'));
    test('maps unknown to modified', () => expect(normalizeChangeType('X')).toBe('modified'));
  });

  describe('LocalGitProvider', () => {
    const provider = new LocalGitProvider();

    test('validate returns error for missing path', async () => {
      const result = await provider.validate({});
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Path is required/);
    });

    test('validate returns error for non-existent path', async () => {
      const result = await provider.validate({ path: '/nonexistent/path/to/repo' });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Path does not exist/);
    });

    test('parseWebhookPayload throws for local repos', () => {
      expect(() => provider.parseWebhookPayload({})).toThrow(/not supported/);
    });
  });

  describe('GitHubProvider', () => {
    const provider = new GitHubProvider();

    test('validate returns error for invalid URL', async () => {
      const result = await provider.validate({ url: 'not-a-github-url', pat: 'token' });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid GitHub repository URL/);
    });

    test('validate returns error for missing PAT', async () => {
      const result = await provider.validate({ url: 'https://github.com/owner/repo' });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Personal Access Token is required/);
    });

    test('parseWebhookPayload extracts commits from push event', () => {
      const payload = {
        commits: [
          {
            id: 'abc123',
            message: 'Fix bug',
            author: { name: 'Alice', email: 'alice@test.com' },
            timestamp: '2024-01-15T10:00:00Z'
          },
          {
            id: 'def456',
            message: 'Add feature',
            author: { name: 'Bob', email: 'bob@test.com' },
            timestamp: '2024-01-15T11:00:00Z'
          }
        ]
      };
      const result = provider.parseWebhookPayload(payload);
      expect(result.commits).toHaveLength(2);
      expect(result.commits[0].commitHash).toBe('abc123');
      expect(result.commits[0].authorName).toBe('Alice');
      expect(result.commits[1].commitHash).toBe('def456');
    });

    test('parseWebhookPayload returns empty for null payload', () => {
      expect(provider.parseWebhookPayload(null).commits).toEqual([]);
      expect(provider.parseWebhookPayload({}).commits).toEqual([]);
    });
  });

  describe('GitLabProvider', () => {
    const provider = new GitLabProvider();

    test('validate returns error for invalid URL', async () => {
      const result = await provider.validate({ url: '', pat: 'token' });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Invalid GitLab repository URL/);
    });

    test('validate returns error for missing PAT', async () => {
      const result = await provider.validate({ url: 'https://gitlab.com/owner/repo' });
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Personal Access Token is required/);
    });

    test('parseWebhookPayload extracts commits from push event', () => {
      const payload = {
        commits: [
          {
            id: 'abc123',
            message: 'Fix bug',
            author: { name: 'Alice', email: 'alice@test.com' },
            timestamp: '2024-01-15T10:00:00Z'
          }
        ]
      };
      const result = provider.parseWebhookPayload(payload);
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].commitHash).toBe('abc123');
    });

    test('parseWebhookPayload returns empty for null payload', () => {
      expect(provider.parseWebhookPayload(null).commits).toEqual([]);
    });
  });

  describe('CodeCommitProvider', () => {
    const provider = new CodeCommitProvider();

    test('validate returns error for missing repository name', async () => {
      const result = await provider.validate({});
      expect(result.valid).toBe(false);
      expect(result.error).toMatch(/Repository name is required/);
    });

    test('parseWebhookPayload returns empty for null payload', () => {
      expect(provider.parseWebhookPayload(null).commits).toEqual([]);
      expect(provider.parseWebhookPayload({}).commits).toEqual([]);
    });

    test('parseWebhookPayload handles SNS records', () => {
      const payload = {
        Records: [
          {
            Sns: {
              Message: JSON.stringify({ detail: { commitId: 'abc123' } }),
              Timestamp: '2024-01-15T10:00:00Z'
            }
          }
        ]
      };
      const result = provider.parseWebhookPayload(payload);
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].commitHash).toBe('abc123');
    });

    test('parseWebhookPayload skips malformed SNS records', () => {
      const payload = {
        Records: [
          { Sns: { Message: 'not-json' } },
          { Sns: { Message: JSON.stringify({ detail: { commitId: 'valid' } }) } }
        ]
      };
      const result = provider.parseWebhookPayload(payload);
      expect(result.commits).toHaveLength(1);
      expect(result.commits[0].commitHash).toBe('valid');
    });
  });
});
