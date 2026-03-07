/**
 * Community routes – Knowledge Posts, Bookmarks, Follows, Reports
 */

const posts = require('../lambdas/community/posts');
const social = require('../lambdas/community/social');

async function communityRoutes(fastify) {
    // ═══════════════════════════════════════
    //  Knowledge Posts
    // ═══════════════════════════════════════

    fastify.post('/community/posts', {
        schema: {
            body: {
                type: 'object',
                required: ['title', 'content'],
                properties: {
                    title: { type: 'string', minLength: 1, maxLength: 200 },
                    content: { type: 'string', minLength: 1 },
                    topic: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        try {
            const result = await posts.createPost(req.body, req.userId);
            return reply.status(201).send(result);
        } catch (err) {
            if (err.message === 'INVALID_TOPIC') throw { statusCode: 400, message: 'Invalid topic. Allowed: agriculture, health, education, finance, infrastructure, general, livestock, business, government' };
            throw err;
        }
    });

    fastify.get('/community/posts', async (req) => {
        const { page = 1, limit = 10, topic, authorId, search } = req.query;
        return posts.listPosts({
            page: +page, limit: +limit, topic, authorId, search,
        });
    });

    fastify.get('/community/posts/:id', async (req) => {
        const result = await posts.getPostById(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Post not found' };
        return result;
    });

    // ═══════════════════════════════════════
    //  Bookmarks
    // ═══════════════════════════════════════

    fastify.post('/community/bookmarks/:postId', async (req) => {
        return social.toggleBookmark(req.params.postId, req.userId);
    });

    fastify.get('/community/bookmarks', async (req) => {
        const { page = 1, limit = 10 } = req.query;
        return social.listBookmarks(req.userId, { page: +page, limit: +limit });
    });

    // ═══════════════════════════════════════
    //  Follows
    // ═══════════════════════════════════════

    fastify.post('/community/follow/:targetUserId', async (req) => {
        return social.toggleFollow(req.params.targetUserId, req.userId);
    });

    fastify.get('/community/following', async (req) => {
        const { page = 1, limit = 10 } = req.query;
        return social.listFollowing(req.userId, { page: +page, limit: +limit });
    });

    // ═══════════════════════════════════════
    //  Reports
    // ═══════════════════════════════════════

    fastify.post('/community/posts/:postId/report', {
        schema: {
            body: {
                type: 'object',
                required: ['reason'],
                properties: {
                    reason: { type: 'string', minLength: 1 },
                },
            },
        },
    }, async (req) => {
        return social.reportPost(req.params.postId, req.userId, req.body.reason);
    });
}

module.exports = communityRoutes;
