/**
 * Market Domain Agent
 *
 * Handles: crop prices, mandi information, price trends, market timing,
 * buyer connections, supply chain queries.
 */

const liveFetcher = require('../market-data-fetcher');

const SYSTEM_PROMPT = `You are a knowledgeable market advisor for Indian farmers.
You help with:
- Current mandi (market) prices for crops
- Price trend analysis and forecasts
- Best time to sell produce
- Nearest mandi locations and timings
- Buyer connections and fair pricing
- Supply chain and logistics

Guidelines:
- Quote prices in ₹/quintal or ₹/kg as appropriate
- Reference specific mandis (APMCs) when possible
- Explain price trends simply (up/down/stable)
- Suggest optimal selling windows
- Warn about MSP (Minimum Support Price) when relevant
- Keep responses brief for voice output (2-3 sentences)

{memory_context}`;

const SUPPORTED_INTENTS = [
    'crop_prices',
    'price_trend',
    'mandi_info',
    'sell_timing',
    'buyer_connection',
    'supply_chain',
    'msp_info',
    'transport_logistics',
];

const LIVE_MARKET_INTENTS = new Set(['crop_prices', 'mandi_info']);

const STATE_ALIASES = {
    mh: 'Maharashtra',
    maha: 'Maharashtra',
    maharashtra: 'Maharashtra',
    maharastra: 'Maharashtra',
    mp: 'Madhya Pradesh',
    'madhya pradesh': 'Madhya Pradesh',
    up: 'Uttar Pradesh',
    'uttar pradesh': 'Uttar Pradesh',
    rj: 'Rajasthan',
    rajasthan: 'Rajasthan',
    gj: 'Gujarat',
    gujarat: 'Gujarat',
    pb: 'Punjab',
    punjab: 'Punjab',
    hr: 'Haryana',
    haryana: 'Haryana',
    ka: 'Karnataka',
    karnataka: 'Karnataka',
    tn: 'Tamil Nadu',
    'tamil nadu': 'Tamil Nadu',
    ts: 'Telangana',
    tg: 'Telangana',
    telangana: 'Telangana',
    ap: 'Andhra Pradesh',
    'andhra pradesh': 'Andhra Pradesh',
    wb: 'West Bengal',
    'west bengal': 'West Bengal',
    br: 'Bihar',
    bihar: 'Bihar',
    as: 'Assam',
    assam: 'Assam',
    kl: 'Kerala',
    kerala: 'Kerala',
    dl: 'Delhi',
    delhi: 'Delhi',
};

function normalizeStateName(raw) {
    const name = String(raw || '')
        .toLowerCase()
        .trim()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');
    return STATE_ALIASES[name];
}

