'use strict';

const fc = require('fast-check');
const { computeBuildingDimensions } = require('../../modules/api/computations');

// Feature: ginator, Property 27: Building Dimension Proportionality
// **Validates: Requirements 17.2**

describe('Property 27: Building Dimension Proportionality', () => {
  // Generate two files with distinct line counts and change frequencies
  it('file with strictly greater line count has strictly greater building height', () => {
    const arb = fc
      .record({
        fileA: fc.string({ minLength: 3, maxLength: 20 }),
        fileB: fc.string({ minLength: 3, maxLength: 20 }),
        additionsA: fc.integer({ min: 2, max: 500 }),
        additionsB: fc.integer({ min: 1, max: 499 })
      })
      .filter((r) => r.fileA !== r.fileB && r.additionsA > r.additionsB);

    fc.assert(
      fc.property(arb, ({ fileA, fileB, additionsA, additionsB }) => {
        const commits = [
          {
            repositoryId: 'repo-1',
            commitHash: 'a'.repeat(40),
            authorName: 'Alice',
            authorEmail: 'alice@test.com',
            commitDate: '2024-01-01T00:00:00.000Z',
            message: 'commit',
            changedFiles: [
              { path: fileA, changeType: 'modified', additions: additionsA, deletions: 0 },
              { path: fileB, changeType: 'modified', additions: additionsB, deletions: 0 }
            ]
          }
        ];
        const result = computeBuildingDimensions(commits);
        const buildingA = result.buildings.find((b) => b.path === fileA);
        const buildingB = result.buildings.find((b) => b.path === fileB);
        expect(buildingA.height).toBeGreaterThan(buildingB.height);
      }),
      { numRuns: 200 }
    );
  });

  it('file with strictly greater change frequency has strictly greater footprint', () => {
    const arb = fc
      .record({
        fileA: fc.string({ minLength: 3, maxLength: 20 }),
        fileB: fc.string({ minLength: 3, maxLength: 20 }),
        extraCommits: fc.integer({ min: 1, max: 10 })
      })
      .filter((r) => r.fileA !== r.fileB);

    fc.assert(
      fc.property(arb, ({ fileA, fileB, extraCommits }) => {
        // Both files appear in one commit, fileA appears in additional commits
        const commits = [
          {
            repositoryId: 'repo-1',
            commitHash: 'a'.repeat(40),
            authorName: 'Alice',
            authorEmail: 'alice@test.com',
            commitDate: '2024-01-01T00:00:00.000Z',
            message: 'commit',
            changedFiles: [
              { path: fileA, changeType: 'modified', additions: 1, deletions: 0 },
              { path: fileB, changeType: 'modified', additions: 1, deletions: 0 }
            ]
          }
        ];
        for (let i = 0; i < extraCommits; i++) {
          commits.push({
            repositoryId: 'repo-1',
            commitHash: `b${i}${'0'.repeat(38)}`,
            authorName: 'Alice',
            authorEmail: 'alice@test.com',
            commitDate: `2024-01-0${i + 2}T00:00:00.000Z`,
            message: 'extra',
            changedFiles: [{ path: fileA, changeType: 'modified', additions: 1, deletions: 0 }]
          });
        }
        const result = computeBuildingDimensions(commits);
        const buildingA = result.buildings.find((b) => b.path === fileA);
        const buildingB = result.buildings.find((b) => b.path === fileB);
        expect(buildingA.footprint).toBeGreaterThan(buildingB.footprint);
      }),
      { numRuns: 200 }
    );
  });
});
