/**
 * General Domain Agent (catch-all)
 *
 * Handles: greetings, general questions, queries that don't fit
 * specific domains, conversational exchanges.
 */

const SYSTEM_PROMPT = `You are a friendly, helpful voice assistant for a rural Indian platform.
You assist farmers and rural communities with everyday needs.

You help with:
- General greetings and conversation
- Digital literacy guidance
- Phone/app usage help
- General knowledge questions
- Connecting to the right service or feature
- Weather and calendar information

Guidelines:
- Be warm, respectful, and patient
- Use simple language appropriate for rural users
- If the query relates to agriculture, market, schemes, or health,
  still provide a helpful answer but mention the specialized feature
- Keep responses brief for voice (1-3 sentences)
- Remember the user's name and use it naturally

{memory_context}`;

const SUPPORTED_INTENTS = [
    'greeting',
    'general_question',
    'digital_literacy',
    'app_help',
    'weather_info',
    'unknown',
];

async function handle(ctx, deps) {
    const { messages, complexity } = ctx;
    const { llm } = deps;

    const generalMessages = messages.map((m, i) => {
        if (i === 0 && m.role === 'system') {
            return {
                role: 'system',
                content: SYSTEM_PROMPT.replace('{memory_context}', m.content),
            };
        }
        return m;
    });

    // General queries → Sarvam-M (fast, free, good at Indian languages)
    const opts = {
        temperature: 0.3,
        maxTokens: 512,
    };

    const result = await llm.generateResponse(generalMessages, opts);

    return {
        response: result.content,
        provider: result.provider,
        metadata: { domain: 'general', intent: ctx.intent, usage: result.usage },
    };
}

module.exports = {
    name: 'general',
    description: 'General catch-all agent — greetings, conversation, digital literacy, app help',
    supportedIntents: SUPPORTED_INTENTS,
    handle,
};
