'use strict';

const express = require('express');
const {
  parsePagination,
  parseCommonParams,
  validateRepoId,
  validateDateRange,
  paginatedResponse,
  errorResponse
} = require('./helpers');

/**
 * Create the commits API router.
 * GET /api/v1/commits — paginated commits by repo + optional date range.
 * @param {import('../commit-store/index')} commitStore - CommitStore instance.
 * @returns {import('express').Router}
 */
function createCommitsRouter(commitStore) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { repoId, from, to } = parseCommonParams(req.query);
      const { limit, offset } = parsePagination(req.query);

      const repoError = validateRepoId(repoId);
      if (repoError) {
        return errorResponse(res, 400, repoError);
      }

      const dateError = validateDateRange(from, to);
      if (dateError) {
        return errorResponse(res, 400, dateError);
      }

      let allItems;
      if (from && to) {
        allItems = await commitStore.getCommitsByDateRange(repoId, from, to);
      } else if (from) {
        // from only — query from that date to far future
        allItems = await commitStore.getCommitsByDateRange(repoId, from, '9999-12-31T23:59:59.999Z');
      } else if (to) {
        // to only — query from epoch to that date
        allItems = await commitStore.getCommitsByDateRange(repoId, '0000-01-01T00:00:00.000Z', to);
      } else {
        // No date range — get all commits for repo
        const result = await commitStore.getCommitsByRepo(repoId);
        allItems = result.items;
      }

      return res.json(paginatedResponse(allItems, limit, offset));
    } catch (err) {
      console.error('Error fetching commits:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createCommitsRouter };
