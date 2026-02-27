/**
 * Logistics Lambda – collective-bargaining.js
 * AI-powered farmer grouping for collective price negotiation.
 * Satisfies Req 5.3: Enable collective bargaining by grouping farmers.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { query } = require('../../utils/db');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

/**
 * Create a collective bargaining group.
 */
async function createGroup(creatorId, data) {
    const {
        name, crop_type, variety, target_price_per_kg, min_price_per_kg,
        location_state, location_district, initial_quantity_kg,
    } = data;

    const result = await query(
        `INSERT INTO bargaining_groups
     (name, crop_type, variety, target_price_per_kg, min_price_per_kg,
      location_state, location_district, member_count, total_quantity_kg, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,1,$8,$9)
     RETURNING *`,
        [name, crop_type, variety, target_price_per_kg, min_price_per_kg,
            location_state, location_district, initial_quantity_kg || 0, creatorId]
    );

    const group = result.rows[0];

    // Add creator as first member
    if (initial_quantity_kg) {
        await query(
            `INSERT INTO bargaining_group_members (group_id, farmer_id, quantity_kg) VALUES ($1,$2,$3)`,
            [group.id, creatorId, initial_quantity_kg]
        );
    }

    return group;
}

/**
 * Join a bargaining group.
 */
async function joinGroup(groupId, farmerId, data) {
    const { quantity_kg, listing_id } = data;

    const group = await query('SELECT * FROM bargaining_groups WHERE id = $1', [groupId]);
    if (group.rows.length === 0) throw new Error('GROUP_NOT_FOUND');
    if (group.rows[0].status === 'sold' || group.rows[0].status === 'dissolved') {
        throw new Error('GROUP_CLOSED');
    }

    // Check if already member
    const existing = await query(
        'SELECT id FROM bargaining_group_members WHERE group_id = $1 AND farmer_id = $2',
        [groupId, farmerId]
    );
    if (existing.rows.length > 0) throw new Error('ALREADY_MEMBER');

    await query(
        `INSERT INTO bargaining_group_members (group_id, farmer_id, listing_id, quantity_kg) VALUES ($1,$2,$3,$4)`,
        [groupId, farmerId, listing_id, quantity_kg]
    );

    // Update group aggregates
    await query(
        `UPDATE bargaining_groups SET 
     member_count = member_count + 1,
     total_quantity_kg = total_quantity_kg + $1,
     updated_at = NOW()
     WHERE id = $2`,
        [quantity_kg, groupId]
    );

    return getGroupById(groupId);
}

/**
 * Get bargaining group details with members.
 */
async function getGroupById(groupId) {
    const group = await query('SELECT * FROM bargaining_groups WHERE id = $1', [groupId]);
    if (group.rows.length === 0) return null;

    const members = await query(
        'SELECT * FROM bargaining_group_members WHERE group_id = $1 ORDER BY joined_at',
        [groupId]
    );

    // Get current market price for context
    const marketPrice = await query(
        `SELECT AVG(modal_price) as avg_price FROM market_prices
     WHERE crop_type = $1 AND trade_date >= CURRENT_DATE - INTERVAL '7 days'`,
        [group.rows[0].crop_type]
    );

    return {
        ...group.rows[0],
        members: members.rows,
        current_market_avg_price: marketPrice.rows[0]?.avg_price || null,
        bargaining_power: calculateBargainingPower(group.rows[0]),
    };
}

/**
 * Search for bargaining groups to join.
 */
