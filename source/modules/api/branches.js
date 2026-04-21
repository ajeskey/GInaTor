'use strict';

const express = require('express');
const { parseCommonParams, validateRepoId, validateDateRange, errorResponse } = require('./helpers');

function createBranchesRouter(commitStore) {
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

      // Group commits by branch
      const branches = {};
      for (const c of commits) {
        const branch = c.branch || 'main';
        if (!branches[branch]) branches[branch] = [];
        branches[branch].push({ commitHash: c.commitHash, commitDate: c.commitDate, message: c.message, authorName: c.authorName });
      }

      return res.json({ branches: Object.entries(branches).map(([name, commits]) => ({ name, commits })) });
    } catch (err) {
      console.error('Error computing branches:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createBranchesRouter };
