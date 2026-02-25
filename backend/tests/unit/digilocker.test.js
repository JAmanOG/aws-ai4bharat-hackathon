/**
 * Unit tests for Peer Grouping – DigiLocker integration
 */

const { startVerification, completeVerification, client: digilockerClient } = require('../../lambdas/peer-grouping/digilocker');

jest.mock('../../utils/db', () => ({
    dynamoDB: { send: jest.fn().mockResolvedValue({}) },
    TABLE_NAMES: {
        USER_LEARNING_PROFILE: 'UserLearningProfile',
        PEER_GROUPS: 'PeerGroups',
        LEARNING_RECOMMENDATIONS: 'LearningRecommendations',
        CONTENT_INTERACTIONS: 'ContentInteractions',
    },
}));

describe('DigiLocker Integration', () => {
    describe('Mock Client', () => {
        test('startVerification should return authorization URL', () => {
            const result = startVerification('user-123');

            expect(result).toHaveProperty('authorization_url');
            expect(result).toHaveProperty('state');
            expect(result).toHaveProperty('provider');
            expect(result.authorization_url).toContain('mock-digilocker');
            expect(result.instructions).toBeTruthy();
        });

        test('completeVerification should verify documents and calculate trust score', async () => {
            const result = await completeVerification('user-123', 'mock-auth-code');

            expect(result).toHaveProperty('userId', 'user-123');
            expect(result).toHaveProperty('verified', true);
            expect(result).toHaveProperty('trustScore');
            expect(result.trustScore).toBeGreaterThan(0);
            expect(result.trustScore).toBeLessThanOrEqual(100);
            expect(result).toHaveProperty('documentsFound');
            expect(result).toHaveProperty('documentsVerified');
            expect(result.documentsVerified).toBeGreaterThan(0);
            expect(result.provider).toBe('mock');
        });

        test('trust score should be based on verified document count', async () => {
            const result = await completeVerification('user-456', 'another-code');

            // Mock returns 3 documents, all verified → score = min(100, 3*25 + 25) = 100
            expect(result.trustScore).toBe(100);
            expect(result.documentsVerified).toBe(3);
        });

        test('mock client should return documents', async () => {
            const docs = await digilockerClient.getDocuments('mock-token');

            expect(docs.documents).toHaveLength(3);
            expect(docs.documents[0]).toHaveProperty('name');
            expect(docs.documents[0]).toHaveProperty('type');
            expect(docs.documents[0]).toHaveProperty('issuer');
        });

        test('mock client should verify credential', async () => {
            const verification = await digilockerClient.verifyCredential('doc-001', 'mock-token');

            expect(verification.verified).toBe(true);
            expect(verification).toHaveProperty('verification_date');
            expect(verification).toHaveProperty('document_integrity', true);
        });
    });
});
