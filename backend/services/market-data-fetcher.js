/**
 * Live Market Data Fetcher
 *
 * Fetches real-time mandi price data from:
 * 1. data.gov.in Open API (primary — free, 1000 calls/day)
 * 2. Agmarknet scraper fallback
 *
 * Supports 20+ commodities. Runs on a schedule (every 4 hours) and
 * also provides on-demand fetch for any crop the user asks about.
 *
 * API: https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070
 *   → Daily Prices of Commodities, Ministry of Consumer Affairs
 */

const { query } = require('../utils/db');

/* ─── data.gov.in endpoint for daily commodity prices ─── */
const DATA_GOV_RESOURCE_ID = '9ef84268-d588-465a-a308-a864a43d0070';
const DATA_GOV_BASE = 'https://api.data.gov.in/resource';
const DATA_GOV_API_KEY = process.env.DATA_GOV_API_KEY || '579b464db66ec23bdd000001cdd3946e44ce4aad7209ff7b23ac571b';

/* ─── In-memory cache (survives across requests, avoids duplicate fetches) ─── */
const _memCache = new Map();          // key → { data, ts }
const MEM_CACHE_TTL = 30 * 60 * 1000; // 30 minutes
const _inflight = new Map();           // key → Promise  (dedup concurrent requests)

/* ─── Rate-limit guard ─── */
let _lastApiCallTs = 0;
const MIN_API_GAP_MS = 600; // at least 600 ms between data.gov.in calls

/* ═══════════════════════════════════════════════════════════════════
 * CROP NAME NORMALIZATION
 * Handles plurals, Hindi names, aliases, typos, STT artifacts.
 * ═══════════════════════════════════════════════════════════════════ */
const CROP_ALIASES = {
    // ── Plurals ──
    sunflowers: 'sunflower', tomatoes: 'tomato', potatoes: 'potato',
    onions: 'onion', soybeans: 'soybean', groundnuts: 'groundnut',
    // ── Hindi / regional names ──
    gehu: 'wheat', gehun: 'wheat',
    chawal: 'rice', dhan: 'rice', paddy: 'rice',
    pyaaz: 'onion', pyaz: 'onion', kanda: 'onion',
    aloo: 'potato', aaloo: 'potato',
    tamatar: 'tomato',
    sarson: 'mustard', sarso: 'mustard',
    surajmukhi: 'sunflower',
    makka: 'maize', makki: 'maize', corn: 'maize',
    ganna: 'sugarcane',
    moongfali: 'groundnut', mungfali: 'groundnut', peanut: 'groundnut', peanuts: 'groundnut',
    haldi: 'turmeric',
    jeera: 'cumin', jira: 'cumin',
    dal: 'arhar', toor: 'arhar', tur: 'arhar',
    kapas: 'cotton', kapaan: 'cotton',
    jau: 'barley',
    elaichi: 'cardamom',
    mirch: 'pepper', mirchi: 'pepper',
    nariyal: 'copra', coconut: 'copra',
    pat: 'jute', paat: 'jute',
    gram: 'chana', chickpea: 'chana', chickpeas: 'chana',
    ragi: 'bajra', millet: 'bajra', pearl_millet: 'bajra',
    sorghum: 'jowar',
    lentil: 'moong', lentils: 'moong',
    'black gram': 'urad', 'urad dal': 'urad',
    'green gram': 'moong', 'moong dal': 'moong',
    okra: 'okra', okras: 'okra',
    bhindi: 'okra', bhendi: 'okra',
    'lady finger': 'okra', 'ladies finger': 'okra',
};

/**
 * Normalize a crop name: strips trailing 's', looks up aliases.
 * Always returns a key that exists in CROP_COMMODITY_MAP (or the cleaned input).
 */
function normalizeCropName(raw) {
    if (!raw) return 'wheat';
    let name = raw.toLowerCase().trim().replace(/[-_]+/g, ' ');
    // Direct alias hit
    if (CROP_ALIASES[name]) return CROP_ALIASES[name];
    // Strip trailing 's', 'es'
    const depluralized = name.replace(/e?s$/, '');
    if (CROP_COMMODITY_MAP[depluralized]) return depluralized;
    if (CROP_ALIASES[depluralized]) return CROP_ALIASES[depluralized];
    // Fuzzy: check if any key starts with input
    const keys = Object.keys(CROP_COMMODITY_MAP);
    const prefixMatch = keys.find(k => k.startsWith(name) || name.startsWith(k));
    if (prefixMatch) return prefixMatch;
    // Give up — return cleaned name (will fall through to direct API search)
    return name;
}

/**
 * Commodity name mapping: our internal crop_type → data.gov.in commodity names
 * data.gov.in uses Title Case English commodity names.
 */
