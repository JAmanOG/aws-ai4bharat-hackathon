/**
 * MCP – Model Context Protocol Layer
 *
 * Communication mediator between the AI Orchestrator and external
 * agents / tools / AI models.
 *
 * Architecture (matching design diagram):
 *
 *              AI Orchestrator
 *                    ↓
 *          MCP Tool Selection
 *       (decides which tool to invoke)
 *            ┌───────┼───────┐
 *            ↓       ↓       ↓
 *       AI Agents  Claude  Gemini
 *      (domain)   (deep)  (fallback)
 *            └───────┼───────┘
 *                    ↓
 *               Sarvam AI
 *
 * Five MCP Tools:
 *   1. domain_agent    – AI Agents with domain logic (Sarvam-M, fast & free)
 *   2. marketplace_tool – Voice-first market workflow execution
 *   3. weather_lookup  – Live weather + AQI lookup
 *   4. deep_reasoning  – AWS Bedrock Claude (complex / sensitive queries)
 *   5. fallback_llm    – Google Gemini (last resort)
 *
 * Tool Selection Rules:
 *   live weather / AQI    → weather_lookup
 *   market workflows      → marketplace_tool
 *   health platform flows → domain_agent (health agent)
 *   complex queries       → deep_reasoning (Claude)
 *   other health queries  → deep_reasoning (Claude, safety)
 *   schemes moderate+     → deep_reasoning (Claude, accuracy)
 *   simple/moderate       → domain_agent (Sarvam-M)
 *
 * Cascading Fallback:
 *   weather_lookup fails → domain_agent → deep_reasoning → fallback_llm
 *   domain_agent fails → deep_reasoning (Claude) → fallback_llm (Gemini)
 *   deep_reasoning fails → domain_agent → fallback_llm (Gemini)
 *
 * Ref: https://modelcontextprotocol.io/docs/getting-started/intro
 */

const agentRegistry = require('./agents');
const llm = require('./llm');
const marketplaceTool = require('./marketplace-tool');
const nova = require('./nova');
const weatherAqi = require('./weather-aqi');

const HEALTH_AGENT_INTENTS = new Set([
    'symptom_guidance',
    'medical_report_analysis',
    'health_platform_help',
    'health_scheme',
    'facility_referral',
]);

const MARKETPLACE_TOOL_INTENTS = new Set([
    'buyer_connection',
    'supply_chain',
    'create_listing',
    'orders',
    'listing_management',
    'contact_buyer',
]);

const HIGH_CONFIDENCE_HEURISTIC_INTENTS = new Set([
    'weather_info',
    'air_quality_info',
    'medical_report_analysis',
    'health_platform_help',
    'symptom_guidance',
    'request_video',
    'request_article',
    'request_course',
    'learning_content',
    'crop_prices',
    'loan_info',
    'insurance_claim',
    'scheme_eligibility',
    'create_listing',
    'listing_management',
    'contact_buyer',
    'orders',
    'buyer_connection',
]);

const VALID_DOMAINS = ['agriculture', 'market', 'schemes', 'health', 'knowledge', 'general'];
const VALID_COMPLEXITIES = ['simple', 'moderate', 'complex'];

/* ─── Structured logger ─── */
function log(level, msg, data = {}) {
    const ts = new Date().toISOString();
    const prefix = `[${ts}] [${level.toUpperCase()}] [MCP]`;
    const extras = Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    if (level === 'error') console.error(`${prefix} ${msg}${extras}`);
    else if (level === 'warn') console.warn(`${prefix} ${msg}${extras}`);
    else console.log(`${prefix} ${msg}${extras}`);
}

/* ═══════════════════════════════════════════════════════ */
/*  MCP Tool Definitions (available capabilities)          */
/* ═══════════════════════════════════════════════════════ */

