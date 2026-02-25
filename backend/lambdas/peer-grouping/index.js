/**
 * Peer Grouping Lambda – Main handler
 * Routes API Gateway events to peer grouping functions.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const clustering = require('./clustering');
const groups = require('./groups');
const digilocker = require('./digilocker');

exports.handler = async (event) => {
    console.log('Peer Grouping event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-user';
    const queryParams = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        // ── Find/create peer groups via AI ──
        if (path.match(/\/knowledge\/peer-groups\/join$/) && method === 'POST') {
            const result = await clustering.findPeersForUser(userId);

            // If matched, auto-create the first suggested group
            if (result.matched && result.suggestedGroups?.length > 0) {
                const topGroup = result.suggestedGroups[0];
                const createdGroup = await groups.createGroupFromClustering(topGroup, userId);
                return success({
                    ...result,
                    createdGroup,
                    message: 'Peer group created based on AI matching',
                }, 201);
            }

            return success(result);
        }

        // ── Get user's groups ──
        if (path.match(/\/knowledge\/peer-groups\/my-groups$/) && method === 'GET') {
            const userGroups = await groups.getUserGroups(userId);
            return success({ groups: userGroups, total: userGroups.length });
        }

        // ── Get group by ID ──
        if (path.match(/\/knowledge\/peer-groups\/([a-f0-9-]+)$/) && method === 'GET') {
            const groupId = path.match(/\/knowledge\/peer-groups\/([a-f0-9-]+)$/)[1];
            const group = await groups.getGroupById(groupId);
            if (!group) return notFound('Peer group not found');
            return success(group);
        }

        // ── Join existing group ──
        if (path.match(/\/knowledge\/peer-groups\/([a-f0-9-]+)\/join$/) && method === 'POST') {
            const groupId = path.match(/\/knowledge\/peer-groups\/([a-f0-9-]+)\/join$/)[1];
            try {
                const result = await groups.joinGroup(groupId, userId, body.displayName);
                return success(result);
            } catch (err) {
                if (err.message === 'GROUP_NOT_FOUND') return notFound('Group not found');
                if (err.message === 'GROUP_INACTIVE') return badRequest('Group is no longer active');
                if (err.message === 'ALREADY_MEMBER') return badRequest('Already a member of this group');
                if (err.message === 'GROUP_FULL') return badRequest('Group has reached maximum capacity');
                throw err;
            }
        }

        // ── Leave group ──
        if (path.match(/\/knowledge\/peer-groups\/([a-f0-9-]+)\/leave$/) && method === 'POST') {
            const groupId = path.match(/\/knowledge\/peer-groups\/([a-f0-9-]+)\/leave$/)[1];
            try {
                const result = await groups.leaveGroup(groupId, userId);
                return success(result);
            } catch (err) {
                if (err.message === 'GROUP_NOT_FOUND') return notFound('Group not found');
                if (err.message === 'NOT_A_MEMBER') return badRequest('Not a member of this group');
                throw err;
            }
        }

        // ── Create group manually ──
        if (path.match(/\/knowledge\/peer-groups$/) && method === 'POST') {
            const group = await groups.createGroup({
                ...body,
                creatorUserId: userId,
            });
            return success(group, 201);
        }

        // ── DigiLocker Verification ──
        if (path.match(/\/knowledge\/peer-groups\/verify\/start$/) && method === 'POST') {
            const result = digilocker.startVerification(userId);
            return success(result);
        }

        if (path.match(/\/knowledge\/peer-groups\/verify\/complete$/) && method === 'POST') {
            if (!body.authCode) return badRequest('authCode is required');
            const result = await digilocker.completeVerification(userId, body.authCode);
            return success(result);
        }

        return notFound(`Route not found: ${method} ${path}`);

    } catch (err) {
        console.error('Peer Grouping error:', err);
        return error('Internal server error', 500, err.message);
    }
};
