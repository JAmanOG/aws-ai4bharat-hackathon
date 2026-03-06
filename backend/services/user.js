/**
 * User Service – Registration, Profile & Auth
 *
 * Requirement 13: AI Processing and Context Management
 *   - User registration (phone + optional DigiLocker)
 *   - Unified user profile (merges voice memory facts, economic profile, learning profile)
 *   - JWT token generation for authenticated sessions
 *
 * DynamoDB Table: Users
 *   PK: userId (UUID)
 *   GSI: ByPhone (phone → userId)
 *
 * Inspired by pipecat-memory's user identity model.
 */

const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PutCommand, GetCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../utils/db');

const JWT_SECRET = process.env.JWT_SECRET || 'rural-ai-hackathon-secret-2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '30d';
const SALT_ROUNDS = 10;

/* ═══════════════════════════════════════════════════════ */
/*  Registration                                           */
/* ═══════════════════════════════════════════════════════ */

/**
 * Register a new user.
 *
 * @param {object} data
 * @param {string} data.phone       – Phone number (required, unique)
 * @param {string} data.pin         – 4-6 digit PIN (password)
 * @param {string} [data.name]
 * @param {string} [data.language]  – Preferred language code (default: 'hi')
 * @param {string} [data.state]
 * @param {string} [data.district]
 * @param {string} [data.registered_via] – 'app' | 'voice' | 'web'
 * @returns {Promise<{user: object, token: string}>}
 */
async function register(data) {
    const { phone, pin, name, language, state, district, registered_via } = data;

    if (!phone || !pin) {
        throw Object.assign(new Error('Phone and PIN are required'), { status: 400 });
    }

    if (pin.length < 4 || pin.length > 6) {
        throw Object.assign(new Error('PIN must be 4-6 digits'), { status: 400 });
    }

    // Check if phone already registered
    const existing = await findByPhone(phone);
    if (existing) {
        throw Object.assign(new Error('Phone number already registered'), { status: 409 });
    }

    const userId = uuid();
    const now = new Date().toISOString();
    const hashedPin = await bcrypt.hash(pin, SALT_ROUNDS);

    const user = {
        userId,
        phone,
        hashedPin,
        name: name || '',
        preferredLanguage: language || 'hi',
        state: state || '',
        district: district || '',
        registeredVia: registered_via || 'app',
        // DigiLocker verification
        isVerified: false,
        digilockerData: null,
        // Profile flags
        profileComplete: false,
        onboardingDone: false,
        // Stats
        totalSessions: 0,
        totalVoiceInteractions: 0,
        lastActiveAt: now,
        createdAt: now,
        updatedAt: now,
    };

    await dynamoDB.send(new PutCommand({
        TableName: TABLE_NAMES.USERS,
        Item: user,
        ConditionExpression: 'attribute_not_exists(userId)',
    }));

    const token = generateToken(userId, phone);
    const safeUser = sanitizeUser(user);

    return { user: safeUser, token };
}

/* ═══════════════════════════════════════════════════════ */
/*  Login                                                  */
/* ═══════════════════════════════════════════════════════ */

/**
 * Login with phone + PIN.
 *
 * @param {string} phone
 * @param {string} pin
 * @returns {Promise<{user: object, token: string}>}
 */
async function login(phone, pin) {
    if (!phone || !pin) {
        throw Object.assign(new Error('Phone and PIN are required'), { status: 400 });
    }

    const user = await findByPhone(phone);
    if (!user) {
        throw Object.assign(new Error('User not found'), { status: 404 });
    }

    const pinMatch = await bcrypt.compare(pin, user.hashedPin);
    if (!pinMatch) {
        throw Object.assign(new Error('Invalid PIN'), { status: 401 });
    }

    // Update last active
    await dynamoDB.send(new UpdateCommand({
        TableName: TABLE_NAMES.USERS,
        Key: { userId: user.userId },
        UpdateExpression: 'SET lastActiveAt = :now',
        ExpressionAttributeValues: { ':now': new Date().toISOString() },
    }));

    const token = generateToken(user.userId, phone);

    return { user: sanitizeUser(user), token };
}

/* ═══════════════════════════════════════════════════════ */
/*  Profile                                                */
/* ═══════════════════════════════════════════════════════ */

/**
 * Get user by ID.
 */
async function getById(userId) {
    const result = await dynamoDB.send(new GetCommand({
        TableName: TABLE_NAMES.USERS,
        Key: { userId },
    }));
    return result.Item || null;
}

/**
 * Get user profile (sanitized, no hashedPin).
 */
async function getProfile(userId) {
    const user = await getById(userId);
    if (!user) return null;
    return sanitizeUser(user);
}

/**
 * Update user profile fields.
 */
