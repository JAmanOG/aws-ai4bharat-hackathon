/**
 * Create all DynamoDB tables on local DynamoDB.
 * Run: node scripts/setup-dynamo.js
 */
require('dotenv').config();
const { DynamoDBClient, CreateTableCommand, ListTablesCommand } = require('@aws-sdk/client-dynamodb');

const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:8000';
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint,
  credentials: { accessKeyId: 'local', secretAccessKey: 'local' },
});

const TABLES = [
  {
    TableName: process.env.VOICE_CONVERSATIONS_TABLE || `VoiceConversations-${process.env.STAGE || 'dev'}`,
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'turnId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'turnId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.USER_MEMORY_FACTS_TABLE || `UserMemoryFacts-${process.env.STAGE || 'dev'}`,
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'factKey', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'factKey', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.RECOMMENDATIONS_TABLE || 'PersonalizedRecommendations',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'feedbackId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'feedbackId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.USER_LEARNING_PROFILE_TABLE || 'UserLearningProfile',
    KeySchema: [{ AttributeName: 'userId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'userId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.PEER_GROUPS_TABLE || 'PeerGroups',
    KeySchema: [{ AttributeName: 'groupId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'groupId', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.LEARNING_RECOMMENDATIONS_TABLE || 'LearningRecommendations',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'recommendationId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'recommendationId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: process.env.CONTENT_INTERACTIONS_TABLE || 'ContentInteractions',
    KeySchema: [
      { AttributeName: 'userId', KeyType: 'HASH' },
      { AttributeName: 'interactionId', KeyType: 'RANGE' },
    ],
    AttributeDefinitions: [
      { AttributeName: 'userId', AttributeType: 'S' },
      { AttributeName: 'interactionId', AttributeType: 'S' },
    ],
    BillingMode: 'PAY_PER_REQUEST',
  },
  {
    TableName: 'VoiceRooms',
    KeySchema: [{ AttributeName: 'roomId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'roomId', AttributeType: 'S' }],
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
    TableName: 'HealthArticles',
    KeySchema: [{ AttributeName: 'articleId', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'articleId', AttributeType: 'S' }],
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
];

(async () => {
  console.log(`Creating DynamoDB tables on ${endpoint}...\n`);
  const existing = await client.send(new ListTablesCommand({}));
  const existingNames = existing.TableNames || [];

  for (const t of TABLES) {
    if (existingNames.includes(t.TableName)) {
      console.log(`  ✅ ${t.TableName} — already exists`);
      continue;
    }
    try {
      await client.send(new CreateTableCommand(t));
      console.log(`  ✅ ${t.TableName} — created`);
    } catch (e) {
      console.error(`  ❌ ${t.TableName} — ${e.message}`);
    }
  }
  console.log('\nDone!');
})();
