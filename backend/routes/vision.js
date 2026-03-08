const vision = require('../services/vision');

async function visionRoutes(fastify) {
    fastify.post('/vision/analyze', {
        schema: {
            body: {
                type: 'object',
                required: ['fileBase64', 'fileType'],
                properties: {
                    fileBase64: { type: 'string', minLength: 1 },
                    fileType: { type: 'string', enum: ['image/jpeg', 'image/png'] },
                    fileName: { type: 'string' },
                    source: { type: 'string', enum: ['camera', 'document'] },
                    userPrompt: { type: 'string' },
                },
            },
        },
    }, async (req) => {
        return vision.analyzeAttachment(req.body);
    });
}

module.exports = visionRoutes;
