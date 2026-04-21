#!/usr/bin/env node

/**
 * DynamoDB table initialization script for GInaTor.
 * Creates all 8 required tables with key schemas, GSIs, and TTL configuration.
 *
 * Usage:
 *   DYNAMODB_ENDPOINT=http://localhost:8000 node source/scripts/init-tables.js
 *
 * Supports DYNAMODB_ENDPOINT env var for local development (DynamoDB Local).
 * When DYNAMODB_ENDPOINT is not set, connects to AWS DynamoDB using default credentials.
 */

const {
  DynamoDBClient,
  CreateTableCommand,
  UpdateTimeToLiveCommand,
  ListTablesCommand
} = require('@aws-sdk/client-dynamodb');

const endpoint = process.env.DYNAMODB_ENDPOINT;
const region = process.env.AWS_REGION || 'us-east-1';

const clientConfig = { region };
if (endpoint) {
  clientConfig.endpoint = endpoint;
}

const client = new DynamoDBClient(clientConfig);

const tableDefinitions = [
  {
    TableName: 'Users',
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'email-index',
        KeySchema: [{ AttributeName: 'email', KeyType: 'HASH' }],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'Sessions',
    KeySchema: [{ AttributeName: 'sessionId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'sessionId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'Commits',
    KeySchema: [
      { AttributeName: 'repositoryId', KeyType: 'HASH' },
      { AttributeName: 'commitHash', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'repositoryId', AttributeType: 'S' },
      { AttributeName: 'commitHash', AttributeType: 'S' },
      { AttributeName: 'commitDate', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'repo-date-index',
        KeySchema: [
          { AttributeName: 'repositoryId', KeyType: 'HASH' },
          { AttributeName: 'commitDate', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
      }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'RepositoryConfigs',
    KeySchema: [{ AttributeName: 'repoId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'repoId', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'AdminSettings',
    KeySchema: [{ AttributeName: 'settingKey', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'settingKey', AttributeType: 'S' }],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'SprintMarkers',
    KeySchema: [
      { AttributeName: 'repositoryId', KeyType: 'HASH' },
      { AttributeName: 'markerId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'repositoryId', AttributeType: 'S' },
      { AttributeName: 'markerId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'Annotations',
    KeySchema: [
      { AttributeName: 'repositoryId', KeyType: 'HASH' },
      { AttributeName: 'annotationId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'repositoryId', AttributeType: 'S' },
      { AttributeName: 'annotationId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  },
  {
    TableName: 'Bookmarks',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'bookmarkId', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'bookmarkId', AttributeType: 'S' }
    ],
    ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 }
  }
];

async function initTables() {
  console.log(
    `Initializing DynamoDB tables${endpoint ? ` (endpoint: ${endpoint})` : ' (AWS DynamoDB)'}...`
  );

  let existingTables = [];
  try {
    const listResult = await client.send(new ListTablesCommand({}));
    existingTables = listResult.TableNames || [];
  } catch (err) {
    console.error('Failed to list existing tables:', err.message);
    process.exit(1);
  }

  for (const tableDef of tableDefinitions) {
    if (existingTables.includes(tableDef.TableName)) {
      console.log(`  Table "${tableDef.TableName}" already exists, skipping.`);
      continue;
    }

    try {
      await client.send(new CreateTableCommand(tableDef));
      console.log(`  Created table "${tableDef.TableName}".`);
    } catch (err) {
      if (err.name === 'ResourceInUseException') {
        console.log(`  Table "${tableDef.TableName}" already exists, skipping.`);
      } else {
        console.error(`  Failed to create table "${tableDef.TableName}":`, err.message);
        process.exit(1);
      }
    }
  }

  // Enable TTL on Sessions table
  try {
    await client.send(
      new UpdateTimeToLiveCommand({
        TableName: 'Sessions',
        TimeToLiveSpecification: {
          Enabled: true,
          AttributeName: 'expires'
        }
      })
    );
    console.log('  Enabled TTL on "Sessions" table (attribute: expires).');
  } catch (err) {
    if (err.name === 'ValidationException' && err.message.includes('already enabled')) {
      console.log('  TTL already enabled on "Sessions" table.');
    } else {
      console.error('  Failed to enable TTL on Sessions:', err.message);
    }
  }

  console.log('DynamoDB table initialization complete.');
}

initTables().catch((err) => {
  console.error('Initialization failed:', err);
  process.exit(1);
});
