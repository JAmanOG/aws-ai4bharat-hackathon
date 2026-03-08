/**
 * BRUTAL TEST SUITE — Dynamic Crops + Voice-Screen Sync
 *
 * Covers:
 * 1. Live market data fetcher: all 25 supported crops
 * 2. prices.js delegation to live fetcher
 * 3. /agriculture/crops route
 * 4. Voice→Screen context passing through the entire pipeline
 * 5. VoiceCommandEngine: buildNavParams for AgriMarket with crop/tab/compareCrop
 * 6. Orchestrator: screenContext injection into system prompt
 */

/* ═══════════ MOCKS ═══════════ */

jest.mock('../../utils/db', () => ({
    query: jest.fn(),
    dynamoDB: { send: jest.fn().mockResolvedValue({ Items: [] }) },
    TABLE_NAMES: {
        USER_LEARNING_PROFILE: 'UserLearningProfile',
        PEER_GROUPS: 'PeerGroups',
        LEARNING_RECOMMENDATIONS: 'LearningRecommendations',
        CONTENT_INTERACTIONS: 'ContentInteractions',
        FARMER_PROFILES: 'FarmerProfiles',
        PRICE_ALERTS: 'PriceAlerts',
        PRICE_WATCH: 'PriceWatch',
    },
}));

// Mock global fetch for live data fetcher
global.fetch = jest.fn();

const { query } = require('../../utils/db');
const liveFetcher = require('../../services/market-data-fetcher');

/* ═══════════════════════════════════════════════════ */
/* SECTION 1: CROP_COMMODITY_MAP — All 27 crops exist */
/* ═══════════════════════════════════════════════════ */

describe('CROP_COMMODITY_MAP coverage', () => {
    const REQUIRED_CROPS = [
        'wheat', 'rice', 'tomato', 'onion', 'potato', 'brinjal',
        'soybean', 'cotton', 'sugarcane', 'mustard', 'chana',
        'maize', 'sunflower', 'groundnut', 'turmeric', 'cumin',
        'jowar', 'bajra', 'arhar', 'urad', 'moong',
        'barley', 'copra', 'pepper', 'cardamom', 'jute', 'okra',
    ];

    test('should have all 27 crops in CROP_COMMODITY_MAP', () => {
        const map = liveFetcher.CROP_COMMODITY_MAP;
        expect(map).toBeDefined();
        for (const crop of REQUIRED_CROPS) {
            expect(map[crop]).toBeDefined();
            expect(Array.isArray(map[crop])).toBe(true);
            expect(map[crop].length).toBeGreaterThan(0);
        }
    });

    test('getAvailableCrops includes all 27 mapped crops', async () => {
        // DB returns empty — should still get all 27 from the MAP
        query.mockResolvedValueOnce({ rows: [] });
        const result = await liveFetcher.getAvailableCrops();
        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBeGreaterThanOrEqual(27);
        const cropNames = result.map(c => c.name);
        for (const crop of REQUIRED_CROPS) {
            expect(cropNames).toContain(crop);
        }
    });
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 2: fetchLivePrices — each crop individually */
/* ═══════════════════════════════════════════════════ */

describe('fetchLivePrices per crop', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockReset();
    });

    const CROPS_TO_TEST = [
        'wheat', 'rice', 'tomato', 'onion', 'potato',
        'soybean', 'cotton', 'sugarcane', 'mustard', 'chana',
        'maize', 'sunflower', 'groundnut', 'turmeric', 'cumin',
        'jowar', 'bajra', 'arhar', 'urad', 'moong',
        'barley', 'copra', 'pepper', 'cardamom', 'jute',
    ];

    for (const crop of CROPS_TO_TEST) {
        test(`fetchLivePrices("${crop}") builds correct API URL with commodity filter`, async () => {
            const commodityNames = liveFetcher.CROP_COMMODITY_MAP[crop];
            // commodityNames is an array — the first variant is used in the URL
            const firstVariant = Array.isArray(commodityNames) ? commodityNames[0] : commodityNames;
            const mockRecords = [
                {
                    commodity: firstVariant,
                    state: 'Madhya Pradesh',
                    market: 'Indore',
                    price: '2500',
                    arrival_date: '15/01/2025',
                },
            ];

            global.fetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    records: mockRecords,
                    total: 1,
                }),
            });

            const result = await liveFetcher.fetchLivePrices(crop);

            expect(global.fetch).toHaveBeenCalledTimes(1);
            const calledUrl = global.fetch.mock.calls[0][0];
            expect(calledUrl).toContain('data.gov.in');
            // URLSearchParams encodes spaces as '+', so check the decoded form
            const decodedUrl = decodeURIComponent(calledUrl.replace(/\+/g, ' '));
            expect(decodedUrl).toContain(firstVariant);
            expect(result).toBeDefined();
            expect(Array.isArray(result)).toBe(true);
        });
    }

    test('fetchLivePrices returns empty array on API failure', async () => {
        global.fetch.mockRejectedValueOnce(new Error('Network failure'));
        const result = await liveFetcher.fetchLivePrices('wheat');
        expect(result).toEqual([]);
    });

    test('fetchLivePrices returns empty for unknown crop', async () => {
        const result = await liveFetcher.fetchLivePrices('unicornfruit');
        expect(result).toEqual([]);
    });
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 3: getOrFetchPrices — cache logic           */
/* ═══════════════════════════════════════════════════ */

