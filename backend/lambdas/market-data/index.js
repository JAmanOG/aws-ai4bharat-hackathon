/**
 * Market Data Lambda – Main handler
 * Routes API Gateway events for market prices, trends, and alerts.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const prices = require('./prices');
const alerts = require('./alerts');

exports.handler = async (event) => {
    console.log('Market Data event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-farmer';
    const qp = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        // ═══ Market Prices ═══

        // GET /agriculture/prices/:crop – Current prices for a crop
        if (path.match(/\/agriculture\/prices\/([a-z-]+)$/) && method === 'GET') {
            const crop = path.match(/\/agriculture\/prices\/([a-z-]+)$/)[1];
            const result = await prices.getCurrentPrices(crop, {
                state: qp.state, district: qp.district, limit: parseInt(qp.limit || '20'),
            });
            return success(result);
        }

        // GET /agriculture/prices/:crop/trend – Historical price trend
        if (path.match(/\/agriculture\/prices\/([a-z-]+)\/trend$/) && method === 'GET') {
            const crop = path.match(/\/agriculture\/prices\/([a-z-]+)\/trend$/)[1];
            const result = await prices.getPriceTrend(crop, {
                mandi_code: qp.mandi_code, state: qp.state,
                days: parseInt(qp.days || '30'),
            });
            return success(result);
        }

        // GET /agriculture/mandis – List mandis
        if (path.match(/\/agriculture\/mandis$/) && method === 'GET') {
            const result = await prices.getMandis(qp.state);
            return success({ mandis: result });
        }

        // GET /agriculture/mandis/:name/prices – Prices at a specific mandi
        if (path.match(/\/agriculture\/mandis\/(.+)\/prices$/) && method === 'GET') {
            const mandiName = decodeURIComponent(path.match(/\/agriculture\/mandis\/(.+)\/prices$/)[1]);
            const result = await prices.getMandiPrices(mandiName);
            return success(result);
        }

        // POST /agriculture/prices/ingest – Bulk ingest price data
        if (path.match(/\/agriculture\/prices\/ingest$/) && method === 'POST') {
            if (!body.records || !Array.isArray(body.records)) return badRequest('records array is required');
            const result = await prices.ingestPriceData(body.records);
            return success(result);
        }

        // ═══ Price Alerts ═══

        // POST /agriculture/alerts – Subscribe to price alerts
        if (path.match(/\/agriculture\/alerts$/) && method === 'POST') {
            if (!body.crop_type) return badRequest('crop_type is required');
            const result = await alerts.subscribePriceAlert(userId, body);
            return success(result, 201);
        }

        // GET /agriculture/alerts – Get user's alerts
        if (path.match(/\/agriculture\/alerts$/) && method === 'GET') {
            const result = await alerts.getUserAlerts(userId);
            return success({ alerts: result });
        }

        // DELETE /agriculture/alerts/:id – Unsubscribe
        if (path.match(/\/agriculture\/alerts\/([a-f0-9-]+)$/) && method === 'DELETE') {
            const alertId = path.match(/\/agriculture\/alerts\/([a-f0-9-]+)$/)[1];
            const result = await alerts.deleteAlert(userId, alertId);
            return success(result);
        }

        // POST /agriculture/alerts/check – Detect and dispatch price change alerts
        if (path.match(/\/agriculture\/alerts\/check$/) && method === 'POST') {
            const threshold = body.threshold_percent || 10;
            const changes = await prices.detectPriceChanges(threshold);
            const dispatchResult = await alerts.dispatchPriceAlerts(changes);
            return success({ changes, dispatch: dispatchResult });
        }

        return notFound(`Route not found: ${method} ${path}`);
    } catch (err) {
        console.error('Market Data error:', err);
        return error('Internal server error', 500, err.message);
    }
};
