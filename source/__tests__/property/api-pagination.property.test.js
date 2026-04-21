'use strict';

const fc = require('fast-check');
const { paginatedResponse } = require('../../modules/api/helpers');

/**
 * Property 26: API Pagination Correctness
 * **Validates: Requirements 40.5**
 *
 * For any dataset of N items and any valid limit (1 ≤ limit ≤ N) and
 * offset (0 ≤ offset < N), the paginated API response SHALL contain exactly
 * min(limit, N - offset) items, matching the slice fullResults[offset : offset + limit]
 * of the full sorted result set. The response SHALL include the total count N.
 */
describe('Property 26: API Pagination Correctness', () => {
  // Generator: non-empty array of unique items (simulating a sorted result set)
  const datasetArb = fc.array(fc.string({ minLength: 1, maxLength: 30 }), {
    minLength: 1,
    maxLength: 200
  });

  // Generator: a dataset paired with valid limit and offset
  const paginationArb = datasetArb.chain((items) => {
    const N = items.length;
    return fc.tuple(
      fc.constant(items),
      fc.integer({ min: 1, max: N }), // limit: 1 ≤ limit ≤ N
      fc.integer({ min: 0, max: N - 1 }) // offset: 0 ≤ offset < N
    );
  });

  it('returns exactly min(limit, N - offset) items for any valid limit and offset', () => {
    fc.assert(
      fc.property(paginationArb, ([items, limit, offset]) => {
        const result = paginatedResponse(items, limit, offset);
        const expectedCount = Math.min(limit, items.length - offset);
        expect(result.items.length).toBe(expectedCount);
      }),
      { numRuns: 500 }
    );
  });

  it('returns items matching the slice fullResults[offset : offset + limit]', () => {
    fc.assert(
      fc.property(paginationArb, ([items, limit, offset]) => {
        const result = paginatedResponse(items, limit, offset);
        const expectedSlice = items.slice(offset, offset + limit);
        expect(result.items).toEqual(expectedSlice);
      }),
      { numRuns: 500 }
    );
  });

  it('includes the total count N in the response', () => {
    fc.assert(
      fc.property(paginationArb, ([items, limit, offset]) => {
        const result = paginatedResponse(items, limit, offset);
        expect(result.total).toBe(items.length);
      }),
      { numRuns: 500 }
    );
  });

  it('preserves limit and offset in the response envelope', () => {
    fc.assert(
      fc.property(paginationArb, ([items, limit, offset]) => {
        const result = paginatedResponse(items, limit, offset);
        expect(result.limit).toBe(limit);
        expect(result.offset).toBe(offset);
      }),
      { numRuns: 500 }
    );
  });
});
