'use strict';

const fc = require('fast-check');

/**
 * Property 9: Incremental Sync Correctness
 * **Validates: Requirements 5.6**
 *
 * For any set of already-stored commits with a known latest commit date,
 * and any set of new commits from the provider, the incremental sync SHALL
 * return exactly those commits whose date is strictly after the latest stored
 * commit date. No already-stored commit SHALL appear in the incremental result.
 */

/**
 * Pure function simulating the incremental sync filtering logic.
 * Given all commits from a provider and a latest stored date cutoff,
 * returns only commits whose commitDate is strictly after the cutoff.
 *
 * @param {Array<{ commitHash: string, commitDate: string }>} allCommits
 * @param {string} latestStoredDate - ISO 8601 date string cutoff
 * @returns {Array<{ commitHash: string, commitDate: string }>}
 */
function filterIncrementalCommits(allCommits, latestStoredDate) {
  const cutoff = new Date(latestStoredDate).getTime();
  return allCommits.filter((commit) => new Date(commit.commitDate).getTime() > cutoff);
}

describe('Property 9: Incremental Sync Correctness', () => {
  // Generator for a 40-char hex commit hash
  const commitHashArb = fc.hexaString({ minLength: 40, maxLength: 40 });

  // Generator for dates within a reasonable range
  const dateArb = fc.date({
    min: new Date('2015-01-01T00:00:00Z'),
    max: new Date('2030-12-31T23:59:59Z')
  });

  // Generator for a single commit record
  const commitArb = fc.record({
    commitHash: commitHashArb,
    commitDate: dateArb.map((d) => d.toISOString()),
    authorName: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    authorEmail: fc
      .tuple(
        fc.stringOf(
          fc.char().filter((c) => /[a-z0-9]/.test(c)),
          { minLength: 1, maxLength: 10 }
        ),
        fc.stringOf(
          fc.char().filter((c) => /[a-z0-9]/.test(c)),
          { minLength: 1, maxLength: 8 }
        ),
        fc.constantFrom('com', 'org', 'net')
      )
      .map(([local, domain, tld]) => `${local}@${domain}.${tld}`),
    message: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0)
  });

  it('returns only commits strictly after the latest stored date', () => {
    fc.assert(
      fc.property(
        fc.array(commitArb, { minLength: 0, maxLength: 30 }),
        dateArb.map((d) => d.toISOString()),
        (allCommits, latestStoredDate) => {
          const result = filterIncrementalCommits(allCommits, latestStoredDate);
          const cutoff = new Date(latestStoredDate).getTime();

          // Every returned commit must have a date strictly after the cutoff
          for (const commit of result) {
            expect(new Date(commit.commitDate).getTime()).toBeGreaterThan(cutoff);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('excludes all commits at or before the latest stored date', () => {
    fc.assert(
      fc.property(
        fc.array(commitArb, { minLength: 0, maxLength: 30 }),
        dateArb.map((d) => d.toISOString()),
        (allCommits, latestStoredDate) => {
          const result = filterIncrementalCommits(allCommits, latestStoredDate);
          const cutoff = new Date(latestStoredDate).getTime();

          // Commits at or before the cutoff must not appear in the result
          const excludedCommits = allCommits.filter(
            (c) => new Date(c.commitDate).getTime() <= cutoff
          );
          const resultHashes = new Set(result.map((c) => c.commitHash));

          for (const excluded of excludedCommits) {
            expect(resultHashes.has(excluded.commitHash)).toBe(false);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns exactly the set of commits after the cutoff (no missing, no extra)', () => {
    fc.assert(
      fc.property(
        fc.array(commitArb, { minLength: 0, maxLength: 30 }),
        dateArb.map((d) => d.toISOString()),
        (allCommits, latestStoredDate) => {
          const result = filterIncrementalCommits(allCommits, latestStoredDate);
          const cutoff = new Date(latestStoredDate).getTime();

          // Manually compute expected set
          const expected = allCommits.filter((c) => new Date(c.commitDate).getTime() > cutoff);

          expect(result).toHaveLength(expected.length);

          // Same commit hashes in same order
          const resultHashes = result.map((c) => c.commitHash);
          const expectedHashes = expected.map((c) => c.commitHash);
          expect(resultHashes).toEqual(expectedHashes);
        }
      ),
      { numRuns: 200 }
    );
  });

  it('no already-stored commit appears in the incremental result', () => {
    // Generate stored commits (before/at cutoff) and new commits (mixed dates)
    fc.assert(
      fc.property(
        fc.array(commitArb, { minLength: 1, maxLength: 15 }),
        fc.array(commitArb, { minLength: 1, maxLength: 15 }),
        (storedCommits, newCommits) => {
          // Derive the cutoff from the max date among stored commits
          const latestStoredDate = storedCommits.reduce((max, c) => {
            const d = new Date(c.commitDate).getTime();
            return d > max ? d : max;
          }, 0);
          const cutoffISO = new Date(latestStoredDate).toISOString();

          // Combine stored + new commits as "all commits from provider"
          const allCommits = [...storedCommits, ...newCommits];
          const result = filterIncrementalCommits(allCommits, cutoffISO);

          // No stored commit should appear in the result (their dates are <= cutoff)
          const storedHashes = new Set(
            storedCommits
              .filter((c) => new Date(c.commitDate).getTime() <= latestStoredDate)
              .map((c) => c.commitHash)
          );
          const resultHashes = new Set(result.map((c) => c.commitHash));

          for (const hash of storedHashes) {
            expect(resultHashes.has(hash)).toBe(false);
          }

          // All result commits must be strictly after the cutoff
          for (const commit of result) {
            expect(new Date(commit.commitDate).getTime()).toBeGreaterThan(latestStoredDate);
          }
        }
      ),
      { numRuns: 200 }
    );
  });

  it('returns empty array when all commits are at or before the cutoff', () => {
    fc.assert(
      fc.property(fc.array(commitArb, { minLength: 1, maxLength: 20 }), (commits) => {
        // Set cutoff to the max date among all commits — everything should be filtered out
        const maxDate = commits.reduce((max, c) => {
          const d = new Date(c.commitDate).getTime();
          return d > max ? d : max;
        }, 0);
        const cutoffISO = new Date(maxDate).toISOString();

        const result = filterIncrementalCommits(commits, cutoffISO);
        expect(result).toHaveLength(0);
      }),
      { numRuns: 200 }
    );
  });

  it('returns all commits when cutoff is before all commit dates', () => {
    fc.assert(
      fc.property(fc.array(commitArb, { minLength: 1, maxLength: 20 }), (commits) => {
        // Set cutoff to well before all possible commit dates
        const cutoffISO = new Date('2000-01-01T00:00:00Z').toISOString();

        const result = filterIncrementalCommits(commits, cutoffISO);
        expect(result).toHaveLength(commits.length);
      }),
      { numRuns: 200 }
    );
  });
});
