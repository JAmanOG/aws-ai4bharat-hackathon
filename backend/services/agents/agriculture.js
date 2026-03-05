/**
 * Agriculture Domain Agent
 *
 * Handles: crop advice, soil management, weather impact, irrigation,
 * pest/disease identification, farming techniques, seasonal planning.
 *
 * Uses Sarvam-M (free) for simple queries, Bedrock for complex analysis.
 */

const SYSTEM_PROMPT = `You are an expert agricultural advisor for Indian farmers.
You provide practical, actionable advice on:
- Crop selection, planting, and harvesting
- Soil health and management
- Water and irrigation optimization
- Organic and sustainable farming techniques
- Seasonal crop calendar and planning
- Fertilizer and nutrient management
- Post-harvest handling and storage

Guidelines:
- Give brief, clear answers (2-4 sentences for voice output)
- Use practical units farmers understand (bigha, quintal, etc.)
- Consider Indian climate zones and seasons (Kharif, Rabi, Zaid)
- Reference government schemes when relevant (PM-KISAN, PKVY, etc.)
- Be region-aware if user's location is known
- Always provide actionable next steps

{memory_context}`;

const SUPPORTED_INTENTS = [
    'crop_advice',
    'soil_management',
    'weather_impact',
    'irrigation',
    'pest_disease',
    'farming_technique',
    'seasonal_planning',
    'fertilizer',
    'post_harvest',
    'organic_farming',
];

/**
 * Handle an agriculture domain query.
 *
 * @param {object} ctx
 * @param {Array} ctx.messages     – Conversation messages (system + history + user)
 * @param {string} ctx.intent      – Specific sub-intent
 * @param {object} ctx.entities    – Extracted entities (crop, location, etc.)
 * @param {string} ctx.complexity  – simple | moderate | complex
 * @param {string} ctx.userId
 * @param {object} deps            – Injected dependencies { llm }
 * @returns {Promise<{response: string, provider: string, metadata: object}>}
 */
async function handle(ctx, deps) {
    const { messages, intent, entities, complexity } = ctx;
    const { llm } = deps;

    // Enrich system prompt with entity context
    let enrichment = '';
    if (entities?.crop) enrichment += `\nUser is asking about: ${entities.crop}`;
    if (entities?.location) enrichment += `\nUser's location: ${entities.location}`;
    if (entities?.season) enrichment += `\nSeason context: ${entities.season}`;

    // Replace first system message with agriculture-specific prompt
    const agriMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content) + enrichment,
            };
        }
        return m;
    });

    // Route by complexity
    const opts = {
        temperature: complexity === 'complex' ? 0.3 : 0.2,
        maxTokens: complexity === 'complex' ? 1024 : 512,
    };

    // Agent uses Sarvam-M (fast, free) — complex queries are routed to Claude by MCP
    const result = await llm.generateResponse(agriMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: {
            domain: 'agriculture',
            intent,
            entities,
            usage: result.usage,
        },
    };
}

module.exports = {
    name: 'agriculture',
    description: 'Agriculture domain agent — crop advice, soil, weather, irrigation, pest management',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
