/**
 * Health Directory Lambda — handler.
 * Routes: govt-portals, eligibility-check, providers.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const { listPortals, getPortal, checkEligibility } = require('./govt-portals');
const { listProviders, getProvider } = require('./providers');

exports.handler = async (event) => {
  const method = event.httpMethod;
  const path = event.path;
  const userId = event.headers?.['x-user-id'] || 'anonymous';
  const qs = event.queryStringParameters || {};
  console.log(`[API:EVENT] Health Directory Lambda invoked. Method: ${method}, Path: ${path}, UserID: ${userId}`);

  try {
    // ── Government Portals ──
    if (path.match(/\/health\/govt-portals$/) && method === 'GET') {
      const portals = await listPortals(qs.category, qs.search);
      return success({ portals, count: portals.length });
    }

    const portalMatch = path.match(/\/health\/govt-portals\/([a-f0-9-]+)$/);
    if (portalMatch && method === 'GET') {
      const portal = await getPortal(portalMatch[1]);
      return portal ? success(portal) : notFound('Portal not found');
    }

    // ── Eligibility Check ──
    if (path.match(/\/health\/eligibility-check$/) && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await checkEligibility(body);
      return success(result);
    }

    // ── Providers ──
    if (path.match(/\/health\/providers$/) && method === 'GET') {
      const result = await listProviders(qs);
      return success(result);
    }

    const providerMatch = path.match(/\/health\/providers\/([a-f0-9-]+)$/);
    if (providerMatch && method === 'GET') {
      const provider = await getProvider(providerMatch[1]);
      return provider ? success(provider) : notFound('Provider not found');
    }

    return notFound(`Route not found: ${method} ${path}`);
  } catch (err) {
    if (err.statusCode) return badRequest(err.message);
    console.error('Health Directory error:', err);
    return error('Internal server error', 500, err.message);
  }
};
