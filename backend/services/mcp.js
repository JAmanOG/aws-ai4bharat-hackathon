/**
 * MCP – Model Context Protocol Layer
 *
 * Communication mediator between the AI Orchestrator and external
 * agents / tools / AI models. Provides a standardized interface for:
 *
 *  1. Tool registry (available capabilities)
 *  2. Agent routing (intent → domain agent)
 *  3. Tool execution (structured I/O)
 *  4. Response aggregation
 *
 * Inspired by Anthropic's Model Context Protocol specification.
 */

const agentRegistry = require('./agents');
const llm = require('./llm');

/* ═══════════════════════════════════════════════════════ */
/*  Tool Definitions (available to orchestrator)           */
/* ═══════════════════════════════════════════════════════ */

const TOOL_DEFINITIONS = [
    {
        name: 'domain_agent',
        description: 'Route query to a domain-specific AI agent for contextual response',
        inputSchema: {
            type: 'object',
            properties: {
                domain: { type: 'string', enum: ['agriculture', 'market', 'schemes', 'health', 'general'] },
                intent: { type: 'string' },
                entities: { type: 'object' },
                complexity: { type: 'string', enum: ['simple', 'moderate', 'complex'] },
            },
            required: ['domain'],
        },
    },
    {
        name: 'deep_reasoning',
        description: 'Use AWS Bedrock for complex questions requiring deep reasoning',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
            },
            required: ['query'],
        },
    },
    {
        name: 'fallback_llm',
        description: 'Use Google Gemini as fallback when other models are unavailable',
        inputSchema: {
            type: 'object',
            properties: {
                query: { type: 'string' },
            },
            required: ['query'],
        },
    },
];

/* ═══════════════════════════════════════════════════════ */
/*  Route to Agent                                         */
/* ═══════════════════════════════════════════════════════ */

/**
 * Route a processed query to the appropriate domain agent.
 *
 * @param {object} params
 * @param {string} params.domain      – Target domain ('agriculture', 'market', etc.)
 * @param {string} params.intent      – Fine-grained intent
 * @param {object} params.entities    – Extracted entities
 * @param {string} params.complexity  – 'simple' | 'moderate' | 'complex'
 * @param {Array}  params.messages    – Full conversation messages (system + history + user)
 * @param {string} params.userId
 * @returns {Promise<{response: string, provider: string, metadata: object}>}
 */
async function routeToAgent(params) {
    const { domain, intent, entities, complexity, messages, userId } = params;

    const agent = agentRegistry.getAgent(domain);

    const ctx = {
        messages,
        intent,
        entities: entities || {},
        complexity: complexity || 'simple',
        userId,
    };

    try {
        const result = await agent.handle(ctx, { llm });
        return {
            ...result,
            route: 'agent',
            agent: domain,
        };
    } catch (agentErr) {
        console.warn(`[MCP] Agent "${domain}" failed: ${agentErr.message}. Trying deep reasoning...`);
        return deepReasoning(messages, domain);
    }
}

/* ═══════════════════════════════════════════════════════ */
/*  Deep Reasoning (Bedrock direct)                        */
/* ═══════════════════════════════════════════════════════ */

/**
 * Direct Bedrock call for complex queries requiring deep reasoning.
 * Falls back to Gemini if Bedrock fails.
 */
async function deepReasoning(messages, domain) {
    try {
        const result = await llm.callBedrock(messages, {
            temperature: 0.3,
            maxTokens: 1024,
        });
        return {
            response: result.content,
            provider: result.provider,
            route: 'deep_reasoning',
            agent: domain || 'bedrock',
            metadata: { usage: result.usage },
        };
    } catch (bedrockErr) {
        console.warn(`[MCP] Bedrock deep reasoning failed: ${bedrockErr.message}. Using Gemini fallback...`);
        return fallbackLlm(messages, domain);
    }
}

/* ═══════════════════════════════════════════════════════ */
/*  Fallback LLM (Gemini)                                  */
/* ═══════════════════════════════════════════════════════ */

/**
 * Gemini fallback when all other paths fail.
 */
async function fallbackLlm(messages, domain) {
    const result = await llm.callGemini(messages, {
        temperature: 0.3,
        maxTokens: 1024,
    });

    return {
        response: result.content,
        provider: result.provider,
        route: 'fallback',
        agent: domain || 'gemini',
        metadata: { usage: result.usage },
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  Execute Tool (generic dispatcher)                      */
/* ═══════════════════════════════════════════════════════ */

/**
 * Execute a named tool via MCP.
 *
 * @param {string} toolName  – 'domain_agent' | 'deep_reasoning' | 'fallback_llm'
 * @param {object} input     – Tool-specific input
 * @param {Array}  messages  – Conversation messages
 * @returns {Promise<object>}
 */
async function executeTool(toolName, input, messages) {
    switch (toolName) {
        case 'domain_agent':
            return routeToAgent({ ...input, messages });
        case 'deep_reasoning':
            return deepReasoning(messages, input.domain);
        case 'fallback_llm':
            return fallbackLlm(messages, input.domain);
        default:
            throw new Error(`[MCP] Unknown tool: ${toolName}`);
    }
}

module.exports = {
    routeToAgent,
    deepReasoning,
    fallbackLlm,
    executeTool,
    TOOL_DEFINITIONS,
};
