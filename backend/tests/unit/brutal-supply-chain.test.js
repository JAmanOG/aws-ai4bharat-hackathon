/**
 * BRUTAL TEST SUITE – Requirement 5: Agriculture Supply Chain
 * Tests: listings, buyers, transport, market prices, alerts, collective bargaining
 * Pushes every function to edge cases, error paths, and boundary conditions.
 */

/* ────────────────────── mocks ────────────────────── */
jest.mock('../../utils/db', () => ({
  query: jest.fn(),
  dynamoDB: { send: jest.fn() },
  TABLE_NAMES: {
    CONTENT_INTERACTIONS: 'ContentInteractions',
    ECONOMIC_PROFILES: 'EconomicProfiles',
    PEER_GROUPS: 'PeerGroups',
    USER_LEARNING_PROFILE: 'UserLearningProfile',
    PRICE_ALERTS: 'PriceAlerts',
  },
}));

jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: jest.fn() })),
  InvokeModelCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/lib-dynamodb', () => ({
  PutCommand: jest.fn((p) => p),
  QueryCommand: jest.fn((p) => p),
  DeleteCommand: jest.fn((p) => p),
  ScanCommand: jest.fn((p) => p),
}));

jest.mock('@aws-sdk/client-sns', () => ({
  SNSClient: jest.fn(() => ({ send: jest.fn() })),
  PublishCommand: jest.fn((p) => p),
}));

jest.mock('uuid', () => ({ v4: () => 'test-uuid-alert' }));

const { query, dynamoDB } = require('../../utils/db');
const listings = require('../../lambdas/supply-chain-api/listings');
const buyers = require('../../lambdas/supply-chain-api/buyers');
const transport = require('../../lambdas/logistics/transport');
const prices = require('../../lambdas/market-data/prices');
const alerts = require('../../lambdas/market-data/alerts');
const bargaining = require('../../lambdas/logistics/collective-bargaining');

beforeEach(() => jest.clearAllMocks());

/* ═══════════════════════════════════════════════════
   SECTION A — LISTINGS (supply-chain-api/listings.js)
   ═══════════════════════════════════════════════════ */
describe('Listings – createListing', () => {
  test('inserts full row with all fields', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, farmer_id: 'f1', crop_type: 'wheat' }] });
    const result = await listings.createListing('f1', {
      crop_type: 'wheat', variety: 'sharbati', quantity_kg: 500,
      price_per_kg: 25, quality_grade: 'premium',
      harvest_date: '2025-03-01', available_from: '2025-03-05', available_until: '2025-04-05',
      location_state: 'MP', location_district: 'Sehore', location_pincode: '466001',
      location_lat: 23.2, location_lng: 77.08, description: 'Fresh wheat',
      images_s3_keys: ['img/w1.jpg'],
    });
    expect(result.id).toBe(1);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('INSERT INTO produce_listings');
    expect(params).toContain('f1');
    expect(params).toContain('wheat');
    expect(params).toContain('premium');
  });

  test('defaults quality_grade to standard and images to []', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
    await listings.createListing('f2', { crop_type: 'rice', quantity_kg: 100, price_per_kg: 30 });
    const params = query.mock.calls[0][1];
    expect(params).toContain('standard');
    expect(params[params.length - 1]).toEqual([]);
  });

  test('propagates DB error', async () => {
    query.mockRejectedValueOnce(new Error('UNIQUE_VIOLATION'));
    await expect(listings.createListing('f3', { crop_type: 'corn' })).rejects.toThrow('UNIQUE_VIOLATION');
  });
});

describe('Listings – searchListings', () => {
  test('returns paginated results with no filters', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const result = await listings.searchListings();
    expect(result.pagination.total).toBe(5);
    expect(result.listings).toHaveLength(2);
  });

  test('applies all filters correctly', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '1' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 99 }] });
    const result = await listings.searchListings({
      crop_type: 'wheat', state: 'MP', district: 'Sehore',
      quality_grade: 'premium', min_qty: 100, max_price: 30,
      page: 2, limit: 5,
    });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('crop_type');
    expect(sql).toContain('location_state');
    expect(sql).toContain('location_district');
    expect(sql).toContain('quality_grade');
    expect(sql).toContain('quantity_kg');
    expect(sql).toContain('price_per_kg');
    expect(result.pagination.page).toBe(2);
    expect(result.pagination.limit).toBe(5);
  });

  test('page 1 has offset 0', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    await listings.searchListings({ page: 1, limit: 10 });
    const params = query.mock.calls[1][1];
    expect(params[params.length - 1]).toBe(0);
  });

  test('calculates totalPages correctly', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '53' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const result = await listings.searchListings({ limit: 20 });
    expect(result.pagination.totalPages).toBe(3);
  });

  test('empty result set', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const result = await listings.searchListings({ crop_type: 'unicorn' });
    expect(result.listings).toEqual([]);
    expect(result.pagination.total).toBe(0);
  });
});

