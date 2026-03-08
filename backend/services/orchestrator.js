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
const { sanitizeModelOutput } = require('./llm');
const {
    buildPlatformCapabilityHint,
    enrichAnalysisWithScreenContext,
} = require('./platform-context');
const {
    buildSymptomContextSummary,
    extractSymptomIntake,
    getMissingSymptomSlot,
    mergeSymptomIntake,
    toSymptomEntities,
} = require('./symptom-intake');

/* ─── Structured logger ─── */
function log(level, stage, msg, data = {}) {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.toUpperCase()}] [Orchestrator/${stage}]`;
    const extras = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    if (level === 'error') console.error(`${prefix} ${msg}${extras}`);
    else if (level === 'warn') console.warn(`${prefix} ${msg}${extras}`);
    else console.log(`${prefix} ${msg}${extras}`);
}

function shouldForceAgentRouting(analysis, originalText = '') {
    const intent = String(analysis?.intent || '').toLowerCase();
    const englishText = String(analysis?.english_text || '').toLowerCase();
    const rawText = String(originalText || '').toLowerCase();
    const combined = `${intent} ${englishText} ${rawText}`;

    // Voice room commands
    if (/request_voice_call_room|create_voice|join_voice|voice room|twitter\s*space|create\s+(a\s+)?room|join\s+(the\s+)?room|रूम|स्पेस|जॉइन|बनाओ/.test(combined)) {
        return true;
    }

    // Knowledge / resource requests — must always go through knowledge agent
    if (/request_video|request_article|request_course|knowledge_query|learning_content|show_resources|training_resources/.test(intent)) {
        return true;
    }
    if (/show\s+(me\s+)?(a\s+)?video|find\s+(me\s+)?video|play\s+(a\s+)?video|watch\s+(a\s+)?video|दिखा.*वीडियो|वीडियो\s*दिखा/.test(combined)) {
        return true;
    }
    if (/show\s+(me\s+)?(an?\s+)?article|find\s+(me\s+)?article|read\s+(an?\s+)?article|लेख|आर्टिकल/.test(combined)) {
        return true;
    }
    if (/show\s+(me\s+)?courses?|find\s+(me\s+)?courses?|training|कोर्स|प्रशिक्षण/.test(combined)) {
        return true;
    }

    return false;
}

const FOLLOW_UP_WEAK_INTENTS = new Set([
    'greeting',
    'general_question',
    'unknown',
    'query_payment_methods',
    'clarification',
    'confirmation',
]);

function findLastTurn(history = [], role) {
    for (let i = history.length - 1; i >= 0; i -= 1) {
        if (history[i]?.role === role) {
            return history[i];
        }
    }
    return null;
}

function isLikelyShortReply(text = '') {
    const cleaned = String(text || '')
        .replace(/[?.!,।]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return false;
    return cleaned.split(' ').length <= 4;
}

function extractFollowUpLocation(text = '') {
    const cleaned = String(text || '')
        .replace(/[?.!,।]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned) return '';

    const tokens = cleaned.split(' ');
    const deduped = tokens.filter((token, index) => {
        const prev = tokens[index - 1];
        return index === 0 || token.toLowerCase() !== String(prev || '').toLowerCase();
    }).join(' ');
    const lower = deduped.toLowerCase();

    if (/^(hello|hi|hey|namaste|namaskar|vanakkam|yes|no|ok|okay|thanks|thank you|haan|haan ji|hmm|hmmm|हां|हाँ|नहीं|नही|ठीक)$/i.test(lower)) {
        return '';
    }

    return deduped.split(' ').length <= 4 ? deduped : '';
}

function buildFollowUpEnglish(intent, location) {
    if (intent === 'air_quality_info') {
        return `What is the AQI in ${location}?`;
    }
    if (intent === 'weather_info') {
        return `What is the weather in ${location}?`;
    }
    return `${intent.replace(/_/g, ' ')} for ${location}`;
}

function buildSymptomFollowUpEnglish(intake = {}, text = '') {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (cleaned) {
        return cleaned;
    }
    return buildSymptomContextSummary(intake) || 'Health symptom interview';
}

function applyRecentTurnContext({ analysis, text, recentHistory = [] }) {
    if (!Array.isArray(recentHistory) || recentHistory.length === 0) {
        return { analysis, reason: null };
    }

    const currentIntent = String(analysis?.intent || '').toLowerCase();
    const weakGeneral = String(analysis?.domain || '') === 'general'
        && (
            FOLLOW_UP_WEAK_INTENTS.has(currentIntent)
            || !!analysis?.can_answer_directly
            || /^query_/.test(currentIntent)
        );
    const shortReply = isLikelyShortReply(text);

    if (!weakGeneral && !shortReply) {
        return { analysis, reason: null };
    }

    const lastAssistant = findLastTurn(recentHistory, 'assistant');
    const lastUser = findLastTurn(recentHistory, 'user');
    const pendingFollowUp = lastAssistant?.followUp || null;

    if (pendingFollowUp?.pendingSlot === 'location') {
        const location = extractFollowUpLocation(text);
        if (location) {
            const nextIntent = pendingFollowUp.intent || lastUser?.intent || analysis.intent || 'weather_info';
            return {
                analysis: {
                    ...analysis,
                    domain: pendingFollowUp.intentDomain || lastUser?.intentDomain || analysis.domain || 'general',
                    intent: nextIntent,
                    entities: {
                        ...((pendingFollowUp.entities && typeof pendingFollowUp.entities === 'object') ? pendingFollowUp.entities : {}),
                        ...((lastUser?.entities && typeof lastUser.entities === 'object') ? lastUser.entities : {}),
                        ...(analysis?.entities || {}),
                        location,
                    },
                    complexity: 'simple',
                    can_answer_directly: false,
                    direct_response: null,
                    summary: `Follow-up location answer for ${nextIntent}`,
                    english_text: buildFollowUpEnglish(nextIntent, location),
                },
                reason: 'follow-up-location-slot',
            };
        }
    }

    if (
        pendingFollowUp?.intentDomain === 'health'
        && ['symptoms', 'age', 'gender'].includes(String(pendingFollowUp.pendingSlot || ''))
    ) {
        const carriedEntities = pendingFollowUp.entities && typeof pendingFollowUp.entities === 'object'
            ? pendingFollowUp.entities
            : {};
        const carriedIntake = mergeSymptomIntake({}, carriedEntities);
        const nextIntake = extractSymptomIntake(text, carriedIntake);
        const currentMissing = getMissingSymptomSlot(nextIntake);
        const prevSlot = String(pendingFollowUp.pendingSlot || 'symptoms');
        const stillSameSlot = currentMissing === prevSlot;
        const prevRetry = Number(pendingFollowUp.retryCount) || 0;
        const retryCount = stillSameSlot ? prevRetry + 1 : 0;

        // Auto-fill stuck slots after 2 failed retries to avoid infinite loop
        if (stillSameSlot && retryCount >= 2) {
            if (prevSlot === 'gender') {
                nextIntake.gender = 'other';
                log('info', 'Nova', `↺ Auto-filling gender=other after ${retryCount} retries`);
            } else if (prevSlot === 'age') {
                nextIntake.age = 30;
                log('info', 'Nova', `↺ Auto-filling age=30 after ${retryCount} retries`);
            } else if (prevSlot === 'symptoms') {
                nextIntake.symptoms = 'general discomfort';
                log('info', 'Nova', `↺ Auto-filling symptoms after ${retryCount} retries`);
            }
        }

        const pendingSlot = getMissingSymptomSlot(nextIntake) || prevSlot;

        return {
            analysis: {
                ...analysis,
                domain: 'health',
                intent: pendingFollowUp.intent || lastUser?.intent || 'symptom_guidance',
                entities: {
                    ...carriedEntities,
                    ...toSymptomEntities(nextIntake),
                    _slotRetryCount: retryCount,
                },
                complexity: 'simple',
                can_answer_directly: false,
                direct_response: null,
                summary: `Follow-up symptom interview answer for ${pendingSlot}`,
                english_text: buildSymptomFollowUpEnglish(nextIntake, text),
            },
            reason: 'follow-up-symptom-slot',
        };
    }

    const continuationCue = /(^|\b)(aur|also|and|isme|usme|isse|issme|that|this|it|there|yahan|yahaan|idhar|wahan|wahaan|phir|then|kab|kaise|kitna|konsa|kaunsa|what about|other|another|all of them|sab|baaki|baki)(\b|$)/i.test(String(text || ''));
    if (weakGeneral && (shortReply || continuationCue) && lastUser?.intent && lastUser?.intentDomain && lastUser.intentDomain !== 'general') {
        return {
            analysis: {
                ...analysis,
                domain: lastUser.intentDomain,
                intent: lastUser.intent,
                entities: {
                    ...((lastUser.entities && typeof lastUser.entities === 'object') ? lastUser.entities : {}),
                    ...(analysis?.entities || {}),
                },
                can_answer_directly: false,
                direct_response: null,
                summary: `Follow-up to previous ${lastUser.intentDomain} turn`,
            },
            reason: 'recent-turn-carryover',
        };
    }

    return { analysis, reason: null };
}

function sanitizeSpokenResponse(text = '') {
    return sanitizeModelOutput(text)
        .replace(/\n+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
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
        screenContext = '',
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
        screenContext,
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
        screenContext = '',
    } = params;

    const pipeline = { stages: {} };

    log('info', 'Pipeline', '▶ STARTING text pipeline', {
        userId,
        sessionId: sessionId.slice(0, 8),
        textPreview: text.substring(0, 80),
        language: languageCode,
        generateAudio,
        hasScreenContext: !!screenContext,
    });

    const result = await _processFromText({
        text,
        userId,
        sessionId,
        detectedLang: languageCode,
        generateAudio,
        startTime,
        pipeline,
        screenContext,
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

async function _processFromText({ text, userId, sessionId, detectedLang, generateAudio, startTime, pipeline, screenContext }) {
    let recentHistory = [];
    try {
        recentHistory = await memory.getSessionHistory(userId, sessionId, 6);
    } catch (historyErr) {
        log('warn', 'Context', `⚠ Failed to load recent history before routing: ${historyErr.message}`);
    }

    // ──────────────────────────────────────────────
    // Stage 2: AWS Nova (Translate + Understand + Route + Direct Answer)
    // ──────────────────────────────────────────────
    let analysis;
    const novaStart = Date.now();
    try {
        log('info', 'Nova', '→ Analyzing intent + routing', { textPreview: text.substring(0, 80), lang: detectedLang });
        analysis = await nova.analyzeAndRoute(text, detectedLang);
        const screenAware = enrichAnalysisWithScreenContext(analysis, text, screenContext);
        analysis = screenAware.analysis;
        const recentAware = applyRecentTurnContext({ analysis, text, recentHistory });
        analysis = recentAware.analysis;
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
            screenOverride: screenAware.reason || undefined,
            recentOverride: recentAware.reason || undefined,
        });
        pipeline.stages.nova = {
            provider: analysis.provider,
            domain: analysis.domain,
            intent: analysis.intent,
            complexity: analysis.complexity,
            can_answer_directly: analysis.can_answer_directly,
            screen_override: screenAware.reason || undefined,
            recent_override: recentAware.reason || undefined,
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

    if (shouldForceAgentRouting(analysis, text)) {
        analysis.can_answer_directly = false;
        analysis.direct_response = null;

        // Re-route knowledge intents to the knowledge domain even if Nova said "general"
        const knowledgeIntent = /request_video|request_article|request_course|knowledge_query|learning_content|show_resources|training_resources/.test(String(analysis.intent || ''));
        const knowledgeText = /show\s+(me\s+)?(a\s+)?video|find\s+video|watch\s+video|play\s+video|article|course|training|वीडियो|लेख|कोर्स|प्रशिक्षण/.test(String(analysis.english_text || '').toLowerCase() + ' ' + String(text || '').toLowerCase());
        if ((knowledgeIntent || knowledgeText) && analysis.domain !== 'knowledge') {
            log('info', 'Agent', `↺ Re-routing domain ${analysis.domain} → knowledge`, { intent: analysis.intent });
            analysis.domain = 'knowledge';
        }

        log('info', 'Agent', '↺ Forcing MCP/agent route for actionable command', {
            intent: analysis.intent,
            domain: analysis.domain,
            english: (analysis.english_text || '').substring(0, 80),
        });
    }

    if (analysis.can_answer_directly && analysis.direct_response) {
        const cleanedDirectResponse = sanitizeSpokenResponse(analysis.direct_response);
        // ⚡ Nova can answer directly — skip the full Agent/MCP pipeline
        log('info', 'Agent', `⚡ Nova direct answer (skipping agent pipeline)`, {
            domain: analysis.domain,
            intent: analysis.intent,
            responsePreview: cleanedDirectResponse.substring(0, 100),
        });
        agentResult = {
            response: cleanedDirectResponse,
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
                hasScreenContext: !!screenContext,
            });

            // Inject screen context into the system prompt if available
            if (screenContext && contextMessages.length > 0 && contextMessages[0].role === 'system') {
                const capabilityHint = buildPlatformCapabilityHint(screenContext);
                contextMessages[0].content += `\n\n--- Current App Screen Context ---\n${screenContext}\n\nUse this context to provide RELEVANT answers about what the user is currently viewing. If they ask about prices, refer to the crop they are viewing. If they mention "this crop" or "current crop", it refers to the crop shown on screen. If the screen exposes specific platform actions, guide the user using those exact actions and labels.`;
                if (capabilityHint) {
                    contextMessages[0].content += `\n\n--- Current Screen Capabilities ---\n${capabilityHint}\n\nGround your answer in these exact platform capabilities. Do not invent features that are not present in this context.`;
                }
                log('info', 'Context', `✓ Injected screen context into system prompt`, {
                    screenContext: screenContext.substring(0, 100),
                });
            }

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
                screenContext,
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

    const responseEnglish = sanitizeSpokenResponse(agentResult.response);

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
            responseText = sanitizeSpokenResponse(translated.translated_text || responseEnglish);
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
                intent: analysis.intent,
                entities: analysis.entities,
            });
            await memory.storeTurn(userId, sessionId, 'assistant', responseText, {
                language: detectedLang,
                intentDomain: analysis.domain,
                intent: analysis.intent,
                entities: analysis.entities,
                followUp: agentResult.metadata?.followUp,
                provider: agentResult.provider,
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
        metadata: agentResult.metadata,
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
