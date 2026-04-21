'use strict';

const express = require('express');
const {
  parseCommonParams,
  validateRepoId,
  validateDateRange,
  errorResponse
} = require('./helpers');
const { computeStats } = require('./computations');

function createStatsRouter(commitStore) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { repoId, from, to } = parseCommonParams(req.query);
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

      return res.json(computeStats(commits));
    } catch (err) {
      console.error('Error computing stats:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createStatsRouter };
