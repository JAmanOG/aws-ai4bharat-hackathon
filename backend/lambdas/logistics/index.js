/**
 * Logistics Lambda – Main handler
 * Routes for collective bargaining and transport coordination.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const bargaining = require('./collective-bargaining');
const transport = require('./transport');

exports.handler = async (event) => {
    console.log('Logistics event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-farmer';
    const qp = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        // ═══ Collective Bargaining ═══

        // POST /agriculture/bargaining/groups – Create group
        if (path.match(/\/agriculture\/bargaining\/groups$/) && method === 'POST') {
            if (!body.name || !body.crop_type) return badRequest('name and crop_type are required');
            const result = await bargaining.createGroup(userId, body);
            return success(result, 201);
        }

        // GET /agriculture/bargaining/groups – Search groups
        if (path.match(/\/agriculture\/bargaining\/groups$/) && method === 'GET') {
            const result = await bargaining.searchGroups({
                crop_type: qp.crop_type, state: qp.state, status: qp.status || 'forming',
                page: parseInt(qp.page || '1'), limit: parseInt(qp.limit || '20'),
            });
            return success(result);
        }

        // GET /agriculture/bargaining/groups/:id – Group details
        if (path.match(/\/agriculture\/bargaining\/groups\/([a-f0-9-]+)$/) && method === 'GET') {
            const id = path.match(/\/agriculture\/bargaining\/groups\/([a-f0-9-]+)$/)[1];
            const result = await bargaining.getGroupById(id);
            if (!result) return notFound('Bargaining group not found');
            return success(result);
        }

        // POST /agriculture/bargaining/groups/:id/join – Join group
        if (path.match(/\/agriculture\/bargaining\/groups\/([a-f0-9-]+)\/join$/) && method === 'POST') {
            const id = path.match(/\/agriculture\/bargaining\/groups\/([a-f0-9-]+)\/join$/)[1];
            if (!body.quantity_kg) return badRequest('quantity_kg is required');
            try {
                const result = await bargaining.joinGroup(id, userId, body);
                return success(result);
            } catch (e) {
                if (e.message === 'GROUP_NOT_FOUND') return notFound('Group not found');
                if (e.message === 'GROUP_CLOSED') return badRequest('Group is no longer accepting members');
                if (e.message === 'ALREADY_MEMBER') return badRequest('Already a member of this group');
                throw e;
            }
        }

        // GET /agriculture/bargaining/suggest – AI-powered group suggestions
        if (path.match(/\/agriculture\/bargaining\/suggest$/) && method === 'GET') {
            const result = await bargaining.suggestGroupsForFarmer(userId);
            return success(result);
        }

        // ═══ Transport / Logistics ═══

        // POST /agriculture/logistics – Create transport request
        if (path.match(/\/agriculture\/logistics$/) && method === 'POST') {
            if (!body.cargo_type || !body.weight_kg) return badRequest('cargo_type and weight_kg are required');
            const result = await transport.createRequest(userId, body);
            return success(result, 201);
        }

        // GET /agriculture/logistics – User's logistics requests
        if (path.match(/\/agriculture\/logistics$/) && method === 'GET') {
            const result = await transport.getUserRequests(userId, qp.status);
            return success({ requests: result });
        }

        // GET /agriculture/logistics/:id – Single request
        if (path.match(/\/agriculture\/logistics\/([a-f0-9-]+)$/) && method === 'GET') {
            const id = path.match(/\/agriculture\/logistics\/([a-f0-9-]+)$/)[1];
            const result = await transport.getRequestById(id);
            if (!result) return notFound('Logistics request not found');
            return success(result);
        }

        // PUT /agriculture/logistics/:id – Update request
        if (path.match(/\/agriculture\/logistics\/([a-f0-9-]+)$/) && method === 'PUT') {
            const id = path.match(/\/agriculture\/logistics\/([a-f0-9-]+)$/)[1];
            const result = await transport.updateRequest(id, body);
            if (!result) return notFound('Logistics request not found');
            return success(result);
        }

        // GET /agriculture/logistics/vehicles – Vehicle types and capacities
        if (path.match(/\/agriculture\/logistics\/vehicles$/) && method === 'GET') {
            return success({ vehicles: transport.getVehicleTypes() });
        }

        // POST /agriculture/logistics/estimate – Cost estimate
        if (path.match(/\/agriculture\/logistics\/estimate$/) && method === 'POST') {
            if (!body.weight_kg) return badRequest('weight_kg is required');
            const cost = transport.estimateTransportCost(
                body.pickup || {}, body.delivery || {},
                body.weight_kg, body.vehicle_type
            );
            return success({
                estimated_cost_inr: cost,
                weight_kg: body.weight_kg,
                vehicle_type: body.vehicle_type || 'truck',
                disclaimer: 'This is an estimate. Actual cost may vary based on road conditions and fuel prices.',
            });
        }

        return notFound(`Route not found: ${method} ${path}`);
    } catch (err) {
        console.error('Logistics error:', err);
        return error('Internal server error', 500, err.message);
    }
};
