/**
 * Rural Ecosystem Platform – Production Server
 * Fastify-based application server replacing Lambda handlers.
 */

require('dotenv').config();
const Fastify = require('fastify');
const { authMiddleware } = require('./middleware/auth');
const { errorHandler } = require('./middleware/error-handler');
const knowledgeRoutes = require('./routes/knowledge');
const agricultureRoutes = require('./routes/agriculture');
const precisionAgricultureRoutes = require('./routes/precision-agriculture');
const economicServicesRoutes = require('./routes/economic-services');
const voiceRoutes = require('./routes/voice');
const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/community');
const businessRoutes = require('./routes/business');
const governmentRoutes = require('./routes/government');
const livelihoodRoutes = require('./routes/livelihood');
const healthRoutes = require('./routes/health');
const openDataRoutes = require('./routes/open-data');
const voiceRoomRoutes = require('./routes/voice-room');
const visionRoutes = require('./routes/vision');
const liveMarketFetcher = require('./services/market-data-fetcher');
const { APP_NAME } = require('./services/brand');

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MARKET_SYNC_ENABLED = process.env.MARKET_SYNC_ENABLED !== 'false';
const MARKET_SYNC_INTERVAL_HOURS = (() => {
    const parsed = parseInt(process.env.MARKET_SYNC_INTERVAL_HOURS || '24', 10);
    return Number.isFinite(parsed) ? Math.max(1, parsed) : 24;
})();

function startMarketSync(app) {
    if (!MARKET_SYNC_ENABLED) {
        app.log.info('Market sync disabled via MARKET_SYNC_ENABLED=false');
        return () => {};
    }

    let running = false;

    const runSync = async (trigger) => {
        if (running) {
            app.log.info({ trigger }, 'Market sync skipped because a previous run is still active');
            return;
        }

        running = true;
        try {
            app.log.info({ trigger }, 'Starting background market sync');
            const total = await liveMarketFetcher.syncTopCrops();
            app.log.info({ trigger, total }, 'Background market sync complete');
        } catch (err) {
            app.log.error({ err, trigger }, 'Background market sync failed');
        } finally {
            running = false;
        }
    };

    const startupTimer = setTimeout(() => {
        void runSync('startup');
    }, 1500);

    const interval = setInterval(() => {
        void runSync('interval');
    }, MARKET_SYNC_INTERVAL_HOURS * 60 * 60 * 1000);

    app.log.info({ intervalHours: MARKET_SYNC_INTERVAL_HOURS }, 'Market sync scheduler enabled');

    return () => {
        clearTimeout(startupTimer);
        clearInterval(interval);
    };
}

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

    // ── Multipart (for audio file uploads) ──
    await app.register(require('@fastify/multipart'), {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB max audio file
            files: 1,
        },
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
            name: `${APP_NAME} API`,
            version: '2.0.0',
            modules: ['auth', 'knowledge', 'agriculture', 'precision-agriculture', 'economics', 'voice', 'community', 'business', 'government', 'livelihood', 'health', 'vision', 'open-data', 'voice-rooms'],
            docs: '/health',
        };
    });

    // ── Route Modules ──
    await app.register(authRoutes);
    await app.register(knowledgeRoutes);
    await app.register(agricultureRoutes);
    await app.register(precisionAgricultureRoutes);
    await app.register(economicServicesRoutes);
    await app.register(voiceRoutes);
    await app.register(communityRoutes);
    await app.register(businessRoutes);
    await app.register(governmentRoutes);
    await app.register(livelihoodRoutes);
    await app.register(healthRoutes);
    await app.register(visionRoutes);
    await app.register(openDataRoutes);
    await app.register(voiceRoomRoutes);

    return app;
}

// ── Start Server ──
async function start() {
    const app = await buildServer();
    let stopMarketSync = () => {};

    // Graceful shutdown
    const shutdown = async (signal) => {
        app.log.info(`${signal} received, shutting down gracefully...`);
        stopMarketSync();
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
        stopMarketSync = startMarketSync(app);
        app.log.info(`🚀 ${APP_NAME} API running on http://${HOST}:${PORT}`);
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