describe('Listings – getListingById', () => {
  test('returns null when listing not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await listings.getListingById(9999)).toBeNull();
  });

  test('returns listing with matching buyers and orders', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, crop_type: 'wheat' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'b1', business_name: 'AgriBuyer' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'o1' }] });
    const result = await listings.getListingById(1);
    expect(result).toBeDefined();
    expect(result.matching_buyers).toBeDefined();
  });
});

describe('Listings – getFarmerListings', () => {
  test('retrieves all listings for farmer with status filter', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });
    const result = await listings.getFarmerListings('f1', 'active');
    expect(result).toHaveLength(2);
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('farmer_id');
  });
});

describe('Listings – updateListingStatus', () => {
  test('updates status to sold', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1, status: 'sold' }] });
    const result = await listings.updateListingStatus(1, 'sold');
    expect(result.status).toBe('sold');
  });

  test('returns null if listing does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await listings.updateListingStatus(999, 'sold');
    expect(result).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════
   SECTION B — BUYERS (supply-chain-api/buyers.js)
   registerBuyer(userId, data), searchBuyers(filters),
   createTradeOrder(listingId, buyerId, data),
   updateTradeOrder(orderId, userId, updates), getOrders(userId, role, status)
   ═══════════════════════════════════════════════════ */
describe('Buyers – registerBuyer', () => {
  test('inserts new buyer with all fields', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // no duplicate
    query.mockResolvedValueOnce({ rows: [{ id: 'b1', business_name: 'FarmCo' }] });
    const result = await buyers.registerBuyer('user1', {
      business_name: 'FarmCo', business_type: 'processor',
      contact_phone: '9876543210', contact_email: 'info@farmco.com',
      crops_interested: ['wheat', 'rice'], location_state: 'MP',
      location_district: 'Indore',
    });
    expect(result.business_name).toBe('FarmCo');
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('throws BUYER_ALREADY_REGISTERED on duplicate', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'b-existing' }] });
    await expect(buyers.registerBuyer('user1', { contact_phone: '9999999999' })).rejects.toThrow('BUYER_ALREADY_REGISTERED');
  });

  test('defaults business_type to wholesaler', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [{ id: 'b2' }] });
    await buyers.registerBuyer('user2', { business_name: 'Test' });
    const insertParams = query.mock.calls[1][1];
    expect(insertParams).toContain('wholesaler');
  });
});

describe('Buyers – searchBuyers', () => {
  test('returns paginated buyer list', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '3' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'b1' }, { id: 'b2' }] });
    const result = await buyers.searchBuyers({ crop_type: 'wheat' });
    expect(result.buyers).toHaveLength(2);
    expect(result.pagination.total).toBe(3);
  });

  test('applies all filter types', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    await buyers.searchBuyers({ crop_type: 'rice', state: 'UP', business_type: 'wholesaler', verified_only: true });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('crops_interested');
    expect(sql).toContain('location_state');
    expect(sql).toContain('is_verified');
  });

  test('default pagination values', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '10' }] });
    query.mockResolvedValueOnce({ rows: [] });
    const result = await buyers.searchBuyers();
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(20);
  });
});

describe('Buyers – getBuyerById', () => {
  test('returns buyer with stats', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'b1', business_name: 'Test', completed_trades: 5 }] });
    const result = await buyers.getBuyerById('b1');
    expect(result.business_name).toBe('Test');
  });

  test('returns null when not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await buyers.getBuyerById('nope')).toBeNull();
  });
});

describe('Buyers – verifyBuyer', () => {
  test('sets is_verified to true', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'b1', is_verified: true }] });
    const result = await buyers.verifyBuyer('b1');
    expect(result.is_verified).toBe(true);
  });

  test('returns null when buyer not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await buyers.verifyBuyer('nope')).toBeNull();
  });
});

describe('Buyers – createTradeOrder', () => {
  test('creates order with listing and buyer data', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'l1', farmer_id: 'f1', status: 'active' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'o1', total_amount: 12500 }] });
    const result = await buyers.createTradeOrder('l1', 'b1', {
      quantity_kg: 500, agreed_price_per_kg: 25, notes: 'Good quality',
    });
    expect(result.total_amount).toBe(12500);
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('throws LISTING_NOT_AVAILABLE when listing not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(buyers.createTradeOrder('nope', 'b1', { quantity_kg: 100, agreed_price_per_kg: 25 })).rejects.toThrow('LISTING_NOT_AVAILABLE');
  });
});

describe('Buyers – updateTradeOrder', () => {
  test('updates order status', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'o1', status: 'confirmed' }] });
    const result = await buyers.updateTradeOrder('o1', 'user1', { status: 'confirmed' });
    expect(result.status).toBe('confirmed');
  });

  test('completed status triggers buyer stats update', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'o1', status: 'completed', buyer_id: 'b1' }] });
    query.mockResolvedValueOnce({ rows: [] }); // buyer stats update
    await buyers.updateTradeOrder('o1', 'user1', { status: 'completed' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('returns null for non-existent order', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await buyers.updateTradeOrder('invalid', 'user1', { status: 'confirmed' });
    expect(result).toBeNull();
  });
});