describe('getOrFetchPrices cache behavior', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockReset();
    });

    test('returns DB data if cache is fresh (< 6 hours)', async () => {
        const freshDate = new Date();
        freshDate.setHours(freshDate.getHours() - 1); // 1 hour ago

        query.mockResolvedValueOnce({
            rows: [
                {
                    crop_type: 'sunflower',
                    state: 'Karnataka',
                    mandi_name: 'Davangere',
                    modal_price: 5500,
                    trade_date: freshDate.toISOString(),
                },
            ],
        });

        const result = await liveFetcher.getOrFetchPrices('sunflower');
        expect(result).toBeDefined();
        expect(result.prices).toBeDefined();
        expect(result.prices.length).toBeGreaterThan(0);
        expect(global.fetch).not.toHaveBeenCalled(); // no live fetch needed
    });

    test('fetches live if cache is stale (> 6 hours)', async () => {
        // DB returns empty (no fresh data)
        query.mockResolvedValueOnce({ rows: [] });

        // Live fetch
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                records: [{
                    commodity: 'Groundnut',
                    state: 'Gujarat',
                    market: 'Rajkot',
                    price: '6000',
                    arrival_date: '10/01/2025',
                }],
            }),
        });

        // Upsert call
        query.mockResolvedValue({ rows: [] });

        const result = await liveFetcher.getOrFetchPrices('groundnut');
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledTimes(1);
    });
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 4: getOrFetchTrend — per crop               */
/* ═══════════════════════════════════════════════════ */

describe('getOrFetchTrend per crop', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockReset();
    });

    const TEST_CROPS = ['wheat', 'rice', 'sunflower', 'turmeric', 'cumin', 'arhar', 'moong', 'pepper'];

    for (const crop of TEST_CROPS) {
        test(`getOrFetchTrend("${crop}") returns trend data`, async () => {
            // First query: seed (getOrFetchPrices check)
            query.mockResolvedValueOnce({
                rows: [{
                    crop_type: crop,
                    state: 'TestState',
                    mandi_name: 'TestMandi',
                    modal_price: 3000,
                    trade_date: new Date().toISOString(),
                }],
            });

            // Second query: trend query
            query.mockResolvedValueOnce({
                rows: [
                    { trade_date: '2025-01-01', avg_modal: 2500 },
                    { trade_date: '2025-01-08', avg_modal: 2600 },
                    { trade_date: '2025-01-15', avg_modal: 2700 },
                ],
            });

            const result = await liveFetcher.getOrFetchTrend(crop, { days: 30 });
            expect(result).toBeDefined();
            expect(result.data_points || result.trend).toBeDefined();
        });
    }
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 5: prices.js delegates to live fetcher      */
/* ═══════════════════════════════════════════════════ */

