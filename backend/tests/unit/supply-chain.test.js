/**
 * Unit tests for Supply Chain API – listings and buyers
 */

jest.mock('../../utils/db', () => ({
    query: jest.fn(),
    dynamoDB: { send: jest.fn() },
    TABLE_NAMES: {
        USER_LEARNING_PROFILE: 'UserLearningProfile', PEER_GROUPS: 'PeerGroups',
        LEARNING_RECOMMENDATIONS: 'LearningRecommendations', CONTENT_INTERACTIONS: 'ContentInteractions',
        FARMER_PROFILES: 'FarmerProfiles', PRICE_ALERTS: 'PriceAlerts', PRICE_WATCH: 'PriceWatch',
    },
}));

const { query } = require('../../utils/db');
const { createListing, searchListings, getListingById, getFarmerListings } = require('../../lambdas/supply-chain-api/listings');
const { registerBuyer, searchBuyers, getBuyerById, createTradeOrder } = require('../../lambdas/supply-chain-api/buyers');

describe('Supply Chain – Listings', () => {
    beforeEach(() => jest.clearAllMocks());

    test('createListing should insert and return listing', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'l1', farmer_id: 'f1', crop_type: 'wheat', quantity_kg: 500 }],
        });

        const result = await createListing('f1', {
            crop_type: 'wheat', quantity_kg: 500, price_per_kg: 24,
            location_state: 'MP', location_district: 'Indore',
        });

        expect(result.id).toBe('l1');
        expect(result.crop_type).toBe('wheat');
        expect(query).toHaveBeenCalledTimes(1);
    });

    test('searchListings should return paginated results', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ total: '10' }] })
            .mockResolvedValueOnce({
                rows: [
                    { id: 'l1', crop_type: 'wheat', quantity_kg: 500 },
                    { id: 'l2', crop_type: 'wheat', quantity_kg: 800 },
                ],
            });

        const result = await searchListings({ crop_type: 'wheat', page: 1, limit: 20 });

        expect(result.listings).toHaveLength(2);
        expect(result.pagination.total).toBe(10);
        expect(result.pagination.page).toBe(1);
    });

    test('getListingById should return listing with matching buyers', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ id: 'l1', crop_type: 'wheat', farmer_id: 'f1' }] })
            .mockResolvedValueOnce({ rows: [{ id: 'b1', business_name: 'Agro Traders' }] })
            .mockResolvedValueOnce({ rows: [] });

        const result = await getListingById('l1');

        expect(result).toBeTruthy();
        expect(result.matching_buyers).toHaveLength(1);
        expect(result.matching_buyers[0].business_name).toBe('Agro Traders');
    });

    test('getListingById should return null for missing listing', async () => {
        query.mockResolvedValueOnce({ rows: [] });
        const result = await getListingById('nonexistent');
        expect(result).toBeNull();
    });

    test('getFarmerListings should return farmer listings', async () => {
        query.mockResolvedValueOnce({
            rows: [{ id: 'l1' }, { id: 'l2' }],
        });

        const result = await getFarmerListings('f1');
        expect(result).toHaveLength(2);
    });
});

describe('Supply Chain – Buyers', () => {
    beforeEach(() => jest.clearAllMocks());

    test('registerBuyer should insert new buyer', async () => {
        query
            .mockResolvedValueOnce({ rows: [] }) // no existing
            .mockResolvedValueOnce({
                rows: [{ id: 'b1', business_name: 'Test Buyer', business_type: 'wholesaler' }],
            });

        const result = await registerBuyer('u1', { business_name: 'Test Buyer' });
        expect(result.business_name).toBe('Test Buyer');
    });

    test('registerBuyer should throw for duplicate registration', async () => {
        query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });

        await expect(registerBuyer('u1', { business_name: 'Dup' }))
            .rejects.toThrow('BUYER_ALREADY_REGISTERED');
    });

    test('searchBuyers should filter and paginate', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ total: '3' }] })
            .mockResolvedValueOnce({
                rows: [{ id: 'b1', business_name: 'Buyer 1', trust_score: 90 }],
            });

        const result = await searchBuyers({ crop_type: 'wheat', verified_only: true });
        expect(result.buyers).toHaveLength(1);
        expect(result.pagination.total).toBe(3);
    });

    test('createTradeOrder should validate listing exists', async () => {
        query.mockResolvedValueOnce({ rows: [] }); // no active listing

        await expect(createTradeOrder('l1', 'b1', {
            quantity_kg: 100, agreed_price_per_kg: 25, notes: 'test',
        })).rejects.toThrow('LISTING_NOT_AVAILABLE');
    });

    test('createTradeOrder should calculate total amount', async () => {
        query
            .mockResolvedValueOnce({ rows: [{ id: 'l1', farmer_id: 'f1' }] }) // listing exists
            .mockResolvedValueOnce({
                rows: [{ id: 'o1', quantity_kg: 100, agreed_price_per_kg: 25, total_amount: 2500 }],
            });

        const result = await createTradeOrder('l1', 'b1', {
            quantity_kg: 100, agreed_price_per_kg: 25,
        });

        expect(result.total_amount).toBe(2500);
    });
});
