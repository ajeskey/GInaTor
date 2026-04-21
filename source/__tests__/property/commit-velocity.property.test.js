'use strict';

const fc = require('fast-check');
const { computeCommitVelocity } = require('../../modules/api/computations');

// Feature: ginator, Property 18: Commit Velocity Aggregation
// **Validates: Requirements 23.1**

const commitRecordArb = fc.record({
  repositoryId: fc.constantFrom('repo-1', 'repo-2', 'repo-3'),
  commitHash: fc.hexaString({ minLength: 40, maxLength: 40 }),
  authorName: fc.string({ minLength: 1, maxLength: 50 }),
  authorEmail: fc.emailAddress(),
  commitDate: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
    .map(d => d.toISOString()),
  message: fc.string({ minLength: 1, maxLength: 200 }),
  changedFiles: fc.array(
    fc.record({
      path: fc.stringOf(fc.constantFrom(...'abcdefghijklmnopqrstuvwxyz/._-'.split('')), { minLength: 3, maxLength: 50 }),
      changeType: fc.constantFrom('added', 'modified', 'deleted'),
      additions: fc.nat({ max: 500 }),
      deletions: fc.nat({ max: 500 })
    }),
    { minLength: 1, maxLength: 20 }
  )
});

describe('Property 18: Commit Velocity Aggregation', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });
  const granularityArb = fc.constantFrom('daily', 'weekly', 'monthly');

  it('sum of all data point values equals total number of commits', () => {
    fc.assert(
      fc.property(commitsArb, granularityArb, (commits, granularity) => {
        const result = computeCommitVelocity(commits, granularity);
        const sum = result.reduce((s, dp) => s + dp.count, 0);
        expect(sum).toBe(commits.length);
      }),
      { numRuns: 200 }
    );
  });

  it('each data point count equals commits falling within that time period', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        // Test with daily granularity for easy verification
        const result = computeCommitVelocity(commits, 'daily');
        for (const dp of result) {
          const expected = commits.filter(c => c.commitDate.slice(0, 10) === dp.period).length;
          expect(dp.count).toBe(expected);
        }
      }),
      { numRuns: 200 }
    );
  });
});
