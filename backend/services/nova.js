/**
 * AWS Nova Language Transformation Service
 *
 * Uses Amazon Nova (via Bedrock) for:
 *   1. Language identification + translation to English
 *   2. Context understanding + entity extraction
 *   3. Intent classification + domain routing logic
 *
 * Model: Amazon Nova Micro (text-only, fastest, cheapest)
 *   - $0.035 / 1M input tokens, $0.14 / 1M output tokens
 *   - Ideal for classification and transformation tasks
 *
 * If Nova is unavailable in the current region, falls back to
 * Claude Haiku for the same transformation task.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

// Nova may not be in ap-south-1 yet; use cross-region if needed
const NOVA_REGION = process.env.NOVA_REGION || process.env.AWS_REGION || 'us-east-1';
const NOVA_MODEL = process.env.NOVA_MODEL_ID || 'amazon.nova-micro-v1:0';
const FALLBACK_MODEL = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const novaClient = new BedrockRuntimeClient({ region: NOVA_REGION });
const fallbackClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

/* ─── Analysis prompt — single LLM call for translate + understand + route ─── */
const ANALYSIS_PROMPT = `You are an AI router for a rural Indian agriculture platform voice assistant.

Given a user's spoken input (possibly in Hindi, Tamil, Telugu, etc.), perform these tasks:

1. TRANSLATE: Convert the input to English (if already English, keep as-is)
2. DETECT LANGUAGE: Identify the input language
3. CLASSIFY INTENT: Determine the domain and sub-intent
4. EXTRACT ENTITIES: Pull out key entities (crop, location, amount, etc.)
5. ASSESS COMPLEXITY: Is this simple, moderate, or complex?

Available domains:
- agriculture: crop advice, soil, weather, irrigation, pest/disease, farming techniques
- market: crop prices, mandi info, price trends, sell timing, MSP, buyers
- schemes: government schemes, subsidies, loans, insurance, eligibility, documents
- health: symptoms, nutrition, maternal health, first aid, facility referral
- general: greetings, general questions, app help, digital literacy

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "english_text": "the input translated to English",
  "original_language": "hi-IN or en-IN or ta-IN etc.",
  "domain": "agriculture|market|schemes|health|general",
  "intent": "specific_intent_name",
  "entities": {
    "crop": "wheat",
    "location": "Maharashtra",
    "amount": "5000"
  },
  "complexity": "simple|moderate|complex",
  "summary": "one-line summary of what user wants"
}

Only include entity keys that are actually present. Use null for missing values.`;

/* ═══════════════════════════════════════════════════════ */
/*  Nova Analysis (translate + understand + route)         */
/* ═══════════════════════════════════════════════════════ */

/**
 * Analyze user input using AWS Nova for translation + intent routing.
 *
 * @param {string} text             – Raw user text (any language)
 * @param {string} [detectedLang]   – Language hint from STT
 * @returns {Promise<{english_text: string, original_language: string, domain: string, intent: string, entities: object, complexity: string, summary: string, provider: string}>}
 */
async function analyzeAndRoute(text, detectedLang = 'unknown') {
    const userMessage = `User input: "${text}"\nDetected language from STT: ${detectedLang}`;

    try {
        // Try Nova first
        const result = await invokeNova(userMessage);
        return { ...result, provider: 'nova' };
    } catch (novaErr) {
        console.warn(`[Nova] Nova analysis failed: ${novaErr.message}. Falling back to Claude Haiku...`);
        try {
            const result = await invokeFallback(userMessage);
            return { ...result, provider: 'bedrock-claude' };
        } catch (fallbackErr) {
            console.warn(`[Nova] Fallback also failed: ${fallbackErr.message}. Using basic routing...`);
            return basicRoute(text, detectedLang);
        }
    }
}

/* ─── Nova InvokeModel ─── */

