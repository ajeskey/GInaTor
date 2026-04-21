'use strict';

/**
 * Adapter for OpenAI Chat Completions API.
 * Uses native fetch to call the API.
 */
class OpenAIAdapter {
  /**
   * @param {string} apiKey - OpenAI API key.
   */
  constructor(apiKey) {
    if (!apiKey) {
      throw new Error('OpenAI API key is required');
    }
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.openai.com/v1/chat/completions';
  }

  /**
   * Generate release notes from commits using OpenAI Chat Completions API.
   * @param {string} prompt - The formatted prompt including commits and template.
   * @returns {Promise<string>} Generated release notes text.
   * @throws {Error} If the API returns an error.
   */
  async generate(prompt) {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'You are a technical writer generating release notes.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${body}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }
}

module.exports = { OpenAIAdapter };
