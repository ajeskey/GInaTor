'use strict';

const express = require('express');
const { parseCommonParams, validateRepoId, validateDateRange, errorResponse } = require('./helpers');

function createComplexityRouter(commitStore) {
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

      // Track cumulative file size over time as a proxy for complexity
      const fileSizes = {};
      const sorted = [...commits].sort((a, b) => a.commitDate.localeCompare(b.commitDate));
      const dataPoints = [];

      for (const c of sorted) {
        if (c.changedFiles) {
          for (const f of c.changedFiles) {
            if (!fileSizes[f.path]) fileSizes[f.path] = 0;
            fileSizes[f.path] += (f.additions || 0) - (f.deletions || 0);
            if (fileSizes[f.path] < 0) fileSizes[f.path] = 0;
          }
        }
        const totalSize = Object.values(fileSizes).reduce((s, v) => s + v, 0);
        dataPoints.push({ commitDate: c.commitDate, commitHash: c.commitHash, totalSize });
      }

      return res.json({ dataPoints });
    } catch (err) {
      console.error('Error computing complexity:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createComplexityRouter };
