'use strict';

const express = require('express');
const { createCommitsRouter } = require('./commits');
const { createDocsRouter } = require('./docs');
const { createStatsRouter } = require('./stats');
const { createHeatmapRouter } = require('./heatmap');
const { createTreemapRouter } = require('./treemap');
const { createSunburstRouter } = require('./sunburst');
const { createPulseRouter } = require('./pulse');
const { createCollaborationRouter } = require('./collaboration');
const { createFiletypesRouter } = require('./filetypes');
const { createActivityMatrixRouter } = require('./activity-matrix');
const { createBranchesRouter } = require('./branches');
const { createImpactRouter } = require('./impact');
const { createBubblemapRouter } = require('./bubblemap');
const { createComplexityRouter } = require('./complexity');
const { createPrFlowRouter } = require('./pr-flow');
const { createBusFactorRouter } = require('./bus-factor');
const { createStaleFilesRouter } = require('./stale-files');
const { createTimelineRouter } = require('./timeline');
const { createCityBlockRouter } = require('./city-block');
const { createAnnotationsRouter } = require('./annotations');
const { createBookmarksRouter } = require('./bookmarks');

/**
 * Create the main API v1 router that mounts all sub-routers.
 * @param {object} options
 * @param {import('../commit-store/index')} options.commitStore - CommitStore instance.
 * @returns {import('express').Router}
 */
function createApiRouter({ commitStore }) {
  const router = express.Router();

  // Mount sub-routers
  router.use('/commits', createCommitsRouter(commitStore));
  router.use('/docs', createDocsRouter());
  router.use('/stats', createStatsRouter(commitStore));
  router.use('/heatmap', createHeatmapRouter(commitStore));
  router.use('/treemap', createTreemapRouter(commitStore));
  router.use('/sunburst', createSunburstRouter(commitStore));
  router.use('/pulse', createPulseRouter(commitStore));
  router.use('/collaboration', createCollaborationRouter(commitStore));
  router.use('/filetypes', createFiletypesRouter(commitStore));
  router.use('/activity-matrix', createActivityMatrixRouter(commitStore));
  router.use('/branches', createBranchesRouter(commitStore));
  router.use('/impact', createImpactRouter(commitStore));
  router.use('/bubblemap', createBubblemapRouter(commitStore));
  router.use('/complexity', createComplexityRouter(commitStore));
  router.use('/pr-flow', createPrFlowRouter());
  router.use('/bus-factor', createBusFactorRouter(commitStore));
  router.use('/stale-files', createStaleFilesRouter(commitStore));
  router.use('/timeline', createTimelineRouter(commitStore));
  router.use('/city-block', createCityBlockRouter(commitStore));
  router.use('/annotations', createAnnotationsRouter());
  router.use('/bookmarks', createBookmarksRouter());

  return router;
}

module.exports = { createApiRouter };
