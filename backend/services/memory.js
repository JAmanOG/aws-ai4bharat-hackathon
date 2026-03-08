/**
 * Voice Conversation Memory – inspired by pipecat-memory / Supermemory.
 *
 * Two DynamoDB tables:
 *   VoiceConversations  – stores every turn (user + assistant)
 *   UserMemoryFacts     – extracted user facts (name, location, crops, etc.)
 *
 * Pattern (like pipecat-memory mode="full"):
 *   1. Store each turn
 *   2. After assistant reply, extract user facts via LLM
 *   3. Before each LLM call, build context from recent history + facts
 */

const { v4: uuid } = require('uuid');
const { PutCommand, QueryCommand, UpdateCommand, DeleteCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../utils/db');
const { generateResponse } = require('./llm');
const { APP_NAME, APP_CONTEXT } = require('./brand');

const CONVERSATIONS_TABLE = TABLE_NAMES.VOICE_CONVERSATIONS;
const FACTS_TABLE = TABLE_NAMES.USER_MEMORY_FACTS;

const MAX_HISTORY_TURNS = 20;
const MAX_FACTS = 30;

/* ═══════════════════════════════════════════════════════ */
/*  Conversation Storage                                   */
/* ═══════════════════════════════════════════════════════ */

/**
 * Store a single conversation turn.
 */
async function storeTurn(userId, sessionId, role, text, metadata = {}) {
    const timestamp = new Date().toISOString();
    const turnId = `${sessionId}#${timestamp}#${uuid().slice(0, 8)}`;
    const entities = metadata.entities && typeof metadata.entities === 'object'
        ? metadata.entities
        : null;

    await dynamoDB.send(new PutCommand({
        TableName: CONVERSATIONS_TABLE,
        Item: {
            userId,
            turnId,
            sessionId,
            role,
            text,
            language: metadata.language || 'unknown',
            intentDomain: metadata.intentDomain || '',
            responseTimeMs: metadata.responseTimeMs || 0,
            audioKey: metadata.audioKey || '',
            createdAt: timestamp,
            ttl: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30-day TTL
            ...(metadata.intent ? { intent: metadata.intent } : {}),
            ...(entities && Object.keys(entities).length > 0 ? { entities } : {}),
            ...(metadata.followUp ? { followUp: metadata.followUp } : {}),
            ...(metadata.provider ? { provider: metadata.provider } : {}),
        },
    }));

    return { turnId, timestamp };
}

/**
 * Fetch recent conversation history for a session.
 */
async function getSessionHistory(userId, sessionId, limit = MAX_HISTORY_TURNS) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: CONVERSATIONS_TABLE,
        KeyConditionExpression: 'userId = :uid AND begins_with(turnId, :sid)',
        ExpressionAttributeValues: {
            ':uid': userId,
            ':sid': `${sessionId}#`,
        },
        ScanIndexForward: false, // fetch latest turns first
        Limit: limit,
    }));

    return (result.Items || [])
        .slice()
        .reverse()
        .map(item => ({
        role: item.role,
        text: item.text,
        language: item.language,
        timestamp: item.createdAt,
        intentDomain: item.intentDomain,
        intent: item.intent || '',
        entities: item.entities || {},
        followUp: item.followUp || null,
        provider: item.provider || '',
    }));
}

/**
 * Get all sessions for a user (most recent first).
 */
async function getUserSessions(userId, limit = 10) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: CONVERSATIONS_TABLE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        ScanIndexForward: false,
        Limit: limit * 5, // Over-fetch to get unique sessions
        ProjectionExpression: 'sessionId, createdAt, #r, #t',
        ExpressionAttributeNames: { '#r': 'role', '#t': 'text' },
    }));

    // Group by session, take first message of each
    const sessions = new Map();
    for (const item of (result.Items || [])) {
        if (!sessions.has(item.sessionId)) {
            sessions.set(item.sessionId, {
                sessionId: item.sessionId,
                firstMessage: item.text?.slice(0, 100),
                lastActivity: item.createdAt,
                turnCount: 1,
            });
        } else {
            sessions.get(item.sessionId).turnCount++;
            if (item.createdAt > sessions.get(item.sessionId).lastActivity) {
                sessions.get(item.sessionId).lastActivity = item.createdAt;
            }
        }
    }

    return [...sessions.values()]
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity))
        .slice(0, limit);
}

/* ═══════════════════════════════════════════════════════ */
/*  User Memory Facts                                      */
/* ═══════════════════════════════════════════════════════ */

/**
 * Upsert a user fact.
 */
async function upsertFact(userId, factKey, factValue, source = 'conversation') {
    await dynamoDB.send(new PutCommand({
        TableName: FACTS_TABLE,
        Item: {
            userId,
            factKey,
            factValue,
            source,
            confidence: 1.0,
            extractedAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60), // 1-year TTL
        },
    }));
}

/**
 * Get all facts for a user.
 */
async function getUserFacts(userId) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: FACTS_TABLE,
        KeyConditionExpression: 'userId = :uid',
        ExpressionAttributeValues: { ':uid': userId },
        Limit: MAX_FACTS,
    }));

    return (result.Items || []).reduce((acc, item) => {
        acc[item.factKey] = item.factValue;
        return acc;
    }, {});
}

