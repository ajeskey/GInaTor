'use strict';

const { generate, formatCommits, buildPrompt } = require('../../modules/release-notes');
const { OpenAIAdapter } = require('../../modules/release-notes/OpenAIAdapter');
const { AnthropicAdapter } = require('../../modules/release-notes/AnthropicAdapter');

describe('release-notes module', () => {
  const sampleCommits = [
    {
      commitHash: 'abc123',
      authorName: 'Alice',
      authorEmail: 'alice@test.com',
      commitDate: '2024-01-15T10:00:00Z',
      message: 'Add login feature',
      changedFiles: [
        { path: 'src/auth.js', changeType: 'added', additions: 50, deletions: 0 },
        { path: 'src/routes.js', changeType: 'modified', additions: 10, deletions: 2 }
      ]
    },
    {
      commitHash: 'def456',
      authorName: 'Bob',
      authorEmail: 'bob@test.com',
      commitDate: '2024-01-16T14:00:00Z',
      message: 'Fix auth bug',
      changedFiles: [
        { path: 'src/auth.js', changeType: 'modified', additions: 5, deletions: 3 }
      ]
    }
  ];

  describe('formatCommits', () => {
    it('returns a message for empty commits', () => {
      expect(formatCommits([])).toBe('No commits in the selected range.');
      expect(formatCommits(null)).toBe('No commits in the selected range.');
    });

    it('formats commits with hash, author, date, message, and files', () => {
      const result = formatCommits(sampleCommits);
      expect(result).toContain('Commit: abc123');
      expect(result).toContain('Author: Alice <alice@test.com>');
      expect(result).toContain('added: src/auth.js');
      expect(result).toContain('Commit: def456');
      expect(result).toContain('modified: src/auth.js');
    });
  });

  describe('buildPrompt', () => {
    it('uses default template when none provided', () => {
      const prompt = buildPrompt(sampleCommits);
      expect(prompt).toContain('Generate concise, well-organized release notes');
      expect(prompt).toContain('--- Commits ---');
      expect(prompt).toContain('abc123');
    });

    it('uses custom template when provided', () => {
      const prompt = buildPrompt(sampleCommits, 'Write changelog in bullet points.');
      expect(prompt).toContain('Write changelog in bullet points.');
      expect(prompt).toContain('abc123');
    });
  });

  describe('generate', () => {
    it('throws when no provider is specified', async () => {
      await expect(generate(sampleCommits, null, 'key123'))
        .rejects.toThrow('No AI provider selected');
    });

    it('throws when no API key is provided for openai', async () => {
      await expect(generate(sampleCommits, 'openai', null))
        .rejects.toThrow('OpenAI API key is not configured');
    });

    it('throws when no API key is provided for anthropic', async () => {
      await expect(generate(sampleCommits, 'anthropic', null))
        .rejects.toThrow('Anthropic API key is not configured');
    });

    it('throws for unsupported provider', async () => {
      await expect(generate(sampleCommits, 'gemini', 'key123'))
        .rejects.toThrow('Unsupported AI provider: "gemini"');
    });
  });

  describe('OpenAIAdapter', () => {
    it('throws when constructed without an API key', () => {
      expect(() => new OpenAIAdapter()).toThrow('OpenAI API key is required');
      expect(() => new OpenAIAdapter('')).toThrow('OpenAI API key is required');
    });

    it('constructs with a valid API key', () => {
      const adapter = new OpenAIAdapter('sk-test-key');
      expect(adapter.apiKey).toBe('sk-test-key');
    });
  });

  describe('AnthropicAdapter', () => {
    it('throws when constructed without an API key', () => {
      expect(() => new AnthropicAdapter()).toThrow('Anthropic API key is required');
      expect(() => new AnthropicAdapter('')).toThrow('Anthropic API key is required');
    });

    it('constructs with a valid API key', () => {
      const adapter = new AnthropicAdapter('sk-ant-test');
      expect(adapter.apiKey).toBe('sk-ant-test');
    });
  });
});