const CROP_COMMODITY_MAP = {
    wheat:      ['Wheat'],
    rice:       ['Rice', 'Paddy(Dhan)(Common)'],
    tomato:     ['Tomato'],
    onion:      ['Onion'],
    potato:     ['Potato'],
    soybean:    ['Soyabean'],
    cotton:     ['Cotton'],
    sugarcane:  ['Sugarcane'],
    mustard:    ['Mustard', 'Mustard Oil'],
    chana:      ['Gram(Chana)(Whole)', 'Bengal Gram(Gram)(Whole)'],
    maize:      ['Maize'],
    sunflower:  ['Sunflower', 'Sunflower Seed'],
    groundnut:  ['Groundnut', 'Groundnut (Shelled)'],
    turmeric:   ['Turmeric', 'Turmeric(Bulb)'],
    cumin:      ['Cummin(Jeera)', 'Cumin Seed(Jeera)'],
    jowar:      ['Jowar(Sorghum)'],
    bajra:      ['Bajra(Pearl Millet)'],
    arhar:      ['Arhar (Tur/Red Gram)', 'Arhar Dal(Tur Dal)'],
    urad:       ['Urad (Heads)', 'Urad Dal'],
    moong:      ['Moong(Green Gram)(Whole)', 'Green Gram (Moong)(Whole)'],
    barley:     ['Barley (Jau)'],
    copra:      ['Copra'],
    pepper:     ['Pepper'],
    cardamom:   ['Small Cardamom'],
    jute:       ['Jute'],
    okra:       ['Bhindi(Ladies Finger)', 'Ladies Finger'],
};

/**
 * All supported crop types (the keys above + any crop in DB).
 */
function getSupportedCrops() {
    return Object.keys(CROP_COMMODITY_MAP);
}

/**
 * Fetch LIVE prices from data.gov.in for a specific commodity.
 *
 * @param {string} cropType - Internal crop name (wheat, sunflower, etc.)
 * @param {object} [opts]
 * @param {number} [opts.limit=50]  - Max records to fetch
 * @param {string} [opts.state]     - Filter by state
 * @returns {Promise<Array>} Array of price records
 */
async function fetchLivePrices(cropType, opts = {}) {
    const { limit = 50, state } = opts;
    const normalized = normalizeCropName(cropType);
    const commodityNames = CROP_COMMODITY_MAP[normalized];

    if (!commodityNames) {
        // Unknown crop — try direct search
        return _fetchFromDataGov(cropType, { limit, state });
    }

    // Try each commodity name variant until we get results
    for (const commodity of commodityNames) {
        const results = await _fetchFromDataGov(commodity, { limit, state });
        if (results.length > 0) return results;
    }

    return [];
}

/**
 * Internal: call data.gov.in API
 */
async function _fetchFromDataGov(commodity, { limit = 50, state } = {}) {
    const params = new URLSearchParams({
        'api-key': DATA_GOV_API_KEY,
        format: 'json',
        limit: String(limit),
        offset: '0',
    });

    // The API uses filter fields
    params.set('filters[commodity]', commodity);
    if (state) {
        params.set('filters[state]', state);
    }

    const url = `${DATA_GOV_BASE}/${DATA_GOV_RESOURCE_ID}?${params.toString()}`;

    // Rate-limit guard: wait if we called too recently
    const now = Date.now();
    const gap = now - _lastApiCallTs;
    if (gap < MIN_API_GAP_MS) {
        await new Promise(r => setTimeout(r, MIN_API_GAP_MS - gap));
    }
    _lastApiCallTs = Date.now();

    try {
        const res = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            signal: AbortSignal.timeout(10000),
        });

        if (res.status === 429) {
            console.warn(`data.gov.in 429 rate-limited for "${commodity}", retrying in 2s...`);
            await new Promise(r => setTimeout(r, 2000));
            _lastApiCallTs = Date.now();
            const retry = await fetch(url, {
                headers: { 'Accept': 'application/json' },
                signal: AbortSignal.timeout(10000),
            });
            if (!retry.ok) {
                console.error(`data.gov.in retry failed: ${retry.status}`);
                return [];
            }
            const json = await retry.json();
            return (json.records || []).map(r => _mapRecord(r, commodity));
        }

        if (!res.ok) {
            console.error(`data.gov.in API error: ${res.status} ${res.statusText}`);
            return [];
        }

        const json = await res.json();
        const records = json.records || [];

        return records.map(r => _mapRecord(r, commodity));
    } catch (err) {
        console.error(`data.gov.in fetch error for "${commodity}":`, err.message);
        return [];
    }
}

