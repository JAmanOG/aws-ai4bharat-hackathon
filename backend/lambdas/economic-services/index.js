/**
 * Economic Services Lambda – main handler.
 * Covers Requirement 8 API routes.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const { getEconomicProfile, upsertEconomicProfile } = require('./profile');
const { filterSchemes, getSchemeById } = require('./schemes');
const { assessLoanEligibility } = require('./eligibility');
const { generateSavingsPlan } = require('./savings');
const { createInsuranceClaim, listInsuranceClaims } = require('./insurance');
const { generateFinancialNudge, listFinancialNudges } = require('./nudges');

exports.handler = async (event) => {
    console.log('Economic Services event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-farmer';
    const qp = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        if (path.match(/\/economics\/profile$/) && method === 'GET') {
            return success(await getEconomicProfile(userId));
        }

        if (path.match(/\/economics\/profile$/) && method === 'POST') {
            return success(await upsertEconomicProfile(userId, body), 201);
        }

        if (path.match(/\/economics\/schemes$/) && method === 'GET') {
            return success(filterSchemes(qp));
        }

        if (path.match(/\/economics\/schemes\/([a-z0-9-]+)$/) && method === 'GET') {
            const schemeId = path.match(/\/economics\/schemes\/([a-z0-9-]+)$/)[1];
            const scheme = getSchemeById(schemeId);
            if (!scheme) return notFound('Scheme not found');
            return success(scheme);
        }

        if (path.match(/\/economics\/eligibility\/assess$/) && method === 'POST') {
            return success(await assessLoanEligibility(userId, body));
        }

        if (path.match(/\/economics\/savings\/plan$/) && method === 'POST') {
            return success(generateSavingsPlan(body));
        }

        if (path.match(/\/economics\/insurance\/claims$/) && method === 'POST') {
            if (!body.crop_type) return badRequest('crop_type is required');
            return success(await createInsuranceClaim(userId, body), 201);
        }

        if (path.match(/\/economics\/insurance\/claims$/) && method === 'GET') {
            return success(await listInsuranceClaims(userId, parseInt(qp.limit || '20', 10)));
        }

        if (path.match(/\/economics\/nudges\/generate$/) && method === 'POST') {
            return success(await generateFinancialNudge(userId, body));
        }

        if (path.match(/\/economics\/nudges$/) && method === 'GET') {
            return success(await listFinancialNudges(userId, parseInt(qp.limit || '20', 10)));
        }

        return notFound(`Route not found: ${method} ${path}`);
    } catch (err) {
        console.error('Economic Services error:', err);
        return error('Internal server error', 500, err.message);
    }
};