describe('Buyers – getOrders', () => {
  test('retrieves farmer orders', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'o1' }, { id: 'o2' }] });
    const result = await buyers.getOrders('f1', 'farmer');
    expect(result).toHaveLength(2);
  });

  test('retrieves buyer orders (looks up buyer id first)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'b1' }] }); // buyer lookup
    query.mockResolvedValueOnce({ rows: [{ id: 'o1' }] }); // orders
    const result = await buyers.getOrders('user1', 'buyer');
    expect(result).toHaveLength(1);
  });

  test('returns empty array when buyer not found', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // buyer not found
    const result = await buyers.getOrders('unknown', 'buyer');
    expect(result).toEqual([]);
  });

  test('filters by status', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'o1' }] });
    await buyers.getOrders('f1', 'farmer', 'completed');
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('status');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION C — TRANSPORT (logistics/transport.js)
   estimateTransportCost(pickup_obj, delivery_obj, weightKg, vehicleType)
   getVehicleTypes() returns [{type, capacity_kg, description, cost_per_km}]
   ═══════════════════════════════════════════════════ */
describe('Transport – haversineDistance edge cases', () => {
  test('returns 0 for identical coordinates', () => {
    expect(transport.haversineDistance(23.2, 77.4, 23.2, 77.4)).toBe(0);
  });

  test('handles equator-to-pole distance', () => {
    const dist = transport.haversineDistance(0, 0, 90, 0);
    expect(dist).toBeCloseTo(10007.54, 0);
  });

  test('handles antipodal points', () => {
    const dist = transport.haversineDistance(0, 0, 0, 180);
    expect(dist).toBeCloseTo(20015.09, 0);
  });

  test('handles negative coordinates', () => {
    const dist = transport.haversineDistance(-34.6, -58.4, 28.6, 77.2);
    expect(dist).toBeGreaterThan(15000);
  });
});

describe('Transport – estimateTransportCost', () => {
  test('with coordinates → uses haversine distance', () => {
    const cost = transport.estimateTransportCost(
      { lat: 23.2, lng: 77.4, state: 'MP' },
      { lat: 26.8, lng: 80.9, state: 'UP' },
      500, 'truck'
    );
    // haversine ~500km, baseCost 1500 + 500*25 + 0 weight surcharge = ~14000
    expect(cost).toBeGreaterThan(5000);
    expect(typeof cost).toBe('number');
  });

  test('no coordinates, different states → 500km default', () => {
    const cost = transport.estimateTransportCost(
      { state: 'MP' }, { state: 'UP' }, 1000, 'truck'
    );
    // baseCost 1500 + 500 * 25 = 14000
    expect(cost).toBe(14000);
  });

  test('no coordinates, same state → 100km default', () => {
    const cost = transport.estimateTransportCost(
      { state: 'MP' }, { state: 'MP' }, 1000, 'truck'
    );
    // baseCost 1500 + 100 * 25 = 4000
    expect(cost).toBe(4000);
  });

  test('weight surcharge for > 5000 kg', () => {
    const costLight = transport.estimateTransportCost(
      { state: 'MP' }, { state: 'MP' }, 3000, 'truck'
    );
    const costHeavy = transport.estimateTransportCost(
      { state: 'MP' }, { state: 'MP' }, 8000, 'truck'
    );
    // Heavy: baseCost 1500 + 100*25 + (8000-5000)*0.5 = 4000 + 1500 = 5500
    expect(costHeavy).toBeGreaterThan(costLight);
    expect(costHeavy - costLight).toBe(Math.round((8000 - 5000) * 0.5));
  });

  test('unknown vehicle type falls back to truck', () => {
    const costTruck = transport.estimateTransportCost(
      { state: 'MP' }, { state: 'MP' }, 1000, 'truck'
    );
    const costUnknown = transport.estimateTransportCost(
      { state: 'MP' }, { state: 'MP' }, 1000, 'spaceship'
    );
    expect(costUnknown).toBe(costTruck);
  });

  test('all vehicle types produce different costs', () => {
    const types = ['tractor', 'pickup', 'mini-truck', 'truck', 'tempo'];
    const costs = types.map((t) =>
      transport.estimateTransportCost({ state: 'MP' }, { state: 'UP' }, 1000, t)
    );
    // All should be positive
    for (const c of costs) expect(c).toBeGreaterThan(0);
    // Not all the same (different base costs and rates)
    expect(new Set(costs).size).toBeGreaterThan(1);
  });

  test('tractor is cheapest for short distance', () => {
    const tractor = transport.estimateTransportCost({ state: 'MP' }, { state: 'MP' }, 500, 'tractor');
    const truck = transport.estimateTransportCost({ state: 'MP' }, { state: 'MP' }, 500, 'truck');
    expect(tractor).toBeLessThan(truck);
  });
});

