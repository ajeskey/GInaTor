'use strict';

const express = require('express');
const { parseCommonParams, validateRepoId, validateDateRange, errorResponse } = require('./helpers');
const { computeStaleFiles } = require('./computations');

function createStaleFilesRouter(commitStore) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { repoId, from, to } = parseCommonParams(req.query);
      const thresholdMonths = parseInt(req.query.thresholdMonths, 10) || 6;
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

      return res.json(computeStaleFiles(commits, thresholdMonths));
    } catch (err) {
      console.error('Error computing stale files:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createStaleFilesRouter };
