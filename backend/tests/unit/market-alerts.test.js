/**
 * Unit tests for Market Data – alerts.js
 */

jest.mock('../../utils/db', () => ({
    query: jest.fn(),
    dynamoDB: { send: jest.fn().mockResolvedValue({ Items: [] }) },
    TABLE_NAMES: {
        USER_LEARNING_PROFILE: 'UserLearningProfile', PEER_GROUPS: 'PeerGroups',
        LEARNING_RECOMMENDATIONS: 'LearningRecommendations', CONTENT_INTERACTIONS: 'ContentInteractions',
        FARMER_PROFILES: 'FarmerProfiles', PRICE_ALERTS: 'PriceAlerts', PRICE_WATCH: 'PriceWatch',
    },
}));

jest.mock('@aws-sdk/client-sns', () => ({
    SNSClient: jest.fn().mockImplementation(() => ({ send: jest.fn().mockResolvedValue({}) })),
    PublishCommand: jest.fn(),
}));

const { dynamoDB } = require('../../utils/db');
const { subscribePriceAlert, getUserAlerts, deleteAlert, dispatchPriceAlerts } = require('../../lambdas/market-data/alerts');

describe('Price Alerts', () => {
    beforeEach(() => jest.clearAllMocks());

    test('subscribePriceAlert should create alert subscription', async () => {
        dynamoDB.send.mockResolvedValueOnce({});

        const result = await subscribePriceAlert('user-1', {
            crop_type: 'wheat', state: 'MP', threshold_percent: 10,
        });

        expect(result.userId).toBe('user-1');
        expect(result.crop_type).toBe('wheat');
        expect(result.state).toBe('MP');
        expect(result.threshold_percent).toBe(10);
        expect(result.is_active).toBe(true);
        expect(result.alertId).toBeTruthy();
        expect(dynamoDB.send).toHaveBeenCalledTimes(1);
    });

    test('subscribePriceAlert should default threshold to 10%', async () => {
        dynamoDB.send.mockResolvedValueOnce({});

        const result = await subscribePriceAlert('user-2', { crop_type: 'rice' });
        expect(result.threshold_percent).toBe(10);
        expect(result.state).toBe('all');
    });

    test('getUserAlerts should query by userId', async () => {
        dynamoDB.send.mockResolvedValueOnce({
            Items: [
                { userId: 'user-1', alertId: 'a1', crop_type: 'wheat' },
                { userId: 'user-1', alertId: 'a2', crop_type: 'rice' },
            ],
        });

        const result = await getUserAlerts('user-1');
        expect(result).toHaveLength(2);
    });

    test('deleteAlert should remove subscription', async () => {
        dynamoDB.send.mockResolvedValueOnce({});

        const result = await deleteAlert('user-1', 'alert-id');
        expect(result.deleted).toBe(true);
    });

    test('dispatchPriceAlerts should return 0 sent for empty changes', async () => {
        const result = await dispatchPriceAlerts([]);
        expect(result.sent).toBe(0);
    });

    test('dispatchPriceAlerts should match alerts to price changes', async () => {
        dynamoDB.send.mockResolvedValueOnce({
            Items: [
                { userId: 'u1', crop_type: 'wheat', state: 'all', threshold_percent: 5, is_active: true },
                { userId: 'u2', crop_type: 'rice', state: 'Haryana', threshold_percent: 10, is_active: true },
            ],
        });

        const changes = [
            { crop_type: 'wheat', mandi_name: 'Indore', state: 'MP', change_percent: '12.5', direction: 'up', modal_price: 2500, prev_price: 2222 },
        ];

        const result = await dispatchPriceAlerts(changes);
        // u1 subscribed to wheat (state=all, threshold 5%) should match
        expect(result.sent).toBe(1);
        expect(result.total_changes).toBe(1);
    });
});