describe('Transport – getVehicleTypes', () => {
  test('returns non-empty array with correct keys', () => {
    const types = transport.getVehicleTypes();
    expect(types.length).toBe(5);
    for (const t of types) {
      expect(t).toHaveProperty('type');
      expect(t).toHaveProperty('capacity_kg');
      expect(t).toHaveProperty('description');
      expect(t).toHaveProperty('cost_per_km');
      expect(t.capacity_kg).toBeGreaterThan(0);
    }
  });

  test('includes all expected vehicle types', () => {
    const types = transport.getVehicleTypes().map((t) => t.type);
    expect(types).toEqual(expect.arrayContaining(['tractor', 'pickup', 'mini-truck', 'truck', 'tempo']));
  });
});

describe('Transport – createRequest', () => {
  test('persists a new transport request', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tr1', status: 'pending' }] });
    const result = await transport.createRequest('f1', {
      pickup_lat: 23.2, pickup_lng: 77.4, pickup_state: 'MP',
      delivery_lat: 26.8, delivery_lng: 80.9, delivery_state: 'UP',
      cargo_type: 'wheat', weight_kg: 500, vehicle_type: 'truck',
    });
    expect(result.id).toBe('tr1');
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('Transport – getUserRequests', () => {
  test('returns list for user', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tr1' }, { id: 'tr2' }] });
    const result = await transport.getUserRequests('f1');
    expect(result).toHaveLength(2);
  });

  test('filters by status', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await transport.getUserRequests('f1', 'pending');
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('status');
  });
});

describe('Transport – getRequestById', () => {
  test('returns null for missing request', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await transport.getRequestById('invalid')).toBeNull();
  });

  test('returns request with order details', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tr1', trade_order_id: 'to1' }] });
    const result = await transport.getRequestById('tr1');
    expect(result.id).toBe('tr1');
  });
});

describe('Transport – updateRequest', () => {
  test('updates status and transporter details', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tr1', status: 'in_transit' }] });
    const result = await transport.updateRequest('tr1', {
      status: 'in_transit', transporter_name: 'Singh Transport',
    });
    expect(result.status).toBe('in_transit');
  });

  test('delivered status triggers trade order update', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'tr1', status: 'delivered', trade_order_id: 'to1' }] });
    query.mockResolvedValueOnce({ rows: [] });
    await transport.updateRequest('tr1', { status: 'delivered' });
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('returns null when request not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await transport.updateRequest('nope', { status: 'in_transit' });
    expect(result).toBeNull();
  });
});

/* ═══════════════════════════════════════════════════
   SECTION D — MARKET PRICES (market-data/prices.js)
   ═══════════════════════════════════════════════════ */
describe('Prices – getCurrentPrices', () => {
  test('returns prices with summary stats', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { id: 1, crop_type: 'wheat', modal_price: 2200, mandi_name: 'Mandi A' },
        { id: 2, crop_type: 'wheat', modal_price: 2400, mandi_name: 'Mandi B' },
        { id: 3, crop_type: 'wheat', modal_price: 2000, mandi_name: 'Mandi C' },
      ],
    });
    const result = await prices.getCurrentPrices('wheat');
    expect(result.crop_type).toBe('wheat');
    expect(result.prices).toHaveLength(3);
    expect(result.summary).toBeDefined();
    expect(parseFloat(result.summary.avgPrice)).toBeCloseTo(2200, 0);
    expect(parseFloat(result.summary.minPrice)).toBe(2000);
    expect(parseFloat(result.summary.maxPrice)).toBe(2400);
    expect(result.summary.totalMandis).toBe(3);
  });

  test('null summary when no rows', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await prices.getCurrentPrices('saffron');
    expect(result.summary).toBeNull();
    expect(result.prices).toEqual([]);
  });

  test('applies state and district filters', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await prices.getCurrentPrices('rice', { state: 'Punjab', district: 'Ludhiana', limit: 5 });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('state');
    expect(sql).toContain('district');
    const params = query.mock.calls[0][1];
    expect(params).toContain('Punjab');
    expect(params).toContain('Ludhiana');
    expect(params).toContain(5);
  });

  test('summary with single mandi has totalMandis=1', async () => {
    query.mockResolvedValueOnce({
      rows: [{ modal_price: 1500, mandi_name: 'OneMandi' }],
    });
    const result = await prices.getCurrentPrices('corn');
    expect(result.summary.totalMandis).toBe(1);
  });

  test('handles zero modal_price rows (excluded from summary)', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { modal_price: 0, mandi_name: 'X' },
        { modal_price: 2000, mandi_name: 'Y' },
      ],
    });
    const result = await prices.getCurrentPrices('wheat');
    expect(parseFloat(result.summary.avgPrice)).toBe(2000);
  });
});

