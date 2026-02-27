/**
 * Rural Ecosystem Platform – Production Server
 * Fastify-based application server replacing Lambda handlers.
 */

const Fastify = require('fastify');
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error-handler');
const knowledgeRoutes = require('./routes/knowledge');
const agricultureRoutes = require('./routes/agriculture');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer() {
    const app = Fastify({
        logger: {
            level: process.env.LOG_LEVEL || 'info',
            ...(process.env.NODE_ENV !== 'production' && {
                transport: { target: 'pino-pretty', options: { colorize: true } },
            }),
        },
        trustProxy: true,
        requestTimeout: 30000,
        bodyLimit: 10 * 1024 * 1024, // 10MB
    });

    // ── Security ──
    await app.register(require('@fastify/cors'), {
        origin: process.env.CORS_ORIGIN || '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'X-Request-Id'],
        credentials: true,
    });

    await app.register(require('@fastify/helmet'), {
        contentSecurityPolicy: false, // API server, no CSP needed
    });

    // ── Rate Limiting ──
    await app.register(require('@fastify/rate-limit'), {
        max: parseInt(process.env.RATE_LIMIT_MAX || '200', 10),
        timeWindow: '1 minute',
        keyGenerator: (req) => req.headers['x-user-id'] || req.ip,
    });

    // ── Auth ──
    app.addHook('preHandler', authMiddleware);

    // ── Error Handler ──
    app.setErrorHandler(errorHandler);

    // ── Health Check ──
    app.get('/health', { config: { rateLimit: false } }, async () => {
        return {
            status: 'healthy',
            version: '2.0.0',
            uptime: process.uptime(),
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
        };
    });

    app.get('/', { config: { rateLimit: false } }, async () => {
        return {
            name: 'Rural Ecosystem Platform API',
            version: '2.0.0',
            modules: ['knowledge', 'agriculture'],
            docs: '/health',
        };
    });

    // ── Route Modules ──
    await app.register(knowledgeRoutes);
    await app.register(agricultureRoutes);

    return app;
}

// ── Start Server ──
async function start() {
    const app = await buildServer();

    // Graceful shutdown
    const shutdown = async (signal) => {
        app.log.info(`${signal} received, shutting down gracefully...`);
        await app.close();

        // Close database pools
        try {
            const { getPostgresPool } = require('./utils/db');
            const pool = getPostgresPool();
            if (pool) await pool.end();
            app.log.info('Database connections closed');
        } catch (err) {
            app.log.error(err, 'Error closing database connections');
        }

        process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    try {
        await app.listen({ port: PORT, host: HOST });
        app.log.info(`🚀 Rural Ecosystem Platform API running on http://${HOST}:${PORT}`);
        app.log.info(`   Environment: ${process.env.NODE_ENV || 'development'}`);
        app.log.info(`   Health check: http://${HOST}:${PORT}/health`);
    } catch (err) {
        app.log.fatal(err);
        process.exit(1);
    }
}

// Export for testing, start if run directly
module.exports = { buildServer };
if (require.main === module) {
    start();
}