const TOOL_DEFINITIONS = [
    {
        name: 'domain_agent',
        description: 'Route to domain-specific AI agent for contextual response (uses Sarvam-M)',
        inputSchema: {
            type: 'object',
            properties: {
                domain: { type: 'string', enum: ['agriculture', 'market', 'schemes', 'health', 'knowledge', 'general'] },
                intent: { type: 'string' },
                entities: { type: 'object' },
                complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
            },
            required: ['domain'],
        },
    },
    {
        name: 'marketplace_tool',
        description: 'Voice-first market workflow for creating listings, surfacing buyer matches, and managing listing status',
        inputSchema: {
            type: 'object',
            properties: {
                domain: { type: 'string', enum: ['market'] },
                intent: { type: 'string' },
                entities: { type: 'object' },
            },
            required: ['domain'],
        },
    },
    {
        name: 'weather_lookup',
        description: 'Live weather and AQI lookup for a city using Open-Meteo APIs',
        inputSchema: {
            type: 'object',
            properties: {
                intent: { type: 'string', enum: ['weather_info', 'air_quality_info'] },
                entities: { type: 'object' },
            },
        },
    },
    {
        name: 'deep_reasoning',
        description: 'AWS Bedrock Claude — deep reasoning for complex or sensitive queries',
        inputSchema: {
            type: 'object',
            properties: {
                domain: { type: 'string' },
                intent: { type: 'string' },
            },
            required: ['domain'],
        },
    },
    {
        name: 'fallback_llm',
        description: 'Google Gemini — fallback when other providers are unavailable',
        inputSchema: {
            type: 'object',
            properties: {
                domain: { type: 'string' },
            },
        },
    },
];

/* ═══════════════════════════════════════════════════════ */
/*  Domain Context (injected into deep reasoning prompts)  */
/* ═══════════════════════════════════════════════════════ */

const DOMAIN_CONTEXT = {
    agriculture: 'You are an expert Indian agricultural advisor. Provide practical advice on crops, soil, irrigation, pests, farming techniques, and seasonal planning. Use units farmers understand (bigha, quintal). Reference government schemes when relevant.',
    market: 'You are an expert on Indian agricultural markets. Cover mandi prices (₹/quintal), MSP, price trends, buyer connections, supply chain, and logistics. Reference specific APMCs when possible.',
    schemes: 'You are an expert on Indian government schemes for farmers. Cover PM-KISAN, PMFBY, PKVY, KCC, subsidies, eligibility criteria, required documents, and deadlines. Direct users to CSC for offline help.',
    health: 'You provide rural health guidance for Indian communities. CRITICAL: NEVER diagnose conditions — always recommend professional medical consultation. For emergencies, direct to 108 (ambulance) or 112. Cover nutrition, maternal/child health, first aid, heat prevention. When current app context mentions HealthDashboard or SymptomChecker, anchor responses to the exact on-screen features such as Start Screening, Upload Report, Get Insights, schemes, and consultation providers.',
    general: 'You are a friendly assistant for rural Indian communities. Help with general knowledge, digital literacy, and connecting to available services.',
    knowledge: 'You are a learning resource assistant for rural Indian farmers. Help find educational videos, articles, courses, and training content. Reference government training portals (ICAR, KVK, PMKVY) when relevant. Always provide actual resource links and titles.',
};

function normalizeDomain(domain) {
    const normalized = String(domain || '').trim().toLowerCase();
    return VALID_DOMAINS.includes(normalized) ? normalized : 'general';
}

function normalizeComplexity(complexity) {
    const normalized = String(complexity || '').trim().toLowerCase();
    return VALID_COMPLEXITIES.includes(normalized) ? normalized : 'simple';
}

function getLatestUserText(messages = []) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        if (messages[i]?.role === 'user' && typeof messages[i].content === 'string') {
            return messages[i].content;
        }
    }
    return '';
}

function shouldUseHeuristicRoute(current, heuristic) {
    if (!heuristic || heuristic.intent === 'general_question') {
        return false;
    }

    if (current.intent === heuristic.intent && current.domain === heuristic.domain) {
        return false;
    }

    const currentIntentDomain = agentRegistry.resolveDomain(current.intent);
    const currentIsWeak = current.intent === 'unknown'
        || current.intent === 'general_question'
        || (current.domain === 'general' && currentIntentDomain === 'general');

    if (currentIsWeak) {
        return true;
    }

    if (HIGH_CONFIDENCE_HEURISTIC_INTENTS.has(heuristic.intent)) {
        return true;
    }

    return heuristic.domain !== 'general' && current.domain === 'general';
}