describe('Prices – getPriceTrend', () => {
  test('detects rising trend (>5%)', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { trade_date: '2025-01-01', avg_modal: 2000 },
        { trade_date: '2025-01-15', avg_modal: 2200 },
      ],
    });
    const result = await prices.getPriceTrend('wheat');
    expect(result.trend).toBe('rising');
  });

  test('detects falling trend (<-5%)', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { trade_date: '2025-01-01', avg_modal: 2200 },
        { trade_date: '2025-01-15', avg_modal: 2000 },
      ],
    });
    const result = await prices.getPriceTrend('wheat');
    expect(result.trend).toBe('falling');
  });

  test('stable trend within ±5%', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { trade_date: '2025-01-01', avg_modal: 2000 },
        { trade_date: '2025-01-15', avg_modal: 2050 },
      ],
    });
    const result = await prices.getPriceTrend('wheat');
    expect(result.trend).toBe('stable');
  });

  test('stable when only 1 data point', async () => {
    query.mockResolvedValueOnce({ rows: [{ trade_date: '2025-01-01', avg_modal: 2000 }] });
    const result = await prices.getPriceTrend('wheat');
    expect(result.trend).toBe('stable');
  });

  test('stable when no data points', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await prices.getPriceTrend('unicorn');
    expect(result.trend).toBe('stable');
    expect(result.data_points).toEqual([]);
  });

  test('passes mandi_code and state filters', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await prices.getPriceTrend('rice', { mandi_code: 'M001', state: 'Punjab', days: 60 });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('mandi_code');
    expect(sql).toContain('state');
    const params = query.mock.calls[0][1];
    expect(params).toContain('rice');
    expect(params).toContain(60);
    expect(params).toContain('M001');
    expect(params).toContain('Punjab');
  });

  test('exactly at +5% boundary → stable', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { trade_date: '2025-01-01', avg_modal: 2000 },
        { trade_date: '2025-01-15', avg_modal: 2100 },
      ],
    });
    const result = await prices.getPriceTrend('wheat');
    expect(result.trend).toBe('stable');
  });
});

describe('Prices – getMandiPrices', () => {
  test('groups prices by crop', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { crop_type: 'wheat', modal_price: 2200, state: 'MP', district: 'Sehore' },
        { crop_type: 'wheat', modal_price: 2300, state: 'MP', district: 'Sehore' },
        { crop_type: 'rice', modal_price: 1800, state: 'MP', district: 'Sehore' },
      ],
    });
    const result = await prices.getMandiPrices('Sehore Mandi');
    expect(result.total_crops).toBe(2);
    expect(result.crops.wheat).toHaveLength(2);
    expect(result.crops.rice).toHaveLength(1);
    expect(result.state).toBe('MP');
  });

  test('handles no data for mandi', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await prices.getMandiPrices('Ghost Mandi');
    expect(result.total_crops).toBe(0);
    expect(result.state).toBeUndefined();
  });
});

describe('Prices – getMandis', () => {
  test('returns all mandis when no state filter', async () => {
    query.mockResolvedValueOnce({ rows: [{ mandi_name: 'M1' }, { mandi_name: 'M2' }] });
    const result = await prices.getMandis();
    expect(result).toHaveLength(2);
    expect(query.mock.calls[0][1]).toEqual([]);
  });

  test('filters by state', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await prices.getMandis('Gujarat');
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('WHERE state = $1');
    expect(query.mock.calls[0][1]).toEqual(['Gujarat']);
  });
});

describe('Prices – detectPriceChanges', () => {
  test('returns rows with direction and alert_message', async () => {
    query.mockResolvedValueOnce({
      rows: [
        { crop_type: 'wheat', mandi_name: 'Mandi A', state: 'MP', modal_price: 2500, prev_price: 2000, change_percent: '25.00' },
        { crop_type: 'rice', mandi_name: 'Mandi B', state: 'UP', modal_price: 1500, prev_price: 2000, change_percent: '-25.00' },
      ],
    });
    const result = await prices.detectPriceChanges(10);
    expect(result).toHaveLength(2);
    expect(result[0].direction).toBe('up');
    expect(result[0].alert_message).toContain('up');
    expect(result[0].alert_message).toContain('wheat');
    expect(result[1].direction).toBe('down');
    expect(result[1].alert_message).toContain('down');
    expect(result[1].alert_message).toContain('rice');
  });

  test('default threshold is 10', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await prices.detectPriceChanges();
    expect(query.mock.calls[0][1]).toEqual([10]);
  });

  test('empty result → no changes', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await prices.detectPriceChanges(5);
    expect(result).toEqual([]);
  });
});