async function invokeNova(userMessage) {
    // Nova uses Bedrock Messages API format (similar to Converse)
    const payload = {
        messages: [
            {
                role: 'user',
                content: [{ text: userMessage }],
            },
        ],
        system: [{ text: ANALYSIS_PROMPT }],
        inferenceConfig: {
            maxTokens: 512,
            temperature: 0.1,
        },
    };

    const command = new InvokeModelCommand({
        modelId: NOVA_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    });

    const response = await novaClient.send(command);
    const data = JSON.parse(Buffer.from(response.body).toString('utf-8'));

    const text = data.output?.message?.content?.[0]?.text || '';
    return parseAnalysisResponse(text);
}

/* ─── Claude Haiku fallback ─── */

async function invokeFallback(userMessage) {
    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 512,
        temperature: 0.1,
        system: ANALYSIS_PROMPT,
        messages: [
            { role: 'user', content: userMessage },
        ],
    };

    const command = new InvokeModelCommand({
        modelId: FALLBACK_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    });

    const response = await fallbackClient.send(command);
    const data = JSON.parse(Buffer.from(response.body).toString('utf-8'));

    const text = data.content?.[0]?.text || '';
    return parseAnalysisResponse(text);
}

/* ─── Response parser ─── */

function parseAnalysisResponse(text) {
    // Strip markdown fences if present
    const cleaned = text.trim()
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

    try {
        const parsed = JSON.parse(cleaned);

        // Validate required fields with defaults
        return {
            english_text: parsed.english_text || parsed.text || text,
            original_language: parsed.original_language || 'unknown',
            domain: validDomain(parsed.domain),
            intent: parsed.intent || 'unknown',
            entities: parsed.entities || {},
            complexity: validComplexity(parsed.complexity),
            summary: parsed.summary || '',
        };
    } catch {
        console.warn('[Nova] Failed to parse analysis JSON, using basic routing');
        return {
            english_text: text,
            original_language: 'unknown',
            domain: 'general',
            intent: 'unknown',
            entities: {},
            complexity: 'simple',
            summary: '',
        };
    }
}

/* ─── Basic keyword routing (last-resort fallback) ─── */

function basicRoute(text, detectedLang) {
    const lower = text.toLowerCase();

    let domain = 'general';
    let intent = 'general_question';

    // Simple keyword matching
    const agriKeywords = /crop|farm|soil|seed|harvest|irrigat|pest|wheat|rice|cotton|fertiliz|khet|fasal|kheti/i;
    const marketKeywords = /price|mandi|sell|buy|market|₹|rupee|rate|kilo|quintal|daam|bazaar|bhav/i;
    const schemeKeywords = /scheme|yojana|subsid|loan|insurance|kisan|pm-kisan|bima|kcc|sarkar/i;
    const healthKeywords = /health|doctor|hospital|pain|fever|symptom|medicine|nutrition|pregnant|tabiyat|bukhar/i;
    const greetingKeywords = /^(hello|hi|namaste|namaskar|vanakkam|kaise ho|how are)/i;

    if (greetingKeywords.test(lower)) {
        domain = 'general';
        intent = 'greeting';
    } else if (agriKeywords.test(lower)) {
        domain = 'agriculture';
        intent = 'crop_advice';
    } else if (marketKeywords.test(lower)) {
        domain = 'market';
        intent = 'crop_prices';
    } else if (schemeKeywords.test(lower)) {
        domain = 'schemes';
        intent = 'scheme_eligibility';
    } else if (healthKeywords.test(lower)) {
        domain = 'health';
        intent = 'symptom_guidance';
    }

    return {
        english_text: text, // Can't translate without LLM
        original_language: detectedLang || 'unknown',
        domain,
        intent,
        entities: {},
        complexity: 'simple',
        summary: '',
    };
}

/* ─── Validation helpers ─── */

const VALID_DOMAINS = ['agriculture', 'market', 'schemes', 'health', 'general'];
const VALID_COMPLEXITIES = ['simple', 'moderate', 'complex'];

function validDomain(d) {
    return VALID_DOMAINS.includes(d) ? d : 'general';
}

function validComplexity(c) {
    return VALID_COMPLEXITIES.includes(c) ? c : 'simple';
}

module.exports = {
    analyzeAndRoute,
    parseAnalysisResponse,
    basicRoute,
    ANALYSIS_PROMPT,
};
