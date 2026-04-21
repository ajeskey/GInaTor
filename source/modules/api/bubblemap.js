'use strict';

const express = require('express');
const { parseCommonParams, validateRepoId, validateDateRange, errorResponse } = require('./helpers');

function createBubblemapRouter(commitStore) {
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

      const fileData = {};
      for (const c of commits) {
        if (c.changedFiles) {
          for (const f of c.changedFiles) {
            if (!fileData[f.path]) fileData[f.path] = { frequency: 0, lines: 0, contributors: new Set() };
            fileData[f.path].frequency++;
            fileData[f.path].lines += (f.additions || 0) + (f.deletions || 0);
            fileData[f.path].contributors.add(c.authorEmail);
          }
        }
      }

      const bubbles = Object.entries(fileData).map(([path, d]) => ({
        path,
        frequency: d.frequency,
        lines: d.lines,
        contributorCount: d.contributors.size
      }));

      return res.json({ bubbles });
    } catch (err) {
      console.error('Error computing bubblemap:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createBubblemapRouter };
