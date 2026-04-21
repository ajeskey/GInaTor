'use strict';

const express = require('express');
const {
  parseCommonParams,
  validateRepoId,
  validateDateRange,
  errorResponse
} = require('./helpers');

function createImpactRouter(commitStore) {
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

      const impacts = commits.map((c) => {
        const totalLines = (c.changedFiles || []).reduce(
          (s, f) => s + (f.additions || 0) + (f.deletions || 0),
          0
        );
        return {
          commitHash: c.commitHash,
          authorName: c.authorName,
          commitDate: c.commitDate,
          totalLines,
          files: (c.changedFiles || []).map((f) => ({
            path: f.path,
            changeType: f.changeType,
            additions: f.additions || 0,
            deletions: f.deletions || 0
          }))
        };
      });

      return res.json({ impacts });
    } catch (err) {
      console.error('Error computing impact:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createImpactRouter };
