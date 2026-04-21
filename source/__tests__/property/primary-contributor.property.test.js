'use strict';

const fc = require('fast-check');
const { computePrimaryContributor } = require('../../modules/api/computations');

// Feature: ginator, Property 17: Primary Contributor Computation
// **Validates: Requirements 21.2**

const commitRecordArb = fc.record({
  repositoryId: fc.constantFrom('repo-1', 'repo-2', 'repo-3'),
  commitHash: fc.hexaString({ minLength: 40, maxLength: 40 }),
  authorName: fc.string({ minLength: 1, maxLength: 50 }),
  authorEmail: fc.emailAddress(),
  commitDate: fc
    .date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
    .map((d) => d.toISOString()),
  message: fc.string({ minLength: 1, maxLength: 200 }),
  changedFiles: fc.array(
    fc.record({
      path: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/._-'.split('')), {
        minLength: 3,
        maxLength: 50
      }),
      changeType: fc.constantFrom('added', 'modified', 'deleted'),
      additions: fc.nat({ max: 500 }),
      deletions: fc.nat({ max: 500 })
    }),
    { minLength: 1, maxLength: 20 }
  )
});

describe('Property 17: Primary Contributor Computation', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });

  it('primary contributor is the author with most commits touching that file (tie-break alphabetically)', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computePrimaryContributor(commits);
        for (const file of result.files) {
          // Count commits per author for this file
          const authorCounts = {};
          for (const c of commits) {
            if (c.changedFiles && c.changedFiles.some((f) => f.path === file.path)) {
              authorCounts[c.authorEmail] = (authorCounts[c.authorEmail] || 0) + 1;
            }
          }
          const maxCount = Math.max(...Object.values(authorCounts));
          const topAuthors = Object.entries(authorCounts)
            .filter(([, count]) => count === maxCount)
            .map(([author]) => author)
            .sort((a, b) => a.localeCompare(b));
          expect(topAuthors).toContain(file.primaryContributor);
          // If tie, should be alphabetically first
          expect(file.primaryContributor).toBe(topAuthors[0]);
        }
      }),
      { numRuns: 200 }
    );
  });
});
