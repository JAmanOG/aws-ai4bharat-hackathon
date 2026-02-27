/**
 * Logistics Lambda – transport.js
 * Logistics coordination for produce transportation.
 * Satisfies Req 5.5: Coordinate logistics for produce transportation.
 */

const { query } = require('../../utils/db');

/**
 * Create a logistics/transport request.
 */
async function createRequest(requesterId, data) {
    const {
        trade_order_id, pickup_state, pickup_district, pickup_pincode,
        pickup_lat, pickup_lng, delivery_state, delivery_district,
        delivery_pincode, delivery_lat, delivery_lng,
        cargo_type, weight_kg, vehicle_type, preferred_date, notes,
    } = data;

    // Estimate cost based on distance and weight
    const estimatedCost = estimateTransportCost(
        { lat: pickup_lat, lng: pickup_lng, state: pickup_state },
        { lat: delivery_lat, lng: delivery_lng, state: delivery_state },
        weight_kg, vehicle_type
    );

    const result = await query(
        `INSERT INTO logistics_requests
     (trade_order_id, requester_id, pickup_state, pickup_district, pickup_pincode,
      pickup_lat, pickup_lng, delivery_state, delivery_district, delivery_pincode,
      delivery_lat, delivery_lng, cargo_type, weight_kg, vehicle_type,
      preferred_date, estimated_cost, notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
     RETURNING *`,
        [trade_order_id, requesterId, pickup_state, pickup_district, pickup_pincode,
            pickup_lat, pickup_lng, delivery_state, delivery_district, delivery_pincode,
            delivery_lat, delivery_lng, cargo_type, weight_kg, vehicle_type || 'truck',
            preferred_date, estimatedCost, notes]
    );

    return result.rows[0];
}

/**
 * Get logistics requests for a user.
 */
async function getUserRequests(userId, status = null) {
    let sql = 'SELECT * FROM logistics_requests WHERE requester_id = $1';
    const params = [userId];
    if (status) { sql += ' AND status = $2'; params.push(status); }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.rows;
}

/**
 * Get a specific logistics request.
 */
async function getRequestById(requestId) {
    const result = await query(
        `SELECT lr.*, to2.listing_id, to2.quantity_kg as order_qty, to2.total_amount
     FROM logistics_requests lr
     LEFT JOIN trade_orders to2 ON to2.id = lr.trade_order_id
     WHERE lr.id = $1`,
        [requestId]
    );
    return result.rows[0] || null;
}

/**
 * Update logistics request status.
 */
async function updateRequest(requestId, updates) {
    const { status, transporter_name, transporter_phone, notes } = updates;
    const sets = ['updated_at = NOW()'];
    const params = [];
    let i = 1;

    if (status) { sets.push(`status = $${i++}`); params.push(status); }
    if (transporter_name) { sets.push(`transporter_name = $${i++}`); params.push(transporter_name); }
    if (transporter_phone) { sets.push(`transporter_phone = $${i++}`); params.push(transporter_phone); }
    if (notes) { sets.push(`notes = $${i++}`); params.push(notes); }

    params.push(requestId);
    const result = await query(
        `UPDATE logistics_requests SET ${sets.join(', ')} WHERE id = $${i} RETURNING *`,
        params
    );

    // If delivered, update trade order status too
    if (status === 'delivered') {
        const req = result.rows[0];
        if (req?.trade_order_id) {
            await query(
                'UPDATE trade_orders SET status = $1, updated_at = NOW() WHERE id = $2',
                ['delivered', req.trade_order_id]
            );
        }
    }

    return result.rows[0] || null;
}

/**
 * Get available vehicle types with estimated capacity.
 */
function getVehicleTypes() {
    return [
        { type: 'tractor', capacity_kg: 2000, description: 'Tractor trolley (local transport)', cost_per_km: 15 },
        { type: 'pickup', capacity_kg: 1000, description: 'Pickup van (small loads)', cost_per_km: 12 },
        { type: 'mini-truck', capacity_kg: 3000, description: 'Mini truck / TATA Ace', cost_per_km: 18 },
        { type: 'truck', capacity_kg: 10000, description: 'Standard truck (10T)', cost_per_km: 25 },
        { type: 'tempo', capacity_kg: 5000, description: 'Tempo (medium loads)', cost_per_km: 20 },
    ];
}

/**
 * Estimate transport cost.
 * Uses a simplified distance-based model.
 */
function estimateTransportCost(pickup, delivery, weightKg, vehicleType = 'truck') {
    const vehicles = {
        tractor: { costPerKm: 15, baseCost: 500 },
        pickup: { costPerKm: 12, baseCost: 300 },
        'mini-truck': { costPerKm: 18, baseCost: 800 },
        truck: { costPerKm: 25, baseCost: 1500 },
        tempo: { costPerKm: 20, baseCost: 1000 },
    };

    const vehicle = vehicles[vehicleType] || vehicles.truck;

    // Estimate distance: if coordinates available, use Haversine; otherwise use state heuristic
    let distanceKm = 50; // default

    if (pickup.lat && pickup.lng && delivery.lat && delivery.lng) {
        distanceKm = haversineDistance(
            parseFloat(pickup.lat), parseFloat(pickup.lng),
            parseFloat(delivery.lat), parseFloat(delivery.lng)
        );
    } else if (pickup.state !== delivery.state) {
        distanceKm = 500; // Inter-state
    } else {
        distanceKm = 100; // Intra-state, different district
    }

    // Cost = base + distance × rate + weight surcharge
    const weightSurcharge = weightKg > 5000 ? (weightKg - 5000) * 0.5 : 0;
    const cost = vehicle.baseCost + (distanceKm * vehicle.costPerKm) + weightSurcharge;

    return Math.round(cost);
}

/**
 * Haversine distance between two coordinates in km.
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

module.exports = {
    createRequest, getUserRequests, getRequestById, updateRequest,
    getVehicleTypes, estimateTransportCost, haversineDistance,
};
