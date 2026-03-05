/**
 * AI Orchestrator Layer
 *
 * Central orchestration engine for the voice pipeline. Coordinates:
 *
 *   User Audio
 *       ↓
 *   Amazon Transcribe (STT + Language ID)
 *       ↓
 *   AWS Nova (Translate + Understand + Route)
 *       ↓
 *   MCP → [AI Agents | Bedrock | Gemini]
 *       ↓
 *   Sarvam AI (Localize + TTS)
 *       ↓
 *   User Output (text + audio)
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

/* ═══════════════════════════════════════════════════════ */
/*  Full Audio Pipeline                                    */
/*  Audio → Transcribe → Nova → MCP/Agent → Sarvam → Out  */
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

    // ──────────────────────────────────────────────
    // Stage 1: Amazon Transcribe (STT + Language ID)
    // ──────────────────────────────────────────────
    const sttStart = Date.now();
    const sttResult = await transcribeService.transcribe(audioBuffer, { languageCode });
    pipeline.stages.stt = {
        provider: sttResult.provider,
        language: sttResult.language_code,
        ms: Date.now() - sttStart,
    };

    const userText = sttResult.transcript;
    const detectedLang = sttResult.language_code || languageCode;

    if (!userText || !userText.trim()) {
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

    // Continue with the text pipeline (stages 2-5)
    const result = await _processFromText({
        text: userText,
        userId,
        sessionId,
        detectedLang,
        generateAudio,
        startTime,
        pipeline,
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

    return _processFromText({
        text,
        userId,
        sessionId,
        detectedLang: languageCode,
        generateAudio,
        startTime,
        pipeline,
    });
}

/* ═══════════════════════════════════════════════════════ */
/*  Internal shared pipeline (stages 2-5)                  */
/* ═══════════════════════════════════════════════════════ */

async function _processFromText({ text, userId, sessionId, detectedLang, generateAudio, startTime, pipeline }) {

    // ──────────────────────────────────────────────
    // Stage 2: AWS Nova (Translate + Understand + Route)
    // ──────────────────────────────────────────────
    const novaStart = Date.now();
    const analysis = await nova.analyzeAndRoute(text, detectedLang);
    pipeline.stages.nova = {
        provider: analysis.provider,
        domain: analysis.domain,
        intent: analysis.intent,
        complexity: analysis.complexity,
        ms: Date.now() - novaStart,
    };

    // ──────────────────────────────────────────────
    // Stage 3: Store user turn in conversation memory
    // ──────────────────────────────────────────────
    await memory.storeTurn(userId, sessionId, 'user', text, {
        language: detectedLang,
        intentDomain: analysis.domain,
    });

    // ──────────────────────────────────────────────
    // Stage 4: Build context + Route through MCP → Agent
    // ──────────────────────────────────────────────
    const contextMessages = await memory.buildContextMessages(
        userId,
        sessionId,
        analysis.english_text, // Use English text for LLM
    );

    const mcpStart = Date.now();
    const agentResult = await mcp.routeToAgent({
        domain: analysis.domain,
        intent: analysis.intent,
        entities: analysis.entities,
        complexity: analysis.complexity,
        messages: contextMessages,
        userId,
    });
    pipeline.stages.agent = {
        provider: agentResult.provider,
        route: agentResult.route,
        agent: agentResult.agent,
        ms: Date.now() - mcpStart,
    };

    const responseEnglish = agentResult.response;
    const responseTimeMs = Date.now() - startTime;

    // ──────────────────────────────────────────────
    // Stage 5: Sarvam AI — Localize + TTS
    // ──────────────────────────────────────────────
    let responseText = responseEnglish;
    let audioBase64 = '';

    const sarvamStart = Date.now();

    // 5a. Translate response to user's language (if not already in their language)
    const userLangShort = detectedLang.split('-')[0]; // 'hi-IN' → 'hi'
    const isEnglish = userLangShort === 'en' || detectedLang === 'en-IN' || detectedLang === 'en-US';

    if (!isEnglish && responseEnglish) {
        try {
            const translated = await sarvam.translate(responseEnglish, 'en', detectedLang);
            responseText = translated.translated_text || responseEnglish;
        } catch (translateErr) {
            console.warn(`[Orchestrator] Translation failed: ${translateErr.message}. Using English response.`);
            responseText = responseEnglish;
        }
    }

    // 5b. Generate TTS audio
    if (generateAudio && responseText) {
        try {
            const ttsResult = await sarvam.synthesize(responseText, {
                targetLanguageCode: isEnglish ? 'en-IN' : detectedLang,
            });
            audioBase64 = ttsResult.audios?.[0] || '';
        } catch (ttsErr) {
            console.warn(`[Orchestrator] TTS failed: ${ttsErr.message}. Returning text only.`);
        }
    }

    pipeline.stages.sarvam = {
        translated: !isEnglish,
        tts_generated: !!audioBase64,
        ms: Date.now() - sarvamStart,
    };

    // ──────────────────────────────────────────────
    // Stage 6: Store assistant turn + background fact extraction
    // ──────────────────────────────────────────────
    await memory.storeTurn(userId, sessionId, 'assistant', responseText, {
        language: detectedLang,
        intentDomain: analysis.domain,
        responseTimeMs,
    });

    // Background fact extraction — don't block response
    memory.extractAndStoreFacts(userId, text, responseText).catch(err => {
        console.warn(`[Orchestrator] Background fact extraction failed: ${err.message}`);
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
