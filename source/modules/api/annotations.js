'use strict';

const express = require('express');
const { parseCommonParams, validateRepoId, errorResponse } = require('./helpers');

/**
 * In-memory annotation store (placeholder until DynamoDB CRUD is wired).
 * In production, this would use DynamoDB Annotations table.
 */
const annotationsByRepo = {};

function createAnnotationsRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const { repoId } = parseCommonParams(req.query);
      const repoError = validateRepoId(repoId);
      if (repoError) return errorResponse(res, 400, repoError);

      const annotations = annotationsByRepo[repoId] || [];
      return res.json({ annotations });
    } catch (err) {
      console.error('Error fetching annotations:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  router.post('/', (req, res) => {
    try {
      const { repoId } = parseCommonParams(req.query);
      const repoError = validateRepoId(repoId);
      if (repoError) return errorResponse(res, 400, repoError);

      const { label, description, targetType, targetCommitHash, targetDateFrom, targetDateTo } =
        req.body;
      if (!label) return errorResponse(res, 400, 'Missing required field: label');

      const annotation = {
        annotationId: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        repositoryId: repoId,
        label,
        description: description || '',
        targetType: targetType || 'commit',
        targetCommitHash: targetCommitHash || null,
        targetDateFrom: targetDateFrom || null,
        targetDateTo: targetDateTo || null,
        createdAt: new Date().toISOString()
      };

      if (!annotationsByRepo[repoId]) annotationsByRepo[repoId] = [];
      annotationsByRepo[repoId].push(annotation);

      return res.status(201).json(annotation);
    } catch (err) {
      console.error('Error creating annotation:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  router.delete('/:annotationId', (req, res) => {
    try {
      const { repoId } = parseCommonParams(req.query);
      const repoError = validateRepoId(repoId);
      if (repoError) return errorResponse(res, 400, repoError);

      const { annotationId } = req.params;
      if (!annotationsByRepo[repoId]) return errorResponse(res, 404, 'Annotation not found');

      const idx = annotationsByRepo[repoId].findIndex((a) => a.annotationId === annotationId);
      if (idx === -1) return errorResponse(res, 404, 'Annotation not found');

      annotationsByRepo[repoId].splice(idx, 1);
      return res.json({ deleted: true });
    } catch (err) {
      console.error('Error deleting annotation:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createAnnotationsRouter };
