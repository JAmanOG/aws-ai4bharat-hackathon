/**
 * Government routes – Portals, Schemes, Complaints
 */

const portals = require('../lambdas/government/portals');
const schemes = require('../lambdas/government/schemes');

async function governmentRoutes(fastify) {
    // ═══════════════════════════════════════
    //  Government Portals
    // ═══════════════════════════════════════

    fastify.get('/government/portals', async (req) => {
        const { category, region, search } = req.query;
        return portals.listPortals({ category, region, search });
    });

    fastify.get('/government/portals/:id', async (req) => {
        const result = await portals.getPortalById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Portal not found' };
        return result;
    });

    // ═══════════════════════════════════════
    //  Government Schemes
    // ═══════════════════════════════════════

    fastify.get('/government/schemes', async (req) => {
        const { category, state, search, page = 1, limit = 10 } = req.query;
        return schemes.listSchemes({ category, state, search, page: +page, limit: +limit });
    });

    fastify.get('/government/schemes/:id', async (req) => {
        const result = await schemes.getSchemeById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Scheme not found' };
        return result;
    });

    fastify.get('/government/scheme-categories', async () => {
        return schemes.listSchemeCategories();
    });

    // ═══════════════════════════════════════
    //  Complaints
    // ═══════════════════════════════════════

    fastify.post('/government/complaints', {
        schema: {
            body: {
                type: 'object',
                required: ['portalId', 'category', 'subject'],
                properties: {
                    portalId: { type: 'string' },
                    category: { type: 'string' },
                    subject: { type: 'string', minLength: 1, maxLength: 200 },
                    description: { type: 'string', maxLength: 2000 },
                },
            },
        },
    }, async (req, reply) => {
        const result = await schemes.saveComplaint(req.body, req.userId);
        return reply.status(201).send(result);
    });

    fastify.get('/government/complaints', async (req) => {
        return schemes.listComplaints(req.userId);
    });
}

module.exports = governmentRoutes;
