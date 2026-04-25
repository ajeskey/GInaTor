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

  // Repos list (accessible to all authenticated users, not just admin)
  router.get('/repos', async (_req, res) => {
    try {
      const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
      const { DynamoDBDocumentClient, ScanCommand } = require('@aws-sdk/lib-dynamodb');
      const clientConfig = { region: process.env.AWS_REGION || 'us-east-1' };
      if (process.env.DYNAMODB_ENDPOINT) clientConfig.endpoint = process.env.DYNAMODB_ENDPOINT;
      const docClient = DynamoDBDocumentClient.from(new DynamoDBClient(clientConfig));
      const result = await docClient.send(new ScanCommand({ TableName: 'RepositoryConfigs' }));
      const repos = (result.Items || []).map(r => ({
        repoId: r.repoId,
        name: r.name,
        providerType: r.providerType
      }));
      res.json(repos);
    } catch {
      res.status(500).json({ error: 'Failed to fetch repos' });
    }
  });

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
