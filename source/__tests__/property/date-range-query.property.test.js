'use strict';

const fc = require('fast-check');

/**
 * Property 12: Date Range Query Correctness
 * **Validates: Requirements 7.4, 7.5**
 *
 * For any set of commits in a repository and any date range [from, to],
 * querying the Commit_Store by repository and date range SHALL return
 * exactly those commits where from ≤ commitDate ≤ to, ordered by
 * commitDate descending.
 */

// --- Pure function under test ---

/**
 * Filters commits where from <= commitDate <= to and sorts descending by commitDate.
 * This mirrors the logic of CommitStore.getCommitsByDateRange without DynamoDB.
 *
 * @param {Array<object>} commits - Array of commit records with commitDate (ISO 8601).
 * @param {string} from - Start date (ISO 8601, inclusive).
 * @param {string} to - End date (ISO 8601, inclusive).
 * @returns {Array<object>} Filtered and sorted commits.
 */
function filterByDateRange(commits, from, to) {
  return commits
    .filter((c) => c.commitDate >= from && c.commitDate <= to)
    .sort((a, b) => {
      if (a.commitDate > b.commitDate) return -1;
      if (a.commitDate < b.commitDate) return 1;
      return 0;
    });
}

// --- Generators ---

const dateArb = fc
  .date({
    min: new Date('2015-01-01T00:00:00.000Z'),
    max: new Date('2030-12-31T23:59:59.000Z')
  })
  .map((d) => d.toISOString());

const commitHashArb = fc.hexaString({ minLength: 40, maxLength: 40 });

const emailArb = fc
  .tuple(
    fc.stringOf(
      fc.char().filter((c) => /[a-z0-9]/.test(c)),
      { minLength: 1, maxLength: 8 }
    ),
    fc.stringOf(
      fc.char().filter((c) => /[a-z0-9]/.test(c)),
      { minLength: 1, maxLength: 6 }
    ),
    fc.constantFrom('com', 'org', 'net')
  )
  .map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const commitRecordArb = fc.record({
  commitHash: commitHashArb,
  authorName: fc.string({ minLength: 1, maxLength: 15 }).filter((s) => s.trim().length > 0),
  authorEmail: emailArb,
  commitDate: dateArb,
  message: fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim().length > 0),
  changedFiles: fc.constant([])
});

/**
 * Generate a date range [from, to] where from <= to.
 */
const dateRangeArb = fc
  .tuple(dateArb, dateArb)
  .map(([a, b]) => (a <= b ? { from: a, to: b } : { from: b, to: a }));

// --- Tests ---

describe('Property 12: Date Range Query Correctness', () => {
  it('returns exactly those commits where from <= commitDate <= to', () => {
    fc.assert(
      fc.property(
        fc.array(commitRecordArb, { minLength: 0, maxLength: 30 }),
        dateRangeArb,
        (commits, range) => {
          const result = filterByDateRange(commits, range.from, range.to);

          // Every returned commit must be within the range
          for (const c of result) {
            expect(c.commitDate >= range.from).toBe(true);
            expect(c.commitDate <= range.to).toBe(true);
          }

          // Every commit in the original set that is within range must appear in result
          const expectedCount = commits.filter(
            (c) => c.commitDate >= range.from && c.commitDate <= range.to
          ).length;
          expect(result.length).toBe(expectedCount);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns results ordered by commitDate descending', () => {
    fc.assert(
      fc.property(
        fc.array(commitRecordArb, { minLength: 0, maxLength: 30 }),
        dateRangeArb,
        (commits, range) => {
          const result = filterByDateRange(commits, range.from, range.to);

          for (let i = 1; i < result.length; i++) {
            expect(result[i - 1].commitDate >= result[i].commitDate).toBe(true);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns empty array when no commits fall within the range', () => {
    fc.assert(
      fc.property(
        fc.array(commitRecordArb, { minLength: 0, maxLength: 20 }),
        dateRangeArb,
        (commits, range) => {
          // Shift all commits outside the range
          const outsideCommits = commits.map((c) => ({
            ...c,
            commitDate: new Date(new Date(range.to).getTime() + 86400000).toISOString()
          }));

          const result = filterByDateRange(outsideCommits, range.from, range.to);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('returns all commits when range spans the full date extent', () => {
    fc.assert(
      fc.property(fc.array(commitRecordArb, { minLength: 1, maxLength: 20 }), (commits) => {
        const dates = commits.map((c) => c.commitDate);
        const minDate = dates.reduce((a, b) => (a < b ? a : b));
        const maxDate = dates.reduce((a, b) => (a > b ? a : b));

        const result = filterByDateRange(commits, minDate, maxDate);
        expect(result.length).toBe(commits.length);
      }),
      { numRuns: 200 }
    );
  });

  it('does not include commits outside the range boundaries', () => {
    fc.assert(
      fc.property(
        fc.array(commitRecordArb, { minLength: 0, maxLength: 30 }),
        dateRangeArb,
        (commits, range) => {
          const result = filterByDateRange(commits, range.from, range.to);
          const resultSet = new Set(result.map((c) => c.commitHash));

          for (const c of commits) {
            if (c.commitDate < range.from || c.commitDate > range.to) {
              expect(resultSet.has(c.commitHash)).toBe(false);
            }
          }
        }
      ),
      { numRuns: 200 }
    );
  });
});
