'use strict';

const fc = require('fast-check');
const { computeBusFactor } = require('../../modules/api/computations');

// Feature: ginator, Property 23: Bus Factor Computation
// **Validates: Requirements 31.1**

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

describe('Property 23: Bus Factor Computation', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });

  it('bus factor equals count of distinct authorEmail values for commits touching that file', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeBusFactor(commits);
        for (const file of result.files) {
          const authors = new Set();
          for (const c of commits) {
            if (c.changedFiles && c.changedFiles.some((f) => f.path === file.path)) {
              authors.add(c.authorEmail);
            }
          }
          expect(file.busFactor).toBe(authors.size);
          expect(file.contributors.sort()).toEqual(Array.from(authors).sort());
        }
      }),
      { numRuns: 200 }
    );
  });
});