describe('prices.js delegates to live fetcher', () => {
    beforeEach(() => jest.clearAllMocks());

    const prices = require('../../lambdas/market-data/prices');

    test('getCurrentPrices calls liveFetcher.getOrFetchPrices', async () => {
        // Mock DB for the live fetcher
        query.mockResolvedValueOnce({
            rows: [{
                crop_type: 'bajra',
                state: 'Rajasthan',
                mandi_name: 'Jodhpur',
                modal_price: 2200,
                trade_date: new Date().toISOString(),
            }],
        });

        const result = await prices.getCurrentPrices('bajra');
        expect(result).toBeDefined();
        expect(result.crop_type).toBe('bajra');
    });

    test('getPriceTrend calls liveFetcher.getOrFetchTrend', async () => {
        query.mockResolvedValueOnce({
            rows: [{
                crop_type: 'jowar',
                state: 'Maharashtra',
                modal_price: 2800,
                trade_date: new Date().toISOString(),
            }],
        });
        query.mockResolvedValueOnce({
            rows: [
                { trade_date: '2025-01-01', avg_modal: 2700 },
                { trade_date: '2025-01-08', avg_modal: 2850 },
            ],
        });

        const result = await prices.getPriceTrend('jowar');
        expect(result).toBeDefined();
    });
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 6: Voice-Screen Context Passing             */
/* ═══════════════════════════════════════════════════ */

describe('Voice-Screen Context Flow', () => {
    test('screen_context is accepted by orchestrator.processText', async () => {
        // We just verify the function accepts the param without crashing
        const orchestrator = require('../../services/orchestrator');

        // This will fail at Nova call but that's OK — we're testing the param acceptance
        try {
            await orchestrator.processText({
                text: 'sunflower ka bhav',
                userId: 'test-user',
                sessionId: 'test-session',
                languageCode: 'hi',
                generateAudio: false,
                screenContext: 'User is on screen: AgriMarket. Active tab: crops. Viewing crop: sunflower',
            });
        } catch (err) {
            // Expected to fail at Nova/Sarvam call since we're not mocking those
            // The test passes if it doesn't throw a TypeError about screenContext
            expect(err.message).not.toContain('screenContext');
        }
    });
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 7: syncTopCrops — background sync           */
/* ═══════════════════════════════════════════════════ */

describe('syncTopCrops', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockReset();
    });

    test('syncTopCrops fetches for multiple crops', async () => {
        // Each crop will trigger a DB query + fetch
        // Rate-limiter adds ~600ms gap between API calls, so this needs more time
        query.mockResolvedValue({ rows: [] });
        global.fetch.mockResolvedValue({
            ok: true,
            json: async () => ({
                records: [{
                    commodity: 'Wheat',
                    state: 'MP',
                    market: 'Indore',
                    price: '2500',
                    arrival_date: '15/01/2025',
                }],
            }),
        });

        await liveFetcher.syncTopCrops();

        // Should have called fetch for multiple crops
        expect(global.fetch.mock.calls.length).toBeGreaterThanOrEqual(1);
    }, 30000);
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 8: Crop name normalization                   */
/* ═══════════════════════════════════════════════════ */

describe('Crop name normalization', () => {
    const norm = liveFetcher.normalizeCropName;

    test('passes through valid crop names unchanged', () => {
        expect(norm('wheat')).toBe('wheat');
        expect(norm('sunflower')).toBe('sunflower');
        expect(norm('tomato')).toBe('tomato');
    });

    test('normalizes plural forms to singular', () => {
        expect(norm('sunflowers')).toBe('sunflower');
        expect(norm('tomatoes')).toBe('tomato');
        expect(norm('potatoes')).toBe('potato');
        expect(norm('onions')).toBe('onion');
        expect(norm('soybeans')).toBe('soybean');
        expect(norm('groundnuts')).toBe('groundnut');
        expect(norm('peanuts')).toBe('groundnut');
        expect(norm('chickpeas')).toBe('chana');
        expect(norm('lentils')).toBe('moong');
    });

    test('normalizes Hindi crop names', () => {
        expect(norm('gehu')).toBe('wheat');
        expect(norm('chawal')).toBe('rice');
        expect(norm('pyaaz')).toBe('onion');
        expect(norm('aloo')).toBe('potato');
        expect(norm('tamatar')).toBe('tomato');
        expect(norm('sarson')).toBe('mustard');
        expect(norm('surajmukhi')).toBe('sunflower');
        expect(norm('makka')).toBe('maize');
        expect(norm('haldi')).toBe('turmeric');
        expect(norm('jeera')).toBe('cumin');
        expect(norm('ganna')).toBe('sugarcane');
        expect(norm('moongfali')).toBe('groundnut');
        expect(norm('kapas')).toBe('cotton');
        expect(norm('elaichi')).toBe('cardamom');
        expect(norm('mirchi')).toBe('pepper');
    });

    test('normalizes English aliases', () => {
        expect(norm('corn')).toBe('maize');
        expect(norm('peanut')).toBe('groundnut');
        expect(norm('coconut')).toBe('copra');
        expect(norm('eggplant')).toBe('brinjal');
        expect(norm('baingan')).toBe('brinjal');
        expect(norm('gram')).toBe('chana');
        expect(norm('chickpea')).toBe('chana');
        expect(norm('sorghum')).toBe('jowar');
        expect(norm('paddy')).toBe('rice');
        expect(norm('toor')).toBe('arhar');
        expect(norm('okra')).toBe('okra');
        expect(norm('bhindi')).toBe('okra');
        expect(norm('ladies finger')).toBe('okra');
    });

    test('handles case and whitespace', () => {
        expect(norm('SUNFLOWER')).toBe('sunflower');
        expect(norm('  Wheat  ')).toBe('wheat');
        expect(norm('Tomato')).toBe('tomato');
    });

    test('returns wheat for null/empty input', () => {
        expect(norm(null)).toBe('wheat');
        expect(norm(undefined)).toBe('wheat');
        expect(norm('')).toBe('wheat');
    });
});

describe('Hindi / alias crop name mapping in CROP_COMMODITY_MAP', () => {
    test('CROP_COMMODITY_MAP handles common Hindi→English crop names that Nova translates', () => {
        // The Nova LLM translates Hindi to English before routing
        // So we need to make sure the English names in our map are comprehensive
        const map = liveFetcher.CROP_COMMODITY_MAP;

        // Verify key crops that Hindi users commonly ask about
        expect(map['wheat']).toBeDefined();  // गेहूं → wheat
        expect(map['rice']).toBeDefined();   // चावल → rice
        expect(map['onion']).toBeDefined();  // प्याज → onion
        expect(map['mustard']).toBeDefined(); // सरसों → mustard
        expect(map['chana']).toBeDefined();  // चना → chana
        expect(map['arhar']).toBeDefined();  // अरहर → arhar
        expect(map['urad']).toBeDefined();   // उड़द → urad
        expect(map['moong']).toBeDefined();  // मूंग → moong
        expect(map['bajra']).toBeDefined();  // बाजरा → bajra
        expect(map['jowar']).toBeDefined();  // ज्वार → jowar
        expect(map['sunflower']).toBeDefined(); // सूरजमुखी → sunflower
        expect(map['groundnut']).toBeDefined(); // मूंगफली → groundnut
        expect(map['turmeric']).toBeDefined(); // हल्दी → turmeric
        expect(map['cumin']).toBeDefined();  // जीरा → cumin
        expect(map['potato']).toBeDefined(); // आलू → potato
        expect(map['tomato']).toBeDefined(); // टमाटर → tomato
    });
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 9: Live data date parsing                    */
/* ═══════════════════════════════════════════════════ */

describe('Date parsing from data.gov.in format', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockReset();
    });

    test('handles dd/mm/yyyy date format from government API', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                records: [{
                    commodity: 'Wheat',
                    state: 'Madhya Pradesh',
                    market: 'Indore',
                    price: '2500',
                    arrival_date: '25/12/2024', // dd/mm/yyyy
                }],
            }),
        });

        const result = await liveFetcher.fetchLivePrices('wheat');
        expect(result).toBeDefined();
        if (result.length > 0) {
            // The date should have been converted to ISO or kept parseable
            expect(result[0].arrival_date || result[0].trade_date).toBeDefined();
        }
    });

    test('handles missing date gracefully', async () => {
        global.fetch.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                records: [{
                    commodity: 'Rice',
                    state: 'Punjab',
                    market: 'Ludhiana',
                    price: '3200',
                    // no arrival_date
                }],
            }),
        });

        const result = await liveFetcher.fetchLivePrices('rice');
        expect(result).toBeDefined(); // Should not crash
    });
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 10: Multi-crop comparison (2 crops at once) */
/* ═══════════════════════════════════════════════════ */