async function searchGroups(filters = {}) {
    const { crop_type, state, status = 'forming', page = 1, limit = 20 } = filters;
    let sql = 'SELECT * FROM bargaining_groups WHERE 1=1';
    const params = [];
    let i = 1;

    if (crop_type) { sql += ` AND crop_type = $${i++}`; params.push(crop_type); }
    if (state) { sql += ` AND location_state = $${i++}`; params.push(state); }
    if (status) { sql += ` AND status = $${i++}`; params.push(status); }

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const offset = (page - 1) * limit;
    sql += ` ORDER BY total_quantity_kg DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return {
        groups: result.rows.map(g => ({ ...g, bargaining_power: calculateBargainingPower(g) })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

/**
 * AI-powered suggestion: find similar listings and suggest forming groups.
 */
async function suggestGroupsForFarmer(farmerId) {
    // Get farmer's active listings
    const farmerListings = await query(
        'SELECT * FROM produce_listings WHERE farmer_id = $1 AND status = $2 ORDER BY created_at DESC',
        [farmerId, 'active']
    );

    if (farmerListings.rows.length === 0) {
        return { suggestions: [], message: 'No active listings found. Create a listing first.' };
    }

    // For each listing, find similar produce in the same area
    const suggestions = [];
    for (const listing of farmerListings.rows) {
        const similar = await query(
            `SELECT farmer_id, crop_type, variety, quantity_kg, price_per_kg, location_district
       FROM produce_listings
       WHERE crop_type = $1 AND status = 'active' AND farmer_id != $2
       AND (location_state = $3 OR location_district = $4)
       ORDER BY created_at DESC LIMIT 20`,
            [listing.crop_type, farmerId, listing.location_state, listing.location_district]
        );

        if (similar.rows.length >= 2) {
            const totalQty = similar.rows.reduce((sum, r) => sum + parseFloat(r.quantity_kg), parseFloat(listing.quantity_kg));
            const avgPrice = similar.rows.reduce((sum, r) => sum + parseFloat(r.price_per_kg || 0), parseFloat(listing.price_per_kg || 0)) / (similar.rows.length + 1);

            // Use AI to generate negotiation strategy
            let aiStrategy = null;
            try {
                aiStrategy = await getAINegotiationStrategy(listing, similar.rows, totalQty);
            } catch (err) {
                console.error('AI strategy error:', err.message);
            }

            suggestions.push({
                crop_type: listing.crop_type,
                variety: listing.variety,
                your_quantity: listing.quantity_kg,
                total_quantity_available: totalQty,
                similar_farmer_count: similar.rows.length,
                avg_asking_price: avgPrice.toFixed(2),
                location: listing.location_district || listing.location_state,
                ai_strategy: aiStrategy,
                recommended_action: totalQty > 5000
                    ? 'Strong group potential — with over 5 tonnes combined, you can negotiate significantly better prices'
                    : 'Group forming — more farmers would strengthen bargaining position',
            });
        }
    }

    return { suggestions, farmer_id: farmerId };
}

/**
 * Get AI negotiation strategy from Bedrock.
 */
async function getAINegotiationStrategy(listing, similarListings, totalQty) {
    const prompt = `You are an agricultural trade advisor for Indian farmers.
A group of ${similarListings.length + 1} farmers in ${listing.location_state || 'India'} want to collectively sell ${listing.crop_type}.
Total combined quantity: ${totalQty} kg.
Individual asking prices range from ₹${Math.min(...similarListings.map(s => s.price_per_kg || 0).filter(p => p > 0))}/kg to ₹${Math.max(...similarListings.map(s => s.price_per_kg || 0))}/kg.

Provide a brief negotiation strategy in JSON:
{
  "suggested_group_price": number,
  "min_acceptable_price": number,
  "negotiation_tips": ["tip1", "tip2"],
  "target_buyer_types": ["wholesaler", "processor"],
  "estimated_premium_percent": number,
  "strategy_summary": "Brief summary in simple language"
}`;

    const response = await bedrock.send(new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }],
        }),
    }));

    const responseBody = JSON.parse(new TextDecoder().decode(response.body));
    const content = responseBody.content?.[0]?.text || '{}';
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
}

/**
 * Calculate bargaining power score (0-100) based on quantity and member count.
 */
function calculateBargainingPower(group) {
    const qty = parseFloat(group.total_quantity_kg || 0);
    const members = group.member_count || 0;

    // Score: 40% quantity impact + 40% member count + 20% status bonus
    let score = 0;
    if (qty >= 10000) score += 40;
    else if (qty >= 5000) score += 30;
    else if (qty >= 1000) score += 20;
    else score += Math.min(qty / 100, 10);

    if (members >= 10) score += 40;
    else if (members >= 5) score += 30;
    else score += members * 5;

    if (group.status === 'negotiating') score += 20;
    else if (group.status === 'active') score += 10;

    return Math.min(score, 100);
}

module.exports = {
    createGroup, joinGroup, getGroupById, searchGroups,
    suggestGroupsForFarmer, calculateBargainingPower,
};
