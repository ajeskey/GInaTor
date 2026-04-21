'use strict';

const express = require('express');

/**
 * Create the API docs router.
 * GET /api/v1/docs — returns API documentation describing all available endpoints.
 * @returns {import('express').Router}
 */
function createDocsRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.json({
      name: 'GInaTor Visualization API',
      version: 'v1',
      baseUrl: '/api/v1',
      authentication: 'Session cookie or API token required for all endpoints.',
      commonParameters: {
        repoId: { type: 'string', required: true, description: 'Repository identifier' },
        from: { type: 'string', required: false, description: 'Start date (ISO 8601, inclusive)' },
        to: { type: 'string', required: false, description: 'End date (ISO 8601, inclusive)' },
        limit: { type: 'integer', required: false, description: 'Page size (default 50, max 500)' },
        offset: {
          type: 'integer',
          required: false,
          description: 'Number of items to skip (default 0)'
        }
      },
      paginationFormat: {
        items: 'Array of result objects',
        total: 'Total number of matching items',
        limit: 'Page size used',
        offset: 'Offset used'
      },
      endpoints: [
        {
          method: 'GET',
          path: '/commits',
          description: 'Paginated commits by repo and optional date range'
        },
        {
          method: 'GET',
          path: '/stats',
          description:
            'Repository statistics (contributor count, file count, date range, commit count)'
        },
        {
          method: 'GET',
          path: '/heatmap',
          description: 'Contributor heatmap data (author × time grid)'
        },
        { method: 'GET', path: '/treemap', description: 'File hotspot treemap data' },
        { method: 'GET', path: '/sunburst', description: 'Code ownership sunburst data' },
        { method: 'GET', path: '/branches', description: 'Branch/merge graph data' },
        { method: 'GET', path: '/pulse', description: 'Commit velocity time series' },
        { method: 'GET', path: '/impact', description: 'Impact burst data per commit' },
        { method: 'GET', path: '/collaboration', description: 'Author collaboration network' },
        { method: 'GET', path: '/filetypes', description: 'File type distribution' },
        { method: 'GET', path: '/activity-matrix', description: 'Day/hour activity matrix (7×24)' },
        { method: 'GET', path: '/bubblemap', description: 'Bubble map data' },
        { method: 'GET', path: '/complexity', description: 'Code complexity trend data' },
        { method: 'GET', path: '/pr-flow', description: 'PR/MR review flow (GitHub/GitLab only)' },
        { method: 'GET', path: '/bus-factor', description: 'Bus factor per file/directory' },
        { method: 'GET', path: '/stale-files', description: 'Stale file list' },
        { method: 'GET', path: '/annotations', description: 'Annotations for a repo' },
        { method: 'GET', path: '/bookmarks', description: "User's saved bookmarks" },
        { method: 'GET', path: '/docs', description: 'This API documentation' }
      ],
      errors: {
        400: 'Bad Request — invalid or missing parameters',
        401: 'Unauthorized — authentication required',
        404: 'Not Found — repository not found or no access',
        500: 'Internal Server Error'
      }
    });
  });

  return router;
}

module.exports = { createDocsRouter };