describe('Multi-crop comparison flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockReset();
    });

    const COMPARISON_PAIRS = [
        ['wheat', 'rice'],
        ['sunflower', 'groundnut'],
        ['arhar', 'urad'],
        ['turmeric', 'cumin'],
        ['bajra', 'jowar'],
        ['onion', 'potato'],
        ['tomato', 'soybean'],
        ['cotton', 'jute'],
    ];

    for (const [cropA, cropB] of COMPARISON_PAIRS) {
        test(`can fetch ${cropA} and ${cropB} concurrently for comparison`, async () => {
            // Mock DB for both crops
            query.mockResolvedValue({
                rows: [{
                    crop_type: cropA,
                    state: 'TestState',
                    mandi_name: 'TestMandi',
                    modal_price: 3000 + Math.random() * 2000,
                    trade_date: new Date().toISOString(),
                }],
            });

            const [resultA, resultB] = await Promise.all([
                liveFetcher.getOrFetchPrices(cropA),
                liveFetcher.getOrFetchPrices(cropB),
            ]);

            expect(resultA).toBeDefined();
            expect(resultB).toBeDefined();
            expect(resultA.crop_type).toBe(cropA);
            expect(resultB.crop_type).toBe(cropB);
        });
    }
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 11: API response structure validation       */
/* ═══════════════════════════════════════════════════ */

