/**
 * Database client helpers for DynamoDB and Aurora PostgreSQL.
 * Same pattern as knowledge_sharing_and_learning module.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { Pool } = require('pg');

// ── DynamoDB ──
const endpoint = process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566';
const accessKeyId = process.env.AWS_ACCESS_KEY_ID || 'test';
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY || 'test';

console.log(`🔌 DynamoDB Config:
  - Endpoint: ${endpoint}
  - Region: ${process.env.AWS_REGION || 'us-east-1'}
  - AccessKeyId: ${accessKeyId.substring(0, 4)}***`);

const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: endpoint,
  credentials: {
    accessKeyId: accessKeyId,
    secretAccessKey: secretAccessKey,
  },
});

const dynamoDB = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

// Proxy DynamoDB send method for logging
const originalSend = dynamoDB.send.bind(dynamoDB);
dynamoDB.send = async (command, ...args) => {
  const start = Date.now();
  const cmdName = command.constructor.name;
  let actionStr = '[CRUD:READ]';
  if (cmdName === 'PutCommand') actionStr = '[CRUD:CREATE]';
  if (cmdName === 'UpdateCommand') actionStr = '[CRUD:UPDATE]';
  if (cmdName === 'DeleteCommand') actionStr = '[CRUD:DELETE]';

  const payloadStr = JSON.stringify(command.input?.Item || command.input?.ExpressionAttributeValues || command.input?.Key || {});
  console.log(`${actionStr} DynamoDB ${cmdName} on table: ${command.input?.TableName || 'Unknown'} | Payload: ${payloadStr.substring(0, 300)}${payloadStr.length > 300 ? '...' : ''}`);

  try {
    const res = await originalSend(command, ...args);
    const duration = Date.now() - start;
    console.log(`[API:SUCCESS] DynamoDB ${cmdName} completed in ${duration}ms`);
    return res;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`[API:ERROR] DynamoDB ${cmdName} failed after ${duration}ms: ${err.message}`);
    throw err;
  }
};

// ── Aurora PostgreSQL ──
let pgPool = null;

function getPostgresPool() {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.PG_HOST,
      port: parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || 'rural_community',
      user: process.env.PG_USER,
      password: process.env.PG_PASSWORD,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
    });
  }
  return pgPool;
}

async function query(text, params) {
  const start = Date.now();

  // Basic heuristic to figure out CRUD type
  const t = text.trim().toUpperCase();
  let actionStr = '[CRUD:READ]';
  if (t.startsWith('INSERT')) actionStr = '[CRUD:CREATE]';
  if (t.startsWith('UPDATE')) actionStr = '[CRUD:UPDATE]';
  if (t.startsWith('DELETE')) actionStr = '[CRUD:DELETE]';

  const shortQuery = text.replace(/\s+/g, ' ').substring(0, 100) + '...';
  console.log(`${actionStr} Postgres Query: ${shortQuery} | Params: ${JSON.stringify(params)}`);

  const pool = getPostgresPool();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log(`[API:SUCCESS] Postgres Query OK (${result.rowCount || 0} rows) in ${duration}ms`);
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    console.log(`[API:ERROR] Postgres Query failed in ${duration}ms: ${err.message}`);
    throw err;
  }
}

// ── Table Names (from environment) ──
const TABLE_NAMES = {
  VOICE_ROOMS: process.env.VOICE_ROOMS_TABLE || 'VoiceRooms',
  VOICE_ROOM_PARTICIPANTS: process.env.VOICE_ROOM_PARTICIPANTS_TABLE || 'VoiceRoomParticipants',
  CHAT_MESSAGES: process.env.CHAT_MESSAGES_TABLE || 'ChatMessages',
  WEBSOCKET_CONNECTIONS: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'WebSocketConnections',
};

module.exports = { dynamoDB, query, TABLE_NAMES, getPostgresPool };
