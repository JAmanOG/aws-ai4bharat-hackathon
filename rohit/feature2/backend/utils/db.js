/**
 * Database client helpers for DynamoDB and Aurora PostgreSQL.
 * Same pattern as knowledge_sharing_and_learning module.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { Pool } = require('pg');

// ── DynamoDB ──
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION_CUSTOM || process.env.AWS_REGION || 'ap-south-1',
});

const dynamoDB = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: { removeUndefinedValues: true },
});

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
  const pool = getPostgresPool();
  const result = await pool.query(text, params);
  return result;
}

// ── Table Names (from environment) ──
const TABLE_NAMES = {
  VOICE_ROOMS: process.env.VOICE_ROOMS_TABLE || 'VoiceRooms',
  VOICE_ROOM_PARTICIPANTS: process.env.VOICE_ROOM_PARTICIPANTS_TABLE || 'VoiceRoomParticipants',
  CHAT_MESSAGES: process.env.CHAT_MESSAGES_TABLE || 'ChatMessages',
  WEBSOCKET_CONNECTIONS: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'WebSocketConnections',
};

module.exports = { dynamoDB, query, TABLE_NAMES, getPostgresPool };
