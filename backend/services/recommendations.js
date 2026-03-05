/**
 * Personalized Recommendations Service
 *
 * Requirement 13 – AC4: Personalized recommendations based on user history and context
 * Requirement 13 – AC5: Continuously learn and improve from user interactions
 *
 * This service sits above the existing learning-path recommendations.js Lambda
 * and adds conversation-aware, memory-driven personalisation.
 *
 * Sources of signal:
 *   1. Memory facts (pipecat-memory extracted user facts)
 *   2. Conversation history (recent topics, intents, languages)
 *   3. User profile (crops, land, location)
 *   4. Interaction feedback (thumbs up/down, repeat queries)
 *
 * Outputs:
 *   - Contextual nudges ("You asked about wheat → 3 wheat courses available")
 *   - Domain recommendations (market tips, scheme eligibility, crop advice)
 *   - Learning path suggestions (wired to existing recommendations Lambda)
 *   - Feedback loop storage (interaction outcomes for future tuning)
 */

const { v4: uuid } = require('uuid');
const { PutCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB, TABLE_NAMES } = require('../utils/db');
const memory = require('./memory');
const logger = {
    warn: (...args) => console.warn('[Recommendations]', ...args),
    error: (...args) => console.error('[Recommendations]', ...args),
    info: (...args) => console.log('[Recommendations]', ...args),
};

const RECOMMENDATIONS_TABLE = process.env.RECOMMENDATIONS_TABLE || 'PersonalizedRecommendations';

/* ═══════════════════════════════════════════════════════ */
/*  AC4: Personalized Recommendations                      */
/* ═══════════════════════════════════════════════════════ */

/**
 * Generate context-aware recommendations for a user.
 * Combines memory facts + recent conversations + domain knowledge.
 *
 * @param {string} userId
 * @returns {Promise<{recommendations: object[], reasoning: string}>}
 */
async function getPersonalizedRecommendations(userId) {
    // 1. Gather all signals in parallel
    const [facts, sessions, feedbackHistory] = await Promise.all([
        memory.getUserFacts(userId),
        memory.getUserSessions(userId, 5),
        getRecentFeedback(userId),
    ]);

    // 2. Derive user interest signals from memory facts
    const signals = deriveSignals(facts, sessions, feedbackHistory);

    // 3. Generate recommendations per domain
    const recommendations = [];

    // Agriculture recommendations
    if (signals.crops.length > 0) {
        recommendations.push(...generateCropRecommendations(signals));
    }

    // Market recommendations
    if (signals.topics.has('market') || signals.topics.has('price')) {
        recommendations.push(...generateMarketRecommendations(signals));
    }

    // Scheme recommendations
    if (signals.state || signals.landSize) {
        recommendations.push(...generateSchemeRecommendations(signals));
    }

    // Health recommendations (seasonal)
    recommendations.push(...generateSeasonalHealthTips(signals));

    // Learning recommendations
    recommendations.push(...generateLearningRecommendations(signals));

    // 4. Sort by relevance score and deduplicate
    const uniqueRecs = deduplicateRecommendations(recommendations);
    const sorted = uniqueRecs.sort((a, b) => b.relevanceScore - a.relevanceScore);
    const top = sorted.slice(0, 10);

    // 5. Store for caching & feedback tracking
    await storeRecommendations(userId, top);

    return {
        recommendations: top,
        userSignals: {
            crops: signals.crops,
            location: signals.state ? `${signals.district}, ${signals.state}` : 'Unknown',
            recentTopics: [...signals.topics],
            interactionCount: signals.totalInteractions,
        },
        reasoning: `Generated ${top.length} recommendations based on ${Object.keys(facts).length} memory facts, ${sessions.length} sessions, ${feedbackHistory.length} feedback entries`,
    };
}

/**
 * Derive user interest signals from all data sources.
 */
