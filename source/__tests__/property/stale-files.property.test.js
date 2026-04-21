'use strict';

const fc = require('fast-check');
const { computeStaleFiles } = require('../../modules/api/computations');

// Feature: ginator, Property 24: Stale File Detection
// **Validates: Requirements 32.1**

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

describe('Property 24: Stale File Detection', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });
  const thresholdArb = fc.integer({ min: 1, max: 24 });
  const refDateArb = fc.date({ min: new Date('2024-01-01'), max: new Date('2026-12-31') });

  it('returns exactly files whose most recent commitDate is more than threshold months before reference date', () => {
    fc.assert(
      fc.property(commitsArb, thresholdArb, refDateArb, (commits, threshold, refDate) => {
        const result = computeStaleFiles(commits, threshold, refDate);

        // Build expected: file -> latest commitDate
        const fileLatest = Object.create(null);
        for (const c of commits) {
          if (c.changedFiles) {
            for (const f of c.changedFiles) {
              if (!fileLatest[f.path] || c.commitDate > fileLatest[f.path]) {
                fileLatest[f.path] = c.commitDate;
              }
            }
          }
        }

        const ref = new Date(refDate);
        const expectedStale = new Set();
        for (const [path, lastDate] of Object.entries(fileLatest)) {
          const d = new Date(lastDate);
          const monthsSince =
            (ref.getFullYear() - d.getFullYear()) * 12 + (ref.getMonth() - d.getMonth());
          if (monthsSince > threshold) {
            expectedStale.add(path);
          }
        }

        const actualStale = new Set(result.files.map((f) => f.path));
        expect(actualStale).toEqual(expectedStale);
      }),
      { numRuns: 200 }
    );
  });

  it('no file modified within the threshold appears in the stale list', () => {
    fc.assert(
      fc.property(commitsArb, thresholdArb, refDateArb, (commits, threshold, refDate) => {
        const result = computeStaleFiles(commits, threshold, refDate);
        const ref = new Date(refDate);

        const fileLatest = Object.create(null);
        for (const c of commits) {
          if (c.changedFiles) {
            for (const f of c.changedFiles) {
              if (!fileLatest[f.path] || c.commitDate > fileLatest[f.path]) {
                fileLatest[f.path] = c.commitDate;
              }
            }
          }
        }

        for (const staleFile of result.files) {
          const d = new Date(fileLatest[staleFile.path]);
          const monthsSince =
            (ref.getFullYear() - d.getFullYear()) * 12 + (ref.getMonth() - d.getMonth());
          expect(monthsSince).toBeGreaterThan(threshold);
        }
      }),
      { numRuns: 200 }
    );
  });
});
