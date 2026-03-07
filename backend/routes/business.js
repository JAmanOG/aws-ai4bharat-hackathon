/**
 * Business routes – Business Directory CRUD
 */

const businesses = require('../lambdas/business/businesses');
const categories = require('../lambdas/business/categories');

async function businessRoutes(fastify) {
    // ═══════════════════════════════════════
    //  Business Categories
    // ═══════════════════════════════════════

    fastify.get('/business/categories', async () => {
        return categories.listCategories();
    });

    fastify.get('/business/categories/:id', async (req) => {
        const result = await categories.getCategoryById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Category not found' };
        return result;
    });

    // ═══════════════════════════════════════
    //  Businesses
    // ═══════════════════════════════════════

    fastify.post('/business/listings', {
        schema: {
            body: {
                type: 'object',
                required: ['name', 'phone', 'address', 'categoryId'],
                properties: {
                    name: { type: 'string', minLength: 1, maxLength: 100 },
                    phone: { type: 'string' },
                    address: { type: 'string' },
                    categoryId: { type: 'string' },
                    subCategoryId: { type: 'string' },
                    description: { type: 'string' },
                    email: { type: 'string' },
                    latitude: { type: 'number' },
                    longitude: { type: 'number' },
                    operatingHours: { type: 'object' },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const result = await businesses.createBusiness(req.body, req.userId);
            return reply.status(201).send(result);
        } catch (err) {
            if (err.message === 'INVALID_PHONE') throw { statusCode: 400, message: 'Invalid phone number. Must be 10-digit Indian mobile.' };
            if (err.message === 'CATEGORY_NOT_FOUND') throw { statusCode: 404, message: 'Category not found' };
            if (err.message === 'DUPLICATE_BUSINESS') throw { statusCode: 409, message: 'You already have a business with this name' };
            throw err;
        }
    });

    fastify.get('/business/listings', async (req) => {
        const { page = 1, limit = 10, search, categoryId, verified, active } = req.query;
        return businesses.listBusinesses({
            page: +page, limit: +limit, search, categoryId, verified, active,
        });
    });

    fastify.get('/business/listings/:id', async (req) => {
        const result = await businesses.getBusinessById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Business not found' };
        return result;
    });

    fastify.put('/business/listings/:id', async (req) => {
        try {
            return await businesses.updateBusiness(req.params.id, req.body, req.userId);
        } catch (err) {
            if (err.message === 'BUSINESS_NOT_FOUND') throw { statusCode: 404, message: 'Business not found' };
            if (err.message === 'NOT_OWNER') throw { statusCode: 403, message: 'You can only edit your own business' };
            if (err.message === 'INVALID_PHONE') throw { statusCode: 400, message: 'Invalid phone number' };
            throw err;
        }
    });

    fastify.delete('/business/listings/:id', async (req) => {
        try {
            return await businesses.deactivateBusiness(req.params.id, req.userId);
        } catch (err) {
            if (err.message === 'BUSINESS_NOT_FOUND') throw { statusCode: 404, message: 'Business not found' };
            if (err.message === 'NOT_OWNER') throw { statusCode: 403, message: 'You can only deactivate your own business' };
            throw err;
        }
    });
}

module.exports = businessRoutes;
