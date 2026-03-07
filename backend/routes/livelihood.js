/**
 * Livelihood routes – Categories & Guidance
 */

const livelihood = require('../lambdas/livelihood/livelihood');

async function livelihoodRoutes(fastify) {
    fastify.get('/livelihood/categories', async () => {
        return livelihood.listCategories();
    });

    fastify.get('/livelihood/guidance', async (req) => {
        const { categoryId, search } = req.query;
        return livelihood.listGuidance({ categoryId, search });
    });

    fastify.get('/livelihood/guidance/:id', async (req) => {
        const result = await livelihood.getGuidanceById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Guidance not found' };
        return result;
    });
}

module.exports = livelihoodRoutes;
