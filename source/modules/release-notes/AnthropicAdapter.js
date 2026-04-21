'use strict';

/**
 * Adapter for Anthropic Messages API.
 * Uses native fetch to call the API.
 */
class AnthropicAdapter {
  /**
   * @param {string} apiKey - Anthropic API key.
   */
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('Anthropic API key is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.anthropic.com/v1/messages';
  }

  /**
   * Generate release notes from commits using Anthropic Messages API.
   * @param {string} prompt - The formatted prompt including commits and template.
   * @returns {Promise<string>} Generated release notes text.
   * @throws {Error} If the API returns an error.
   */
  async generate(prompt) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        messages: [
          { role: 'user', content: prompt }
        ],
        system: 'You are a technical writer generating release notes.'
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${body}`);
    }

    const data = await response.json();
    return data.content[0].text;
  }
}

module.exports = { AnthropicAdapter };
