/**
 * AI Orchestrator Layer
 *
 * Central orchestration engine for the voice pipeline. Coordinates:
 *
 *   User Audio
 *       ↓
 *   STT (Sarvam primary → Amazon Transcribe fallback)
 *       ↓
 *   AWS Nova (Translate + Understand + Route)
 *       ↓
 *   MCP → [AI Agents | Bedrock | Gemini]
 *       ↓
 *   Sarvam AI (Localize + TTS)
 *       ↓
 *   User Output (text + audio)
 *
 * Every stage is logged with timing + provider + outcome.
 *
 * This module exposes two main entry points:
 *   - processAudio()  – Full audio pipeline (STT → response)
 *   - processText()   – Text-only pipeline (skip STT)
 */

const { v4: uuid } = require('uuid');
const transcribeService = require('./transcribe');
const nova = require('./nova');
const mcp = require('./mcp');
const memory = require('./memory');
const sarvam = require('./sarvam');

/* ─── Structured logger ─── */
function log(level, stage, msg, data = {}) {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.toUpperCase()}] [Orchestrator/${stage}]`;
    const extras = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    if (level === 'error') console.error(`${prefix} ${msg}${extras}`);
    else if (level === 'warn') console.warn(`${prefix} ${msg}${extras}`);
    else console.log(`${prefix} ${msg}${extras}`);
}

/* ═══════════════════════════════════════════════════════ */
/*  Full Audio Pipeline                                    */
/*  Audio → STT → Nova → MCP/Agent → Sarvam → Out         */
/* ═══════════════════════════════════════════════════════ */

/**
 * Process a voice audio input through the complete pipeline.
 *
 * @param {object} params
 * @param {Buffer} params.audioBuffer   – Raw audio data
 * @param {string} params.userId        – User identifier
 * @param {string} [params.sessionId]   – Session ID (auto-generated if omitted)
 * @param {string} [params.languageCode] – Language hint for STT
 * @param {boolean} [params.generateAudio=true] – Generate TTS response
 * @returns {Promise<OrchestratorResult>}
 */
async function processAudio(params) {
    const startTime = Date.now();
    const {
        audioBuffer,
        userId,
        sessionId = uuid(),
        languageCode = 'unknown',
        generateAudio = true,
    } = params;

    const pipeline = { stages: {} };

    log('info', 'Pipeline', '▶ STARTING audio pipeline', {
        userId,
        sessionId: sessionId.slice(0, 8),
        audioBytes: audioBuffer?.length || 0,
        languageHint: languageCode,
        generateAudio,
    });

    // ──────────────────────────────────────────────
    // Stage 1: STT (Sarvam primary → Transcribe fallback)
    // ──────────────────────────────────────────────
    let sttResult;
    const sttStart = Date.now();

    try {
        log('info', 'STT', '→ Starting speech-to-text', { audioBytes: audioBuffer.length });
        sttResult = await transcribeService.transcribe(audioBuffer, { languageCode });
        const sttMs = Date.now() - sttStart;
        log('info', 'STT', `✓ Transcription complete in ${sttMs}ms`, {
            provider: sttResult.provider,
            language: sttResult.language_code,
            transcript: (sttResult.transcript || '').substring(0, 100),
            confidence: sttResult.confidence,
        });
        pipeline.stages.stt = {
            provider: sttResult.provider,
            language: sttResult.language_code,
            transcript_preview: (sttResult.transcript || '').substring(0, 60),
            ms: sttMs,
        };
    } catch (sttErr) {
        const sttMs = Date.now() - sttStart;
        log('error', 'STT', `✗ All STT providers failed after ${sttMs}ms`, {
            error: sttErr.message,
        });
        pipeline.stages.stt = { provider: 'none', error: sttErr.message, ms: sttMs };
        return {
            transcript: '',
            response_text: 'Sorry, I could not understand what you said. Please try again.',
            response_text_english: 'Sorry, I could not understand what you said. Please try again.',
            audio_base64: '',
            session_id: sessionId,
            language_code: languageCode,
            domain: 'unknown',
            intent: 'unknown',
            provider: 'none',
            pipeline,
            response_time_ms: Date.now() - startTime,
            error: `STT failed: ${sttErr.message}`,
        };
    }

    const userText = sttResult.transcript;
    const detectedLang = sttResult.language_code || languageCode;

    if (!userText || !userText.trim()) {
        log('warn', 'STT', '⚠ Empty transcript — no speech detected');
        return {
            transcript: '',
            response_text: '',
            response_text_english: '',
            audio_base64: '',
            session_id: sessionId,
            language_code: detectedLang,
            domain: 'unknown',
            intent: 'unknown',
            provider: sttResult.provider,
            pipeline,
            response_time_ms: Date.now() - startTime,
            error: 'Could not transcribe audio — no speech detected',
        };
    }

    // Continue with the text pipeline (stages 2-6)
    const result = await _processFromText({
        text: userText,
        userId,
        sessionId,
        detectedLang,
        generateAudio,
        startTime,
        pipeline,
    });

    const totalMs = Date.now() - startTime;
    log('info', 'Pipeline', `■ AUDIO PIPELINE COMPLETE in ${totalMs}ms`, {
        stages: Object.fromEntries(
            Object.entries(pipeline.stages).map(([k, v]) => [k, `${v.ms}ms (${v.provider || ''})`])
        ),
    });

    return {
        transcript: userText,
        ...result,
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  Text-Only Pipeline                                     */
/*  Text → Nova → MCP/Agent → Sarvam → Output             */
/* ═══════════════════════════════════════════════════════ */

/**
 * Process a text input (skip STT step).
 *
 * @param {object} params
 * @param {string} params.text          – User's text input
 * @param {string} params.userId
 * @param {string} [params.sessionId]
 * @param {string} [params.languageCode='hi']
 * @param {boolean} [params.generateAudio=true]
 * @returns {Promise<OrchestratorResult>}
 */
async function processText(params) {
    const startTime = Date.now();
    const {
        text,
        userId,
        sessionId = uuid(),
        languageCode = 'hi',
        generateAudio = true,
    } = params;

    const pipeline = { stages: {} };

    log('info', 'Pipeline', '▶ STARTING text pipeline', {
        userId,
        sessionId: sessionId.slice(0, 8),
        textPreview: text.substring(0, 80),
        language: languageCode,
        generateAudio,
    });

    const result = await _processFromText({
        text,
        userId,
        sessionId,
        detectedLang: languageCode,
        generateAudio,
        startTime,
        pipeline,
    });

    const totalMs = Date.now() - startTime;
    log('info', 'Pipeline', `■ TEXT PIPELINE COMPLETE in ${totalMs}ms`, {
        stages: Object.fromEntries(
            Object.entries(pipeline.stages).map(([k, v]) => [k, `${v.ms}ms (${v.provider || ''})`])
        ),
    });

    return result;
}

/* ═══════════════════════════════════════════════════════ */
/*  Internal shared pipeline (stages 2-5)                  */
/* ═══════════════════════════════════════════════════════ */

async function _processFromText({ text, userId, sessionId, detectedLang, generateAudio, startTime, pipeline }) {

    // ──────────────────────────────────────────────
    // Stage 2: AWS Nova (Translate + Understand + Route + Direct Answer)
    // ──────────────────────────────────────────────
    let analysis;
    const novaStart = Date.now();
    try {
        log('info', 'Nova', '→ Analyzing intent + routing', { textPreview: text.substring(0, 80), lang: detectedLang });
        analysis = await nova.analyzeAndRoute(text, detectedLang);
        const novaMs = Date.now() - novaStart;
        log('info', 'Nova', `✓ Analysis complete in ${novaMs}ms`, {
            provider: analysis.provider,
            domain: analysis.domain,
            intent: analysis.intent,
            complexity: analysis.complexity,
            canAnswerDirectly: analysis.can_answer_directly,
            english: (analysis.english_text || '').substring(0, 80),
            directResponse: analysis.can_answer_directly
                ? (analysis.direct_response || '').substring(0, 80)
                : undefined,
        });
        pipeline.stages.nova = {
            provider: analysis.provider,
            domain: analysis.domain,
            intent: analysis.intent,
            complexity: analysis.complexity,
            can_answer_directly: analysis.can_answer_directly,
            ms: novaMs,
        };
    } catch (novaErr) {
        const novaMs = Date.now() - novaStart;
        log('error', 'Nova', `✗ Analysis failed after ${novaMs}ms`, { error: novaErr.message });
        // Use basic fallback
        analysis = {
            english_text: text,
            original_language: detectedLang,
            domain: 'general',
            intent: 'general_question',
            entities: {},
            complexity: 'simple',
            summary: '',
            can_answer_directly: false,
            direct_response: null,
            provider: 'fallback-basic',
        };
        pipeline.stages.nova = { provider: 'fallback-basic', error: novaErr.message, ms: novaMs };
    }

    // ──────────────────────────────────────────────
    // Stage 3: Build context + Route through MCP → Agent
    //   OR use Nova's direct answer (shortcut for simple queries)
    // ──────────────────────────────────────────────
    let agentResult;

    if (analysis.can_answer_directly && analysis.direct_response) {
        // ⚡ Nova can answer directly — skip the full Agent/MCP pipeline
        log('info', 'Agent', `⚡ Nova direct answer (skipping agent pipeline)`, {
            domain: analysis.domain,
            intent: analysis.intent,
            responsePreview: analysis.direct_response.substring(0, 100),
        });
        agentResult = {
            response: analysis.direct_response,
            provider: 'nova-direct',
            route: 'direct',
            agent: 'nova',
        };
        pipeline.stages.agent = {
            provider: 'nova-direct',
            route: 'direct',
            agent: 'nova',
            ms: 0,
            skipped: true,
        };
    } else {
        // Full pipeline: build context → MCP tool selection → execute tool
        const mcpStart = Date.now();
        try {
            // Step 1: Build conversation context (memory facts + history + current query)
            const contextMessages = await memory.buildContextMessages(
                userId,
                sessionId,
                analysis.english_text, // Use English text for LLM
            );
            const historyTurns = Math.max(0, contextMessages.length - 2); // minus system + current
            log('info', 'Context', `✓ Built context: ${contextMessages.length} messages`, {
                systemPrompt: true,
                historyTurns,
                currentQuery: analysis.english_text.substring(0, 60),
            });

            // Step 2: Route through MCP → Tool Selection → Agent / Claude / Gemini
            log('info', 'MCP', `→ Routing "${analysis.domain}" (${analysis.complexity}) through MCP`, {
                domain: analysis.domain,
                intent: analysis.intent,
                complexity: analysis.complexity,
            });

            agentResult = await mcp.routeToAgent({
                domain: analysis.domain,
                intent: analysis.intent,
                entities: analysis.entities,
                complexity: analysis.complexity,
                messages: contextMessages,
                userId,
            });
            const mcpMs = Date.now() - mcpStart;
            log('info', 'MCP', `✓ MCP response in ${mcpMs}ms`, {
                tool: agentResult.tool,
                provider: agentResult.provider,
                route: agentResult.route,
                agent: agentResult.agent,
                responsePreview: (agentResult.response || '').substring(0, 100),
            });
            pipeline.stages.agent = {
                tool: agentResult.tool,
                provider: agentResult.provider,
                route: agentResult.route,
                agent: agentResult.agent,
                ms: mcpMs,
            };
        } catch (agentErr) {
            const mcpMs = Date.now() - mcpStart;
            log('error', 'MCP', `✗ All MCP tools failed after ${mcpMs}ms`, { error: agentErr.message });
            agentResult = {
                response: 'I am having trouble processing your request right now. Please try again.',
                provider: 'fallback-static',
                route: 'error',
                agent: 'none',
                tool: 'none',
            };
            pipeline.stages.agent = { provider: 'fallback-static', error: agentErr.message, ms: mcpMs };
        }
    } // end else (full MCP pipeline)

    const responseEnglish = agentResult.response;

    // ──────────────────────────────────────────────
    // Stage 4: Sarvam AI — Localize + TTS
    // ──────────────────────────────────────────────
    let responseText = responseEnglish;
    let audioBase64 = '';

    const sarvamStart = Date.now();

    // 5a. Translate response to user's language (if not already in their language)
    const userLangShort = detectedLang.split('-')[0]; // 'hi-IN' → 'hi'
    const isEnglish = userLangShort === 'en' || detectedLang === 'en-IN' || detectedLang === 'en-US';

    if (!isEnglish && responseEnglish) {
        try {
            log('info', 'Sarvam/Translate', `→ Translating en → ${detectedLang}`, {
                textLength: responseEnglish.length,
            });
            const translated = await sarvam.translate(responseEnglish, 'en', detectedLang);
            responseText = translated.translated_text || responseEnglish;
            log('info', 'Sarvam/Translate', `✓ Translation done`, {
                outputLength: responseText.length,
                preview: responseText.substring(0, 80),
            });
        } catch (translateErr) {
            log('warn', 'Sarvam/Translate', `⚠ Translation failed: ${translateErr.message}, using English`);
            responseText = responseEnglish;
        }
    } else {
        log('debug', 'Sarvam/Translate', 'Skipping translation (English detected)');
    }

    // 5b. Generate TTS audio
    if (generateAudio && responseText) {
        try {
            const ttsLang = isEnglish ? 'en-IN' : detectedLang;
            log('info', 'Sarvam/TTS', `→ Generating speech in ${ttsLang}`, {
                textLength: responseText.length,
            });
            const ttsResult = await sarvam.synthesize(responseText, {
                targetLanguageCode: ttsLang,
            });
            audioBase64 = ttsResult.audios?.[0] || '';
            log('info', 'Sarvam/TTS', `✓ TTS generated`, {
                audioLength: audioBase64.length,
                hasAudio: !!audioBase64,
            });
        } catch (ttsErr) {
            log('warn', 'Sarvam/TTS', `⚠ TTS failed: ${ttsErr.message}, returning text only`);
        }
    } else {
        log('debug', 'Sarvam/TTS', 'Skipping TTS', { generateAudio, hasText: !!responseText });
    }

    pipeline.stages.sarvam = {
        translated: !isEnglish,
        tts_generated: !!audioBase64,
        ms: Date.now() - sarvamStart,
    };

    // ──────────────────────────────────────────────
    // Stage 5: Store turns + extract facts (fire-and-forget, don't block response)
    // ──────────────────────────────────────────────
    const memStartTime = Date.now();
    (async () => {
        try {
            await memory.storeTurn(userId, sessionId, 'user', text, {
                language: detectedLang,
                intentDomain: analysis.domain,
            });
            await memory.storeTurn(userId, sessionId, 'assistant', responseText, {
                language: detectedLang,
                intentDomain: analysis.domain,
                responseTimeMs: Date.now() - startTime,
            });
            log('debug', 'Memory', `✓ Both turns stored in ${Date.now() - memStartTime}ms`);
        } catch (memErr) {
            log('warn', 'Memory', `⚠ Failed to store turns: ${memErr.message}`);
        }
    })();

    // Background fact extraction — don't block response
    memory.extractAndStoreFacts(userId, text, responseText).catch(err => {
        log('warn', 'Memory', `⚠ Background fact extraction failed: ${err.message}`);
    });

    return {
        response_text: responseText,
        response_text_english: responseEnglish,
        audio_base64: audioBase64,
        session_id: sessionId,
        language_code: detectedLang,
        domain: analysis.domain,
        intent: analysis.intent,
        entities: analysis.entities,
        complexity: analysis.complexity,
        provider: agentResult.provider,
        route: agentResult.route,
        pipeline,
        response_time_ms: Date.now() - startTime,
    };
}

module.exports = {
    processAudio,
    processText,
};

/**
 * @typedef {object} OrchestratorResult
 * @property {string} [transcript]              – Original transcription (audio only)
 * @property {string} response_text             – Response in user's language
 * @property {string} response_text_english     – English version of response
 * @property {string} audio_base64              – TTS audio (base64 WAV)
 * @property {string} session_id
 * @property {string} language_code
 * @property {string} domain                    – Routed domain
 * @property {string} intent                    – Classified intent
 * @property {object} [entities]                – Extracted entities
 * @property {string} complexity
 * @property {string} provider                  – LLM provider used
 * @property {string} route                     – 'agent' | 'deep_reasoning' | 'fallback'
 * @property {object} pipeline                  – Stage-by-stage timing
 * @property {number} response_time_ms          – Total pipeline time
 * @property {string} [error]                   – Error message if failed
 */