/** Map a raw data.gov.in record to our internal shape */
function _mapRecord(r, commodity) {
    return {
        crop_type: commodity.toLowerCase(),
        variety: r.variety || '',
        mandi_name: r.market || r.district || '',
        state: r.state || '',
        district: r.district || '',
        min_price: parseFloat(r.min_price) || 0,
        max_price: parseFloat(r.max_price) || 0,
        modal_price: parseFloat(r.modal_price) || 0,
        arrival_date: r.arrival_date || '',
        source: 'data.gov.in',
    };
}

/**
 * Fetch and cache prices: first check DB for fresh data (< 6 hours old),
 * if stale or missing → fetch live → upsert into DB → return.
 *
 * This is the primary function screens and agents should call.
 *
 * @param {string} cropType
 * @param {object} [opts]
 * @returns {Promise<{prices: Array, summary: object, source: string, fresh: boolean}>}
 */
async function getOrFetchPrices(cropType, opts = {}) {
    const normalized = normalizeCropName(cropType);
    const { state, district, forceRefresh = false } = opts;
    const cacheKey = `prices:${normalized}:${state || ''}:${district || ''}`;

    // 0. In-memory cache hit (fastest — avoids DB + API)
    if (!forceRefresh) {
        const mem = _memCache.get(cacheKey);
        if (mem && Date.now() - mem.ts < MEM_CACHE_TTL) {
            return { ...mem.data, source: 'mem-cache', fresh: false };
        }
    }

    // 0b. Dedup: if an identical request is already in-flight, wait for it
    if (_inflight.has(cacheKey)) {
        return _inflight.get(cacheKey);
    }

    const doFetch = async () => {
        // 1. Check DB for recent data (within 6 hours)
        if (!forceRefresh) {
            const dbResult = await _getFromDB(normalized, { state, district });
            if (dbResult && dbResult.prices.length > 0) {
                const result = { ...dbResult, source: 'cache', fresh: false };
                _memCache.set(cacheKey, { data: result, ts: Date.now() });
                return result;
            }
        }

        // 2. Fetch live from data.gov.in
        const liveRecords = await fetchLivePrices(normalized, { limit: 50, state });

        if (liveRecords.length > 0) {
            // 3. Upsert into database for trend + cache
            await _upsertRecords(normalized, liveRecords);

            // 4. Read back from DB (ensures consistent format)
            const dbResult = await _getFromDB(normalized, { state, district });
            if (dbResult) {
                const result = { ...dbResult, source: 'data.gov.in', fresh: true };
                _memCache.set(cacheKey, { data: result, ts: Date.now() });
                return result;
            }
        }

        // 5. Fallback: return whatever DB has (even old data)
        const fallback = await _getFromDB(normalized, { state, district, daysBack: 90 });
        if (fallback && fallback.prices.length > 0) {
            const result = { ...fallback, source: 'cache-stale', fresh: false };
            _memCache.set(cacheKey, { data: result, ts: Date.now() });
            return result;
        }

        // 6. Nothing at all
        return {
            crop_type: normalized,
            prices: [],
            summary: null,
            source: 'none',
            fresh: false,
            message: `No price data available for "${cropType}". Try again in a moment — the government API may be rate-limited.`,
        };
    };

    const promise = doFetch().finally(() => _inflight.delete(cacheKey));
    _inflight.set(cacheKey, promise);
    return promise;
}

/**
 * Read prices from the local database.
 */
async function _getFromDB(cropType, { state, district, daysBack = 7 } = {}) {
    let sql = `SELECT * FROM market_prices WHERE LOWER(crop_type) = $1 AND trade_date >= CURRENT_DATE - $2 * INTERVAL '1 day'`;
    const params = [cropType, daysBack];
    let i = 3;
    if (state) { sql += ` AND LOWER(state) = LOWER($${i++})`; params.push(state); }
    if (district) { sql += ` AND LOWER(district) = LOWER($${i++})`; params.push(district); }
    sql += ` ORDER BY trade_date DESC, modal_price DESC LIMIT 50`;

    const result = await query(sql, params);
    const prices = result.rows;
    if (prices.length === 0) return null;

    const modalPrices = prices.map(p => parseFloat(p.modal_price)).filter(p => p > 0);
    const summary = modalPrices.length > 0 ? {
        avgPrice: (modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length).toFixed(2),
        average_price: (modalPrices.reduce((a, b) => a + b, 0) / modalPrices.length).toFixed(2),
        minPrice: Math.min(...modalPrices).toFixed(2),
        min_price: Math.min(...modalPrices).toFixed(2),
        maxPrice: Math.max(...modalPrices).toFixed(2),
        max_price: Math.max(...modalPrices).toFixed(2),
        mandi_count: new Set(prices.map(p => p.mandi_name)).size,
        totalMandis: new Set(prices.map(p => p.mandi_name)).size,
    } : null;

    return { crop_type: cropType, prices, summary };
}

