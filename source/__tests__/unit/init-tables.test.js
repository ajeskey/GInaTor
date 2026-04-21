/**
 * Unit tests for DynamoDB table initialization script.
 * Validates table definitions, key schemas, GSIs, and TTL configuration.
 */

// Variables prefixed with 'mock' are allowed inside jest.mock()
let mockCreateCommands = [];
let mockTTLCommand = null;
const mockSend = jest.fn().mockImplementation((command) => {
  if (command.constructor.name === 'ListTablesCommand') {
    return Promise.resolve({ TableNames: [] });
  }
  if (command.constructor.name === 'CreateTableCommand') {
    mockCreateCommands.push(command.input);
    return Promise.resolve({});
  }
  if (command.constructor.name === 'UpdateTimeToLiveCommand') {
    mockTTLCommand = command.input;
    return Promise.resolve({});
  }
  return Promise.resolve({});
});

jest.mock('@aws-sdk/client-dynamodb', () => {
  const actual = jest.requireActual('@aws-sdk/client-dynamodb');
  return {
    ...actual,
    DynamoDBClient: jest.fn().mockImplementation(() => ({
      send: mockSend
    }))
  };
});

// Suppress console output during tests
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(process, 'exit').mockImplementation(() => {});
});

afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
  process.exit.mockRestore();
});

beforeEach(() => {
  mockCreateCommands = [];
  mockTTLCommand = null;
  mockSend.mockClear();
  jest.resetModules();
});

describe('DynamoDB init-tables script', () => {
  async function runScript() {
    delete require.cache[require.resolve('../../scripts/init-tables.js')];
    require('../../scripts/init-tables.js');
    // Wait for async operations to complete
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  test('creates exactly 8 tables', async () => {
    await runScript();
    expect(mockCreateCommands).toHaveLength(8);
  });

  test('creates all required table names', async () => {
    await runScript();
    const tableNames = mockCreateCommands.map((cmd) => cmd.TableName);
    expect(tableNames).toEqual(
      expect.arrayContaining([
        'Users',
        'Sessions',
        'Commits',
        'RepositoryConfigs',
        'AdminSettings',
        'SprintMarkers',
        'Annotations',
        'Bookmarks'
      ])
    );
  });

  test('Users table has userId PK and email-index GSI', async () => {
    await runScript();
    const users = mockCreateCommands.find((c) => c.TableName === 'Users');
    expect(users.KeySchema).toEqual([{ AttributeName: 'userId', KeyType: 'HASH' }]);
    expect(users.GlobalSecondaryIndexes).toHaveLength(1);
    expect(users.GlobalSecondaryIndexes[0].IndexName).toBe('email-index');
    expect(users.GlobalSecondaryIndexes[0].KeySchema).toEqual([
      { AttributeName: 'email', KeyType: 'HASH' }
    ]);
  });

  test('Sessions table has sessionId PK', async () => {
    await runScript();
    const sessions = mockCreateCommands.find((c) => c.TableName === 'Sessions');
    expect(sessions.KeySchema).toEqual([{ AttributeName: 'sessionId', KeyType: 'HASH' }]);
    expect(sessions.GlobalSecondaryIndexes).toBeUndefined();
  });

  test('Commits table has composite key and repo-date-index GSI', async () => {
    await runScript();
    const commits = mockCreateCommands.find((c) => c.TableName === 'Commits');
    expect(commits.KeySchema).toEqual([
      { AttributeName: 'repositoryId', KeyType: 'HASH' },
      { AttributeName: 'commitHash', KeyType: 'RANGE' }
    ]);
    expect(commits.GlobalSecondaryIndexes).toHaveLength(1);
    expect(commits.GlobalSecondaryIndexes[0].IndexName).toBe('repo-date-index');
    expect(commits.GlobalSecondaryIndexes[0].KeySchema).toEqual([
      { AttributeName: 'repositoryId', KeyType: 'HASH' },
      { AttributeName: 'commitDate', KeyType: 'RANGE' }
    ]);
  });

  test('RepositoryConfigs table has repoId PK', async () => {
    await runScript();
    const repoConfigs = mockCreateCommands.find((c) => c.TableName === 'RepositoryConfigs');
    expect(repoConfigs.KeySchema).toEqual([{ AttributeName: 'repoId', KeyType: 'HASH' }]);
  });

  test('AdminSettings table has settingKey PK', async () => {
    await runScript();
    const adminSettings = mockCreateCommands.find((c) => c.TableName === 'AdminSettings');
    expect(adminSettings.KeySchema).toEqual([{ AttributeName: 'settingKey', KeyType: 'HASH' }]);
  });

  test('SprintMarkers table has composite key (repositoryId, markerId)', async () => {
    await runScript();
    const markers = mockCreateCommands.find((c) => c.TableName === 'SprintMarkers');
    expect(markers.KeySchema).toEqual([
      { AttributeName: 'repositoryId', KeyType: 'HASH' },
      { AttributeName: 'markerId', KeyType: 'RANGE' }
    ]);
  });

  test('Annotations table has composite key (repositoryId, annotationId)', async () => {
    await runScript();
    const annotations = mockCreateCommands.find((c) => c.TableName === 'Annotations');
    expect(annotations.KeySchema).toEqual([
      { AttributeName: 'repositoryId', KeyType: 'HASH' },
      { AttributeName: 'annotationId', KeyType: 'RANGE' }
    ]);
  });

  test('Bookmarks table has composite key (userId, bookmarkId)', async () => {
    await runScript();
    const bookmarks = mockCreateCommands.find((c) => c.TableName === 'Bookmarks');
    expect(bookmarks.KeySchema).toEqual([
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'bookmarkId', KeyType: 'RANGE' }
    ]);
  });

  test('enables TTL on Sessions table with expires attribute', async () => {
    await runScript();
    expect(mockTTLCommand).toEqual({
      TableName: 'Sessions',
      TimeToLiveSpecification: {
        Enabled: true,
        AttributeName: 'expires'
      }
    });
  });
});
