/**
 * Market Domain Agent
 *
 * Handles: crop prices, mandi information, price trends, market timing,
 * buyer connections, supply chain queries.
 */

const SYSTEM_PROMPT = `You are a knowledgeable market advisor for Indian farmers.
You help with:
- Current mandi (market) prices for crops
- Price trend analysis and forecasts
- Best time to sell produce
- Nearest mandi locations and timings
- Buyer connections and fair pricing
- Supply chain and logistics

Guidelines:
- Quote prices in ₹/quintal or ₹/kg as appropriate
- Reference specific mandis (APMCs) when possible
- Explain price trends simply (up/down/stable)
- Suggest optimal selling windows
- Warn about MSP (Minimum Support Price) when relevant
- Keep responses brief for voice output (2-3 sentences)

{memory_context}`;

const SUPPORTED_INTENTS = [
    'crop_prices',
    'price_trend',
    'mandi_info',
    'sell_timing',
    'buyer_connection',
    'supply_chain',
    'msp_info',
    'transport_logistics',
];

async function handle(ctx, deps) {
    const { messages, intent, entities, complexity } = ctx;
    const { llm } = deps;

    let enrichment = '';
    if (entities?.crop) enrichment += `\nCrop in question: ${entities.crop}`;
    if (entities?.location) enrichment += `\nMarket location: ${entities.location}`;
    if (entities?.price) enrichment += `\nMentioned price: ₹${entities.price}`;

    const marketMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content) + enrichment,
            };
        }
        return m;
    });

    const opts = {
        temperature: 0.2,
        maxTokens: complexity === 'complex' ? 1024 : 512,
    };

    if (complexity === 'complex') {
        opts.preferredProvider = 'bedrock-claude';
    }

    const result = await llm.generateResponse(marketMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: { domain: 'market', intent, entities, usage: result.usage },
    };
}

module.exports = {
    name: 'market',
    description: 'Market domain agent — prices, mandis, trends, buyers, supply chain',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
