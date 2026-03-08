/**
 * Database client helpers for DynamoDB and Aurora PostgreSQL.
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');
const { Pool } = require('pg');

// ── DynamoDB ──
const ddbOpts = {
    region: process.env.AWS_REGION || 'ap-south-1',
};
if (process.env.DYNAMODB_ENDPOINT) {
    ddbOpts.endpoint = process.env.DYNAMODB_ENDPOINT;
    // Use dummy credentials for local DynamoDB
    ddbOpts.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'local',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'local',
    };
}
const ddbClient = new DynamoDBClient(ddbOpts);

const dynamoDB = DynamoDBDocumentClient.from(ddbClient, {
    marshallOptions: { removeUndefinedValues: true },
});

// ── Aurora PostgreSQL ──
let pgPool = null;
const pgAvailable = !!(process.env.PG_HOST && process.env.PG_HOST.trim());

function getPostgresPool() {
    if (!pgPool) {
        pgPool = new Pool({
            host: process.env.PG_HOST || 'localhost',
            port: parseInt(process.env.PG_PORT || '5432', 10),
            database: process.env.PG_DATABASE || 'rural_platform',
            user: process.env.PG_USER || 'admin',
            password: String(process.env.PG_PASSWORD ?? 'localdev123'),
            max: 5,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 5000,
            ssl: process.env.PG_SSL === 'true' ? { rejectUnauthorized: false } : false,
        });
    }
    return pgPool;
}

async function query(text, params) {
    // Graceful fallback when PostgreSQL is not configured
    if (!pgAvailable) {
        return { rows: [], rowCount: 0, fields: [] };
    }
    try {
        const pool = getPostgresPool();
        const result = await pool.query(text, params);
        return result;
    } catch (err) {
        if (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') {
            console.warn('[PG] Connection failed, returning empty result:', err.message);
            return { rows: [], rowCount: 0, fields: [] };
        }
        throw err;
    }
}

// ── Table Names (from environment) ──
const TABLE_NAMES = {
    // Auth / User module
    USERS: process.env.USERS_TABLE || 'Users',
    PERSONALIZED_RECOMMENDATIONS: process.env.RECOMMENDATIONS_TABLE || 'PersonalizedRecommendations',
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
    // Voice rooms module (community)
    VOICE_ROOMS: process.env.VOICE_ROOMS_TABLE || 'VoiceRooms',
    VOICE_ROOM_PARTICIPANTS: process.env.VOICE_ROOM_PARTICIPANTS_TABLE || 'VoiceRoomParticipants',
    CHAT_MESSAGES: process.env.CHAT_MESSAGES_TABLE || 'ChatMessages',
    WEBSOCKET_CONNECTIONS: process.env.WEBSOCKET_CONNECTIONS_TABLE || 'WebSocketConnections',
    // Health module
    HEALTH_ARTICLES: process.env.HEALTH_ARTICLES_TABLE || 'HealthArticles',
    SYMPTOM_LOGS: process.env.SYMPTOM_LOGS_TABLE || 'SymptomLogs',
    // Open Data module
    EXPORT_AUDIT: process.env.EXPORT_AUDIT_TABLE || 'ExportAudit',
};

module.exports = { dynamoDB, query, TABLE_NAMES, getPostgresPool };