function normalizeRoutingParams(params = {}) {
    const messages = Array.isArray(params.messages) ? params.messages : [];
    const latestUserText = getLatestUserText(messages);
    const normalized = {
        ...params,
        domain: normalizeDomain(params.domain),
        intent: String(params.intent || '').trim() || 'unknown',
        entities: params.entities && typeof params.entities === 'object' ? { ...params.entities } : {},
        complexity: normalizeComplexity(params.complexity),
        messages,
        screenContext: params.screenContext || '',
    };
    const reasons = [];

    const intentDomain = agentRegistry.resolveDomain(normalized.intent);
    if (intentDomain !== 'general' && normalized.domain !== intentDomain) {
        normalized.domain = intentDomain;
        reasons.push(`intent-domain:${normalized.intent}`);
    }

    const heuristic = latestUserText ? nova.basicRoute(latestUserText, 'unknown') : null;
    if (shouldUseHeuristicRoute(normalized, heuristic)) {
        normalized.domain = heuristic.domain;
        normalized.intent = heuristic.intent;
        if (heuristic.entities?.location && !normalized.entities.location) {
            normalized.entities.location = heuristic.entities.location;
        }
        reasons.push(`text-heuristic:${heuristic.intent}`);
    } else if (
        heuristic?.entities?.location
        && !normalized.entities.location
        && (normalized.intent === 'weather_info' || normalized.intent === 'air_quality_info')
    ) {
        normalized.entities.location = heuristic.entities.location;
        reasons.push('text-location');
    }

    if ((normalized.intent === 'weather_info' || normalized.intent === 'air_quality_info') && normalized.domain !== 'general') {
        normalized.domain = 'general';
        reasons.push('weather-domain:general');
    }

    return {
        ...normalized,
        normalizationReason: reasons.join(', ') || null,
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  MCP Tool Selection                                     */
/* ═══════════════════════════════════════════════════════ */

/**
 * Select the appropriate MCP tool based on query characteristics.
 *
 * @param {{ domain: string, complexity: string, intent: string }} params
 * @returns {{ tool: string, reason: string }}
 */
function selectTool({ domain, complexity, intent }) {
    const normalized = normalizeRoutingParams({ domain, complexity, intent });
    domain = normalized.domain;
    complexity = normalized.complexity;
    intent = normalized.intent;

    // 1. Live weather / AQI always uses the live tool first
    if (intent === 'weather_info' || intent === 'air_quality_info') {
        return { tool: 'weather_lookup', reason: 'Live weather/AQI request → weather lookup tool' };
    }

    // 2. Health platform/help/report/symptom flows → health agent first
    if (domain === 'health' && HEALTH_AGENT_INTENTS.has(String(intent || ''))) {
        return { tool: 'domain_agent', reason: 'Health platform/report flow → health agent' };
    }

    // 3. Market voice workflow → marketplace tool first
    if (domain === 'market' && MARKETPLACE_TOOL_INTENTS.has(String(intent || ''))) {
        return { tool: 'marketplace_tool', reason: 'Market listing / buyer workflow → marketplace tool' };
    }

    // 4. Complex queries → Bedrock Claude (deep reasoning)
    if (complexity === 'complex') {
        return { tool: 'deep_reasoning', reason: 'Complex query → Claude deep reasoning' };
    }

    // 5. Health domain → Claude (accuracy & safety required)
    if (domain === 'health') {
        return { tool: 'deep_reasoning', reason: 'Health domain → Claude for accuracy/safety' };
    }

    // 6. Schemes with moderate complexity → Claude (factual accuracy)
    if (domain === 'schemes' && complexity === 'moderate') {
        return { tool: 'deep_reasoning', reason: 'Scheme details → Claude for accuracy' };
    }

    // 7. Everything else → domain-specific AI agent (Sarvam-M, fast & free)
    return { tool: 'domain_agent', reason: `Simple/moderate → ${domain} agent (Sarvam-M)` };
}

/* ═══════════════════════════════════════════════════════ */
/*  Tool Executors                                         */
/* ═══════════════════════════════════════════════════════ */

/**
 * Execute domain_agent tool — routes to the appropriate AI agent.
 * Agents use Sarvam-M (fast, free) as their primary LLM.
 */
async function executeDomainAgent(params) {
    const { domain, intent, entities, complexity, messages, userId, screenContext } = params;
    const agent = agentRegistry.getAgent(domain);

    log('info', `🔧 [domain_agent] → ${agent.name || domain} agent`, {
        intent,
        complexity,
        entityKeys: Object.keys(entities || {}),
    });

    const ctx = {
        messages,
        intent,
        entities: entities || {},
        complexity: complexity || 'simple',
        userId,
        screenContext: screenContext || '',
    };

    const result = await agent.handle(ctx, { llm });

    return {
        ...result,
        route: 'agent',
        agent: domain,
        tool: 'domain_agent',
    };
}

async function executeWeatherLookup(params) {
    const { intent, entities, messages, screenContext } = params;
    log('info', '🔧 [weather_lookup] → Open-Meteo live data', {
        intent,
        entityKeys: Object.keys(entities || {}),
    });

    const result = await weatherAqi.getWeatherAndAqi({
        intent,
        entities: entities || {},
        messages: messages || [],
        screenContext: screenContext || '',
    });

    return {
        ...result,
        route: 'weather_lookup',
        agent: 'weather-live',
        tool: 'weather_lookup',
    };
}

async function executeMarketplaceTool(params) {
    const { intent, entities, messages, userId } = params;
    log('info', '🔧 [marketplace_tool] → market listings and buyer workflow', {
        intent,
        entityKeys: Object.keys(entities || {}),
    });

    const result = await marketplaceTool.handleMarketplaceRequest({
        intent,
        entities: entities || {},
        messages: messages || [],
        userId,
    });

    return {
        ...result,
        route: 'marketplace_tool',
        agent: 'marketplace-workflow',
        tool: 'marketplace_tool',
    };
}

/**
 * Execute deep_reasoning tool — calls AWS Bedrock Claude directly.
 * Used for complex queries, health domain, and sensitive scheme details.
 */
async function executeDeepReasoning(messages, domain, intent) {
    log('info', `🔧 [deep_reasoning] → Bedrock Claude`, { domain, intent });

    const domainContext = DOMAIN_CONTEXT[domain] || DOMAIN_CONTEXT.general;

    // Enhance system prompt with domain expertise for Claude
    const enhancedMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: m.content
                    + '\n\n--- Domain Expert Context (Deep Reasoning) ---\n'
                    + domainContext
                    + '\n\nProvide thorough, well-reasoned answers. Keep responses concise for voice output (2-4 sentences).',
            };
        }
        return m;
    });

    const result = await llm.callBedrock(enhancedMessages, {
        temperature: 0.3,
        maxTokens: 1024,
    });

    return {
        response: result.content,
        provider: result.provider, // 'bedrock-claude'
        route: 'deep_reasoning',
        agent: `claude-${domain}`,
        tool: 'deep_reasoning',
        metadata: { domain, intent, usage: result.usage },
    };
}

