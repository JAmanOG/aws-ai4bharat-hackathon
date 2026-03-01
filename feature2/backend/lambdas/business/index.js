/**
 * Business Lambda – Main handler.
 */

const { success, error, badRequest, notFound, conflict } = require('../../utils/response');
const businesses = require('./businesses');
const categories = require('./categories');

exports.handler = async (event) => {
  console.log('Business API event:', JSON.stringify(event, null, 2));

  const method = event.httpMethod || event.requestContext?.http?.method;
  const path = event.path || event.rawPath;
  const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-user';
  const queryParams = event.queryStringParameters || {};
  let body = {};
  try { body = event.body ? JSON.parse(event.body) : {}; } catch (e) { return badRequest('Invalid JSON body'); }

  try {
    // ── Categories ──
    if (path.match(/\/businesses\/categories$/) && method === 'GET') {
      const result = await categories.listCategories();
      return success(result);
    }

    if (path.match(/\/businesses\/categories\/([a-f0-9-]+)$/) && method === 'GET') {
      const catId = path.match(/\/businesses\/categories\/([a-f0-9-]+)$/)[1];
      const result = await categories.getCategoryById(catId);
      if (!result) return notFound('Category not found');
      return success(result);
    }

    // ── Create Business ──
    if (path.match(/\/businesses$/) && method === 'POST') {
      if (!body.name || !body.phone || !body.address || !body.categoryId) {
        return badRequest('name, phone, address, and categoryId are required');
      }
      try {
        const result = await businesses.createBusiness(body, userId);
        return success(result, 201);
      } catch (err) {
        if (err.message === 'INVALID_PHONE') return badRequest('Invalid phone number (10-digit Indian mobile)');
        if (err.message === 'CATEGORY_NOT_FOUND') return notFound('Category not found');
        if (err.message === 'DUPLICATE_BUSINESS') return conflict('You already have a business with this name');
        throw err;
      }
    }

    // ── List Businesses ──
    if (path.match(/\/businesses$/) && method === 'GET') {
      const result = await businesses.listBusinesses({
        page: parseInt(queryParams.page || '1', 10),
        limit: parseInt(queryParams.limit || '10', 10),
        search: queryParams.search,
        categoryId: queryParams.categoryId,
        verified: queryParams.verified,
        active: queryParams.active,
      });
      return success(result);
    }

    // ── Get Business ──
    if (path.match(/\/businesses\/([a-f0-9-]+)$/) && method === 'GET') {
      const id = path.match(/\/businesses\/([a-f0-9-]+)$/)[1];
      const result = await businesses.getBusinessById(id);
      if (!result) return notFound('Business not found');
      return success(result);
    }

    // ── Update Business ──
    if (path.match(/\/businesses\/([a-f0-9-]+)$/) && method === 'PUT') {
      const id = path.match(/\/businesses\/([a-f0-9-]+)$/)[1];
      try {
        const result = await businesses.updateBusiness(id, body, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'BUSINESS_NOT_FOUND') return notFound('Business not found');
        if (err.message === 'NOT_OWNER') return error('Not the business owner', 403);
        if (err.message === 'INVALID_PHONE') return badRequest('Invalid phone number');
        throw err;
      }
    }

    // ── Delete (deactivate) Business ──
    if (path.match(/\/businesses\/([a-f0-9-]+)$/) && method === 'DELETE') {
      const id = path.match(/\/businesses\/([a-f0-9-]+)$/)[1];
      try {
        const result = await businesses.deactivateBusiness(id, userId);
        return success(result);
      } catch (err) {
        if (err.message === 'BUSINESS_NOT_FOUND') return notFound('Business not found');
        if (err.message === 'NOT_OWNER') return error('Not the business owner', 403);
        throw err;
      }
    }

    return notFound(`Route not found: ${method} ${path}`);

  } catch (err) {
    console.error('Business API error:', err);
    return error('Internal server error', 500, err.message);
  }
};
