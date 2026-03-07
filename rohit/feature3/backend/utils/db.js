/**
 * DB clients — DynamoDB for articles/logs + Aurora PostgreSQL for directory data.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { Pool } = require('pg');

// ── DynamoDB ──
const ddbClient = new DynamoDBClient({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.DYNAMODB_ENDPOINT || 'http://localhost:4566',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
  forcePathStyle: true,
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

const TABLE_NAMES = {
  HEALTH_ARTICLES: process.env.HEALTH_ARTICLES_TABLE || 'HealthArticles',
  SYMPTOM_LOGS: process.env.SYMPTOM_LOGS_TABLE || 'SymptomLogs',
};

// ── Aurora PostgreSQL ──
let pgPool = null;
function getPostgresPool() {
  if (!pgPool) {
    pgPool = new Pool({
      host: process.env.PG_HOST,
      port: parseInt(process.env.PG_PORT || '5432', 10),
      database: process.env.PG_DATABASE || 'rural_health',
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

module.exports = { dynamoDB, TABLE_NAMES, query, getPostgresPool };
