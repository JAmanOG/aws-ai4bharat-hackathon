/**
 * Auth Routes – Registration, Login, Profile, DigiLocker Verification
 *
 * Requirement 13: AI Processing and Context Management
 *   - User-based registration with phone + PIN
 *   - DigiLocker identity verification (API Setu sandbox)
 *   - Unified profile (merges voice memory, learning, economic data)
 *   - Personalized recommendations API
 *   - Peer clustering API
 *   - Feedback loop for continuous learning (AC5)
 */

const userService = require('../services/user');
const digilockerService = require('../services/digilocker');
const recommendationsService = require('../services/recommendations');
const { findPeersForUser } = require('../lambdas/peer-grouping/clustering');
const { getUserGroups, joinGroup, leaveGroup } = require('../lambdas/peer-grouping/groups');

async function authRoutes(fastify) {

    /* ═══════════════════════════════════════════════════ */
    /*  Public Routes (no auth required)                   */
    /* ═══════════════════════════════════════════════════ */

    /**
     * POST /auth/register
     * Register a new user with phone + PIN.
     */
    fastify.post('/auth/register', {
        config: { skipAuth: true },
        schema: {
            body: {
                type: 'object',
                required: ['phone', 'pin'],
                properties: {
                    phone: { type: 'string', minLength: 10, maxLength: 15 },
                    pin: { type: 'string', minLength: 4, maxLength: 6 },
                    name: { type: 'string' },
                    language: { type: 'string', default: 'hi' },
                    state: { type: 'string' },
                    district: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const result = await userService.register(request.body);
        return reply.status(201).send({
            success: true,
            message: 'Registration successful',
            user: result.user,
            token: result.token,
        });
    });

    /**
     * POST /auth/login
     * Login with phone + PIN, returns JWT.
     */
    fastify.post('/auth/login', {
        config: { skipAuth: true },
        schema: {
            body: {
                type: 'object',
                required: ['phone', 'pin'],
                properties: {
                    phone: { type: 'string' },
                    pin: { type: 'string' },
                },
            },
        },
    }, async (request, reply) => {
        const { phone, pin } = request.body;
        const result = await userService.login(phone, pin);
        return reply.send({
            success: true,
            message: 'Login successful',
            user: result.user,
            token: result.token,
        });
    });

    /* ═══════════════════════════════════════════════════ */
    /*  DigiLocker Routes                                  */
    /* ═══════════════════════════════════════════════════ */

    /**
     * GET /auth/digilocker/authorize
     * Returns the DigiLocker authorization URL.
     * Frontend opens this URL in a browser/webview.
     */
    fastify.get('/auth/digilocker/authorize', async (request) => {
        const url = digilockerService.getAuthorizationUrl(request.userId);
        return { authorizationUrl: url };
    });

    /**
     * GET /auth/digilocker/callback
     * Callback endpoint for DigiLocker OAuth.
     * Exchanges code for token, verifies user, stores data.
     */
    fastify.get('/auth/digilocker/callback', {
        config: { skipAuth: true },
        schema: {
            querystring: {
                type: 'object',
                properties: {
                    code: { type: 'string' },
                    state: { type: 'string' }, // userId
                },
            },
        },
    }, async (request, reply) => {
        const { code, state: userId } = request.query;

        if (!code || !userId) {
            return reply.status(400).send({ error: 'Missing code or state parameter' });
        }

        const verificationResult = await digilockerService.verifyUser(code);

        // Store verification in user profile
        await userService.setDigilockerVerified(userId, {
            name: verificationResult.name,
            documentTypes: verificationResult.documentTypes,
        });

        return {
            success: true,
            message: 'DigiLocker verification successful',
            verified: verificationResult.verified,
            name: verificationResult.name,
            documents: verificationResult.documentTypes,
        };
    });

    /**
     * POST /auth/digilocker/verify
     * Direct Aadhaar verification via DigiLocker sandbox.
     * For prototype: quick verification without full OAuth flow.
     */
    fastify.post('/auth/digilocker/verify', {
        schema: {
            body: {
                type: 'object',
                required: ['aadhaarNumber'],
                properties: {
                    aadhaarNumber: { type: 'string', minLength: 12, maxLength: 12 },
                },
            },
        },
    }, async (request, reply) => {
        const { aadhaarNumber } = request.body;

        const result = await digilockerService.verifyAadhaar(aadhaarNumber);

        if (result.verified) {
            await userService.setDigilockerVerified(request.userId, {
                name: result.name,
                documentTypes: ['AADHAAR'],
            });
        }

        return {
            success: true,
            verified: result.verified,
            maskedAadhaar: result.maskedAadhaar,
            name: result.name,
        };
    });

    /* ═══════════════════════════════════════════════════ */
    /*  Profile Routes (auth required)                     */
    /* ═══════════════════════════════════════════════════ */

    /**
     * GET /auth/profile
     * Get basic user profile.
     */
    fastify.get('/auth/profile', async (request) => {
        const profile = await userService.getProfile(request.userId);
        if (!profile) {
            throw { statusCode: 404, message: 'Profile not found' };
        }
        return { success: true, profile };
    });

    /**
     * GET /auth/profile/unified
     * Get unified profile (User + voice memory facts + domain data).
     * This is the full AI-context-aware profile.
     */
    fastify.get('/auth/profile/unified', async (request) => {
        const profile = await userService.getUnifiedProfile(request.userId);
        if (!profile) {
            throw { statusCode: 404, message: 'Profile not found' };
        }
        return { success: true, profile };
    });

    /**
     * PUT /auth/profile
     * Update profile fields.
     */
    fastify.put('/auth/profile', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    preferredLanguage: { type: 'string' },
                    state: { type: 'string' },
                    district: { type: 'string' },
                    profileComplete: { type: 'boolean' },
                    onboardingDone: { type: 'boolean' },
                },
            },
        },
    }, async (request) => {
        const updated = await userService.updateProfile(request.userId, request.body);
        return { success: true, profile: updated };
    });

    /* ═══════════════════════════════════════════════════ */
    /*  Recommendations (AC4)                              */
    /* ═══════════════════════════════════════════════════ */

    /**
     * GET /auth/recommendations
     * Get personalized recommendations based on user history + context.
     */
    fastify.get('/auth/recommendations', async (request) => {
        const result = await recommendationsService.getPersonalizedRecommendations(request.userId);
        return { success: true, ...result };
    });

    /**
     * POST /auth/recommendations/feedback
     * Submit feedback on a recommendation (continuous learning — AC5).
     */
    fastify.post('/auth/recommendations/feedback', {
        schema: {
            body: {
                type: 'object',
                required: ['rating'],
                properties: {
                    interactionId: { type: 'string' },
                    domain: { type: 'string' },
                    rating: { type: 'number', minimum: 1, maximum: 5 },
                    feedbackText: { type: 'string' },
                    action: { type: 'string', enum: ['followed', 'ignored', 'dismissed'] },
                },
            },
        },
    }, async (request) => {
        await recommendationsService.recordFeedback(request.userId, request.body);
        return { success: true, message: 'Feedback recorded' };
    });

    /**
     * POST /auth/recommendations/:id/action
     * Track when user acts on a recommendation.
     */
    fastify.post('/auth/recommendations/:id/action', {
        schema: {
            body: {
                type: 'object',
                required: ['action'],
                properties: {
                    action: { type: 'string', enum: ['followed', 'ignored', 'dismissed'] },
                },
            },
        },
    }, async (request) => {
        await recommendationsService.trackRecommendationAction(
            request.userId,
            request.params.id,
            request.body.action,
        );
        return { success: true };
    });

    /**
     * GET /auth/engagement
     * Get user engagement analytics (feedback loop data).
     */
    fastify.get('/auth/engagement', async (request) => {
        const engagement = await recommendationsService.getUserEngagement(request.userId);
        return { success: true, engagement };
    });

    /* ═══════════════════════════════════════════════════ */
    /*  Peer Clustering (AC3)                              */
    /* ═══════════════════════════════════════════════════ */

    /**
     * GET /auth/peers
     * Find matching peers for the user using AI clustering.
     */
    fastify.get('/auth/peers', async (request) => {
        const result = await findPeersForUser(request.userId);
        return { success: true, ...result };
    });

    /**
     * GET /auth/groups
     * Get user's existing peer groups.
     */
    fastify.get('/auth/groups', async (request) => {
        const groups = await getUserGroups(request.userId);
        return { success: true, groups };
    });

    /**
     * POST /auth/groups/:id/join
     * Join a peer group.
     */
    fastify.post('/auth/groups/:id/join', async (request) => {
        const result = await joinGroup(request.params.id, request.userId);
        return { success: true, ...result };
    });

    /**
     * POST /auth/groups/:id/leave
     * Leave a peer group.
     */
    fastify.post('/auth/groups/:id/leave', async (request) => {
        const result = await leaveGroup(request.params.id, request.userId);
        return { success: true, ...result };
    });
}

module.exports = authRoutes;
