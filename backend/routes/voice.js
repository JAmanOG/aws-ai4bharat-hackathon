/**
 * Voice API routes – Requirement 2: Voice-Based Interface System
 *
 * Endpoints:
 *   POST /voice/transcribe     – Audio → Text (Sarvam STT)
 *   POST /voice/synthesize     – Text → Audio (Sarvam TTS)
 *   POST /voice/chat           – Full pipeline: text → LLM → response + audio
 *   POST /voice/chat/audio     – Full pipeline: audio → STT → LLM → response + audio
 *   POST /voice/translate      – Text translation between Indian languages
 *   GET  /voice/languages      – Supported languages + voices
 *   GET  /voice/sessions       – User's conversation sessions
 *   GET  /voice/sessions/:id   – Session history
 */

const { v4: uuid } = require('uuid');
const sarvam = require('../services/sarvam');
const { generateResponse } = require('../services/llm');
const memory = require('../services/memory');

async function voiceRoutes(fastify) {

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/transcribe – Audio → Text                  */
    /* ═══════════════════════════════════════════════════════ */
    fastify.post('/voice/transcribe', {
        config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        // Accept multipart file upload or raw body
        let audioBuffer;
        let languageCode = 'unknown';

        if (req.isMultipart && req.isMultipart()) {
            const data = await req.file();
            if (!data) {
                return reply.status(400).send({ error: 'No audio file provided' });
            }
            audioBuffer = await data.toBuffer();
            // Check for language_code in fields
            const fields = data.fields;
            if (fields?.language_code?.value) {
                languageCode = fields.language_code.value;
            }
        } else {
            // Raw body (base64 JSON or binary)
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

        const langBcp47 = languageCode === 'unknown' ? 'unknown' : sarvam.toBcp47(languageCode);

        const result = await sarvam.transcribe(audioBuffer, {
            languageCode: langBcp47,
            mode: req.body?.mode || 'transcribe',
        });

        return {
            transcript: result.transcript,
            language_code: result.language_code,
            language_probability: result.language_probability,
            request_id: result.request_id,
        };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/synthesize – Text → Audio                  */
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
    /*  POST /voice/chat – Text chat with memory + TTS         */
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
                },
            },
        },
    }, async (req) => {
        const startTime = Date.now();
        const userId = req.userId;
        const {
            text,
            language_code = 'hi',
            session_id = uuid(),
            generate_audio = true,
        } = req.body;

        // 1. Store user turn
        await memory.storeTurn(userId, session_id, 'user', text, {
            language: language_code,
        });

        // 2. Build context messages with memory
        const messages = await memory.buildContextMessages(userId, session_id, text);

        // 3. Generate response via LLM chain
        const llmResult = await generateResponse(messages, {
            temperature: 0.3,
            maxTokens: 512, // Shorter for voice
        });

        const responseText = llmResult.content;
        const responseTimeMs = Date.now() - startTime;

        // 4. Store assistant turn
        await memory.storeTurn(userId, session_id, 'assistant', responseText, {
            language: language_code,
            responseTimeMs,
        });

        // 5. Generate audio if requested
        let audioBase64 = '';
        if (generate_audio && responseText) {
            try {
                const ttsResult = await sarvam.synthesize(responseText, {
                    targetLanguageCode: language_code,
                });
                audioBase64 = ttsResult.audios?.[0] || '';
            } catch (err) {
                req.log.warn({ err }, 'TTS generation failed, returning text only');
            }
        }

        // 6. Extract facts in background (don't block response)
        memory.extractAndStoreFacts(userId, text, responseText).catch(err => {
            req.log.warn({ err }, 'Background fact extraction failed');
        });

        return {
            response_text: responseText,
            audio_base64: audioBase64,
            session_id,
            language_code,
            provider: llmResult.provider,
            response_time_ms: responseTimeMs,
        };
    });

    /* ═══════════════════════════════════════════════════════ */
    /*  POST /voice/chat/audio – Full audio pipeline           */
    /*  Audio → STT → LLM → TTS → Audio                       */
    /* ═══════════════════════════════════════════════════════ */
    fastify.post('/voice/chat/audio', {
        config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    }, async (req, reply) => {
        const startTime = Date.now();
        const userId = req.userId;

        // Parse audio from request
        let audioBuffer;
        let languageCode = 'unknown';
        let sessionId = uuid();

        if (req.isMultipart && req.isMultipart()) {
            const data = await req.file();
            if (!data) {
                return reply.status(400).send({ error: 'No audio file provided' });
            }
            audioBuffer = await data.toBuffer();
            const fields = data.fields;
            if (fields?.language_code?.value) languageCode = fields.language_code.value;
            if (fields?.session_id?.value) sessionId = fields.session_id.value;
        } else if (req.body?.audio_base64) {
            audioBuffer = Buffer.from(req.body.audio_base64, 'base64');
            languageCode = req.body.language_code || 'unknown';
            sessionId = req.body.session_id || sessionId;
        } else {
            return reply.status(400).send({ error: 'No audio data provided' });
        }

        // 1. Transcribe audio → text
        const sttResult = await sarvam.transcribe(audioBuffer, {
            languageCode: languageCode === 'unknown' ? 'unknown' : sarvam.toBcp47(languageCode),
        });

        const userText = sttResult.transcript;
        const detectedLang = sttResult.language_code || languageCode;

        if (!userText || !userText.trim()) {
            return {
                response_text: '',
                transcript: '',
                audio_base64: '',
                session_id: sessionId,
                language_code: detectedLang,
                error: 'Could not transcribe audio',
            };
        }

        // 2. Store user turn
        await memory.storeTurn(userId, sessionId, 'user', userText, {
            language: detectedLang,
        });

        // 3. Build context + LLM
        const messages = await memory.buildContextMessages(userId, sessionId, userText);
        const llmResult = await generateResponse(messages, {
            temperature: 0.3,
            maxTokens: 512,
        });

        const responseText = llmResult.content;
        const responseTimeMs = Date.now() - startTime;

        // 4. Store assistant turn
        await memory.storeTurn(userId, sessionId, 'assistant', responseText, {
            language: detectedLang,
            responseTimeMs,
        });

        // 5. Generate TTS for response
        let audioBase64 = '';
        try {
            const ttsResult = await sarvam.synthesize(responseText, {
                targetLanguageCode: detectedLang,
            });
            audioBase64 = ttsResult.audios?.[0] || '';
        } catch (err) {
            req.log.warn({ err }, 'TTS generation failed');
        }

        // 6. Background fact extraction
        memory.extractAndStoreFacts(userId, userText, responseText).catch(err => {
            req.log.warn({ err }, 'Background fact extraction failed');
        });

        return {
            transcript: userText,
            response_text: responseText,
            audio_base64: audioBase64,
            session_id: sessionId,
            language_code: detectedLang,
            provider: llmResult.provider,
            response_time_ms: Date.now() - startTime,
        };
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
        }));

        return {
            languages,
            total: languages.length,
            stt_model: 'saaras:v3',
            tts_model: 'bulbul:v3',
        };
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
    /*  GET /voice/sessions/:id – Session conversation history */
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
}

module.exports = voiceRoutes;
