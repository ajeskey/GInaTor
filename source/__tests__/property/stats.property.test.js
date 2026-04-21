'use strict';

const fc = require('fast-check');
const { computeStats } = require('../../modules/api/computations');

// Feature: ginator, Property 13: Repository Stats Computation
// **Validates: Requirements 11.1**

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

describe('Property 13: Repository Stats Computation', () => {
  const nonEmptyCommitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 50 });

  it('contributorCount equals distinct authorEmail values', () => {
    fc.assert(
      fc.property(nonEmptyCommitsArb, (commits) => {
        const result = computeStats(commits);
        const expected = new Set(commits.map((c) => c.authorEmail)).size;
        expect(result.contributorCount).toBe(expected);
      }),
      { numRuns: 200 }
    );
  });

  it('fileCount equals distinct file paths across all changedFiles', () => {
    fc.assert(
      fc.property(nonEmptyCommitsArb, (commits) => {
        const result = computeStats(commits);
        const allPaths = new Set();
        for (const c of commits) {
          if (c.changedFiles) for (const f of c.changedFiles) allPaths.add(f.path);
        }
        expect(result.fileCount).toBe(allPaths.size);
      }),
      { numRuns: 200 }
    );
  });

  it('firstCommitDate equals minimum commitDate', () => {
    fc.assert(
      fc.property(nonEmptyCommitsArb, (commits) => {
        const result = computeStats(commits);
        const minDate = commits.reduce(
          (m, c) => (c.commitDate < m ? c.commitDate : m),
          commits[0].commitDate
        );
        expect(result.firstCommitDate).toBe(minDate);
      }),
      { numRuns: 200 }
    );
  });

  it('lastCommitDate equals maximum commitDate', () => {
    fc.assert(
      fc.property(nonEmptyCommitsArb, (commits) => {
        const result = computeStats(commits);
        const maxDate = commits.reduce(
          (m, c) => (c.commitDate > m ? c.commitDate : m),
          commits[0].commitDate
        );
        expect(result.lastCommitDate).toBe(maxDate);
      }),
      { numRuns: 200 }
    );
  });

  it('commitCount equals total number of commits', () => {
    fc.assert(
      fc.property(nonEmptyCommitsArb, (commits) => {
        const result = computeStats(commits);
        expect(result.commitCount).toBe(commits.length);
      }),
      { numRuns: 200 }
    );
  });
});
