/**
 * Database client helpers for DynamoDB and Aurora PostgreSQL.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { Pool } = require('pg');

// ── DynamoDB ──
const ddbClient = new DynamoDBClient({
    region: process.env.AWS_REGION || 'ap-south-1',
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
            database: process.env.PG_DATABASE || 'rural_platform',
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
    // Knowledge module
    USER_LEARNING_PROFILE: process.env.USER_LEARNING_PROFILE_TABLE || 'UserLearningProfile',
    PEER_GROUPS: process.env.PEER_GROUPS_TABLE || 'PeerGroups',
    LEARNING_RECOMMENDATIONS: process.env.LEARNING_RECOMMENDATIONS_TABLE || 'LearningRecommendations',
    CONTENT_INTERACTIONS: process.env.CONTENT_INTERACTIONS_TABLE || 'ContentInteractions',
    // Agriculture supply chain module
    FARMER_PROFILES: process.env.FARMER_PROFILES_TABLE || 'FarmerProfiles',
    PRICE_ALERTS: process.env.PRICE_ALERTS_TABLE || 'PriceAlerts',
    PRICE_WATCH: process.env.PRICE_WATCH_TABLE || 'PriceWatch',
    FARM_PRACTICE_LOGS: process.env.FARM_PRACTICE_LOGS_TABLE || 'FarmPracticeLogs',
    ECONOMIC_PROFILES: process.env.ECONOMIC_PROFILES_TABLE || 'EconomicProfiles',
    INSURANCE_CLAIMS: process.env.INSURANCE_CLAIMS_TABLE || 'InsuranceClaims',
    FINANCIAL_NUDGES: process.env.FINANCIAL_NUDGES_TABLE || 'FinancialNudges',
    // Voice module
    VOICE_CONVERSATIONS: process.env.VOICE_CONVERSATIONS_TABLE || 'VoiceConversations',
    USER_MEMORY_FACTS: process.env.USER_MEMORY_FACTS_TABLE || 'UserMemoryFacts',
};

module.exports = { dynamoDB, query, TABLE_NAMES, getPostgresPool };
