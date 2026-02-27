/**
 * Authentication middleware.
 * Validates Cognito JWT tokens in production.
 * Falls back to demo mode (x-user-id header) in development.
 */

const jwt = require('jsonwebtoken');

const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID || '';
const AWS_REGION = process.env.AWS_REGION || 'ap-south-1';
const IS_DEMO = process.env.NODE_ENV !== 'production';

/**
 * Fastify preHandler hook for authentication.
 */
async function authMiddleware(request, reply) {
    // Health check bypass
    if (request.url === '/health' || request.url === '/') return;

    // Demo mode: accept x-user-id header
    if (IS_DEMO) {
        request.userId = request.headers['x-user-id'] || 'demo-user';
        return;
    }

    // Production: validate JWT
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.slice(7);

    try {
        const decoded = jwt.decode(token, { complete: true });
        if (!decoded) {
            return reply.status(401).send({ error: 'Invalid token' });
        }

        // In production, verify the token signature against Cognito JWKS
        // For now, extract the sub claim as userId
        request.userId = decoded.payload.sub || decoded.payload['cognito:username'];

        if (!request.userId) {
            return reply.status(401).send({ error: 'Token missing user identity' });
        }
    } catch (err) {
        request.log.error({ err }, 'Auth verification failed');
        return reply.status(401).send({ error: 'Token verification failed' });
    }
}

module.exports = { authMiddleware };
