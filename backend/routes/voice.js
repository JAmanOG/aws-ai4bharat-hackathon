/**
 * Voice API routes – Requirement 2: Voice-Based Interface System
 *
 * Architecture:
 *   Audio → Amazon Transcribe (STT + Lang ID)
 *       → AWS Nova (Translate + Understand + Route)
 *       → AI Orchestrator → MCP → [Agents | Bedrock | Gemini]
 *       → Sarvam AI (Localize + TTS)
 *       → User Output
 *
 * Endpoints:
 *   POST /voice/transcribe     – Audio → Text (Amazon Transcribe + Sarvam fallback)
 *   POST /voice/synthesize     – Text → Audio (Sarvam TTS)
 *   POST /voice/chat           – Full text pipeline (Nova → Agent → Sarvam TTS)
 *   POST /voice/chat/audio     – Full audio pipeline (Transcribe → Nova → Agent → Sarvam TTS)
 *   POST /voice/translate      – Text translation between Indian languages
 *   GET  /voice/languages      – Supported languages + voices
 *   GET  /voice/sessions       – User's conversation sessions
 *   GET  /voice/sessions/:id   – Session history
 *   GET  /voice/memory/facts   – User's extracted memory facts
 *   DELETE /voice/memory/facts/:key – Delete a fact
 *   GET  /voice/agents         – List available AI agents
 *   GET  /voice/pipeline/health – Pipeline component health check
 */

const { v4: uuid } = require('uuid');
const sarvam = require('../services/sarvam');
const transcribeService = require('../services/transcribe');
const orchestrator = require('../services/orchestrator');
const memory = require('../services/memory');
const agentRegistry = require('../services/agents');

