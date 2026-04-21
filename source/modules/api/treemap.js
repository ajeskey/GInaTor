'use strict';

const express = require('express');
const {
  parseCommonParams,
  validateRepoId,
  validateDateRange,
  errorResponse
} = require('./helpers');
const { computeFileChangeFrequency } = require('./computations');

function createTreemapRouter(commitStore) {
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

      return res.json(computeFileChangeFrequency(commits));
    } catch (err) {
      console.error('Error computing treemap:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createTreemapRouter };