/**
 * Delete a specific fact.
 */
async function deleteFact(userId, factKey) {
    await dynamoDB.send(new DeleteCommand({
        TableName: FACTS_TABLE,
        Key: { userId, factKey },
    }));
}

/* ═══════════════════════════════════════════════════════ */
/*  Fact Extraction (LLM-powered)                          */
/* ═══════════════════════════════════════════════════════ */

const FACT_EXTRACTION_PROMPT = `You are a fact extractor for ${APP_NAME}. ${APP_CONTEXT} From the conversation below, extract any NEW user facts.

Return ONLY a JSON object with extracted facts. Use these keys:
- user_name: User's name
- location_state: User's state
- location_district: User's district/village
- primary_language: User's preferred language
- crops: Comma-separated crops they grow
- land_size_acres: Land size
- livestock: Animals they have
- family_size: Family members
- income_source: Main income sources
- education_level: Education level
- phone_type: Type of phone (smartphone/feature phone)
- irrigation_type: Irrigation method
- farming_experience_years: Years of farming

Only include keys where you found NEW information. Return {} if no new facts found.
Return ONLY valid JSON, no markdown, no explanation.`;

/**
 * Extract facts from a conversation snippet using LLM.
 */
async function extractFacts(conversationSnippet) {
    try {
        const result = await generateResponse([
            { role: 'system', content: FACT_EXTRACTION_PROMPT },
            { role: 'user', content: `Conversation:\n${conversationSnippet}` },
        ], {
            temperature: 0.1,
            maxTokens: 512,
        });

        // Parse JSON from response
        const jsonStr = extractJsonObject(result.content);
        const facts = JSON.parse(jsonStr);

        // Filter out empty values
        const validFacts = {};
        for (const [key, value] of Object.entries(facts)) {
            if (value && String(value).trim() && value !== 'unknown' && value !== 'null') {
                validFacts[key] = String(value).trim();
            }
        }
        return validFacts;
    } catch (err) {
        console.warn('[Memory] Fact extraction failed:', err.message);
        return {};
    }
}

function extractJsonObject(raw = '') {
    const cleaned = String(raw || '')
        .replace(/<think>[\s\S]*?<\/think>/gi, '')
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
        return cleaned.slice(start, end + 1);
    }

    return cleaned;
}

/**
 * Extract and store facts after a conversation exchange.
 * Run this asynchronously — don't block the response.
 */
async function extractAndStoreFacts(userId, userText, assistantText) {
    const snippet = `User: ${userText}\nAssistant: ${assistantText}`;
    const facts = await extractFacts(snippet);

    const promises = Object.entries(facts).map(([key, value]) =>
        upsertFact(userId, key, value, 'conversation')
    );

    if (promises.length > 0) {
        await Promise.allSettled(promises);
        console.log(`[Memory] Extracted ${promises.length} facts for ${userId}`);
    }
}

/* ═══════════════════════════════════════════════════════ */
/*  Context Builder (inject memory into system prompt)     */
/* ═══════════════════════════════════════════════════════ */

const SYSTEM_PROMPT = `You are the helpful voice assistant inside ${APP_NAME}. ${APP_CONTEXT}
Keep responses brief (1-3 sentences) since your output will be spoken aloud via TTS.
Be warm, respectful, and use simple language. If the user speaks Hindi or another Indian language, respond in the same language.
Do not use special characters, markdown, or emojis — your response must be plain spoken text.
When you know the user's name, use it naturally in conversation.
If the user asks the app name or platform name, answer that the app is called ${APP_NAME}.

{memory_context}`;

/**
 * Build the full message array with memory context injected.
 */
async function buildContextMessages(userId, sessionId, userText) {
    // 1. Fetch user facts
    const facts = await getUserFacts(userId);

    // 2. Fetch recent conversation history
    const history = await getSessionHistory(userId, sessionId, MAX_HISTORY_TURNS);

    // 3. Build memory context block
    let memoryBlock = '';

    if (Object.keys(facts).length > 0) {
        memoryBlock += '\n--- User Profile (from past conversations) ---\n';
        for (const [key, value] of Object.entries(facts)) {
            const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            memoryBlock += `${label}: ${value}\n`;
        }
    }

    // 4. Build system prompt with injected memory
    const systemPrompt = SYSTEM_PROMPT.replace('{memory_context}', memoryBlock);

    // 5. Assemble messages: system + history + current user message
    const messages = [{ role: 'system', content: systemPrompt }];

    for (const turn of history) {
        messages.push({
            role: turn.role === 'user' ? 'user' : 'assistant',
            content: turn.text,
        });
    }

    messages.push({ role: 'user', content: userText });

    return messages;
}

module.exports = {
    storeTurn,
    getSessionHistory,
    getUserSessions,
    upsertFact,
    getUserFacts,
    deleteFact,
    extractFacts,
    extractAndStoreFacts,
    buildContextMessages,
    extractJsonObject,
    // Expose table names for provisioning
    CONVERSATIONS_TABLE,
    FACTS_TABLE,
};
