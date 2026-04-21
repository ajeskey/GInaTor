'use strict';

const { generateDigestHtml, sendDigest } = require('../../modules/digest');

describe('digest module', () => {
  const sampleCommits = [
    {
      commitHash: 'aaa111',
      authorName: 'Alice',
      authorEmail: 'alice@test.com',
      commitDate: '2024-01-10T10:00:00Z',
      message: 'Init project',
      changedFiles: [
        { path: 'src/index.js', changeType: 'added', additions: 100, deletions: 0 },
        { path: 'package.json', changeType: 'added', additions: 20, deletions: 0 }
      ]
    },
    {
      commitHash: 'bbb222',
      authorName: 'Bob',
      authorEmail: 'bob@test.com',
      commitDate: '2024-01-11T12:00:00Z',
      message: 'Add tests',
      changedFiles: [
        { path: 'src/index.js', changeType: 'modified', additions: 10, deletions: 2 },
        { path: 'test/index.test.js', changeType: 'added', additions: 50, deletions: 0 }
      ]
    },
    {
      commitHash: 'ccc333',
      authorName: 'Alice',
      authorEmail: 'alice@test.com',
      commitDate: '2024-01-12T09:00:00Z',
      message: 'Fix bug',
      changedFiles: [
        { path: 'src/index.js', changeType: 'modified', additions: 5, deletions: 3 }
      ]
    }
  ];

  const sampleRepos = [
    { repoId: 'repo-1', name: 'My Project' }
  ];

  describe('generateDigestHtml', () => {
    it('generates HTML with stats, contributors, files, and velocity', () => {
      const html = generateDigestHtml(sampleCommits, sampleRepos, 'weekly', 'https://ginator.app');

      expect(html).toContain('GInaTor Weekly Digest');
      expect(html).toContain('Total commits: <strong>3</strong>');
      expect(html).toContain('Contributors: <strong>2</strong>');
      // Top contributors
      expect(html).toContain('alice@test.com');
      expect(html).toContain('bob@test.com');
      // Hottest files
      expect(html).toContain('src/index.js');
      // Repo link
      expect(html).toContain('https://ginator.app/?repoId=repo-1');
      expect(html).toContain('My Project');
    });

    it('generates monthly digest label', () => {
      const html = generateDigestHtml(sampleCommits, sampleRepos, 'monthly');
      expect(html).toContain('GInaTor Monthly Digest');
    });

    it('handles empty commits', () => {
      const html = generateDigestHtml([], sampleRepos, 'weekly');
      expect(html).toContain('Total commits: <strong>0</strong>');
      expect(html).toContain('No activity');
    });
  });

  describe('sendDigest', () => {
    it('sends emails to all users and returns counts', async () => {
      const mockSend = jest.fn().mockResolvedValue({});
      const mockSesClient = { send: mockSend };

      const result = await sendDigest(
        ['alice@test.com', 'bob@test.com'],
        '<h1>Digest</h1>',
        { sesClient: mockSesClient, logger: { error: jest.fn() } }
      );

      expect(result.sent).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('logs failures per user without interrupting others', async () => {
      const mockSend = jest.fn()
        .mockRejectedValueOnce(new Error('Bounce'))
        .mockResolvedValueOnce({});
      const mockSesClient = { send: mockSend };
      const mockLogger = { error: jest.fn() };

      const result = await sendDigest(
        ['bad@test.com', 'good@test.com'],
        '<h1>Digest</h1>',
        { sesClient: mockSesClient, logger: mockLogger }
      );

      expect(result.sent).toBe(1);
      expect(result.failed).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].email).toBe('bad@test.com');
      expect(result.errors[0].error).toBe('Bounce');
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('bad@test.com')
      );
    });

    it('handles empty user list', async () => {
      const mockSesClient = { send: jest.fn() };
      const result = await sendDigest([], '<h1>Digest</h1>', { sesClient: mockSesClient });

      expect(result.sent).toBe(0);
      expect(result.failed).toBe(0);
      expect(mockSesClient.send).not.toHaveBeenCalled();
    });
  });
});
