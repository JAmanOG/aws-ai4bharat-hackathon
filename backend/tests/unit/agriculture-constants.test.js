/**
 * Unit tests for shared constants – agriculture additions
 */

const {
    CROP_TYPES, BUYER_TYPES, LISTING_STATUS, TRADE_ORDER_STATUS,
    PAYMENT_STATUS, LOGISTICS_STATUS, VEHICLE_TYPES, BARGAINING_STATUS,
    QUALITY_GRADES, MARKET_DATA_SOURCES,
} = require('../../utils/constants');

describe('Agriculture Constants', () => {
    test('CROP_TYPES should include major Indian crops', () => {
        expect(CROP_TYPES).toContain('wheat');
        expect(CROP_TYPES).toContain('rice');
        expect(CROP_TYPES).toContain('cotton');
        expect(CROP_TYPES).toContain('sugarcane');
        expect(CROP_TYPES).toContain('tomato');
        expect(CROP_TYPES).toContain('onion');
        expect(CROP_TYPES.length).toBeGreaterThanOrEqual(20);
    });

    test('BUYER_TYPES should include all categories', () => {
        expect(BUYER_TYPES).toEqual(
            expect.arrayContaining(['wholesaler', 'retailer', 'processor', 'exporter', 'FPO'])
        );
    });

    test('LISTING_STATUS should have lifecycle states', () => {
        expect(LISTING_STATUS.ACTIVE).toBe('active');
        expect(LISTING_STATUS.SOLD).toBe('sold');
        expect(LISTING_STATUS.EXPIRED).toBe('expired');
        expect(LISTING_STATUS.CANCELLED).toBe('cancelled');
    });

    test('TRADE_ORDER_STATUS should include complete lifecycle', () => {
        expect(TRADE_ORDER_STATUS.PENDING).toBe('pending');
        expect(TRADE_ORDER_STATUS.ACCEPTED).toBe('accepted');
        expect(TRADE_ORDER_STATUS.IN_TRANSIT).toBe('in_transit');
        expect(TRADE_ORDER_STATUS.DELIVERED).toBe('delivered');
        expect(TRADE_ORDER_STATUS.COMPLETED).toBe('completed');
        expect(TRADE_ORDER_STATUS.DISPUTED).toBe('disputed');
    });

    test('VEHICLE_TYPES should include rural transport options', () => {
        expect(VEHICLE_TYPES).toContain('tractor');
        expect(VEHICLE_TYPES).toContain('truck');
        expect(VEHICLE_TYPES).toContain('tempo');
    });

    test('QUALITY_GRADES should have 3 tiers', () => {
        expect(QUALITY_GRADES).toEqual(['premium', 'standard', 'economy']);
    });

    test('MARKET_DATA_SOURCES should include e-NAM and agmarknet', () => {
        expect(MARKET_DATA_SOURCES).toContain('e-NAM');
        expect(MARKET_DATA_SOURCES).toContain('agmarknet');
    });

    test('BARGAINING_STATUS should have forming through dissolved', () => {
        expect(Object.keys(BARGAINING_STATUS)).toHaveLength(5);
        expect(BARGAINING_STATUS.FORMING).toBe('forming');
        expect(BARGAINING_STATUS.SOLD).toBe('sold');
        expect(BARGAINING_STATUS.DISSOLVED).toBe('dissolved');
    });
});
