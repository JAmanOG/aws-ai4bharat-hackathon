/**
 * Precision Agriculture routes – Req 6: Precision Agriculture Support.
 */

const { analyzeFarmImage } = require('../lambdas/precision-agriculture/advisory');
const { detectPestAlerts } = require('../lambdas/precision-agriculture/pest-alerts');
const { calculateCarbonScore } = require('../lambdas/precision-agriculture/carbon');
const { buildWeatherAdvisory } = require('../lambdas/precision-agriculture/weather');
const {
    analyzePracticeData,
    logPractice,
    getPracticeLogs,
} = require('../lambdas/precision-agriculture/practice-tracker');

async function precisionAgricultureRoutes(fastify) {
    fastify.post('/agriculture/precision/analyze', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    image_type: { type: 'string', enum: ['crop', 'leaf', 'soil', 'field'] },
                    crop_type: { type: 'string' },
                    crop_stage: { type: 'string' },
                    observed_symptoms: { type: 'array', items: { type: 'string' } },
                    notes: { type: 'string' },
                    soil_condition: { type: 'string' },
                    weather: { type: 'object' },
                },
            },
        },
    }, async (req) => analyzeFarmImage(req.body));

    fastify.post('/agriculture/precision/pest-disease/analyze', {
        schema: {
            body: {
                type: 'object',
                required: ['crop_type'],
                properties: {
                    crop_type: { type: 'string' },
                    observed_symptoms: { type: 'array', items: { type: 'string' } },
                    detections: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string' },
                                confidence: { type: 'number' },
                            },
                        },
                    },
                    weather: { type: 'object' },
                    notes: { type: 'string' },
                },
            },
        },
    }, async (req) => detectPestAlerts(req.body));

    fastify.post('/agriculture/precision/carbon/calculate', {
        schema: {
            body: {
                type: 'object',
                required: ['practices'],
                properties: {
                    practices: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['practice_type', 'quantity'],
                            properties: {
                                practice_type: { type: 'string' },
                                quantity: { type: 'number' },
                                unit: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, async (req) => calculateCarbonScore(req.body));

    fastify.post('/agriculture/precision/weather/advisory', {
        schema: {
            body: {
                type: 'object',
                required: ['forecast'],
                properties: {
                    crop_type: { type: 'string' },
                    location: { type: 'object' },
                    forecast: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                date: { type: 'string' },
                                rain_mm: { type: 'number' },
                                wind_kph: { type: 'number' },
                                humidity_pct: { type: 'number' },
                                temp_max_c: { type: 'number' },
                                temp_min_c: { type: 'number' },
                            },
                        },
                    },
                },
            },
        },
    }, async (req) => buildWeatherAdvisory(req.body));

    fastify.post('/agriculture/precision/practices/analyze', {
        schema: {
            body: {
                type: 'object',
                properties: {
                    crop_type: { type: 'string' },
                    crop_stage: { type: 'string' },
                    irrigation_method: { type: 'string' },
                    practices: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                practice_type: { type: 'string' },
                                type: { type: 'string' },
                            },
                        },
                    },
                },
            },
        },
    }, async (req) => analyzePracticeData(req.body));

    fastify.post('/agriculture/precision/practices/log', {
        schema: {
            body: {
                type: 'object',
                required: ['practice_type'],
                properties: {
                    practice_type: { type: 'string' },
                    crop_type: { type: 'string' },
                    field_id: { type: 'string' },
                    quantity: { type: 'number' },
                    unit: { type: 'string' },
                    notes: { type: 'string' },
                    metadata: { type: 'object' },
                    loggedAt: { type: 'string' },
                },
            },
        },
    }, async (req, reply) => {
        const result = await logPractice(req.userId, req.body);
        return reply.status(201).send(result);
    });

    fastify.get('/agriculture/precision/practices/logs', async (req) => {
        return getPracticeLogs(req.userId, +(req.query.limit || 20));
    });
}

module.exports = precisionAgricultureRoutes;
