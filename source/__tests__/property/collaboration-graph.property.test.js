'use strict';

const fc = require('fast-check');
const { computeCollaborationGraph } = require('../../modules/api/computations');

// Feature: ginator, Property 20: Author Collaboration Graph
// **Validates: Requirements 25.1, 25.3**

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

function edgeKey(a, b) {
  const sorted = [a, b].sort();
  return `${sorted[0]}\0${sorted[1]}`;
}

describe('Property 20: Author Collaboration Graph', () => {
  const commitsArb = fc.array(commitRecordArb, { minLength: 1, maxLength: 30 });

  it('edge exists between two authors iff they both modified at least one common file', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeCollaborationGraph(commits);

        const fileAuthors = Object.create(null);
        for (const c of commits) {
          if (c.changedFiles) {
            for (const f of c.changedFiles) {
              if (!fileAuthors[f.path]) fileAuthors[f.path] = new Set();
              fileAuthors[f.path].add(c.authorEmail);
            }
          }
        }

        const expectedEdges = new Set();
        for (const [, authors] of Object.entries(fileAuthors)) {
          const arr = Array.from(authors).sort();
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              expectedEdges.add(edgeKey(arr[i], arr[j]));
            }
          }
        }

        const actualEdges = new Set(result.edges.map((e) => edgeKey(e.source, e.target)));
        expect(actualEdges).toEqual(expectedEdges);
      }),
      { numRuns: 200 }
    );
  });

  it('edge weight equals count of distinct shared files', () => {
    fc.assert(
      fc.property(commitsArb, (commits) => {
        const result = computeCollaborationGraph(commits);

        const fileAuthors = Object.create(null);
        for (const c of commits) {
          if (c.changedFiles) {
            for (const f of c.changedFiles) {
              if (!fileAuthors[f.path]) fileAuthors[f.path] = new Set();
              fileAuthors[f.path].add(c.authorEmail);
            }
          }
        }

        const expectedWeights = {};
        for (const [, authors] of Object.entries(fileAuthors)) {
          const arr = Array.from(authors).sort();
          for (let i = 0; i < arr.length; i++) {
            for (let j = i + 1; j < arr.length; j++) {
              const key = edgeKey(arr[i], arr[j]);
              expectedWeights[key] = (expectedWeights[key] || 0) + 1;
            }
          }
        }

        for (const edge of result.edges) {
          const key = edgeKey(edge.source, edge.target);
          expect(edge.sharedFiles).toBe(expectedWeights[key]);
        }
      }),
      { numRuns: 200 }
    );
  });
});
