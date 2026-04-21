'use strict';

const fc = require('fast-check');

/**
 * Property 11: Commit Deduplication
 * **Validates: Requirements 7.2, 7.3**
 *
 * For any commit record, storing it in the Commit_Store twice with the same
 * repositoryId and commitHash SHALL result in exactly one record. The second
 * store operation SHALL not produce an error and SHALL not create a duplicate.
 */

// --- Mock setup (must be before require of CommitStore) ---
let mockSend;

jest.mock('@aws-sdk/client-dynamodb', () => ({
  DynamoDBClient: jest.fn().mockImplementation(() => ({}))
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  DynamoDBDocumentClient: {
    from: jest.fn().mockImplementation(() => ({
      get send() { return mockSend; }
    }))
  },
  PutCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Put' })),
  QueryCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'Query' })),
  BatchWriteCommand: jest.fn().mockImplementation((params) => ({ ...params, _type: 'BatchWrite' }))
}));

const CommitStore = require('../../modules/commit-store');

// --- Generators ---

const commitHashArb = fc.hexaString({ minLength: 40, maxLength: 40 });

const repoIdArb = fc.stringOf(
  fc.char().filter(c => /[a-zA-Z0-9\-]/.test(c)),
  { minLength: 1, maxLength: 30 }
).filter(s => s.trim().length > 0);

const dateArb = fc.date({
  min: new Date('2015-01-01T00:00:00Z'),
  max: new Date('2030-12-31T23:59:59Z')
}).map(d => d.toISOString());

const emailArb = fc.tuple(
  fc.stringOf(fc.char().filter(c => /[a-z0-9]/.test(c)), { minLength: 1, maxLength: 10 }),
  fc.stringOf(fc.char().filter(c => /[a-z0-9]/.test(c)), { minLength: 1, maxLength: 8 }),
  fc.constantFrom('com', 'org', 'net')
).map(([local, domain, tld]) => `${local}@${domain}.${tld}`);

const changeTypeArb = fc.constantFrom('added', 'modified', 'deleted');

const changedFileArb = fc.record({
  path: fc.stringOf(fc.char().filter(c => /[a-zA-Z0-9\/\.\-_]/.test(c)), { minLength: 1, maxLength: 30 })
    .filter(s => s.trim().length > 0),
  changeType: changeTypeArb
});

const commitRecordArb = fc.record({
  repositoryId: repoIdArb,
  commitHash: commitHashArb,
  authorName: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
  authorEmail: emailArb,
  commitDate: dateArb,
  message: fc.string({ minLength: 1, maxLength: 80 }).filter(s => s.trim().length > 0),
  changedFiles: fc.array(changedFileArb, { minLength: 0, maxLength: 5 })
});

/**
 * Configure mockSend to simulate DynamoDB dedup behavior:
 * first call succeeds, subsequent calls throw ConditionalCheckFailedException.
 */
function setupDedupMock() {
  let callCount = 0;
  mockSend = jest.fn().mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve({});
    }
    const err = new Error('The conditional request failed');
    err.name = 'ConditionalCheckFailedException';
    return Promise.reject(err);
  });
}

// --- Tests ---

describe('Property 11: Commit Deduplication', () => {
  // Use a single store instance; reset mockSend per property iteration
  let store;

  beforeAll(() => {
    mockSend = jest.fn();
    store = new CommitStore({ endpoint: 'http://localhost:8000' });
  });

  it('first putCommit returns {created: true}, second returns {created: false}', async () => {
    await fc.assert(
      fc.asyncProperty(commitRecordArb, async (record) => {
        setupDedupMock();

        const first = await store.putCommit(record);
        const second = await store.putCommit(record);

        expect(first).toEqual({ created: true });
        expect(second).toEqual({ created: false });
      }),
      { numRuns: 100 }
    );
  });

  it('second putCommit does not throw an error', async () => {
    await fc.assert(
      fc.asyncProperty(commitRecordArb, async (record) => {
        setupDedupMock();

        await store.putCommit(record);
        await expect(store.putCommit(record)).resolves.toBeDefined();
      }),
      { numRuns: 100 }
    );
  });

  it('putCommit uses condition expression to prevent duplicates', async () => {
    await fc.assert(
      fc.asyncProperty(commitRecordArb, async (record) => {
        setupDedupMock();

        await store.putCommit(record);

        expect(mockSend).toHaveBeenCalledTimes(1);
        const putParams = mockSend.mock.calls[0][0];
        expect(putParams.ConditionExpression).toBe(
          'attribute_not_exists(repositoryId) AND attribute_not_exists(commitHash)'
        );
        expect(putParams.Item.repositoryId).toBe(record.repositoryId);
        expect(putParams.Item.commitHash).toBe(record.commitHash);
      }),
      { numRuns: 100 }
    );
  });

  it('exactly two DynamoDB calls for two putCommit invocations on the same record', async () => {
    await fc.assert(
      fc.asyncProperty(commitRecordArb, async (record) => {
        setupDedupMock();

        await store.putCommit(record);
        await store.putCommit(record);

        expect(mockSend).toHaveBeenCalledTimes(2);
      }),
      { numRuns: 100 }
    );
  });
});