describe('Prices – ingestPriceData', () => {
  test('inserts multiple price records', async () => {
    query.mockResolvedValue({ rows: [{ id: 1 }] });
    const result = await prices.ingestPriceData([
      { crop_type: 'wheat', variety: 'sharbati', mandi_name: 'M1', mandi_code: 'MC1', state: 'MP', district: 'Sehore', min_price: 2000, max_price: 2500, modal_price: 2200, arrival_qty: 100, trade_date: '2025-01-20' },
      { crop_type: 'rice', variety: 'basmati', mandi_name: 'M2', mandi_code: 'MC2', state: 'Punjab', district: 'Ludhiana', min_price: 1800, max_price: 2200, modal_price: 2000, arrival_qty: 200 },
    ]);
    expect(result.inserted).toBe(2);
    expect(result.total).toBe(2);
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('handles partial failures gracefully', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
    query.mockRejectedValueOnce(new Error('DB error'));
    query.mockResolvedValueOnce({ rows: [{ id: 3 }] });
    const result = await prices.ingestPriceData([
      { crop_type: 'wheat', mandi_name: 'A', mandi_code: 'A1', state: 'MP', district: 'S', min_price: 100, max_price: 200, modal_price: 150, arrival_qty: 50 },
      { crop_type: 'BAD', mandi_code: null },
      { crop_type: 'rice', mandi_name: 'B', mandi_code: 'B1', state: 'UP', district: 'L', min_price: 100, max_price: 200, modal_price: 150, arrival_qty: 50 },
    ]);
    expect(result.inserted).toBe(2);
    expect(result.total).toBe(3);
  });

  test('empty input array', async () => {
    const result = await prices.ingestPriceData([]);
    expect(result.inserted).toBe(0);
    expect(result.total).toBe(0);
    expect(query).not.toHaveBeenCalled();
  });
});

/* ═══════════════════════════════════════════════════
   SECTION E — ALERTS (market-data/alerts.js) — uses DynamoDB
   subscribePriceAlert(userId, data), getUserAlerts(userId),
   deleteAlert(userId, alertId), dispatchPriceAlerts(priceChanges)
   ═══════════════════════════════════════════════════ */
describe('Alerts – subscribePriceAlert', () => {
  test('creates a new alert subscription via DynamoDB', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await alerts.subscribePriceAlert('f1', {
      crop_type: 'wheat', state: 'MP', threshold_percent: 10,
    });
    expect(result.userId).toBe('f1');
    expect(result.crop_type).toBe('wheat');
    expect(result.threshold_percent).toBe(10);
    expect(result.alertId).toBe('test-uuid-alert');
    expect(result.is_active).toBe(true);
    expect(dynamoDB.send).toHaveBeenCalledTimes(1);
  });

  test('defaults threshold_percent to 10 and notify_via to push', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await alerts.subscribePriceAlert('f2', { crop_type: 'rice' });
    expect(result.threshold_percent).toBe(10);
    expect(result.notify_via).toBe('push');
  });

  test('defaults state to all', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await alerts.subscribePriceAlert('f3', { crop_type: 'wheat' });
    expect(result.state).toBe('all');
  });
});

describe('Alerts – getUserAlerts', () => {
  test('returns all alerts for user via DynamoDB', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: [{ alertId: 'a1' }, { alertId: 'a2' }] });
    const result = await alerts.getUserAlerts('f1');
    expect(result).toHaveLength(2);
    expect(dynamoDB.send).toHaveBeenCalledTimes(1);
  });

  test('returns empty array for user with no alerts', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: [] });
    const result = await alerts.getUserAlerts('unknown');
    expect(result).toEqual([]);
  });

  test('returns empty array when Items is undefined', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await alerts.getUserAlerts('unknown');
    expect(result).toEqual([]);
  });
});

describe('Alerts – deleteAlert', () => {
  test('deletes alert via DynamoDB', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await alerts.deleteAlert('f1', 'a1');
    expect(result).toEqual({ deleted: true });
    expect(dynamoDB.send).toHaveBeenCalledTimes(1);
  });
});

describe('Alerts – dispatchPriceAlerts', () => {
  test('returns sent:0 for empty price changes', async () => {
    const result = await alerts.dispatchPriceAlerts([]);
    expect(result.sent).toBe(0);
  });

  test('returns sent:0 for null input', async () => {
    const result = await alerts.dispatchPriceAlerts(null);
    expect(result.sent).toBe(0);
  });

  test('scans active subscriptions and matches crop alerts', async () => {
    dynamoDB.send.mockResolvedValueOnce({
      Items: [
        { userId: 'f1', crop_type: 'wheat', state: 'all', threshold_percent: 10, is_active: true },
      ],
    });
    const result = await alerts.dispatchPriceAlerts([
      { crop_type: 'wheat', change_percent: '15', mandi_name: 'M1', state: 'MP', direction: 'up', modal_price: 2500, prev_price: 2000 },
    ]);
    expect(result.sent).toBe(1);
    expect(result.total_changes).toBe(1);
    expect(result.total_subscriptions).toBe(1);
  });

  test('no match when change below threshold', async () => {
    dynamoDB.send.mockResolvedValueOnce({
      Items: [
        { userId: 'f1', crop_type: 'wheat', state: 'all', threshold_percent: 20, is_active: true },
      ],
    });
    const result = await alerts.dispatchPriceAlerts([
      { crop_type: 'wheat', change_percent: '5', mandi_name: 'M1', state: 'MP', direction: 'up' },
    ]);
    expect(result.sent).toBe(0);
  });
});

