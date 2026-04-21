'use strict';

/**
 * Parse and validate pagination query parameters.
 * @param {object} query - Express request query object.
 * @returns {{ limit: number, offset: number }} Validated pagination params.
 */
function parsePagination(query) {
  let limit = parseInt(query.limit, 10);
  if (isNaN(limit) || limit < 1) limit = 50;
  if (limit > 500) limit = 500;

  let offset = parseInt(query.offset, 10);
  if (isNaN(offset) || offset < 0) offset = 0;

  return { limit, offset };
}

/**
 * Parse common query parameters shared across visualization endpoints.
 * @param {object} query - Express request query object.
 * @returns {{ repoId: string|null, from: string|null, to: string|null }}
 */
function parseCommonParams(query) {
  const repoId = query.repoId || null;
  const from = query.from || null;
  const to = query.to || null;

  return { repoId, from, to };
}

/**
 * Validate that repoId is present. Returns an error string or null.
 * @param {string|null} repoId
 * @returns {string|null}
 */
function validateRepoId(repoId) {
  if (!repoId || typeof repoId !== 'string' || repoId.trim() === '') {
    return 'Missing required query parameter: repoId';
  }
  return null;
}

/**
 * Validate ISO date strings. Returns an error string or null.
 * @param {string|null} from
 * @param {string|null} to
 * @returns {string|null}
 */
function validateDateRange(from, to) {
  if (from && isNaN(Date.parse(from))) {
    return 'Invalid "from" date format. Use ISO 8601 (e.g. 2024-01-01)';
  }
  if (to && isNaN(Date.parse(to))) {
    return 'Invalid "to" date format. Use ISO 8601 (e.g. 2024-12-31)';
  }
  if (from && to && new Date(from) > new Date(to)) {
    return '"from" date must be before or equal to "to" date';
  }
  return null;
}

/**
 * Build a paginated response envelope.
 * @param {Array} allItems - Full sorted result set.
 * @param {number} limit - Page size.
 * @param {number} offset - Starting offset.
 * @returns {{ items: Array, total: number, limit: number, offset: number }}
 */
function paginatedResponse(allItems, limit, offset) {
  const total = allItems.length;
  const items = allItems.slice(offset, offset + limit);
  return { items, total, limit, offset };
}

/**
 * Send a JSON error response.
 * @param {import('express').Response} res
 * @param {number} status
 * @param {string} message
 */
function errorResponse(res, status, message) {
  return res.status(status).json({ error: message });
}

module.exports = {
  parsePagination,
  parseCommonParams,
  validateRepoId,
  validateDateRange,
  paginatedResponse,
  errorResponse
};