function deriveSignals(facts, sessions, feedback) {
    const crops = (facts.crops || '').split(',').map(c => c.trim()).filter(Boolean);
    const topics = new Set();

    // Extract topics from recent session summaries
    for (const session of sessions) {
        const msg = (session.firstMessage || '').toLowerCase();
        if (msg.includes('price') || msg.includes('mandi') || msg.includes('rate')) topics.add('market');
        if (msg.includes('scheme') || msg.includes('yojana') || msg.includes('loan')) topics.add('schemes');
        if (msg.includes('weather') || msg.includes('mausam') || msg.includes('barish')) topics.add('weather');
        if (msg.includes('pest') || msg.includes('keet') || msg.includes('rog')) topics.add('pest');
        if (msg.includes('health') || msg.includes('doctor') || msg.includes('bimar')) topics.add('health');
        if (msg.includes('learn') || msg.includes('course') || msg.includes('sikh')) topics.add('learning');
        for (const crop of crops) {
            if (msg.includes(crop.toLowerCase())) topics.add('crop_specific');
        }
    }

    // Extract positive/negative feedback signals
    const positiveTopics = new Set();
    const negativeTopics = new Set();
    for (const fb of feedback) {
        if (fb.rating >= 4) positiveTopics.add(fb.domain);
        if (fb.rating <= 2) negativeTopics.add(fb.domain);
    }

    return {
        crops,
        state: facts.location_state || '',
        district: facts.location_district || '',
        landSize: facts.land_size_acres || '',
        irrigation: facts.irrigation_type || '',
        language: facts.primary_language || 'hi',
        experience: facts.farming_experience_years || '',
        topics,
        positiveTopics,
        negativeTopics,
        totalInteractions: sessions.reduce((sum, s) => sum + (s.turnCount || 0), 0),
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  Domain-Specific Recommendation Generators              */
/* ═══════════════════════════════════════════════════════ */

function generateCropRecommendations(signals) {
    const recs = [];
    const month = new Date().getMonth(); // 0-11
    const season = getSeason(month);

    for (const crop of signals.crops.slice(0, 3)) {
        recs.push({
            id: `crop-${crop}-${season}`,
            type: 'agriculture',
            domain: 'crop_advisory',
            title: `${crop} ${season} advisory`,
            description: `Get ${season}-specific advice for your ${crop} crop including irrigation, fertilizer, and pest management`,
            action: { type: 'voice_query', query: `${crop} ki ${season} mein dekhbhal kaise karein` },
            relevanceScore: 0.85,
            tags: [crop, season, 'advisory'],
        });
    }

    // Pest alert recommendation if they grow crops
    if (signals.crops.length > 0) {
        recs.push({
            id: `pest-alert-${season}`,
            type: 'alert',
            domain: 'pest_management',
            title: `${season} pest alerts`,
            description: `Check current pest and disease alerts for your crops in ${signals.district || 'your area'}`,
            action: { type: 'api_call', endpoint: '/agriculture/pest-alerts' },
            relevanceScore: 0.75,
            tags: ['pest', 'alert', season],
        });
    }

    return recs;
}

function generateMarketRecommendations(signals) {
    const recs = [];

    for (const crop of signals.crops.slice(0, 2)) {
        recs.push({
            id: `price-${crop}`,
            type: 'market',
            domain: 'market_prices',
            title: `${crop} market prices`,
            description: `Current mandi prices for ${crop} in ${signals.state || 'your area'} with trend analysis`,
            action: { type: 'voice_query', query: `${crop} ka aaj ka rate kya hai` },
            relevanceScore: 0.90,
            tags: [crop, 'price', 'market'],
        });
    }

    recs.push({
        id: 'price-alerts-setup',
        type: 'feature',
        domain: 'market_prices',
        title: 'Set price alerts',
        description: 'Get notified when prices for your crops reach your target',
        action: { type: 'navigate', screen: 'PriceAlerts' },
        relevanceScore: 0.65,
        tags: ['price', 'alert', 'notification'],
    });

    return recs;
}

function generateSchemeRecommendations(signals) {
    const recs = [];

    const eligibilityFactors = [];
    if (signals.landSize) eligibilityFactors.push(`${signals.landSize} acres`);
    if (signals.state) eligibilityFactors.push(signals.state);
    if (signals.crops.length > 0) eligibilityFactors.push(signals.crops.join(', '));

    recs.push({
        id: 'scheme-eligibility',
        type: 'government',
        domain: 'schemes',
        title: 'Government scheme check',
        description: `Check your eligibility for schemes based on: ${eligibilityFactors.join(', ') || 'your profile'}`,
        action: { type: 'voice_query', query: 'meri kaunsi sarkari yojana ke liye eligible hoon' },
        relevanceScore: 0.80,
        tags: ['scheme', 'government', 'eligibility'],
    });

    // PM-KISAN is universal for small/marginal farmers
    if (signals.landSize && parseFloat(signals.landSize) <= 5) {
        recs.push({
            id: 'pm-kisan',
            type: 'government',
            domain: 'schemes',
            title: 'PM-KISAN status',
            description: 'Check your PM-KISAN installment status and enrollment',
            action: { type: 'voice_query', query: 'PM KISAN ka status kya hai' },
            relevanceScore: 0.85,
            tags: ['pm-kisan', 'government'],
        });
    }

    return recs;
}

function generateSeasonalHealthTips(signals) {
    const month = new Date().getMonth();
    const recs = [];

    // Monsoon health tips (June-Sept)
    if (month >= 5 && month <= 8) {
        recs.push({
            id: 'monsoon-health',
            type: 'health',
            domain: 'health',
            title: 'Monsoon health tips',
            description: 'Stay safe during monsoon — water-borne disease prevention and first aid',
            action: { type: 'voice_query', query: 'barsaat mein kya health precautions leni chahiye' },
            relevanceScore: 0.60,
            tags: ['health', 'monsoon', 'seasonal'],
        });
    }

    // Summer heat (March-May)
    if (month >= 2 && month <= 4) {
        recs.push({
            id: 'heat-safety',
            type: 'health',
            domain: 'health',
            title: 'Heat safety for farmers',
            description: 'Tips for working safely in summer heat',
            action: { type: 'voice_query', query: 'garmi mein khet mein kaam karte waqt kya dhyan rakhein' },
            relevanceScore: 0.60,
            tags: ['health', 'summer', 'safety'],
        });
    }

    return recs;
}

function generateLearningRecommendations(signals) {
    const recs = [];

    if (signals.experience && parseInt(signals.experience) < 5) {
        recs.push({
            id: 'beginner-farming',
            type: 'learning',
            domain: 'education',
            title: 'Farming basics course',
            description: 'Structured learning path covering soil, seeds, irrigation, and harvest',
            action: { type: 'navigate', screen: 'Courses' },
            relevanceScore: 0.70,
            tags: ['learning', 'beginner', 'farming'],
        });
    }

    if (signals.topics.has('market')) {
        recs.push({
            id: 'market-literacy',
            type: 'learning',
            domain: 'education',
            title: 'Market literacy',
            description: 'Learn how to get the best prices and understand mandi dynamics',
            action: { type: 'navigate', screen: 'Courses' },
            relevanceScore: 0.65,
            tags: ['learning', 'market', 'financial'],
        });
    }

    return recs;
}

/* ═══════════════════════════════════════════════════════ */
/*  AC5: Continuous Learning / Feedback Loop               */
/* ═══════════════════════════════════════════════════════ */

/**
 * Record user feedback on a recommendation or interaction.
 * This creates the feedback loop that allows the system to learn.
 *
 * @param {string} userId
 * @param {object} feedback
 * @param {string} feedback.interactionId   – Session or recommendation ID
 * @param {string} feedback.domain          – Which domain (market, crop, scheme, etc.)
 * @param {number} feedback.rating          – 1-5 rating
 * @param {string} [feedback.feedbackText]  – Optional text feedback
 * @param {string} [feedback.action]        – What user did (followed, ignored, dismissed)
 */
async function recordFeedback(userId, feedback) {
    const feedbackId = `${userId}#${Date.now()}#${uuid().slice(0, 8)}`;

    await dynamoDB.send(new PutCommand({
        TableName: RECOMMENDATIONS_TABLE,
        Item: {
            userId,
            feedbackId,
            interactionId: feedback.interactionId || '',
            domain: feedback.domain || 'general',
            rating: feedback.rating || 3,
            feedbackText: feedback.feedbackText || '',
            action: feedback.action || 'unknown',
            createdAt: new Date().toISOString(),
            ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60), // 90-day TTL
        },
    }));

    // If the feedback is very positive, boost related facts in memory
    if (feedback.rating >= 4 && feedback.domain) {
        try {
            await memory.upsertFact(userId, `interest_${feedback.domain}`, 'high', 'feedback');
        } catch (err) {
            logger.warn('[Recommendations] Failed to boost interest fact:', err.message);
        }
    }

    // If feedback is negative, record avoidance signal
    if (feedback.rating <= 2 && feedback.domain) {
        try {
            await memory.upsertFact(userId, `avoid_${feedback.domain}`, 'true', 'feedback');
        } catch (err) {
            logger.warn('[Recommendations] Failed to store avoidance fact:', err.message);
        }
    }
}

/**
 * Get recent feedback entries for a user (used as signal for future recommendations).
 */
async function getRecentFeedback(userId) {
    try {
        const result = await dynamoDB.send(new QueryCommand({
            TableName: RECOMMENDATIONS_TABLE,
            KeyConditionExpression: 'userId = :uid',
            ExpressionAttributeValues: { ':uid': userId },
            ScanIndexForward: false,
            Limit: 20,
        }));
        return result.Items || [];
    } catch (err) {
        // Table might not exist yet in dev
        logger.warn('[Recommendations] Feedback fetch failed:', err.message);
        return [];
    }
}

/**
 * Track when a user acts on a recommendation (continuous learning signal).
 */
async function trackRecommendationAction(userId, recommendationId, action) {
    try {
        await recordFeedback(userId, {
            interactionId: recommendationId,
            domain: recommendationId.split('-')[0] || 'general',
            rating: action === 'followed' ? 5 : action === 'dismissed' ? 2 : 3,
            action,
        });
    } catch (err) {
        logger.warn('[Recommendations] Track action failed:', err.message);
    }
}

/**
 * Get user engagement analytics (for continuous improvement).
 */
async function getUserEngagement(userId) {
    const feedback = await getRecentFeedback(userId);

    const totalFeedback = feedback.length;
    const avgRating = totalFeedback > 0
        ? feedback.reduce((sum, f) => sum + (f.rating || 3), 0) / totalFeedback
        : 0;

    const domainBreakdown = {};
    for (const fb of feedback) {
        const domain = fb.domain || 'general';
        if (!domainBreakdown[domain]) {
            domainBreakdown[domain] = { count: 0, totalRating: 0, actions: {} };
        }
        domainBreakdown[domain].count++;
        domainBreakdown[domain].totalRating += (fb.rating || 3);
        const action = fb.action || 'unknown';
        domainBreakdown[domain].actions[action] = (domainBreakdown[domain].actions[action] || 0) + 1;
    }

    // Compute per-domain average ratings
    for (const domain of Object.keys(domainBreakdown)) {
        domainBreakdown[domain].avgRating =
            domainBreakdown[domain].totalRating / domainBreakdown[domain].count;
    }

    return {
        userId,
        totalFeedback,
        averageRating: Math.round(avgRating * 100) / 100,
        domainBreakdown,
        topDomains: Object.entries(domainBreakdown)
            .sort((a, b) => b[1].avgRating - a[1].avgRating)
            .map(([domain, stats]) => ({ domain, avgRating: stats.avgRating, count: stats.count })),
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  Helpers                                                */
/* ═══════════════════════════════════════════════════════ */

function getSeason(month) {
    if (month >= 5 && month <= 9) return 'kharif';   // June-Oct (monsoon)
    if (month >= 10 || month <= 1) return 'rabi';     // Nov-Feb (winter)
    return 'zaid'; // Mar-May (summer)
}

function deduplicateRecommendations(recs) {
    const seen = new Set();
    return recs.filter(r => {
        if (seen.has(r.id)) return false;
        seen.add(r.id);
        return true;
    });
}

async function storeRecommendations(userId, recommendations) {
    try {
        await dynamoDB.send(new PutCommand({
            TableName: RECOMMENDATIONS_TABLE,
            Item: {
                userId,
                feedbackId: `recs#${new Date().toISOString()}`,
                recommendations,
                generatedAt: new Date().toISOString(),
                ttl: Math.floor(Date.now() / 1000) + (24 * 60 * 60), // 24h cache
            },
        }));
    } catch (err) {
        logger.warn('[Recommendations] Store failed:', err.message);
    }
}

module.exports = {
    getPersonalizedRecommendations,
    recordFeedback,
    getRecentFeedback,
    trackRecommendationAction,
    getUserEngagement,
};
