'use strict';

const express = require('express');
const { parseCommonParams, validateRepoId, errorResponse } = require('./helpers');

function createPrFlowRouter() {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { repoId } = parseCommonParams(req.query);
      const repoError = validateRepoId(repoId);
      if (repoError) return errorResponse(res, 400, repoError);

      // PR/MR flow data requires GitHub/GitLab API integration.
      // Returns placeholder structure; full implementation requires provider-specific PR data.
      return res.json({
        message: 'PR/MR review flow data is available for GitHub and GitLab repositories only.',
        flows: []
      });
    } catch (err) {
      console.error('Error computing pr-flow:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createPrFlowRouter };