async function voiceRoutes(fastify) {

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/transcribe – Audio → Text                  */
    /*  Uses Amazon Transcribe (primary) + Sarvam STT (fallback) */
    /* ═══════════════════════════════════════════════════════ */
    fastify.post('/voice/transcribe', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        let audioBuffer;
        let languageCode = 'unknown';

        if (req.isMultipart && req.isMultipart()) {
            const data = await req.file();
            if (!data) {
                return reply.status(400).send({ error: 'No audio file provided' });
            }
            audioBuffer = await data.toBuffer();
            const fields = data.fields;
            if (fields?.language_code?.value) {
                languageCode = fields.language_code.value;
            }
        } else {
            const body = req.body;
            if (body?.audio_base64) {
                audioBuffer = Buffer.from(body.audio_base64, 'base64');
                languageCode = body.language_code || 'unknown';
            } else if (Buffer.isBuffer(req.body)) {
                audioBuffer = req.body;
                languageCode = req.headers['x-language-code'] || 'unknown';
            } else {
                return reply.status(400).send({ error: 'No audio data provided. Send multipart file or JSON with audio_base64' });
            }
        }

        if (!audioBuffer || audioBuffer.length === 0) {
            return reply.status(400).send({ error: 'Empty audio data' });
        }

        // Use hybrid transcription (Amazon Transcribe → Sarvam fallback)
        const result = await transcribeService.transcribe(audioBuffer, { languageCode });

        return {
            transcript: result.transcript,
            language_code: result.language_code,
            confidence: result.confidence,
            provider: result.provider,
        };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/synthesize – Text → Audio (Sarvam TTS)     */
    /* ═══════════════════════════════════════════════════════ */
    fastify.post('/voice/synthesize', {
        schema: {
            body: {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string', minLength: 1, maxLength: 2500 },
                    language_code: { type: 'string' },
                    speaker: { type: 'string' },
                    pace: { type: 'number', minimum: 0.5, maximum: 2.0 },
                },
            },
        },
    }, async (req) => {
        const { text, language_code = 'hi', speaker, pace } = req.body;

        const result = await sarvam.synthesize(text, {
            targetLanguageCode: language_code,
            speaker,
            pace,
        });

        return {
            audio_base64: result.audios?.[0] || '',
            request_id: result.request_id,
        };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/translate – Language translation            */
    /* ═══════════════════════════════════════════════════════ */
    fastify.post('/voice/translate', {
        schema: {
            body: {
                type: 'object',
                required: ['text', 'target_language'],
                properties: {
                    text: { type: 'string', minLength: 1, maxLength: 2000 },
                    source_language: { type: 'string' },
                    target_language: { type: 'string' },
                },
            },
        },
    }, async (req) => {
        const { text, source_language = 'auto', target_language } = req.body;
        const result = await sarvam.translate(text, source_language, target_language);
        return {
            translated_text: result.translated_text,
            source_language_code: result.source_language_code,
            request_id: result.request_id,
        };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/chat – Text → Orchestrator pipeline        */
    /*  Text → Nova → MCP/Agent → Sarvam (Localize + TTS)     */
    /* ═══════════════════════════════════════════════════════ */
    fastify.post('/voice/chat', {
        schema: {
            body: {
                type: 'object',
                required: ['text'],
                properties: {
                    text: { type: 'string', minLength: 1 },
                    language_code: { type: 'string' },
                    session_id: { type: 'string' },
                    generate_audio: { type: 'boolean' },
                    screen_context: { type: 'string' },
                },
            },
        },
    }, async (req) => {
        const userId = req.userId;
        const reqStart = Date.now();
        const {
            text,
            language_code = 'hi',
            session_id = uuid(),
            generate_audio = true,
            screen_context = '',
        } = req.body;

        req.log.info({
            route: '/voice/chat',
            userId,
            textLength: text.length,
            textPreview: text.substring(0, 80),
            language: language_code,
            screenContext: (screen_context || '').substring(0, 100),
        }, '▶ Voice text request received');

        try {
            const result = await orchestrator.processText({
                text,
                userId,
                sessionId: session_id,
                languageCode: language_code,
                generateAudio: generate_audio,
                screenContext: screen_context,
            });

            req.log.info({
                route: '/voice/chat',
                totalMs: Date.now() - reqStart,
                provider: result.provider,
                domain: result.domain,
            }, '■ Voice text response sent');

            return result;
        } catch (err) {
            req.log.error({
                route: '/voice/chat',
                totalMs: Date.now() - reqStart,
                error: err.message,
            }, '✗ Voice text pipeline failed');
            throw err;
        }
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/chat/audio – Full audio pipeline           */
    /*  Audio → Transcribe → Nova → Agent → Sarvam → Output   */
    /* ═══════════════════════════════════════════════════════ */
    fastify.post('/voice/chat/audio', {
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const userId = req.userId;
        const reqStart = Date.now();

        // Parse audio from request
        let audioBuffer;
        let languageCode = 'unknown';
        let sessionId = uuid();
        let screenContext = '';

        if (req.isMultipart && req.isMultipart()) {
            const data = await req.file();
            if (!data) {
                return reply.status(400).send({ error: 'No audio file provided' });
            }
            audioBuffer = await data.toBuffer();
            const fields = data.fields;
            if (fields?.language_code?.value) languageCode = fields.language_code.value;
            if (fields?.session_id?.value) sessionId = fields.session_id.value;
            if (fields?.screen_context?.value) screenContext = fields.screen_context.value;
        } else if (req.body?.audio_base64) {
            audioBuffer = Buffer.from(req.body.audio_base64, 'base64');
            languageCode = req.body.language_code || 'unknown';
            sessionId = req.body.session_id || sessionId;
            screenContext = req.body.screen_context || '';
        } else {
            return reply.status(400).send({ error: 'No audio data provided' });
        }

        req.log.info({
            route: '/voice/chat/audio',
            userId,
            audioBytes: audioBuffer.length,
            languageCode,
            sessionId: sessionId.slice(0, 8),
            screenContext: (screenContext || '').substring(0, 80),
        }, '▶ Voice audio request received');

        try {
            const result = await orchestrator.processAudio({
                audioBuffer,
                userId,
                sessionId,
                languageCode,
                generateAudio: true,
                screenContext,
            });

            req.log.info({
                route: '/voice/chat/audio',
                totalMs: Date.now() - reqStart,
                provider: result.provider,
                domain: result.domain,
                hasAudio: !!result.audio_base64,
                hasError: !!result.error,
            }, '■ Voice audio response sent');

            return result;
        } catch (err) {
            req.log.error({
                route: '/voice/chat/audio',
                totalMs: Date.now() - reqStart,
                error: err.message,
            }, '✗ Voice audio pipeline failed');
            throw err;
        }
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  GET /voice/languages – Supported languages             */
    /* ═══════════════════════════════════════════════════════ */
    fastify.get('/voice/languages', {
        config: { rateLimit: false },
    }, async () => {
        const languages = Object.entries(sarvam.SARVAM_LANGUAGES).map(([short, info]) => ({
            code: short,
            bcp47: info.code,
            name: info.name,
            tts_speaker: sarvam.DEFAULT_SPEAKERS[info.code] || null,
            tts_available: !!sarvam.DEFAULT_SPEAKERS[info.code],
            transcribe_supported: transcribeService.TRANSCRIBE_LANGUAGES.includes(info.code),
        }));

        return {
            languages,
            total: languages.length,
            stt_primary: 'amazon-transcribe',
            stt_fallback: 'sarvam-saaras-v3',
            tts_model: 'sarvam-bulbul-v3',
            routing_model: 'aws-nova-micro',
        };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  GET /voice/agents – List available AI agents            */
    /* ═══════════════════════════════════════════════════════ */
    fastify.get('/voice/agents', {
        config: { rateLimit: false },
    }, async () => {
        return { agents: agentRegistry.listAgents() };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  GET /voice/sessions – User's conversation sessions     */
    /* ═══════════════════════════════════════════════════════ */
    fastify.get('/voice/sessions', async (req) => {
        const limit = parseInt(req.query.limit || '10', 10);
        const sessions = await memory.getUserSessions(req.userId, limit);
        return { sessions };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  GET /voice/sessions/:id – Session history              */
    /* ═══════════════════════════════════════════════════════ */
    fastify.get('/voice/sessions/:id', async (req) => {
        const sessionId = req.params.id;
        const limit = parseInt(req.query.limit || '50', 10);
        const history = await memory.getSessionHistory(req.userId, sessionId, limit);
        return { session_id: sessionId, turns: history };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  GET /voice/memory/facts – User's extracted facts       */
    /* ═══════════════════════════════════════════════════════ */
    fastify.get('/voice/memory/facts', async (req) => {
        const facts = await memory.getUserFacts(req.userId);
        return { facts };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  DELETE /voice/memory/facts/:key – Delete a fact        */
    /* ═══════════════════════════════════════════════════════ */
    fastify.delete('/voice/memory/facts/:key', async (req) => {
        await memory.deleteFact(req.userId, req.params.key);
        return { deleted: true, key: req.params.key };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  GET /voice/pipeline/health – Pipeline health check     */
    /* ═══════════════════════════════════════════════════════ */
    fastify.get('/voice/pipeline/health', {
        config: { rateLimit: false },
    }, async () => {
        const components = {
            stt_amazon_transcribe: { status: 'available', region: process.env.AWS_REGION || 'ap-south-1' },
            stt_sarvam_fallback: { status: process.env.SARVAM_API_KEY ? 'available' : 'missing_key' },
            nova_router: { status: 'available', model: process.env.NOVA_MODEL_ID || 'amazon.nova-micro-v1:0' },
            bedrock_llm: { status: 'available', model: process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0' },
            gemini_fallback: { status: process.env.GEMINI_API_KEY ? 'available' : 'missing_key' },
            sarvam_tts: { status: process.env.SARVAM_API_KEY ? 'available' : 'missing_key' },
            sarvam_translate: { status: process.env.SARVAM_API_KEY ? 'available' : 'missing_key' },
            memory_dynamodb: { status: 'available' },
        };

        const agents = agentRegistry.listAgents().map(a => a.name);

        return {
            pipeline: 'Audio → Transcribe → Nova → MCP/Agent → Sarvam → Output',
            components,
            agents,
            healthy: Object.values(components).every(c => c.status === 'available'),
        };
    });
}

module.exports = voiceRoutes;
