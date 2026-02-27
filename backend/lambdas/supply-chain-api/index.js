/**
 * Supply Chain API Lambda – Main handler
 * Routes API Gateway events for produce listings, buyers, and trade orders.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const listings = require('./listings');
const buyers = require('./buyers');

exports.handler = async (event) => {
    console.log('Supply Chain API event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-farmer';
    const qp = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        // ═══ Produce Listings ═══

        // POST /agriculture/listings – Create listing
        if (path.match(/\/agriculture\/listings$/) && method === 'POST') {
            if (!body.crop_type || !body.quantity_kg) return badRequest('crop_type and quantity_kg are required');
            const result = await listings.createListing(userId, body);
            return success(result, 201);
        }

        // GET /agriculture/listings – Search listings
        if (path.match(/\/agriculture\/listings$/) && method === 'GET') {
            const result = await listings.searchListings({
                crop_type: qp.crop_type, state: qp.state, district: qp.district,
                quality_grade: qp.quality_grade, min_qty: qp.min_qty, max_price: qp.max_price,
                page: parseInt(qp.page || '1'), limit: parseInt(qp.limit || '20'),
            });
            return success(result);
        }

        // GET /agriculture/listings/my – Farmer's own listings
        if (path.match(/\/agriculture\/listings\/my$/) && method === 'GET') {
            const result = await listings.getFarmerListings(userId, qp.status);
            return success({ listings: result });
        }

        // GET /agriculture/listings/:id – Single listing with matching buyers
        if (path.match(/\/agriculture\/listings\/([a-f0-9-]+)$/) && method === 'GET') {
            const id = path.match(/\/agriculture\/listings\/([a-f0-9-]+)$/)[1];
            const result = await listings.getListingById(id);
            if (!result) return notFound('Listing not found');
            return success(result);
        }

        // PUT /agriculture/listings/:id/status – Update listing status
        if (path.match(/\/agriculture\/listings\/([a-f0-9-]+)\/status$/) && method === 'PUT') {
            const id = path.match(/\/agriculture\/listings\/([a-f0-9-]+)\/status$/)[1];
            if (!body.status) return badRequest('status is required');
            const result = await listings.updateListingStatus(id, userId, body.status);
            if (!result) return notFound('Listing not found or not owned by you');
            return success(result);
        }

        // ═══ Buyers ═══

        // POST /agriculture/buyers/register – Register as buyer
        if (path.match(/\/agriculture\/buyers\/register$/) && method === 'POST') {
            if (!body.business_name) return badRequest('business_name is required');
            try {
                const result = await buyers.registerBuyer(userId, body);
                return success(result, 201);
            } catch (e) {
                if (e.message === 'BUYER_ALREADY_REGISTERED') return badRequest('Already registered as buyer');
                throw e;
            }
        }

        // GET /agriculture/buyers – Search buyers
        if (path.match(/\/agriculture\/buyers$/) && method === 'GET') {
            const result = await buyers.searchBuyers({
                crop_type: qp.crop_type, state: qp.state, district: qp.district,
                business_type: qp.business_type, verified_only: qp.verified === 'true',
                page: parseInt(qp.page || '1'), limit: parseInt(qp.limit || '20'),
            });
            return success(result);
        }

        // GET /agriculture/buyers/:id – Buyer profile
        if (path.match(/\/agriculture\/buyers\/([a-f0-9-]+)$/) && method === 'GET') {
            const id = path.match(/\/agriculture\/buyers\/([a-f0-9-]+)$/)[1];
            const result = await buyers.getBuyerById(id);
            if (!result) return notFound('Buyer not found');
            return success(result);
        }

        // POST /agriculture/buyers/:id/verify – Verify buyer
        if (path.match(/\/agriculture\/buyers\/([a-f0-9-]+)\/verify$/) && method === 'POST') {
            const id = path.match(/\/agriculture\/buyers\/([a-f0-9-]+)\/verify$/)[1];
            const result = await buyers.verifyBuyer(id, body.method || 'manual');
            if (!result) return notFound('Buyer not found');
            return success(result);
        }

        // ═══ Trade Orders ═══

        // POST /agriculture/listings/:id/order – Buyer places order
        if (path.match(/\/agriculture\/listings\/([a-f0-9-]+)\/order$/) && method === 'POST') {
            const listingId = path.match(/\/agriculture\/listings\/([a-f0-9-]+)\/order$/)[1];
            if (!body.buyer_id || !body.quantity_kg || !body.agreed_price_per_kg) {
                return badRequest('buyer_id, quantity_kg, and agreed_price_per_kg are required');
            }
            try {
                const result = await buyers.createTradeOrder(listingId, body.buyer_id, body);
                return success(result, 201);
            } catch (e) {
                if (e.message === 'LISTING_NOT_AVAILABLE') return badRequest('Listing is not available');
                throw e;
            }
        }

        // GET /agriculture/orders – Get orders for user
        if (path.match(/\/agriculture\/orders$/) && method === 'GET') {
            const result = await buyers.getOrders(userId, qp.role || 'farmer', qp.status);
            return success({ orders: result });
        }

        // PUT /agriculture/orders/:id – Update order
        if (path.match(/\/agriculture\/orders\/([a-f0-9-]+)$/) && method === 'PUT') {
            const id = path.match(/\/agriculture\/orders\/([a-f0-9-]+)$/)[1];
            const result = await buyers.updateTradeOrder(id, userId, body);
            if (!result) return notFound('Order not found');
            return success(result);
        }

        return notFound(`Route not found: ${method} ${path}`);
    } catch (err) {
        console.error('Supply Chain API error:', err);
        return error('Internal server error', 500, err.message);
    }
};
