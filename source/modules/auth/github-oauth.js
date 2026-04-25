'use strict';

const express = require('express');
const crypto = require('node:crypto');
const { encrypt } = require('../crypto');

// Hardcoded OAuth credentials (move to env vars later)
const GITHUB_CLIENT_ID = 'Ov23liHVw4DXeOIq4JjJ';
const GITHUB_CLIENT_SECRET = '5bad40a95ada1b7953c59fbd2b31e43d9d01af82';
const GITHUB_REDIRECT_URI = 'http://localhost:3000/auth/github/callback';

/**
 * Create GitHub OAuth router.
 * Must be mounted BEFORE CSRF protection but AFTER session/passport middleware.
 * Routes check req.isAuthenticated() manually.
 * @param {object} options
 * @param {string} options.encryptionKey - Hex-encoded 256-bit key for encrypting tokens.
 * @param {import('@aws-sdk/lib-dynamodb').DynamoDBDocumentClient} options.docClient
 * @returns {express.Router}
 */
function createGitHubOAuthRouter({ encryptionKey, docClient }) {
  const router = express.Router();
  const { PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

  /**
   * GET /auth/github
   * Redirects browser to GitHub OAuth authorize URL.
   */
  router.get('/github', (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const state = crypto.randomBytes(20).toString('hex');
    req.session.githubOAuthState = state;

    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      redirect_uri: GITHUB_REDIRECT_URI,
      scope: 'repo',
      state
    });

    return res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  /**
   * GET /auth/github/callback
   * GitHub redirects here with ?code=xxx&state=xxx.
   */
  router.get('/github/callback', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { code, state } = req.query;

    // Verify state matches session
    if (!state || state !== req.session.githubOAuthState) {
      return res.status(403).json({ error: 'Invalid OAuth state' });
    }
    delete req.session.githubOAuthState;

    try {
      // Exchange code for access token
      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: GITHUB_REDIRECT_URI
        })
      });

      const tokenData = await tokenRes.json();
      if (tokenData.error || !tokenData.access_token) {
        return res.redirect('http://localhost:3001/admin-panel?github=error');
      }

      const accessToken = tokenData.access_token;

      // Fetch user info from GitHub
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: 'application/vnd.github+json'
        }
      });

      if (!userRes.ok) {
        return res.redirect('http://localhost:3001/admin-panel?github=error');
      }

      const userData = await userRes.json();

      // Store encrypted access token in AdminSettings
      const encryptedToken = encrypt(accessToken, encryptionKey);
      await docClient.send(
        new PutCommand({
          TableName: 'AdminSettings',
          Item: { settingKey: 'githubAccessToken', settingValue: JSON.stringify(encryptedToken) }
        })
      );

      // Store GitHub username in AdminSettings
      await docClient.send(
        new PutCommand({
          TableName: 'AdminSettings',
          Item: { settingKey: 'githubUsername', settingValue: userData.login }
        })
      );

      return res.redirect('http://localhost:3001/admin-panel?github=connected');
    } catch (err) {
      console.error('GitHub OAuth callback error:', err);
      return res.redirect('http://localhost:3001/admin-panel?github=error');
    }
  });

  /**
   * GET /auth/github/status
   * Returns { connected: true/false, username: "..." }
   */
  router.get('/github/status', async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    try {
      const tokenResult = await docClient.send(
        new GetCommand({ TableName: 'AdminSettings', Key: { settingKey: 'githubAccessToken' } })
      );
      const usernameResult = await docClient.send(
        new GetCommand({ TableName: 'AdminSettings', Key: { settingKey: 'githubUsername' } })
      );

      const connected = !!(tokenResult.Item && tokenResult.Item.settingValue);
      const username = usernameResult.Item ? usernameResult.Item.settingValue : null;

      return res.json({ connected, username });
    } catch (err) {
      console.error('GitHub status check error:', err);
      return res.json({ connected: false, username: null });
    }
  });

  return router;
}

module.exports = { createGitHubOAuthRouter };
