/**
 * Government Lambda – Main handler.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const portals = require('./portals');
const schemes = require('./schemes');

exports.handler = async (event) => {
  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath;
  const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-user';
  console.log(`[API:EVENT] Government Lambda invoked. Method: ${method}, Path: ${path}, UserID: ${userId}`);

  const queryParams = event.queryStringParameters || {};
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { return badRequest('Invalid JSON body'); }

  try {
    // ── Portals ──
    if (path.match(/\/government\/portals$/) && method === 'GET') {
      const result = await portals.listPortals({
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
        category: queryParams.category,
        region: queryParams.region,
        search: queryParams.search,
      });
      return success(result);
    }

    if (path.match(/\/government\/portals\/([a-f0-9-]+)$/) && method === 'GET') {
      const id = path.match(/\/government\/portals\/([a-f0-9-]+)$/)[1];
      const result = await portals.getPortalById(id);
      if (!result) return notFound('Portal not found');
      return success(result);
    }

    // ── Scheme Categories ──
    if (path.match(/\/government\/schemes\/categories$/) && method === 'GET') {
      const result = await schemes.listSchemeCategories();
      return success(result);
    }

    // ── Schemes ──
    if (path.match(/\/government\/schemes$/) && method === 'GET') {
      const result = await schemes.listSchemes({
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
        categoryId: queryParams.categoryId,
        search: queryParams.search,
      });
      return success(result);
    }

    if (path.match(/\/government\/schemes\/([a-f0-9-]+)$/) && method === 'GET') {
      const id = path.match(/\/government\/schemes\/([a-f0-9-]+)$/)[1];
      const result = await schemes.getSchemeById(id);
      if (!result) return notFound('Scheme not found');
      return success(result);
    }

    // ── Complaints ──
    if (path.match(/\/government\/complaints$/) && method === 'POST') {
      if (!body.portalName || !body.referenceNo) return badRequest('portalName and referenceNo required');
      const result = await schemes.saveComplaint(body, userId);
      return success(result, 201);
    }

    if (path.match(/\/government\/complaints$/) && method === 'GET') {
      const result = await schemes.listComplaints(userId, {
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
      });
      return success(result);
    }

    return notFound(`Route not found: ${method} ${path}`);

  } catch (err) {
    console.error('Government API error:', err);
    return error('Internal server error', 500, err.message);
  }
};