/**
 * Upsert live records into the database.
 */
async function _upsertRecords(normalizedCrop, records) {
    let inserted = 0;
    for (const r of records) {
        try {
            // Parse arrival_date (data.gov.in format: "25/02/2026" or ISO)
            let tradeDate;
            if (r.arrival_date && r.arrival_date.includes('/')) {
                const [d, m, y] = r.arrival_date.split('/');
                tradeDate = `${y}-${m}-${d}`;
            } else {
                tradeDate = r.arrival_date || new Date().toISOString().split('T')[0];
            }

            await query(
                `INSERT INTO market_prices
                 (crop_type, variety, mandi_name, state, district,
                  min_price, max_price, modal_price, trade_date, source)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::date, $10)
                 ON CONFLICT DO NOTHING`,
                [normalizedCrop, r.variety, r.mandi_name, r.state, r.district,
                 r.min_price, r.max_price, r.modal_price, tradeDate, 'data.gov.in']
            );
            inserted++;
        } catch (err) {
            // Silently skip duplicates / constraint errors
        }
    }
    return inserted;
}

/**
 * Fetch live price trend (historical data.gov.in doesn't provide historical,
 * so we rely on our cached DB data accumulated over time).
 * The first call for a new crop fetches live and seeds the DB.
 */
async function getOrFetchTrend(cropType, opts = {}) {
    const normalized = normalizeCropName(cropType);
    const { days = 90, state } = opts;

    // Ensure we have at least today's data
    await getOrFetchPrices(normalized, { state });

    // Now query the trend from DB
    let sql = `SELECT trade_date,
               AVG(modal_price) as avg_modal,
               MIN(min_price) as min_price,
               MAX(max_price) as max_price,
               SUM(arrival_qty) as total_arrival_qty,
               COUNT(DISTINCT mandi_name) as mandi_count
               FROM market_prices
               WHERE LOWER(crop_type) = $1 AND trade_date >= CURRENT_DATE - $2::int * INTERVAL '1 day'`;
    const params = [normalized, days];
    let i = 3;
    if (state) { sql += ` AND LOWER(state) = LOWER($${i++})`; params.push(state); }
    sql += ' GROUP BY trade_date ORDER BY trade_date ASC';

    const result = await query(sql, params);
    const trend = result.rows;
    let trendDirection = 'stable';
    if (trend.length >= 2) {
        const first = parseFloat(trend[0].avg_modal);
        const last = parseFloat(trend[trend.length - 1].avg_modal);
        const change = ((last - first) / first) * 100;
        if (change > 5) trendDirection = 'rising';
        else if (change < -5) trendDirection = 'falling';
    }

    return {
        crop_type: normalized,
        period_days: days,
        trend: trendDirection,
        data_points: trend,
    };
}

/**
 * Get all available crops (from DB + supported list).
 */
async function getAvailableCrops() {
    const dbResult = await query(
        `SELECT DISTINCT crop_type, COUNT(*) as record_count,
                MAX(trade_date) as latest_date
         FROM market_prices
         GROUP BY crop_type
         ORDER BY crop_type`
    );

    const dbCrops = dbResult.rows.map(r => ({
        name: r.crop_type,
        records: parseInt(r.record_count),
        latestDate: r.latest_date,
        source: 'database',
    }));

    // Merge with supported live crops
    const allCrops = new Map();
    for (const c of dbCrops) allCrops.set(c.name, c);
    for (const name of getSupportedCrops()) {
        if (!allCrops.has(name)) {
            allCrops.set(name, { name, records: 0, latestDate: null, source: 'live-available' });
        }
    }

    return Array.from(allCrops.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Background sync: fetch fresh data for top crops.
 * Called by a scheduler or on server start.
 */
async function syncTopCrops() {
    const topCrops = ['wheat', 'rice', 'tomato', 'onion', 'potato', 'soybean',
                      'cotton', 'mustard', 'chana', 'sunflower', 'maize',
                      'groundnut', 'turmeric', 'cumin', 'jowar', 'bajra', 'okra',
                      'arhar', 'urad', 'moong'];
    let total = 0;
    for (const crop of topCrops) {
        try {
            const result = await getOrFetchPrices(crop, { forceRefresh: true });
            if (result.fresh) total += result.prices?.length || 0;
        } catch (err) {
            console.error(`Sync failed for ${crop}:`, err.message);
        }
    }
    console.log(`[MarketSync] Synced ${total} price records for ${topCrops.length} crops`);
    return total;
}

module.exports = {
    fetchLivePrices,
    getOrFetchPrices,
    getOrFetchTrend,
    getAvailableCrops,
    syncTopCrops,
    getSupportedCrops,
    normalizeCropName,
    CROP_COMMODITY_MAP,
    CROP_ALIASES,
};
