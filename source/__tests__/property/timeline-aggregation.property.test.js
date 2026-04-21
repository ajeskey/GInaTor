'use strict';

const fc = require('fast-check');
const { computeTimelineAggregation } = require('../../modules/api/computations');

// Feature: ginator, Property 14: Timeline Aggregation Invariant
// **Validates: Requirements 13.1, 13.2, 13.3**

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

describe('Property 14: Timeline Aggregation Invariant', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });

  it('sum of additions across all buckets equals total additions across all commits', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeTimelineAggregation(commits);

        // Compute expected totals using the same logic as the function
        let expectedAdditions = 0;
        let expectedDeletions = 0;
        let expectedModifications = 0;

        for (const c of commits) {
          if (c.changedFiles) {
            for (const f of c.changedFiles) {
              const lineCount = (f.additions || 0) + (f.deletions || 0);
              if (f.changeType === 'added') expectedAdditions += lineCount;
              else if (f.changeType === 'deleted') expectedDeletions += lineCount;
              else expectedModifications += lineCount;
            }
          }
        }

        const bucketAdditions = result.buckets.reduce((s, b) => s + b.additions, 0);
        const bucketDeletions = result.buckets.reduce((s, b) => s + b.deletions, 0);
        const bucketModifications = result.buckets.reduce((s, b) => s + b.modifications, 0);

        expect(bucketAdditions).toBe(expectedAdditions);
        expect(bucketDeletions).toBe(expectedDeletions);
        expect(bucketModifications).toBe(expectedModifications);
      }),
      { numRuns: 200 }
    );
  });
});
