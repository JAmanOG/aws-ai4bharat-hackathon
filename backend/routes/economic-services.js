/**
 * Economic Services routes – Req 8: Economic Services Integration.
 */

const { getEconomicProfile, upsertEconomicProfile } = require('../lambdas/economic-services/profile');
const { filterSchemes, getSchemeById } = require('../lambdas/economic-services/schemes');
const { assessLoanEligibility } = require('../lambdas/economic-services/eligibility');
const { generateSavingsPlan } = require('../lambdas/economic-services/savings');
const { createInsuranceClaim, listInsuranceClaims } = require('../lambdas/economic-services/insurance');
const { generateFinancialNudge, listFinancialNudges } = require('../lambdas/economic-services/nudges');

async function economicServicesRoutes(fastify) {
    fastify.get('/economics/profile', async (req) => getEconomicProfile(req.userId));

    fastify.post('/economics/profile', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    full_name: { type: 'string' },
                    state: { type: 'string' },
                    district: { type: 'string' },
                    primary_language: { type: 'string' },
                    land_size_acres: { type: 'number' },
                    crop_types: { type: 'array', items: { type: 'string' } },
                    annual_income_inr: { type: 'number' },
                    expected_harvest_income_inr: { type: 'number' },
                    seasonal_expenses: { type: 'array', items: { type: 'object' } },
                    harvest_months: { type: 'array', items: { type: 'string' } },
                    has_bank_account: { type: 'boolean' },
                    has_kcc: { type: 'boolean' },
                    digilocker_verified: { type: 'boolean' },
                    insurance_provider: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        const result = await upsertEconomicProfile(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/economics/schemes', async (req) => filterSchemes(req.query));

    fastify.get('/economics/schemes/:id', async (req) => {
        const scheme = getSchemeById(req.params.id);
        if (!scheme) throw { statusCode: 404, message: 'Scheme not found' };
        return scheme;
    });

    fastify.post('/economics/eligibility/assess', async (req) => assessLoanEligibility(req.userId, req.body));

    fastify.post('/economics/savings/plan', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    expected_harvest_income_inr: { type: 'number' },
                    harvest_months: { type: 'array', items: { type: 'string' } },
                    seasonal_expenses: { type: 'array', items: { type: 'object' } },
                },
            },
        },
    }, async (req) => generateSavingsPlan(req.body));

    fastify.post('/economics/insurance/claims', {
        schema: {
            body: {
                type: 'object',
                required: ['crop_type'],
                properties: {
                    scheme_id: { type: 'string' },
                    crop_type: { type: 'string' },
                    loss_date: { type: 'string' },
                    area_affected_acres: { type: 'number' },
                    location: { type: 'object' },
                    damage_signals: { type: 'array', items: { type: 'string' } },
                    notes: { type: 'string' },
                    digilocker_consent: { type: 'boolean' },
                },
            },
        },
    }, async (req, reply) => {
        const result = await createInsuranceClaim(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/economics/insurance/claims', async (req) => {
        return listInsuranceClaims(req.userId, +(req.query.limit || 20));
    });

    fastify.post('/economics/nudges/generate', async (req) => generateFinancialNudge(req.userId, req.body));

    fastify.get('/economics/nudges', async (req) => listFinancialNudges(req.userId, +(req.query.limit || 20)));
}

module.exports = economicServicesRoutes;
