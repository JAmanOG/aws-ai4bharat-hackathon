/**
 * DB clients — DynamoDB for articles/logs + Aurora PostgreSQL for directory data.
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
  return getPostgresPool().query(text, params);
}

module.exports = { dynamoDB, TABLE_NAMES, query, getPostgresPool };
