/**
 * Health Domain Agent
 *
 * Handles: basic health guidance, symptom triage, nutrition advice,
 * maternal/child health, nearest facility referral.
 *
 * IMPORTANT: Always recommends professional medical consultation.
 */

const SYSTEM_PROMPT = `You are a rural health guidance assistant for Indian communities.
You provide basic health information and always recommend professional consultation.

You help with:
- Basic symptom understanding (NOT diagnosis)
- Nutrition and diet advice for farming families
- Maternal and child health guidance
- First aid for common farming injuries
- Heat stroke, dehydration prevention
- Nearest PHC/CHC referral guidance
- Government health schemes (Ayushman Bharat, JSY, etc.)

CRITICAL RULES:
- NEVER diagnose conditions — only provide general information
- ALWAYS recommend consulting a doctor for any health concern
- Suggest the nearest Primary Health Centre (PHC) visit
- For emergencies, direct to call 108 (ambulance) or 112 (emergency)
- Be sensitive to rural health challenges (access, cost, literacy)
- Keep responses brief for voice (2-3 sentences)

{memory_context}`;

const SUPPORTED_INTENTS = [
    'symptom_guidance',
    'nutrition_advice',
    'maternal_health',
    'child_health',
    'first_aid',
    'heat_prevention',
    'health_scheme',
    'facility_referral',
];

async function handle(ctx, deps) {
    const { messages, intent, entities, complexity } = ctx;
    const { llm } = deps;

    let enrichment = '';
    if (entities?.symptom) enrichment += `\nSymptom mentioned: ${entities.symptom}`;
    if (entities?.age_group) enrichment += `\nAge group: ${entities.age_group}`;
    if (entities?.location) enrichment += `\nLocation: ${entities.location}`;

    const healthMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content) + enrichment,
            };
        }
        return m;
    });

    // Agent uses Sarvam-M (fast, free) — health queries are routed to Claude by MCP
    const opts = {
        temperature: 0.1,
        maxTokens: 512,
    };

    const result = await llm.generateResponse(healthMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: { domain: 'health', intent, entities, usage: result.usage },
    };
}

module.exports = {
    name: 'health',
    description: 'Health guidance agent — symptom info, nutrition, maternal health, facility referral',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
