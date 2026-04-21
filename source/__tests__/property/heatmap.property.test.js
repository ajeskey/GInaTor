'use strict';

const fc = require('fast-check');
const { computeHeatmap } = require('../../modules/api/computations');

// Feature: ginator, Property 15: Contributor Heatmap Aggregation
// **Validates: Requirements 19.1**

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

describe('Property 15: Contributor Heatmap Aggregation', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });

  it('each cell (author, timePeriod) count equals commits by that author in that period', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeHeatmap(commits);
        // Verify each cell independently
        for (const cell of result.grid) {
          const expected = commits.filter(c =>
            c.authorEmail === cell.author && c.commitDate.slice(0, 10) === cell.timePeriod
          ).length;
          expect(cell.count).toBe(expected);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('sum of all cell values equals total number of commits', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeHeatmap(commits);
        const sum = result.grid.reduce((s, cell) => s + cell.count, 0);
        expect(sum).toBe(commits.length);
        expect(result.totalCommits).toBe(commits.length);
      }),
      { numRuns: 200 }
    );
  });
});