/**
 * Execute fallback_llm tool — calls Google Gemini as last resort.
 */
async function executeFallback(messages, domain) {
    log('info', `🔧 [fallback_llm] → Google Gemini`, { domain });

    const result = await llm.callGemini(messages, {
        temperature: 0.3,
        maxTokens: 1024,
    });

    return {
        response: result.content,
        provider: result.provider, // 'gemini'
        route: 'fallback',
        agent: `gemini-${domain}`,
        tool: 'fallback_llm',
        metadata: { domain, usage: result.usage },
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  Cascading Fallback Helper                              */
/* ═══════════════════════════════════════════════════════ */

/**
 * Execute a tool with cascading fallback through other tools.
 */
async function _executeWithFallback(primaryFn, fallback1Fn, fallback2Fn, primaryName) {
    try {
        return await primaryFn();
    } catch (err1) {
        log('warn', `⚠ ${primaryName} failed: ${err1.message}. Trying next tool...`);
        try {
            return await fallback1Fn();
        } catch (err2) {
            log('warn', `⚠ Second tool failed: ${err2.message}. Final fallback (Gemini)...`);
            return await fallback2Fn();
        }
    }
}

/* ═══════════════════════════════════════════════════════ */
/*  Main Router (with MCP tool selection)                  */
/* ═══════════════════════════════════════════════════════ */

/**
 * Route a processed query through the MCP tool layer.
 *
 * MCP selects the best tool based on domain/complexity/intent,
 * executes it, and handles cascading fallbacks:
 *   weather_lookup → domain_agent → deep_reasoning → fallback_llm
 *   domain_agent → deep_reasoning (Claude) → fallback_llm (Gemini)
 *   deep_reasoning → domain_agent → fallback_llm (Gemini)
 *
 * @param {object} params
 * @param {string} params.domain
 * @param {string} params.intent
 * @param {object} params.entities
 * @param {string} params.complexity
 * @param {Array}  params.messages
 * @param {string} params.userId
 * @returns {Promise<{response: string, provider: string, route: string, agent: string, tool: string}>}
 */
async function routeToAgent(params) {
    const normalizedParams = normalizeRoutingParams(params);
    const {
        domain,
        intent,
        entities,
        complexity,
        messages,
        userId,
        screenContext,
        normalizationReason,
    } = normalizedParams;

    // ── Step 1: MCP Tool Selection ──
    const selected = selectTool(normalizedParams);
    log('info', `🎯 Tool selected: ${selected.tool}`, {
        reason: selected.reason,
        domain,
        complexity,
        intent,
        normalizationReason,
        contextMessages: messages.length,
    });

    // ── Step 2: Execute selected tool with cascading fallback ──
    if (selected.tool === 'deep_reasoning') {
        // Primary: Claude → Fallback 1: AI Agent → Fallback 2: Gemini
        return _executeWithFallback(
            () => executeDeepReasoning(messages, domain, intent),
            () => executeDomainAgent({ domain, intent, entities, complexity, messages, userId, screenContext }),
            () => executeFallback(messages, domain),
            'deep_reasoning',
        );
    }

    if (selected.tool === 'weather_lookup') {
        return _executeWithFallback(
            () => executeWeatherLookup({ domain, intent, entities, messages, screenContext }),
            () => _executeWithFallback(
                () => executeDomainAgent({ domain, intent, entities, complexity, messages, userId, screenContext }),
                () => executeDeepReasoning(messages, domain, intent),
                () => executeFallback(messages, domain),
                'domain_agent',
            ),
            () => executeFallback(messages, domain),
            'weather_lookup',
        );
    }

    if (selected.tool === 'marketplace_tool') {
        return _executeWithFallback(
            () => executeMarketplaceTool({ domain, intent, entities, messages, userId, screenContext }),
            () => _executeWithFallback(
                () => executeDomainAgent({ domain, intent, entities, complexity, messages, userId, screenContext }),
                () => executeDeepReasoning(messages, domain, intent),
                () => executeFallback(messages, domain),
                'domain_agent',
            ),
            () => executeFallback(messages, domain),
            'marketplace_tool',
        );
    }

    // Default: domain_agent
    // Primary: AI Agent → Fallback 1: Claude → Fallback 2: Gemini
    return _executeWithFallback(
        () => executeDomainAgent({ domain, intent, entities, complexity, messages, userId, screenContext }),
        () => executeDeepReasoning(messages, domain, intent),
        () => executeFallback(messages, domain),
        'domain_agent',
    );
}

/* ═══════════════════════════════════════════════════════ */
/*  Generic Tool Executor (for external callers)           */
/* ═══════════════════════════════════════════════════════ */

/**
 * Execute a named tool via MCP.
 *
 * @param {string} toolName  – 'domain_agent' | 'weather_lookup' | 'deep_reasoning' | 'fallback_llm'
 * @param {object} input     – Tool-specific input
 * @param {Array}  messages  – Conversation messages
 * @returns {Promise<object>}
 */
async function executeTool(toolName, input, messages) {
    const normalizedInput = normalizeRoutingParams({ ...input, messages });

    switch (toolName) {
        case 'domain_agent':
            return executeDomainAgent(normalizedInput);
        case 'marketplace_tool':
            return executeMarketplaceTool(normalizedInput);
        case 'weather_lookup':
            return executeWeatherLookup(normalizedInput);
        case 'deep_reasoning':
            return executeDeepReasoning(normalizedInput.messages, normalizedInput.domain, normalizedInput.intent);
        case 'fallback_llm':
            return executeFallback(normalizedInput.messages, normalizedInput.domain);
        default:
            throw new Error(`[MCP] Unknown tool: ${toolName}`);
    }
}

module.exports = {
    routeToAgent,
    selectTool,
    normalizeRoutingParams,
    executeTool,
    TOOL_DEFINITIONS,
    DOMAIN_CONTEXT,
};
