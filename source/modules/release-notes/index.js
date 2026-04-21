'use strict';

const { OpenAIAdapter } = require('./OpenAIAdapter');
const { AnthropicAdapter } = require('./AnthropicAdapter');

/**
 * Format commits into a human-readable summary for the AI prompt.
 * @param {Array} commits - Array of commit records.
 * @returns {string} Formatted commit summary.
 */
function formatCommits(commits) {
  if (!commits || commits.length === 0) {
    return 'No commits in the selected range.';
  }

  return commits
    .map((c) => {
      const files = (c.changedFiles || []).map((f) => `  - ${f.changeType}: ${f.path}`).join('\n');
      return `Commit: ${c.commitHash}\nAuthor: ${c.authorName} <${c.authorEmail}>\nDate: ${c.commitDate}\nMessage: ${c.message}\nFiles:\n${files}`;
    })
    .join('\n\n');
}

/**
 * Build the full prompt from commits and an optional template.
 * @param {Array} commits - Array of commit records.
 * @param {string} [promptTemplate] - Admin-configured prompt template.
 * @returns {string} The full prompt to send to the AI provider.
 */
function buildPrompt(commits, promptTemplate) {
  const commitSummary = formatCommits(commits);
  const template =
    promptTemplate ||
    'Generate concise, well-organized release notes from the following commits. Group related changes and highlight breaking changes.';

  return `${template}\n\n--- Commits ---\n${commitSummary}`;
}

/**
 * Generate release notes from commits using the configured AI provider.
 *
 * @param {Array} commits - Array of commit records.
 * @param {string} provider - AI provider name: 'openai' or 'anthropic'.
 * @param {string} apiKey - Decrypted API key for the selected provider.
 * @param {string} [promptTemplate] - Admin-configured prompt template.
 * @returns {Promise<string>} Generated release notes.
 * @throws {Error} If provider is not configured, key is missing, or API fails.
 */
async function generate(commits, provider, apiKey, promptTemplate) {
  if (!provider) {
    throw new Error(
      'No AI provider selected. The admin must select an AI provider (OpenAI or Anthropic) before release notes can be generated.'
    );
  }

  if (!apiKey) {
    const providerName = provider === 'openai' ? 'OpenAI' : 'Anthropic';
    throw new Error(
      `The ${providerName} API key is not configured. The admin must configure the ${providerName} API key.`
    );
  }

  const prompt = buildPrompt(commits, promptTemplate);

  let adapter;
  if (provider === 'openai') {
    adapter = new OpenAIAdapter(apiKey);
  } else if (provider === 'anthropic') {
    adapter = new AnthropicAdapter(apiKey);
  } else {
    throw new Error(
      `Unsupported AI provider: "${provider}". Supported providers are "openai" and "anthropic".`
    );
  }

  return adapter.generate(prompt);
}

module.exports = { generate, formatCommits, buildPrompt };