async function updateProfile(userId, updates) {
    const allowedFields = [
        'name', 'preferredLanguage', 'state', 'district',
        'profileComplete', 'onboardingDone',
    ];

    const updateParts = [];
    const exprValues = { ':now': new Date().toISOString() };
    const exprNames = {};

    // DynamoDB reserved keywords that need ExpressionAttributeNames
    const reservedWords = new Set(['name', 'state', 'district', 'status', 'language']);

    for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key) && value !== undefined) {
            const attr = `:${key}`;
            const placeholder = `#${key}`;
            if (reservedWords.has(key)) {
                updateParts.push(`${placeholder} = ${attr}`);
                exprNames[placeholder] = key;
            } else {
                updateParts.push(`${key} = ${attr}`);
            }
            exprValues[attr] = value;
        }
    }

    if (updateParts.length === 0) {
        return getProfile(userId);
    }

    updateParts.push('updatedAt = :now');

    await dynamoDB.send(new UpdateCommand({
        TableName: TABLE_NAMES.USERS,
        Key: { userId },
        UpdateExpression: 'SET ' + updateParts.join(', '),
        ExpressionAttributeValues: exprValues,
        ...(Object.keys(exprNames).length > 0 ? { ExpressionAttributeNames: exprNames } : {}),
    }));

    return getProfile(userId);
}

/**
 * Get unified profile — merges User record + voice memory facts.
 * This is the "AI context-aware" profile that combines all data sources.
 */
async function getUnifiedProfile(userId) {
    const memory = require('./memory');

    const [user, facts] = await Promise.all([
        getProfile(userId),
        memory.getUserFacts(userId),
    ]);

    if (!user) return null;

    // Merge memory facts into profile
    return {
        ...user,
        memoryFacts: facts,
        // Convenience fields from memory
        crops: facts.crops || null,
        landSize: facts.land_size_acres || null,
        farmingExperience: facts.farming_experience_years || null,
        livestock: facts.livestock || null,
        irrigationType: facts.irrigation_type || null,
        phoneType: facts.phone_type || null,
        // Merge name from voice if not set in profile
        name: user.name || facts.user_name || '',
        state: user.state || facts.location_state || '',
        district: user.district || facts.location_district || '',
    };
}

/**
 * Increment user interaction counters (fire-and-forget).
 */
async function trackInteraction(userId, type = 'voice') {
    try {
        const counterAttr = type === 'voice' ? 'totalVoiceInteractions' : 'totalSessions';
        await dynamoDB.send(new UpdateCommand({
            TableName: TABLE_NAMES.USERS,
            Key: { userId },
            UpdateExpression: `SET ${counterAttr} = if_not_exists(${counterAttr}, :zero) + :one, lastActiveAt = :now`,
            ExpressionAttributeValues: {
                ':zero': 0,
                ':one': 1,
                ':now': new Date().toISOString(),
            },
        }));
    } catch (err) {
        console.warn(`[User] Failed to track interaction: ${err.message}`);
    }
}

/* ═══════════════════════════════════════════════════════ */
/*  DigiLocker Verification                                */
/* ═══════════════════════════════════════════════════════ */

/**
 * Store DigiLocker verification result.
 */
async function setDigilockerVerified(userId, digilockerData) {
    await dynamoDB.send(new UpdateCommand({
        TableName: TABLE_NAMES.USERS,
        Key: { userId },
        UpdateExpression: 'SET isVerified = :v, digilockerData = :d, updatedAt = :now',
        ExpressionAttributeValues: {
            ':v': true,
            ':d': {
                aadhaarName: digilockerData.name || '',
                documentTypes: digilockerData.documentTypes || [],
                verifiedAt: new Date().toISOString(),
                provider: 'digilocker',
            },
            ':now': new Date().toISOString(),
        },
    }));
}

/* ═══════════════════════════════════════════════════════ */
/*  Helpers                                                */
/* ═══════════════════════════════════════════════════════ */

/**
 * Find user by phone number (GSI lookup).
 */
async function findByPhone(phone) {
    const result = await dynamoDB.send(new QueryCommand({
        TableName: TABLE_NAMES.USERS,
        IndexName: 'ByPhone',
        KeyConditionExpression: 'phone = :ph',
        ExpressionAttributeValues: { ':ph': phone },
        Limit: 1,
    }));
    return result.Items?.[0] || null;
}

/**
 * Generate JWT token.
 */
function generateToken(userId, phone) {
    return jwt.sign(
        { sub: userId, phone, iat: Math.floor(Date.now() / 1000) },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN },
    );
}

/**
 * Verify JWT token and return payload.
 */
function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

/**
 * Remove sensitive fields from user object.
 */
function sanitizeUser(user) {
    const { hashedPin, ...safe } = user;
    return safe;
}

module.exports = {
    register,
    login,
    getById,
    getProfile,
    updateProfile,
    getUnifiedProfile,
    trackInteraction,
    setDigilockerVerified,
    findByPhone,
    verifyToken,
    generateToken,
};
