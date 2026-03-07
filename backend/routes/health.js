/**
 * Health routes – Symptom Checker, Health Articles, Directory, Medical Imaging
 */

const symptomChecker = require('../lambdas/health-ai/symptom-checker');
const knowledgeBase  = require('../lambdas/health-ai/knowledge-base');
const govtPortals    = require('../lambdas/health-directory/govt-portals');
const providers      = require('../lambdas/health-directory/providers');
const imaging        = require('../lambdas/medical-imaging/imaging');

async function healthRoutes(fastify) {
    // ═══════════════════════════════════════
    //  Symptom Checker (Bedrock AI)
    // ═══════════════════════════════════════

    fastify.post('/health/symptoms/check', {
        schema: {
            body: {
                type: 'object',
                required: ['symptoms', 'age', 'gender'],
                properties: {
                    symptoms: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
                    age: { type: 'integer', minimum: 0, maximum: 150 },
                    gender: { type: 'string', enum: ['male', 'female', 'other'] },
                    duration: { type: 'string' },
                    severity: { type: 'string', enum: ['mild', 'moderate', 'severe'] },
                    existingConditions: { type: 'array', items: { type: 'string' } },
                },
            },
        },
    }, async (req) => {
        const { symptoms, age, gender, medicalHistory, existingConditions } = req.body;
        const mergedHistory = Array.isArray(existingConditions) && existingConditions.length > 0
            ? [medicalHistory, existingConditions.join(', ')].filter(Boolean).join('; ')
            : medicalHistory;

        return symptomChecker.checkSymptoms(symptoms, age, gender, mergedHistory, req.userId);
    });

    // ═══════════════════════════════════════
    //  Health Knowledge Base / Articles
    // ═══════════════════════════════════════

    fastify.get('/health/articles', async (req) => {
        const { topic, language, page = 1, limit = 10 } = req.query;
        return knowledgeBase.listArticles({ topic, language, page: +page, limit: +limit });
    });

    fastify.get('/health/articles/:id', async (req) => {
        const result = await knowledgeBase.getArticle(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Article not found' };
        return result;
    });

    fastify.post('/health/articles/generate', {
        schema: {
            body: {
                type: 'object',
                required: ['topic'],
                properties: {
                    topic: { type: 'string', minLength: 1, maxLength: 200 },
                    language: { type: 'string', default: 'en' },
                },
            },
        },
    }, async (req) => {
        return knowledgeBase.generateArticle(req.body.topic, req.body.language || 'en');
    });

    // ═══════════════════════════════════════
    //  Health Government Portals & Eligibility
    // ═══════════════════════════════════════

    fastify.get('/health/portals', async (req) => {
        const { category, search } = req.query;
        return govtPortals.listHealthPortals(category, search);
    });

    fastify.get('/health/portals/:id', async (req) => {
        const result = await govtPortals.getHealthPortal(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Health portal not found' };
        return result;
    });

    fastify.post('/health/eligibility-check', {
        schema: {
            body: {
                type: 'object',
                required: ['age', 'location'],
                properties: {
                    age: { type: 'integer' },
                    income: { type: 'number' },
                    location: { type: 'string' },
                    familySize: { type: 'integer' },
                    bplCard: { type: 'boolean' },
                    aadhaar: { type: 'boolean' },
                    gender: { type: 'string' },
                },
            },
        },
    }, async (req) => {
        return govtPortals.checkEligibility(req.body);
    });

    // ═══════════════════════════════════════
    //  Health Providers
    // ═══════════════════════════════════════

    fastify.get('/health/providers', async (req) => {
        const { city, type, search, page = 1, limit = 10 } = req.query;
        return providers.listProviders({ city, type, search, page: +page, limit: +limit });
    });

    fastify.get('/health/providers/:id', async (req) => {
        const result = await providers.getProvider(req.params.id);
        if (!result) throw { statusCode: 404, message: 'Provider not found' };
        return result;
    });

    // ═══════════════════════════════════════
    //  Medical Imaging (S3 + Bedrock Vision)
    // ═══════════════════════════════════════

    fastify.post('/health/imaging/upload', {
        schema: {
            body: {
                type: 'object',
                required: ['fileName', 'fileType', 'imagingType'],
                properties: {
                    fileName: { type: 'string' },
                    fileType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/dicom', 'application/pdf'] },
                    imagingType: { type: 'string', enum: ['xray', 'ct_scan', 'mri', 'ultrasound', 'pathology'] },
                    metadata: { type: 'object' },
                },
            },
        },
    }, async (req) => {
        return imaging.initiateUpload(
            req.userId,
            req.body.imagingType,
            req.body.metadata?.description || req.body.fileName,
            req.body.fileType,
        );
    });

    fastify.get('/health/imaging/:id/status', async (req) => {
        const result = await imaging.getDocumentStatus(req.params.id, req.userId);
        if (!result) throw { statusCode: 404, message: 'Document not found' };
        return result;
    });

    fastify.post('/health/imaging/:id/analyze', async (req) => {
        try {
            return await imaging.analyzeImage(
                req.params.id,
                req.body?.imagingType || 'xray',
                req.userId,
            );
        } catch (err) {
            if (err.message === 'DOCUMENT_NOT_FOUND') throw { statusCode: 404, message: 'Document not found' };
            if (err.message === 'NOT_UPLOADED') throw { statusCode: 400, message: 'Image has not been uploaded yet' };
            throw err;
        }
    });
}

module.exports = healthRoutes;
