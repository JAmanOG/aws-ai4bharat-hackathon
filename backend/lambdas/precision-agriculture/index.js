/**
 * Precision Agriculture Lambda – main handler.
 * Covers Requirement 6 API routes.
 */

const { success, error, badRequest, notFound } = require('../../utils/response');
const { analyzeFarmImage } = require('./advisory');
const { detectPestAlerts } = require('./pest-alerts');
const { calculateCarbonScore } = require('./carbon');
const { buildWeatherAdvisory } = require('./weather');
const { analyzePracticeData, logPractice, getPracticeLogs } = require('./practice-tracker');

exports.handler = async (event) => {
    console.log('Precision Agriculture event:', JSON.stringify(event, null, 2));

    const method = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const userId = event.requestContext?.authorizer?.claims?.sub || event.headers?.['x-user-id'] || 'demo-farmer';
    const qp = event.queryStringParameters || {};
    const body = event.body ? JSON.parse(event.body) : {};

    try {
        if (path.match(/\/agriculture\/precision\/analyze$/) && method === 'POST') {
            return success(await analyzeFarmImage(body));
        }

        if (path.match(/\/agriculture\/precision\/pest-disease\/analyze$/) && method === 'POST') {
            return success(detectPestAlerts(body));
        }

        if (path.match(/\/agriculture\/precision\/carbon\/calculate$/) && method === 'POST') {
            if (!Array.isArray(body.practices)) return badRequest('practices array is required');
            return success(calculateCarbonScore(body));
        }

        if (path.match(/\/agriculture\/precision\/weather\/advisory$/) && method === 'POST') {
            if (!Array.isArray(body.forecast)) return badRequest('forecast array is required');
            return success(buildWeatherAdvisory(body));
        }

        if (path.match(/\/agriculture\/precision\/practices\/analyze$/) && method === 'POST') {
            return success(analyzePracticeData(body));
        }

        if (path.match(/\/agriculture\/precision\/practices\/log$/) && method === 'POST') {
            if (!body.practice_type) return badRequest('practice_type is required');
            return success(await logPractice(userId, body), 201);
        }

        if (path.match(/\/agriculture\/precision\/practices\/logs$/) && method === 'GET') {
            return success(await getPracticeLogs(userId, parseInt(qp.limit || '20', 10)));
        }

        return notFound(`Route not found: ${method} ${path}`);
    } catch (err) {
        console.error('Precision Agriculture error:', err);
        return error('Internal server error', 500, err.message);
    }
};
