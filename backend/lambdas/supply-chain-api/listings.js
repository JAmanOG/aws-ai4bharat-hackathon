/**
 * Supply Chain API – listings.js
 * Produce listing CRUD for farmers.
 * Satisfies Req 5.1: Connect farmers with verified buyers.
 */

const { query } = require('../../utils/db');

/**
 * Create a new produce listing.
 */
async function createListing(farmerId, data) {
    const {
        crop_type, variety, quantity_kg, price_per_kg, quality_grade,
        harvest_date, available_from, available_until,
        location_state, location_district, location_pincode,
        location_lat, location_lng, description, images_s3_keys,
    } = data;

    const result = await query(
        `INSERT INTO produce_listings
     (farmer_id, crop_type, variety, quantity_kg, price_per_kg, quality_grade,
      harvest_date, available_from, available_until,
      location_state, location_district, location_pincode,
      location_lat, location_lng, description, images_s3_keys)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
     RETURNING *`,
        [farmerId, crop_type, variety, quantity_kg, price_per_kg,
            quality_grade || 'standard', harvest_date, available_from || new Date(),
            available_until, location_state, location_district, location_pincode,
            location_lat, location_lng, description, images_s3_keys || []]
    );

    return result.rows[0];
}

/**
 * Search produce listings with filters.
 */
async function searchListings(filters = {}) {
    const { crop_type, state, district, quality_grade, min_qty, max_price, page = 1, limit = 20 } = filters;
    let sql = `SELECT pl.*, 
             (SELECT COUNT(*) FROM trade_orders WHERE listing_id = pl.id AND status NOT IN ('cancelled','disputed')) as order_count
             FROM produce_listings pl WHERE pl.status = 'active'`;
    const params = [];
    let i = 1;

    if (crop_type) { sql += ` AND pl.crop_type = $${i++}`; params.push(crop_type); }
    if (state) { sql += ` AND pl.location_state = $${i++}`; params.push(state); }
    if (district) { sql += ` AND pl.location_district = $${i++}`; params.push(district); }
    if (quality_grade) { sql += ` AND pl.quality_grade = $${i++}`; params.push(quality_grade); }
    if (min_qty) { sql += ` AND pl.quantity_kg >= $${i++}`; params.push(min_qty); }
    if (max_price) { sql += ` AND pl.price_per_kg <= $${i++}`; params.push(max_price); }

    // Only show available listings
    sql += ` AND (pl.available_until IS NULL OR pl.available_until >= CURRENT_DATE)`;

    const countResult = await query(`SELECT COUNT(*) as total FROM (${sql}) sub`, params);
    const total = parseInt(countResult.rows[0].total, 10);

    const offset = (page - 1) * limit;
    sql += ` ORDER BY pl.created_at DESC LIMIT $${i++} OFFSET $${i++}`;
    params.push(limit, offset);

    const result = await query(sql, params);

    return {
        listings: result.rows,
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
}

/**
 * Get a listing by ID with matching buyers.
 */
async function getListingById(listingId) {
    const listing = await query('SELECT * FROM produce_listings WHERE id = $1', [listingId]);
    if (listing.rows.length === 0) return null;

    // Find matching buyers interested in this crop
    const buyers = await query(
        `SELECT id, business_name, business_type, location_state, location_district,
            trust_score, avg_rating, total_transactions, is_verified
     FROM buyers
     WHERE is_active = true AND $1 = ANY(crops_interested)
     ORDER BY trust_score DESC, avg_rating DESC
     LIMIT 10`,
        [listing.rows[0].crop_type]
    );

    // Get existing orders for this listing
    const orders = await query(
        `SELECT to2.*, b.business_name 
     FROM trade_orders to2 
     JOIN buyers b ON b.id = to2.buyer_id 
     WHERE to2.listing_id = $1
     ORDER BY to2.created_at DESC`,
        [listingId]
    );

    return {
        ...listing.rows[0],
        matching_buyers: buyers.rows,
        orders: orders.rows,
    };
}

/**
 * Get all listings for a farmer.
 */
async function getFarmerListings(farmerId, status = null) {
    let sql = 'SELECT * FROM produce_listings WHERE farmer_id = $1';
    const params = [farmerId];

    if (status) {
        sql += ' AND status = $2';
        params.push(status);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Update listing status (mark as sold, cancel, etc.)
 */
async function updateListingStatus(listingId, farmerId, status) {
    const result = await query(
        `UPDATE produce_listings SET status = $1, updated_at = NOW()
     WHERE id = $2 AND farmer_id = $3 RETURNING *`,
        [status, listingId, farmerId]
    );
    return result.rows[0] || null;
}

module.exports = { createListing, searchListings, getListingById, getFarmerListings, updateListingStatus };