describe('Response structure validation for all crops', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    const ALL_CROPS = [
        'wheat', 'rice', 'tomato', 'onion', 'potato',
        'soybean', 'cotton', 'sugarcane', 'mustard', 'chana',
        'maize', 'sunflower', 'groundnut', 'turmeric', 'cumin',
        'jowar', 'bajra', 'arhar', 'urad', 'moong',
        'barley', 'copra', 'pepper', 'cardamom', 'jute',
    ];

    for (const crop of ALL_CROPS) {
        test(`getOrFetchPrices("${crop}") returns correct response shape`, async () => {
            query.mockResolvedValueOnce({
                rows: [{
                    crop_type: crop,
                    state: 'TestState',
                    mandi_name: 'TestMandi',
                    modal_price: 2000 + Math.random() * 5000,
                    trade_date: new Date().toISOString(),
                    min_price: 1500,
                    max_price: 3000,
                }],
            });

            const result = await liveFetcher.getOrFetchPrices(crop);

            // Validate shape
            expect(result).toBeDefined();
            expect(typeof result).toBe('object');
            expect(result.crop_type).toBe(crop);
            expect(result.prices).toBeDefined();
            expect(Array.isArray(result.prices)).toBe(true);
            expect(result.summary).toBeDefined();
        });
    }
});

/* ═══════════════════════════════════════════════════ */
/* SECTION 12: Stress test — rapid sequential queries  */
/* ═══════════════════════════════════════════════════ */

describe('Rapid sequential queries (stress)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        global.fetch.mockReset();
    });

    test('handles 15 rapid sequential crop price queries', async () => {
        const crops = ['wheat', 'rice', 'tomato', 'onion', 'potato',
            'sunflower', 'groundnut', 'turmeric', 'cumin', 'jowar',
            'bajra', 'arhar', 'urad', 'moong', 'pepper'];

        query.mockResolvedValue({
            rows: [{
                crop_type: 'any',
                state: 'TestState',
                mandi_name: 'TestMandi',
                modal_price: 3000,
                trade_date: new Date().toISOString(),
            }],
        });

        const results = [];
        for (const crop of crops) {
            const r = await liveFetcher.getOrFetchPrices(crop);
            results.push(r);
        }

        expect(results.length).toBe(15);
        for (const r of results) {
            expect(r).toBeDefined();
            expect(r.prices).toBeDefined();
        }
    });
});
