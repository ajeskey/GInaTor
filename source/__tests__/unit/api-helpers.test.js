'use strict';

const {
  parsePagination,
  parseCommonParams,
  validateRepoId,
  validateDateRange,
  paginatedResponse,
  errorResponse
} = require('../../modules/api/helpers');

describe('API helpers', () => {
  describe('parsePagination', () => {
    test('returns defaults when no params provided', () => {
      expect(parsePagination({})).toEqual({ limit: 50, offset: 0 });
    });

    test('parses valid limit and offset', () => {
      expect(parsePagination({ limit: '20', offset: '10' })).toEqual({ limit: 20, offset: 10 });
    });

    test('clamps limit to max 500', () => {
      expect(parsePagination({ limit: '1000' })).toEqual({ limit: 500, offset: 0 });
    });

    test('resets negative limit to default', () => {
      expect(parsePagination({ limit: '-5' })).toEqual({ limit: 50, offset: 0 });
    });

    test('resets negative offset to 0', () => {
      expect(parsePagination({ offset: '-3' })).toEqual({ limit: 50, offset: 0 });
    });

    test('resets non-numeric values to defaults', () => {
      expect(parsePagination({ limit: 'abc', offset: 'xyz' })).toEqual({ limit: 50, offset: 0 });
    });
  });

  describe('parseCommonParams', () => {
    test('extracts repoId, from, to', () => {
      const result = parseCommonParams({ repoId: 'r1', from: '2024-01-01', to: '2024-12-31' });
      expect(result).toEqual({ repoId: 'r1', from: '2024-01-01', to: '2024-12-31' });
    });

    test('returns null for missing params', () => {
      expect(parseCommonParams({})).toEqual({ repoId: null, from: null, to: null });
    });
  });

  describe('validateRepoId', () => {
    test('returns error for missing repoId', () => {
      expect(validateRepoId(null)).toBeTruthy();
      expect(validateRepoId('')).toBeTruthy();
      expect(validateRepoId('  ')).toBeTruthy();
    });

    test('returns null for valid repoId', () => {
      expect(validateRepoId('repo-123')).toBeNull();
    });
  });

  describe('validateDateRange', () => {
    test('returns null when both dates are null', () => {
      expect(validateDateRange(null, null)).toBeNull();
    });

    test('returns null for valid dates', () => {
      expect(validateDateRange('2024-01-01', '2024-12-31')).toBeNull();
    });

    test('returns error for invalid from date', () => {
      expect(validateDateRange('not-a-date', null)).toBeTruthy();
    });

    test('returns error for invalid to date', () => {
      expect(validateDateRange(null, 'bad')).toBeTruthy();
    });

    test('returns error when from > to', () => {
      expect(validateDateRange('2024-12-31', '2024-01-01')).toBeTruthy();
    });
  });

  describe('paginatedResponse', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    test('returns correct page', () => {
      const result = paginatedResponse(items, 3, 0);
      expect(result).toEqual({ items: [1, 2, 3], total: 10, limit: 3, offset: 0 });
    });

    test('handles offset', () => {
      const result = paginatedResponse(items, 3, 7);
      expect(result).toEqual({ items: [8, 9, 10], total: 10, limit: 3, offset: 7 });
    });

    test('handles offset beyond items', () => {
      const result = paginatedResponse(items, 3, 20);
      expect(result).toEqual({ items: [], total: 10, limit: 3, offset: 20 });
    });

    test('handles empty array', () => {
      const result = paginatedResponse([], 50, 0);
      expect(result).toEqual({ items: [], total: 0, limit: 50, offset: 0 });
    });
  });

  describe('errorResponse', () => {
    test('sends JSON error with status code', () => {
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
      };
      errorResponse(res, 400, 'Bad request');
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Bad request' });
    });
  });
});
