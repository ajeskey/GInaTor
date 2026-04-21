'use strict';

const fc = require('fast-check');
const { computeActivityMatrix } = require('../../modules/api/computations');

// Feature: ginator, Property 22: Activity Matrix Aggregation
// **Validates: Requirements 27.1**

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

describe('Property 22: Activity Matrix Aggregation', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });

  it('cell (dayOfWeek, hour) contains count of commits at that day and hour', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeActivityMatrix(commits);
        // Verify each cell
        const expected = Array.from({ length: 7 }, () => Array(24).fill(0));
        for (const c of commits) {
          const d = new Date(c.commitDate);
          expected[d.getUTCDay()][d.getUTCHours()]++;
        }
        expect(result.matrix).toEqual(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('sum of all cells equals total number of commits', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeActivityMatrix(commits);
        let sum = 0;
        for (let d = 0; d < 7; d++) {
          for (let h = 0; h < 24; h++) {
            sum += result.matrix[d][h];
          }
        }
        expect(sum).toBe(commits.length);
        expect(result.totalCommits).toBe(commits.length);
      }),
      { numRuns: 200 }
    );
  });
});
