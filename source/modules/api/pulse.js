'use strict';

const express = require('express');
const {
  parseCommonParams,
  validateRepoId,
  validateDateRange,
  errorResponse
} = require('./helpers');
const { computeCommitVelocity, detectSpikes } = require('./computations');

function createPulseRouter(commitStore) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { repoId, from, to } = parseCommonParams(req.query);
      const granularity = req.query.granularity || 'daily';
      const repoError = validateRepoId(repoId);
      if (repoError) return errorResponse(res, 400, repoError);
      const dateError = validateDateRange(from, to);
      if (dateError) return errorResponse(res, 400, dateError);

      let commits;
      if (from && to) {
        commits = await commitStore.getCommitsByDateRange(repoId, from, to);
      } else {
        commits = (await commitStore.getCommitsByRepo(repoId)).items;
      }

      const velocity = computeCommitVelocity(commits, granularity);
      const withSpikes = detectSpikes(velocity);
      return res.json({ timeSeries: withSpikes, totalCommits: commits.length });
    } catch (err) {
      console.error('Error computing pulse:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createPulseRouter };
