/**
 * Setup DynamoDB tables on LocalStack for local development.
 * Run: node setup-dynamo-tables.js
 */
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const client = new DynamoDBClient({
  region: 'us-east-1',
  endpoint: 'http://localhost:4566',
  credentials: { accessKeyId: 'test', secretAccessKey: 'test' },
});

const TABLES = [
  {
    TableName: 'VoiceRooms',
    KeySchema: [{ AttributeName: 'roomId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'roomId', AttributeType: 'S' },
      { AttributeName: 'status', AttributeType: 'S' },
      { AttributeName: 'createdAt', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'ByStatus',
      KeySchema: [
        { AttributeName: 'status', KeyType: 'HASH' },
        { AttributeName: 'createdAt', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
      ProvisionedThroughput: { ReadCapacityUnits: 5, WriteCapacityUnits: 5 },
    }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'VoiceRoomParticipants',
    KeySchema: [
      { AttributeName: 'roomId', KeyType: 'HASH' },
      { AttributeName: 'userId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'roomId', AttributeType: 'S' },
      { AttributeName: 'userId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ChatMessages',
    KeySchema: [
      { AttributeName: 'roomId', KeyType: 'HASH' },
      { AttributeName: 'messageId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'roomId', AttributeType: 'S' },
      { AttributeName: 'messageId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'WebSocketConnections',
    KeySchema: [{ AttributeName: 'connectionId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'connectionId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'ExportAudit',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'exportedAt', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'exportedAt', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'HealthArticles',
    KeySchema: [{ AttributeName: 'articleId', KeyType: 'HASH' }],
    AttributeDefinitions: [
      { AttributeName: 'articleId', AttributeType: 'S' },
      { AttributeName: 'topic', AttributeType: 'S' },
      { AttributeName: 'generatedAt', AttributeType: 'S' },
    ],
    GlobalSecondaryIndexes: [{
      IndexName: 'ByTopic',
      KeySchema: [
        { AttributeName: 'topic', KeyType: 'HASH' },
        { AttributeName: 'generatedAt', KeyType: 'RANGE' },
      ],
      Projection: { ProjectionType: 'ALL' },
    }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'SymptomLogs',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'checkedAt', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'checkedAt', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
];

async function main() {
  console.log('Creating DynamoDB tables on LocalStack...\n');

  // List existing tables
  const existing = await client.send(new ListTablesCommand({}));
  const existingNames = existing.TableNames || [];

  for (const table of TABLES) {
    if (existingNames.includes(table.TableName)) {
      console.log(`  ✅ ${table.TableName} — already exists`);
      continue;
    }
    try {
      await client.send(new CreateTableCommand(table));
      console.log(`  ✅ ${table.TableName} — created`);
    } catch (err) {
      console.error(`  ❌ ${table.TableName} — ${err.message}`);
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);
