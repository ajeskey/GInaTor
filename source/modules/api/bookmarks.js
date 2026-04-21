'use strict';

const express = require('express');
const { errorResponse } = require('./helpers');

/**
 * In-memory bookmark store (placeholder until DynamoDB CRUD is wired).
 * In production, this would use DynamoDB Bookmarks table.
 */
const bookmarksByUser = {};

function createBookmarksRouter() {
  const router = express.Router();

  router.get('/', (req, res) => {
    try {
      const userId = req.user && req.user.userId ? req.user.userId : req.query.userId;
      if (!userId) return errorResponse(res, 400, 'Missing userId');

      const bookmarks = bookmarksByUser[userId] || [];
      return res.json({ bookmarks });
    } catch (err) {
      console.error('Error fetching bookmarks:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  router.post('/', (req, res) => {
    try {
      const userId = req.user && req.user.userId ? req.user.userId : req.query.userId;
      if (!userId) return errorResponse(res, 400, 'Missing userId');

      const { name, repositoryId, visualizationType, dateFrom, dateTo } = req.body;
      if (!name) return errorResponse(res, 400, 'Missing required field: name');

      const bookmark = {
        bookmarkId: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        userId,
        name,
        repositoryId: repositoryId || null,
        visualizationType: visualizationType || null,
        dateFrom: dateFrom || null,
        dateTo: dateTo || null,
        createdAt: new Date().toISOString()
      };

      if (!bookmarksByUser[userId]) bookmarksByUser[userId] = [];
      bookmarksByUser[userId].push(bookmark);

      return res.status(201).json(bookmark);
    } catch (err) {
      console.error('Error creating bookmark:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  router.delete('/:bookmarkId', (req, res) => {
    try {
      const userId = req.user && req.user.userId ? req.user.userId : req.query.userId;
      if (!userId) return errorResponse(res, 400, 'Missing userId');

      const { bookmarkId } = req.params;
      if (!bookmarksByUser[userId]) return errorResponse(res, 404, 'Bookmark not found');

      const idx = bookmarksByUser[userId].findIndex(b => b.bookmarkId === bookmarkId);
      if (idx === -1) return errorResponse(res, 404, 'Bookmark not found');

      bookmarksByUser[userId].splice(idx, 1);
      return res.json({ deleted: true });
    } catch (err) {
      console.error('Error deleting bookmark:', err);
      return errorResponse(res, 500, 'Internal server error');
    }
  });

  return router;
}

module.exports = { createBookmarksRouter };
