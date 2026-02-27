/**
 * Supply Chain API – buyers.js
 * Buyer registration, verification, and management.
 * Satisfies Req 5.1: Verified buyers & Req 5.2: Voice-based buyer registration.
 */

const { query } = require('../../utils/db');

/**
 * Register a new buyer (supports voice-based registration via 'registered_via' field).
 */
async function registerBuyer(userId, data) {
    const {
        business_name, business_type, registration_no,
        contact_phone, contact_email,
        location_state, location_district, location_pincode,
        crops_interested, registered_via,
    } = data;

    // Check if this user already registered as buyer
    const existing = await query('SELECT id FROM buyers WHERE user_id = $1', [userId]);
    if (existing.rows.length > 0) {
        throw new Error('BUYER_ALREADY_REGISTERED');
    }

    const result = await query(
        `INSERT INTO buyers
     (user_id, business_name, business_type, registration_no,
      contact_phone, contact_email,
      location_state, location_district, location_pincode,
      crops_interested, registered_via)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING *`,
        [userId, business_name, business_type || 'wholesaler', registration_no,
            contact_phone, contact_email,
            location_state, location_district, location_pincode,
            crops_interested || [], registered_via || 'app']
    );

    return result.rows[0];
}

/**
 * Search buyers by crop interest and location.
 */
async function searchBuyers(filters = {}) {
    const { crop_type, state, district, business_type, verified_only, page = 1, limit = 20 } = filters;
    let sql = 'SELECT * FROM buyers WHERE is_active = true';
    const params = [];
    let i = 1;

    if (crop_type) { sql += ` AND $${i++} = ANY(crops_interested)`; params.push(crop_type); }
    if (state) { sql += ` AND location_state = $${i++}`; params.push(state); }
    if (district) { sql += ` AND location_district = $${i++}`; params.push(district); }
    if (business_type) { sql += ` AND business_type = $${i++}`; params.push(business_type); }
    if (verified_only) { sql += ' AND is_verified = true'; }

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const offset = (page - 1) * limit;
    sql += ` ORDER BY trust_score DESC, avg_rating DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return {
        buyers: result.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

/**
 * Get buyer profile by ID.
 */
async function getBuyerById(buyerId) {
    const buyer = await query(
        `SELECT b.*,
      (SELECT COUNT(*) FROM trade_orders WHERE buyer_id = b.id AND status = 'completed') as completed_trades,
      (SELECT COALESCE(AVG(farmer_rating), 0) FROM trade_orders WHERE buyer_id = b.id AND farmer_rating IS NOT NULL) as avg_farmer_rating
     FROM buyers b WHERE b.id = $1`,
        [buyerId]
    );
    return buyer.rows[0] || null;
}

/**
 * Verify a buyer (admin or DigiLocker-based verification).
 */
async function verifyBuyer(buyerId, method = 'manual') {
    const result = await query(
        `UPDATE buyers SET is_verified = true, verification_method = $1,
     trust_score = LEAST(trust_score + 30, 100), updated_at = NOW()
     WHERE id = $2 RETURNING *`,
        [method, buyerId]
    );
    return result.rows[0] || null;
}

/**
 * Create a trade order (buyer places bid/order on a listing).
 */
async function createTradeOrder(listingId, buyerId, data) {
    const { quantity_kg, agreed_price_per_kg, notes } = data;
    const total_amount = quantity_kg * agreed_price_per_kg;

    // Validate listing exists and is active
    const listing = await query(
        'SELECT * FROM produce_listings WHERE id = $1 AND status = $2',
        [listingId, 'active']
    );
    if (listing.rows.length === 0) throw new Error('LISTING_NOT_AVAILABLE');

    const result = await query(
        `INSERT INTO trade_orders
     (listing_id, farmer_id, buyer_id, quantity_kg, agreed_price_per_kg, total_amount, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
        [listingId, listing.rows[0].farmer_id, buyerId,
            quantity_kg, agreed_price_per_kg, total_amount, notes]
    );

    return result.rows[0];
}

/**
 * Update trade order status.
 */
async function updateTradeOrder(orderId, userId, updates) {
    const { status, payment_status, farmer_rating, buyer_rating } = updates;
    const sets = ['updated_at = NOW()'];
    const params = [];
    let i = 1;

    if (status) { sets.push(`status = $${i++}`); params.push(status); }
    if (payment_status) { sets.push(`payment_status = $${i++}`); params.push(payment_status); }
    if (farmer_rating) { sets.push(`farmer_rating = $${i++}`); params.push(farmer_rating); }
    if (buyer_rating) { sets.push(`buyer_rating = $${i++}`); params.push(buyer_rating); }

    params.push(orderId);
    const result = await query(
        `UPDATE trade_orders SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        params
    );

    // If completed, update buyer stats
    if (status === 'completed') {
        const order = result.rows[0];
        if (order) {
            await query(
                `UPDATE buyers SET total_transactions = total_transactions + 1,
         avg_rating = (SELECT COALESCE(AVG(farmer_rating),0) FROM trade_orders WHERE buyer_id = $1 AND farmer_rating IS NOT NULL),
         updated_at = NOW() WHERE id = $1`,
                [order.buyer_id]
            );
        }
    }

    return result.rows[0] || null;
}

/**
 * Get orders for a farmer or buyer.
 */
async function getOrders(userId, role = 'farmer', status = null) {
    let sql;
    const params = [userId];

    if (role === 'buyer') {
        // Find buyer ID first
        const buyer = await query('SELECT id FROM buyers WHERE user_id = $1', [userId]);
        if (buyer.rows.length === 0) return [];
        params[0] = buyer.rows[0].id;
        sql = `SELECT to2.*, pl.crop_type, pl.variety, pl.quality_grade
           FROM trade_orders to2
           JOIN produce_listings pl ON pl.id = to2.listing_id
           WHERE to2.buyer_id = $1`;
    } else {
        sql = `SELECT to2.*, pl.crop_type, pl.variety, pl.quality_grade, b.business_name
           FROM trade_orders to2
           JOIN produce_listings pl ON pl.id = to2.listing_id
           JOIN buyers b ON b.id = to2.buyer_id
           WHERE to2.farmer_id = $1`;
    }

    if (status) { sql += ' AND to2.status = $2'; params.push(status); }
    sql += ' ORDER BY to2.created_at DESC';

    const result = await query(sql, params);
    return result.rows;
}

module.exports = {
    registerBuyer, searchBuyers, getBuyerById, verifyBuyer,
    createTradeOrder, updateTradeOrder, getOrders,
};
