/**
 * Peer Grouping Lambda – digilocker.js
 * DigiLocker integration for peer credential verification.
 * Satisfies Requirement 7.3: Peer credential verification through DigiLocker.
 *
 * Supports both REAL DigiLocker sandbox and MOCK implementations.
 */

const axios = require('axios');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { UpdateCommand } = require('@aws-sdk/lib-dynamodb');

// Configuration
const USE_MOCK = process.env.DIGILOCKER_USE_MOCK === 'true' || process.env.DIGILOCKER_USE_MOCK === undefined;
const DIGILOCKER_BASE_URL = process.env.DIGILOCKER_BASE_URL || 'https://api.digitallocker.gov.in';
const DIGILOCKER_CLIENT_ID = process.env.DIGILOCKER_CLIENT_ID || '';
const DIGILOCKER_CLIENT_SECRET = process.env.DIGILOCKER_CLIENT_SECRET || '';
const DIGILOCKER_REDIRECT_URI = process.env.DIGILOCKER_REDIRECT_URI || '';

// ══════════════════════════════════════════════
//  MOCK DigiLocker Client
// ══════════════════════════════════════════════

const mockClient = {
    /**
     * Generate a mock authorization URL.
     */
    getAuthorizationUrl(userId) {
        return {
            url: `https://mock-digilocker.example.com/authorize?client_id=mock&user=${userId}`,
            state: `mock-state-${userId}-${Date.now()}`,
        };
    },

    /**
     * Simulate token exchange from auth code.
     */
    async exchangeAuthCode(code) {
        return {
            access_token: `mock-access-token-${Date.now()}`,
            token_type: 'Bearer',
            expires_in: 3600,
            digilockerid: `mock-dl-${code}`,
        };
    },

    /**
     * Get mock user's documents.
     */
    async getDocuments(accessToken) {
        return {
            documents: [
                {
                    id: 'mock-doc-001',
                    name: 'Class 10 Certificate',
                    type: 'CBSE',
                    issuer: 'Central Board of Secondary Education',
                    issued_date: '2015-05-15',
                },
                {
                    id: 'mock-doc-002',
                    name: 'Skill Certificate - Organic Farming',
                    type: 'SKILL_CERT',
                    issuer: 'PMKVY',
                    issued_date: '2023-08-20',
                },
                {
                    id: 'mock-doc-003',
                    name: 'Aadhaar Card',
                    type: 'AADHAAR',
                    issuer: 'UIDAI',
                    issued_date: '2020-01-01',
                },
            ],
        };
    },

    /**
     * Verify a mock credential.
     */
    async verifyCredential(documentId, accessToken) {
        return {
            verified: true,
            document_id: documentId,
            verification_date: new Date().toISOString(),
            issuer_verified: true,
            document_integrity: true,
        };
    },
};

// ══════════════════════════════════════════════
//  REAL DigiLocker Client (Sandbox)
// ══════════════════════════════════════════════

const realClient = {
    /**
     * Generate DigiLocker OAuth2 authorization URL.
     */
    getAuthorizationUrl(userId) {
        const state = `real-state-${userId}-${Date.now()}`;
        const url = `${DIGILOCKER_BASE_URL}/public/oauth2/1/authorize`
            + `?response_type=code`
            + `&client_id=${encodeURIComponent(DIGILOCKER_CLIENT_ID)}`
            + `&redirect_uri=${encodeURIComponent(DIGILOCKER_REDIRECT_URI)}`
            + `&state=${encodeURIComponent(state)}`;
        return { url, state };
    },

    /**
     * Exchange authorization code for access token.
     */
    async exchangeAuthCode(code) {
        const response = await axios.post(`${DIGILOCKER_BASE_URL}/public/oauth2/1/token`, null, {
            params: {
                code,
                grant_type: 'authorization_code',
                client_id: DIGILOCKER_CLIENT_ID,
                client_secret: DIGILOCKER_CLIENT_SECRET,
                redirect_uri: DIGILOCKER_REDIRECT_URI,
            },
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        });
        return response.data;
    },

    /**
     * Fetch user's documents from DigiLocker.
     */
    async getDocuments(accessToken) {
        const response = await axios.get(`${DIGILOCKER_BASE_URL}/public/oauth2/2/files/issued`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return response.data;
    },

    /**
     * Verify a specific document/credential.
     */
    async verifyCredential(documentId, accessToken) {
        const response = await axios.get(`${DIGILOCKER_BASE_URL}/public/oauth2/2/file/${documentId}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
        });
        return {
            verified: response.status === 200,
            document_id: documentId,
            verification_date: new Date().toISOString(),
            data: response.data,
        };
    },
};

// ══════════════════════════════════════════════
//  Unified DigiLocker Service
// ══════════════════════════════════════════════

const client = USE_MOCK ? mockClient : realClient;

/**
 * Start the DigiLocker verification flow for a user.
 * Returns an authorization URL the user should be redirected to.
 */
function startVerification(userId) {
    const { url, state } = client.getAuthorizationUrl(userId);
    return {
        authorization_url: url,
        state,
        provider: USE_MOCK ? 'mock' : 'digilocker',
        instructions: 'Redirect the user to this URL to authorize DigiLocker access.',
    };
}

/**
 * Complete the verification flow after user authorizes.
 * Verifies credentials and updates the user's trust score.
 */
async function completeVerification(userId, authCode) {
    // Exchange code for token
    const tokenData = await client.exchangeAuthCode(authCode);

    // Fetch user's documents
    const docsData = await client.getDocuments(tokenData.access_token);
    const documents = docsData.documents || [];

    // Verify each document
    const verifications = [];
    for (const doc of documents) {
        try {
            const verification = await client.verifyCredential(doc.id || doc.uri, tokenData.access_token);
            verifications.push({ ...doc, verification });
        } catch (err) {
            verifications.push({ ...doc, verification: { verified: false, error: err.message } });
        }
    }

    const verifiedCount = verifications.filter(v => v.verification?.verified).length;
    const trustScore = Math.min(100, verifiedCount * 25 + 25); // Base 25 + 25 per verified doc

    // Update user's learning profile with verification status
    await dynamoDB.send(new UpdateCommand({
        TableName: TABLE_NAMES.USER_LEARNING_PROFILE,
        Key: { userId },
        UpdateExpression: 'SET trustScore = :ts, isVerified = :iv, verificationDetails = :vd, updatedAt = :now',
        ExpressionAttributeValues: {
            ':ts': trustScore,
            ':iv': verifiedCount > 0,
            ':vd': {
                provider: USE_MOCK ? 'mock-digilocker' : 'digilocker',
                verifiedAt: new Date().toISOString(),
                documentTypes: verifications.filter(v => v.verification?.verified).map(v => v.type || v.name),
                totalDocuments: documents.length,
                verifiedDocuments: verifiedCount,
            },
            ':now': new Date().toISOString(),
        },
    }));

    return {
        userId,
        verified: verifiedCount > 0,
        trustScore,
        documentsFound: documents.length,
        documentsVerified: verifiedCount,
        verifications: verifications.map(v => ({
            name: v.name,
            type: v.type,
            issuer: v.issuer,
            verified: v.verification?.verified || false,
        })),
        provider: USE_MOCK ? 'mock' : 'digilocker',
    };
}

module.exports = { startVerification, completeVerification, client };
