/**
 * Government Schemes Domain Agent
 *
 * Handles: scheme eligibility, application process, subsidy info,
 * financial aid, document requirements, deadlines.
 */

const SYSTEM_PROMPT = `You are an expert on Indian government schemes for farmers and rural citizens.
You help with:
- PM-KISAN, PM-FASAL Bima Yojana, PKVY, Soil Health Card
- State-level agricultural schemes
- Subsidy programs (fertilizer, seed, equipment, solar pump)
- Kisan Credit Card (KCC) and loan schemes
- Crop insurance and claim process
- e-NAM, DigiLocker integration
- Eligibility criteria and required documents
- Application process and deadlines

Guidelines:
- Provide specific scheme names and amounts
- Explain eligibility in simple terms
- List required documents clearly
- Mention deadlines if known
- Direct to nearest CSC (Common Service Centre) for offline help
- Keep responses brief for voice (2-3 sentences)

{memory_context}`;

const SUPPORTED_INTENTS = [
    'scheme_eligibility',
    'scheme_application',
    'subsidy_info',
    'loan_info',
    'insurance_claim',
    'document_help',
    'financial_aid',
    'deadline_reminder',
];

async function handle(ctx, deps) {
    const { messages, intent, entities, complexity } = ctx;
    const { llm } = deps;

    let enrichment = '';
    if (entities?.scheme) enrichment += `\nScheme asked about: ${entities.scheme}`;
    if (entities?.location) enrichment += `\nUser's state: ${entities.location}`;
    if (entities?.amount) enrichment += `\nAmount mentioned: ₹${entities.amount}`;

    const schemeMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content) + enrichment,
            };
        }
        return m;
    });

    // Schemes often need accurate, grounded info → prefer Bedrock for moderate+ complexity
    const opts = {
        temperature: 0.1, // Low temp for factual accuracy
        maxTokens: complexity === 'complex' ? 1024 : 512,
    };

    if (complexity !== 'simple') {
        opts.preferredProvider = 'bedrock-claude';
    }

    const result = await llm.generateResponse(schemeMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: { domain: 'schemes', intent, entities, usage: result.usage },
    };
}

module.exports = {
    name: 'schemes',
    description: 'Government schemes agent — eligibility, applications, subsidies, insurance',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
