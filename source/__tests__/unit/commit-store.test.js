'use strict';

// Mock send function — must be declared before jest.mock hoisting
let mockSend;

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));
jest.mock('@aws-sdk/lib-dynamodb', () => {
  const actual = {
    DynamoDBDocumentClient: {
      from: jest.fn().mockImplementation(() => ({
        get send() {
          return mockSend;
        }
      }))
    },
    PutCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Put' })),
    QueryCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Query' })),
    BatchWriteCommand: jest
      .fn()
      .mockImplementation((params) => ({ ...params, _type: 'BatchWrite' }))
  };
  return actual;
});

const CommitStore = require('../../modules/commit-store');

describe('CommitStore', () => {
  let store;

  const sampleCommit = {
    repositoryId: 'repo-1',
    commitHash: 'abc123',
    authorName: 'Alice',
    authorEmail: 'alice@example.com',
    commitDate: '2024-01-15T10:00:00Z',
    message: 'Initial commit',
    changedFiles: [{ path: 'README.md', changeType: 'added' }],
    branch: 'main'
  };

  beforeEach(() => {
    mockSend = jest.fn();
    store = new CommitStore({ endpoint: 'http://localhost:8000' });
  });

  describe('constructor', () => {
    it('should use default table name and region', () => {
      const s = new CommitStore();
      expect(s.tableName).toBe('Commits');
    });

    it('should accept custom table name', () => {
      const s = new CommitStore({ tableName: 'MyCommits' });
      expect(s.tableName).toBe('MyCommits');
    });
  });

  describe('putCommit', () => {
    it('should store a commit and return created: true', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await store.putCommit(sampleCommit);

      expect(result).toEqual({ created: true });
      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.Item.repositoryId).toBe('repo-1');
      expect(call.Item.commitHash).toBe('abc123');
      expect(call.Item.branch).toBe('main');
      expect(call.ConditionExpression).toBe(
        'attribute_not_exists(repositoryId) AND attribute_not_exists(commitHash)'
      );
    });

    it('should handle ConditionalCheckFailedException as success (dedup)', async () => {
      const err = new Error('Condition not met');
      err.name = 'ConditionalCheckFailedException';
      mockSend.mockRejectedValueOnce(err);

      const result = await store.putCommit(sampleCommit);

      expect(result).toEqual({ created: false });
    });

    it('should rethrow non-conditional errors', async () => {
      const err = new Error('Network error');
      err.name = 'ServiceUnavailableException';
      mockSend.mockRejectedValueOnce(err);

      await expect(store.putCommit(sampleCommit)).rejects.toThrow('Network error');
    });

    it('should omit branch when not provided', async () => {
      mockSend.mockResolvedValueOnce({});
      const { branch: _branch, ...noBranch } = sampleCommit;

      await store.putCommit(noBranch);

      const call = mockSend.mock.calls[0][0];
      expect(call.Item.branch).toBeUndefined();
    });
  });

  describe('putCommits', () => {
    it('should store multiple commits and count created/skipped', async () => {
      mockSend
        .mockResolvedValueOnce({}) // first commit created
        .mockRejectedValueOnce(
          Object.assign(new Error(), { name: 'ConditionalCheckFailedException' })
        ); // second is dup

      const result = await store.putCommits([sampleCommit, sampleCommit]);

      expect(result).toEqual({ created: 1, skipped: 1 });
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return all created when no duplicates', async () => {
      mockSend.mockResolvedValue({});

      const commits = [
        { ...sampleCommit, commitHash: 'aaa' },
        { ...sampleCommit, commitHash: 'bbb' }
      ];
      const result = await store.putCommits(commits);

      expect(result).toEqual({ created: 2, skipped: 0 });
    });
  });

  describe('getCommitsByDateRange', () => {
    it('should query GSI with date range in descending order', async () => {
      const items = [
        { ...sampleCommit, commitDate: '2024-01-20T00:00:00Z' },
        { ...sampleCommit, commitDate: '2024-01-15T00:00:00Z' }
      ];
      mockSend.mockResolvedValueOnce({ Items: items });

      const result = await store.getCommitsByDateRange('repo-1', '2024-01-01', '2024-01-31');

      expect(result).toEqual(items);
      const call = mockSend.mock.calls[0][0];
      expect(call.IndexName).toBe('repo-date-index');
      expect(call.ScanIndexForward).toBe(false);
      expect(call.KeyConditionExpression).toContain('BETWEEN');
    });

    it('should paginate through multiple pages', async () => {
      mockSend
        .mockResolvedValueOnce({
          Items: [{ commitHash: 'a' }],
          LastEvaluatedKey: { repositoryId: 'repo-1', commitDate: '2024-01-15' }
        })
        .mockResolvedValueOnce({
          Items: [{ commitHash: 'b' }]
        });

      const result = await store.getCommitsByDateRange('repo-1', '2024-01-01', '2024-01-31');

      expect(result).toHaveLength(2);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCommitsByRepo', () => {
    it('should return all commits with total count', async () => {
      const items = [
        { commitHash: 'c', commitDate: '2024-01-20' },
        { commitHash: 'b', commitDate: '2024-01-15' },
        { commitHash: 'a', commitDate: '2024-01-10' }
      ];
      mockSend.mockResolvedValueOnce({ Items: items });

      const result = await store.getCommitsByRepo('repo-1');

      expect(result.items).toEqual(items);
      expect(result.total).toBe(3);
    });

    it('should support limit and offset pagination', async () => {
      const items = [{ commitHash: 'c' }, { commitHash: 'b' }, { commitHash: 'a' }];
      mockSend.mockResolvedValueOnce({ Items: items });

      const result = await store.getCommitsByRepo('repo-1', 1, 1);

      expect(result.items).toEqual([{ commitHash: 'b' }]);
      expect(result.total).toBe(3);
    });

    it('should handle offset without limit', async () => {
      const items = [{ commitHash: 'c' }, { commitHash: 'b' }, { commitHash: 'a' }];
      mockSend.mockResolvedValueOnce({ Items: items });

      const result = await store.getCommitsByRepo('repo-1', undefined, 1);

      expect(result.items).toEqual([{ commitHash: 'b' }, { commitHash: 'a' }]);
      expect(result.total).toBe(3);
    });
  });

  describe('getLatestCommit', () => {
    it('should return the most recent commit', async () => {
      const latest = { ...sampleCommit, commitDate: '2024-01-20T00:00:00Z' };
      mockSend.mockResolvedValueOnce({ Items: [latest] });

      const result = await store.getLatestCommit('repo-1');

      expect(result).toEqual(latest);
      const call = mockSend.mock.calls[0][0];
      expect(call.ScanIndexForward).toBe(false);
      expect(call.Limit).toBe(1);
    });

    it('should return null when no commits exist', async () => {
      mockSend.mockResolvedValueOnce({ Items: [] });

      const result = await store.getLatestCommit('repo-1');

      expect(result).toBeNull();
    });

    it('should return null when Items is undefined', async () => {
      mockSend.mockResolvedValueOnce({});

      const result = await store.getLatestCommit('repo-1');

      expect(result).toBeNull();
    });
  });
});
