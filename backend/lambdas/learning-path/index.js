/**
 * Learning Path Lambda – Main handler
 * Routes API Gateway events to recommendation, profile, and analytics functions.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const recommendations = require('./recommendations');
const learningProfile = require('./learning-profile');
const analytics = require('./analytics');

exports.handler = async (event) => {
    console.log('Learning Path event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-user';
    const queryParams = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        // ── Recommendations ──
        if (path.match(/\/knowledge\/recommendations$/) && method === 'GET') {
            const forceRefresh = queryParams.refresh === 'true';
            const result = await recommendations.getLatestRecommendations(userId, forceRefresh);
            return success(result);
        }

        // ── Learning Profile ──
        if (path.match(/\/knowledge\/learning-profile$/) && method === 'GET') {
            const profile = await learningProfile.getLearningProfile(userId);
            if (!profile) return notFound('Learning profile not found. Create one first.');
            return success(profile);
        }

        if (path.match(/\/knowledge\/learning-profile$/) && method === 'POST') {
            if (!body.learningGoals && !body.interests && !body.preferredLanguage) {
                return badRequest('At least one profile field (learningGoals, interests, or preferredLanguage) is required');
            }
            const profile = await learningProfile.upsertLearningProfile(userId, body);
            return success(profile, 201);
        }

        // ── Progress & Analytics ──
        if (path.match(/\/knowledge\/progress-summary$/) && method === 'GET') {
            const summary = await analytics.getProgressSummary(userId);
            return success(summary);
        }

        // ── Check if recommendations need refresh ──
        if (path.match(/\/knowledge\/recommendations\/status$/) && method === 'GET') {
            const needsRefresh = await analytics.shouldRefreshRecommendations(userId);
            return success({ needsRefresh });
        }

        return notFound(`Route not found: ${method} ${path}`);

    } catch (err) {
        console.error('Learning Path error:', err);
        return error('Internal server error', 500, err.message);
    }
};
