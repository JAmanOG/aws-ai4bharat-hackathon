/**
 * Agriculture routes – Req 5: Agriculture Supply Chain Management
 * Wires existing business logic modules to Fastify routes.
 */

const listings = require('../lambdas/supply-chain-api/listings');
const buyers = require('../lambdas/supply-chain-api/buyers');
const prices = require('../lambdas/market-data/prices');
const alerts = require('../lambdas/market-data/alerts');
const bargaining = require('../lambdas/logistics/collective-bargaining');
const transport = require('../lambdas/logistics/transport');

async function agricultureRoutes(fastify) {
    // ═══════════════════════════════════════
    //  Produce Listings
    // ═══════════════════════════════════════

    fastify.post('/agriculture/listings', {
        schema: {
            body: {
                type: 'object',
                required: ['crop_type', 'quantity_kg'],
                properties: {
                    crop_type: { type: 'string' },
                    quantity_kg: { type: 'number', minimum: 0.1 },
                },
            },
        },
    }, async (req, reply) => {
        const result = await listings.createListing(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/agriculture/listings', async (req) => {
        const { crop_type, state, district, quality_grade, min_qty, max_price, page = 1, limit = 20 } = req.query;
        return listings.searchListings({
            crop_type, state, district, quality_grade, min_qty, max_price,
            page: +page, limit: +limit,
        });
    });

    fastify.get('/agriculture/listings/my', async (req) => {
        const result = await listings.getFarmerListings(req.userId, req.query.status);
        return { listings: result };
    });

    fastify.get('/agriculture/listings/:id', async (req) => {
        const result = await listings.getListingById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Listing not found' };
        return result;
    });

    fastify.put('/agriculture/listings/:id/status', {
        schema: {
            body: {
                type: 'object',
                required: ['status'],
                properties: { status: { type: 'string', enum: ['active', 'sold', 'expired', 'cancelled'] } },
            },
        },
    }, async (req) => {
        const result = await listings.updateListingStatus(req.params.id, req.userId, req.body.status);
        if (!result) throw { statusCode: 404, message: 'Listing not found or not owned by you' };
        return result;
    });

    // ═══════════════════════════════════════
    //  Buyers
    // ═══════════════════════════════════════

    fastify.post('/agriculture/buyers/register', {
        schema: {
            body: {
                type: 'object',
                required: ['business_name'],
                properties: { business_name: { type: 'string' } },
            },
        },
    }, async (req, reply) => {
        const result = await buyers.registerBuyer(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/agriculture/buyers', async (req) => {
        const { crop_type, state, district, business_type, verified, page = 1, limit = 20 } = req.query;
        return buyers.searchBuyers({
            crop_type, state, district, business_type,
            verified_only: verified === 'true',
            page: +page, limit: +limit,
        });
    });

    fastify.get('/agriculture/buyers/:id', async (req) => {
        const result = await buyers.getBuyerById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Buyer not found' };
        return result;
    });

    fastify.post('/agriculture/buyers/:id/verify', async (req) => {
        const result = await buyers.verifyBuyer(req.params.id, req.body.method || 'manual');
        if (!result) throw { statusCode: 404, message: 'Buyer not found' };
        return result;
    });

    // ═══════════════════════════════════════
    //  Trade Orders
    // ═══════════════════════════════════════

    fastify.post('/agriculture/listings/:id/order', {
        schema: {
            body: {
                type: 'object',
                required: ['buyer_id', 'quantity_kg', 'agreed_price_per_kg'],
                properties: {
                    buyer_id: { type: 'string' },
                    quantity_kg: { type: 'number', minimum: 0.1 },
                    agreed_price_per_kg: { type: 'number', minimum: 0 },
                },
            },
        },
    }, async (req, reply) => {
        const result = await buyers.createTradeOrder(req.params.id, req.body.buyer_id, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/agriculture/orders', async (req) => {
        const result = await buyers.getOrders(req.userId, req.query.role || 'farmer', req.query.status);
        return { orders: result };
    });

    fastify.put('/agriculture/orders/:id', async (req) => {
        const result = await buyers.updateTradeOrder(req.params.id, req.userId, req.body);
        if (!result) throw { statusCode: 404, message: 'Order not found' };
        return result;
    });

    // ═══════════════════════════════════════
    //  Market Prices
    // ═══════════════════════════════════════

    fastify.get('/agriculture/prices/:crop', async (req) => {
        return prices.getCurrentPrices(req.params.crop, {
            state: req.query.state, district: req.query.district,
            limit: +(req.query.limit || 20),
        });
    });

    fastify.get('/agriculture/prices/:crop/trend', async (req) => {
        return prices.getPriceTrend(req.params.crop, {
            mandi_code: req.query.mandi_code, state: req.query.state,
            days: +(req.query.days || 30),
        });
    });

    fastify.get('/agriculture/mandis', async (req) => {
        const result = await prices.getMandis(req.query.state);
        return { mandis: result };
    });

    fastify.get('/agriculture/mandis/:name/prices', async (req) => {
        return prices.getMandiPrices(decodeURIComponent(req.params.name));
    });

    fastify.post('/agriculture/prices/ingest', {
        schema: {
            body: {
                type: 'object',
                required: ['records'],
                properties: { records: { type: 'array' } },
            },
        },
    }, async (req) => {
        return prices.ingestPriceData(req.body.records);
    });

    // ═══════════════════════════════════════
    //  Price Alerts
    // ═══════════════════════════════════════

    fastify.post('/agriculture/alerts', {
        schema: {
            body: {
                type: 'object',
                required: ['crop_type'],
                properties: { crop_type: { type: 'string' } },
            },
        },
    }, async (req, reply) => {
        const result = await alerts.subscribePriceAlert(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/agriculture/alerts', async (req) => {
        const result = await alerts.getUserAlerts(req.userId);
        return { alerts: result };
    });

    fastify.delete('/agriculture/alerts/:id', async (req) => {
        return alerts.deleteAlert(req.userId, req.params.id);
    });

    fastify.post('/agriculture/alerts/check', async (req) => {
        const threshold = req.body.threshold_percent || 10;
        const changes = await prices.detectPriceChanges(threshold);
        const dispatchResult = await alerts.dispatchPriceAlerts(changes);
        return { changes, dispatch: dispatchResult };
    });

    // ═══════════════════════════════════════
    //  Collective Bargaining
    // ═══════════════════════════════════════

    fastify.post('/agriculture/bargaining/groups', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'crop_type'],
                properties: {
                    name: { type: 'string' },
                    crop_type: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        const result = await bargaining.createGroup(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/agriculture/bargaining/groups', async (req) => {
        const { crop_type, state, status = 'forming', page = 1, limit = 20 } = req.query;
        return bargaining.searchGroups({ crop_type, state, status, page: +page, limit: +limit });
    });

    fastify.get('/agriculture/bargaining/groups/:id', async (req) => {
        const result = await bargaining.getGroupById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Bargaining group not found' };
        return result;
    });

    fastify.post('/agriculture/bargaining/groups/:id/join', {
        schema: {
            body: {
                type: 'object',
                required: ['quantity_kg'],
                properties: { quantity_kg: { type: 'number', minimum: 0.1 } },
            },
        },
    }, async (req) => {
        return bargaining.joinGroup(req.params.id, req.userId, req.body);
    });

    fastify.get('/agriculture/bargaining/suggest', async (req) => {
        return bargaining.suggestGroupsForFarmer(req.userId);
    });

    // ═══════════════════════════════════════
    //  Logistics / Transport
    // ═══════════════════════════════════════

    fastify.post('/agriculture/logistics', {
        schema: {
            body: {
                type: 'object',
                required: ['cargo_type', 'weight_kg'],
                properties: {
                    cargo_type: { type: 'string' },
                    weight_kg: { type: 'number', minimum: 1 },
                },
            },
        },
    }, async (req, reply) => {
        const result = await transport.createRequest(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/agriculture/logistics', async (req) => {
        const result = await transport.getUserRequests(req.userId, req.query.status);
        return { requests: result };
    });

    fastify.get('/agriculture/logistics/vehicles', async () => {
        return { vehicles: transport.getVehicleTypes() };
    });

    fastify.get('/agriculture/logistics/:id', async (req) => {
        const result = await transport.getRequestById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Logistics request not found' };
        return result;
    });

    fastify.put('/agriculture/logistics/:id', async (req) => {
        const result = await transport.updateRequest(req.params.id, req.body);
        if (!result) throw { statusCode: 404, message: 'Logistics request not found' };
        return result;
    });

    fastify.post('/agriculture/logistics/estimate', {
        schema: {
            body: {
                type: 'object',
                required: ['weight_kg'],
                properties: { weight_kg: { type: 'number', minimum: 1 } },
            },
        },
    }, async (req) => {
        const cost = transport.estimateTransportCost(
            req.body.pickup || {}, req.body.delivery || {},
            req.body.weight_kg, req.body.vehicle_type
        );
        return {
            estimated_cost_inr: cost,
            weight_kg: req.body.weight_kg,
            vehicle_type: req.body.vehicle_type || 'truck',
            disclaimer: 'Estimate only. Actual cost may vary.',
        };
    });
}

module.exports = agricultureRoutes;
