'use strict';

const fc = require('fast-check');
const { computeFileTypeDistribution } = require('../../modules/api/computations');

// Feature: ginator, Property 21: File Type Distribution
// **Validates: Requirements 26.1**

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

describe('Property 21: File Type Distribution', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });

  it('each extension count equals the number of changedFiles entries with that extension', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeFileTypeDistribution(commits);
        const expected = {};
        for (const c of commits) {
          if (c.changedFiles) {
            for (const f of c.changedFiles) {
              const dotIdx = f.path.lastIndexOf('.');
              const ext = dotIdx >= 0 ? f.path.slice(dotIdx) : '(no extension)';
              expected[ext] = (expected[ext] || 0) + 1;
            }
          }
        }
        for (const t of result.types) {
          expect(t.count).toBe(expected[t.extension]);
        }
      }),
      { numRuns: 200 }
    );
  });

  it('sum of all counts equals total number of file change entries', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeFileTypeDistribution(commits);
        const totalEntries = commits.reduce((s, c) => s + (c.changedFiles ? c.changedFiles.length : 0), 0);
        const sum = result.types.reduce((s, t) => s + t.count, 0);
        expect(sum).toBe(totalEntries);
      }),
      { numRuns: 200 }
    );
  });
});