function toNumber(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

function capitalizeWords(value) {
    return String(value || '')
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function buildMarketSnapshot(result, crop, state) {
    const prices = Array.isArray(result?.prices)
        ? result.prices
            .map((price) => ({
                mandi_name: price.mandi_name || price.market || 'Unknown mandi',
                state: price.state || '',
                district: price.district || '',
                price_per_quintal: toNumber(price.price_per_quintal ?? price.modal_price ?? price.price),
                date: price.trade_date || price.arrival_date || '',
            }))
            .filter((price) => price.price_per_quintal > 0)
        : [];

    const summary = result?.summary ? {
        average_price: toNumber(result.summary.average_price ?? result.summary.avgPrice),
        min_price: toNumber(result.summary.min_price ?? result.summary.minPrice),
        max_price: toNumber(result.summary.max_price ?? result.summary.maxPrice),
        mandi_count: toNumber(result.summary.mandi_count ?? result.summary.totalMandis) || prices.length,
    } : null;

    return {
        crop,
        state,
        prices,
        summary,
        source: result?.source || 'none',
        fresh: !!result?.fresh,
        message: result?.message,
    };
}

function buildLivePriceResponse(snapshot) {
    const cropLabel = capitalizeWords(snapshot.crop);
    const regionLabel = snapshot.state ? ` in ${snapshot.state}` : '';

    if (!snapshot.summary || snapshot.prices.length === 0) {
        return `I could not find live mandi prices for ${cropLabel}${regionLabel} right now. Please try again in a few minutes or ask for another crop.`;
    }

    const topMandis = snapshot.prices
        .slice()
        .sort((a, b) => b.price_per_quintal - a.price_per_quintal)
        .slice(0, 3)
        .map((price) => `${price.mandi_name}${price.state ? `, ${price.state}` : ''} at Rs ${Math.round(price.price_per_quintal)}`)
        .join('; ');

    const avg = Math.round(snapshot.summary.average_price);
    const mandiCount = snapshot.summary.mandi_count || snapshot.prices.length;
    const sourceLabel = snapshot.fresh ? 'live' : 'cached';
    return `The ${sourceLabel} ${cropLabel} price${regionLabel} is about Rs ${avg} per quintal across ${mandiCount} mandis. Highest recent quotes are ${topMandis}.`;
}

function buildSnapshotPrompt(snapshot) {
    if (!snapshot?.summary || snapshot.prices.length === 0) {
        return snapshot?.message || 'No live mandi data was found for this crop.';
    }

    const topMandis = snapshot.prices
        .slice()
        .sort((a, b) => b.price_per_quintal - a.price_per_quintal)
        .slice(0, 3)
        .map((price) => `${price.mandi_name} (${price.state || 'India'}) Rs ${Math.round(price.price_per_quintal)}`)
        .join('; ');

    return [
        `Crop: ${snapshot.crop}`,
        snapshot.state ? `State filter: ${snapshot.state}` : null,
        `Average price: Rs ${Math.round(snapshot.summary.average_price)} per quintal`,
        `Price range: Rs ${Math.round(snapshot.summary.min_price)} to Rs ${Math.round(snapshot.summary.max_price)} per quintal`,
        `Mandis: ${snapshot.summary.mandi_count}`,
        `Top mandis: ${topMandis}`,
        `Data source: ${snapshot.source}`,
        `Fresh live fetch: ${snapshot.fresh ? 'yes' : 'no'}`,
    ].filter(Boolean).join('\n');
}

async function handle(ctx, deps) {
    const { messages, intent, entities, complexity } = ctx;
    const { llm } = deps;

    const normalizedCrop = entities?.crop ? liveFetcher.normalizeCropName(entities.crop) : '';
    const normalizedState = normalizeStateName(entities?.location);
    const normalizedEntities = {
        ...entities,
        ...(normalizedCrop ? { crop: normalizedCrop } : {}),
        ...(normalizedState ? { location: normalizedState } : {}),
    };

    let snapshot = null;
    if (normalizedCrop) {
        try {
            const result = await liveFetcher.getOrFetchPrices(normalizedCrop, normalizedState ? { state: normalizedState } : {});
            snapshot = buildMarketSnapshot(result, normalizedCrop, normalizedState);
        } catch (err) {
            snapshot = {
                crop: normalizedCrop,
                state: normalizedState,
                prices: [],
                summary: null,
                source: 'error',
                fresh: false,
                message: `Live mandi lookup failed: ${err.message}`,
            };
        }
    }

    if (normalizedCrop && LIVE_MARKET_INTENTS.has(intent)) {
        return {
            response: buildLivePriceResponse(snapshot),
            provider: 'market-live',
            metadata: {
                domain: 'market',
                intent,
                entities: normalizedEntities,
                grounded: true,
                marketData: snapshot,
            },
        };
    }

    let enrichment = '';
    if (normalizedCrop) enrichment += `\nCrop in question: ${normalizedCrop}`;
    if (normalizedState) enrichment += `\nMarket location: ${normalizedState}`;
    if (entities?.price) enrichment += `\nMentioned price: ₹${entities.price}`;
    if (snapshot) {
        enrichment += `\nUse this live market data as the source of truth:\n${buildSnapshotPrompt(snapshot)}`;
    }

    const marketMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content) + enrichment,
            };
        }
        return m;
    });

    const opts = {
        temperature: 0.2,
        maxTokens: complexity === 'complex' ? 1024 : 512,
    };

    // Agent uses Sarvam-M (fast, free) — complex queries are routed to Claude by MCP
    const result = await llm.generateResponse(marketMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: {
            domain: 'market',
            intent,
            entities: normalizedEntities,
            usage: result.usage,
            grounded: !!snapshot?.summary,
            ...(snapshot ? { marketData: snapshot } : {}),
        },
    };
}

module.exports = {
    name: 'market',
    description: 'Market domain agent — prices, mandis, trends, buyers, supply chain',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
