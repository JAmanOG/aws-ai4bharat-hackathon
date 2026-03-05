/**
 * Authentication middleware.
 *
 * Priority:
 *   1. Routes with `config.skipAuth = true` → pass through (register / login)
 *   2. Bearer JWT (custom user-service token) → verify & set userId
 *   3. x-user-id header (demo / dev mode) → set userId directly
 *   4. Reject with 401
 */

const { verifyToken } = require('../services/user');

const IS_DEMO = process.env.NODE_ENV !== 'production';

/**
 * Fastify preHandler hook for authentication.
 */
async function authMiddleware(request, reply) {
    // Health check / root bypass
    if (request.url === '/health' || request.url === '/') return;

    // Skip auth for public routes (register, login, OAuth callback)
    if (request.routeOptions?.config?.skipAuth) return;

    // 1. Try Bearer JWT first (works in both dev and prod)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const payload = verifyToken(token);
            request.userId = payload.sub;
            request.userPhone = payload.phone;
            return;
        } catch (err) {
            // In demo mode, fall through to x-user-id header
            if (!IS_DEMO) {
                return reply.status(401).send({ error: 'Invalid or expired token' });
            }
        }
    }

    // 2. Demo mode: accept x-user-id header
    if (IS_DEMO) {
        request.userId = request.headers['x-user-id'] || 'demo-user';
        return;
    }

    // 3. No valid auth
    return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
}

module.exports = { authMiddleware };