/* ═══════════════════════════════════════════════════
   SECTION F — COLLECTIVE BARGAINING
   ═══════════════════════════════════════════════════ */
describe('Bargaining – calculateBargainingPower', () => {
  test('max score = 100 for large active group', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 50000, member_count: 20, status: 'negotiating',
    });
    expect(score).toBe(100);
  });

  test('minimum score for empty group', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 0, member_count: 0, status: 'forming',
    });
    expect(score).toBe(0);
  });

  test('qty=5000 gets 30 points', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 5000, member_count: 0, status: 'forming',
    });
    expect(score).toBeGreaterThanOrEqual(30);
  });

  test('qty=1000 gets 20 points', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 1000, member_count: 0, status: 'forming',
    });
    expect(score).toBeGreaterThanOrEqual(20);
  });

  test('qty=500 gets fractional (≤10 points)', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 500, member_count: 0, status: 'forming',
    });
    expect(score).toBe(5); // 500/100 = 5
  });

  test('member_count=5 gets 30 points', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 0, member_count: 5, status: 'forming',
    });
    expect(score).toBe(30);
  });

  test('active status adds 10 points', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 0, member_count: 0, status: 'active',
    });
    expect(score).toBe(10);
  });

  test('negotiating status adds 20 points', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 0, member_count: 0, status: 'negotiating',
    });
    expect(score).toBe(20);
  });

  test('handles null/undefined fields', () => {
    const score = bargaining.calculateBargainingPower({});
    expect(score).toBe(0);
  });

  test('capped at 100', () => {
    const score = bargaining.calculateBargainingPower({
      total_quantity_kg: 999999, member_count: 9999, status: 'negotiating',
    });
    expect(score).toBe(100);
  });
});

describe('Bargaining – createGroup', () => {
  test('inserts group and creator as first member', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', name: 'Wheat Group', member_count: 1 }] });
    query.mockResolvedValueOnce({ rows: [] });
    const result = await bargaining.createGroup('f1', {
      name: 'Wheat Group', crop_type: 'wheat', variety: 'sharbati',
      target_price_per_kg: 30, min_price_per_kg: 25,
      location_state: 'MP', location_district: 'Sehore', initial_quantity_kg: 500,
    });
    expect(result.id).toBe('g1');
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('skips member insert when initial_quantity_kg is 0/falsy', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g2' }] });
    await bargaining.createGroup('f1', { name: 'Empty Group', crop_type: 'rice' });
    expect(query).toHaveBeenCalledTimes(1);
  });
});

describe('Bargaining – joinGroup', () => {
  test('successfully joins an open group', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', status: 'forming' }] });
    query.mockResolvedValueOnce({ rows: [] }); // not already member
    query.mockResolvedValueOnce({ rows: [] }); // insert member
    query.mockResolvedValueOnce({ rows: [] }); // update aggregates
    // getGroupById calls:
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', crop_type: 'wheat', total_quantity_kg: 600, member_count: 2 }] });
    query.mockResolvedValueOnce({ rows: [{ farmer_id: 'f1' }, { farmer_id: 'f2' }] });
    query.mockResolvedValueOnce({ rows: [{ avg_price: 2200 }] });

    const result = await bargaining.joinGroup('g1', 'f2', { quantity_kg: 100, listing_id: 'l1' });
    expect(result).toBeDefined();
    expect(result.members).toHaveLength(2);
  });

  test('throws GROUP_NOT_FOUND when group missing', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    await expect(bargaining.joinGroup('bad-id', 'f1', { quantity_kg: 100 })).rejects.toThrow('GROUP_NOT_FOUND');
  });

  test('throws GROUP_CLOSED for sold group', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', status: 'sold' }] });
    await expect(bargaining.joinGroup('g1', 'f1', { quantity_kg: 100 })).rejects.toThrow('GROUP_CLOSED');
  });

  test('throws GROUP_CLOSED for dissolved group', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', status: 'dissolved' }] });
    await expect(bargaining.joinGroup('g1', 'f1', { quantity_kg: 100 })).rejects.toThrow('GROUP_CLOSED');
  });

  test('throws ALREADY_MEMBER for duplicate join', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', status: 'forming' }] });
    query.mockResolvedValueOnce({ rows: [{ id: 'existing-member' }] });
    await expect(bargaining.joinGroup('g1', 'f1', { quantity_kg: 100 })).rejects.toThrow('ALREADY_MEMBER');
  });
});

describe('Bargaining – getGroupById', () => {
  test('returns null for non-existent group', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    expect(await bargaining.getGroupById('nope')).toBeNull();
  });

  test('includes members, market avg price, and bargaining power', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', crop_type: 'wheat', total_quantity_kg: 10000, member_count: 10, status: 'negotiating' }] });
    query.mockResolvedValueOnce({ rows: [{ farmer_id: 'f1' }] });
    query.mockResolvedValueOnce({ rows: [{ avg_price: 2300 }] });
    const result = await bargaining.getGroupById('g1');
    expect(result.members).toHaveLength(1);
    expect(result.current_market_avg_price).toBe(2300);
    expect(result.bargaining_power).toBe(100);
  });

  test('market avg price is null when no recent prices', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'g1', crop_type: 'wheat', total_quantity_kg: 0, member_count: 1, status: 'forming' }] });
    query.mockResolvedValueOnce({ rows: [] });
    query.mockResolvedValueOnce({ rows: [{ avg_price: null }] });
    const result = await bargaining.getGroupById('g1');
    expect(result.current_market_avg_price).toBeNull();
  });
});

describe('Bargaining – searchGroups', () => {
  test('returns paginated results with default status=forming', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '5' }] });
    query.mockResolvedValueOnce({
      rows: [
        { id: 'g1', total_quantity_kg: 5000, member_count: 5, status: 'forming' },
        { id: 'g2', total_quantity_kg: 2000, member_count: 3, status: 'forming' },
      ],
    });
    const result = await bargaining.searchGroups();
    expect(result.groups).toHaveLength(2);
    expect(result.pagination.total).toBe(5);
    expect(result.groups[0].bargaining_power).toBeDefined();
  });

  test('applies crop_type, state filters', async () => {
    query.mockResolvedValueOnce({ rows: [{ total: '0' }] });
    query.mockResolvedValueOnce({ rows: [] });
    await bargaining.searchGroups({ crop_type: 'rice', state: 'Punjab', status: 'active', page: 2, limit: 5 });
    const sql = query.mock.calls[0][0];
    expect(sql).toContain('crop_type');
    expect(sql).toContain('location_state');
  });
});

describe('Bargaining – suggestGroupsForFarmer', () => {
  test('returns message when farmer has no active listings', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const result = await bargaining.suggestGroupsForFarmer('f1');
    expect(result.suggestions).toEqual([]);
    expect(result.message).toContain('No active listings');
  });

  test('returns suggestions with similar farmers', async () => {
    query.mockResolvedValueOnce({
      rows: [{
        id: 'l1', crop_type: 'wheat', variety: 'sharbati', quantity_kg: 500,
        price_per_kg: 25, location_state: 'MP', location_district: 'Sehore',
      }],
    });
    query.mockResolvedValueOnce({
      rows: [
        { farmer_id: 'f2', crop_type: 'wheat', variety: 'sharbati', quantity_kg: 300, price_per_kg: 28, location_district: 'Sehore' },
        { farmer_id: 'f3', crop_type: 'wheat', variety: 'sharbati', quantity_kg: 400, price_per_kg: 22, location_district: 'Sehore' },
      ],
    });
    const result = await bargaining.suggestGroupsForFarmer('f1');
    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0].crop_type).toBe('wheat');
    expect(result.suggestions[0].similar_farmer_count).toBe(2);
    expect(result.suggestions[0].recommended_action).toContain('Group forming');
  });

  test('recommendation changes for >5000kg total', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'l1', crop_type: 'wheat', quantity_kg: 3000, price_per_kg: 25, location_state: 'MP', location_district: 'Sehore' }],
    });
    query.mockResolvedValueOnce({
      rows: [
        { farmer_id: 'f2', crop_type: 'wheat', quantity_kg: 2000, price_per_kg: 28, location_district: 'Sehore' },
        { farmer_id: 'f3', crop_type: 'wheat', quantity_kg: 1500, price_per_kg: 22, location_district: 'Sehore' },
      ],
    });
    const result = await bargaining.suggestGroupsForFarmer('f1');
    expect(result.suggestions[0].recommended_action).toContain('Strong group potential');
  });

  test('no suggestion when <2 similar farmers', async () => {
    query.mockResolvedValueOnce({
      rows: [{ id: 'l1', crop_type: 'wheat', quantity_kg: 500, price_per_kg: 25, location_state: 'MP', location_district: 'Sehore' }],
    });
    query.mockResolvedValueOnce({ rows: [{ farmer_id: 'f2', quantity_kg: 300, price_per_kg: 28, location_district: 'Sehore' }] });
    const result = await bargaining.suggestGroupsForFarmer('f1');
    expect(result.suggestions).toEqual([]);
  });
});
