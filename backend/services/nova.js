/**
 * AWS Nova Language Transformation Service
 *
 * Uses Amazon Nova (via Bedrock) for:
 *   1. Language identification + translation to English
 *   2. Context understanding + entity extraction
 *   3. Intent classification + domain routing logic
 *   4. Direct answer attempt — if the query is simple enough,
 *      Nova answers directly (skipping the full Agent/MCP pipeline)
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

/* ─── Analysis prompt — single LLM call for translate + understand + route + direct answer ─── */
const ANALYSIS_PROMPT = `You are an AI router for a rural Indian agriculture platform voice assistant.

Given a user's spoken input (possibly in Hindi, Tamil, Telugu, etc.), perform these tasks:

1. TRANSLATE: Convert the input to English (if already English, keep as-is)
2. DETECT LANGUAGE: Identify the input language
3. CLASSIFY INTENT: Determine the domain and sub-intent
4. EXTRACT ENTITIES: Pull out key entities (crop, location, amount, etc.)
5. ASSESS COMPLEXITY: Is this simple, moderate, or complex?
6. DIRECT ANSWER: If the query is simple enough that you can confidently answer it yourself (greetings, basic general knowledge, simple app guidance, basic farming tips, or casual conversation), set can_answer_directly=true and provide the answer in direct_response. Keep it brief (1-3 sentences) since this will be spoken aloud via TTS. If the user speaks Hindi or another Indian language, respond in the same language. If the query requires real-time data (live prices, live weather, AQI, air quality), tool access, specific scheme details, platform-specific health flows, or complex domain expertise, set can_answer_directly=false.

Available domains:
- agriculture: crop advice, soil, weather, irrigation, pest/disease, farming techniques
- market: crop prices, mandi info, price trends, sell timing, MSP, buyers
- schemes: government schemes, subsidies, loans, insurance, eligibility, documents
- health: symptoms, symptom screening, AI doctor follow-up questions, nutrition, maternal health, first aid, facility referral, medical report upload, medical report insights, scan analysis, health dashboard guidance
- knowledge: requests for videos, articles, courses, training content, learning resources, educational material, "show me a video", "find articles about", "courses on"
- general: greetings, general questions, app help, digital literacy, city weather, AQI, air quality

IMPORTANT: When a user asks to see, watch, or find videos, articles, courses, or learning content, ALWAYS use domain="knowledge" and NEVER set can_answer_directly=true. These requests require fetching actual resources.
IMPORTANT: When a user asks about uploading a medical report, analyzing an MRI or X-ray or CT or ultrasound or lab report, or asks what they can do on the health screening screen, use domain="health", intent="medical_report_analysis" or "health_platform_help", and NEVER set can_answer_directly=true.
IMPORTANT: When a user describes symptoms, asks for symptom screening, starts an AI doctor consultation, or answers a doctor follow-up with age, gender, or additional symptoms, use domain="health", intent="symptom_guidance", and NEVER set can_answer_directly=true.
IMPORTANT: When a user asks for current weather, temperature, rainfall, forecast, AQI, air quality, or pollution for a city or place, use domain="general", intent="weather_info" or "air_quality_info", extract the location, and NEVER set can_answer_directly=true. Only use agriculture domain for crop-specific weather impact or farming weather advice.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "english_text": "the input translated to English",
  "original_language": "hi-IN or en-IN or ta-IN etc.",
  "domain": "agriculture|market|schemes|health|knowledge|general",
  "intent": "specific_intent_name",
  "entities": {
    "crop": "wheat",
    "location": "Maharashtra",
    "amount": "5000"
  },
  "complexity": "simple|moderate|complex",
  "summary": "one-line summary of what user wants",
  "can_answer_directly": true,
  "direct_response": "Your direct answer here (only if can_answer_directly is true, otherwise omit or set to null)"
}

Only include entity keys that are actually present. Use null for missing values.`;

/* ═══════════════════════════════════════════════════════ */
/*  Nova Analysis (translate + understand + route)         */
/* ═══════════════════════════════════════════════════════ */

/**
 * Analyze user input using AWS Nova for translation + intent routing.
 * Nova also attempts a direct answer for simple queries.
 *
 * @param {string} text             – Raw user text (any language)
 * @param {string} [detectedLang]   – Language hint from STT
 * @returns {Promise<{english_text: string, original_language: string, domain: string, intent: string, entities: object, complexity: string, summary: string, can_answer_directly: boolean, direct_response: string|null, provider: string}>}
 */
async function analyzeAndRoute(text, detectedLang = 'unknown') {
    const userMessage = `User input: "${text}"\nDetected language from STT: ${detectedLang}`;

    try {
        // Try Nova first
        const result = await invokeNova(userMessage);
        return { ...result, provider: 'nova' };
    } catch (novaErr) {
        console.warn(`[Nova] Nova analysis failed: ${novaErr.message}. Falling back to Claude Haiku...`);
        if (isCredentialExpiryError(novaErr)) {
            console.warn('[Nova] Credential/session issue detected. Skipping fallback model and using basic routing.');
            return basicRoute(text, detectedLang);
        }
        try {
            const result = await invokeFallback(userMessage);
            return { ...result, provider: 'bedrock-claude' };
        } catch (fallbackErr) {
            console.warn(`[Nova] Fallback also failed: ${fallbackErr.message}. Using basic routing...`);
            return basicRoute(text, detectedLang);
        }
    }
}

function isCredentialExpiryError(err) {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('session has expired')
        || msg.includes('expiredtoken')
        || msg.includes('security token included in the request is expired')
        || msg.includes('unable to locate credentials')
        || msg.includes('unrecognizedclientexception');
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
            maxTokens: 768,
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
        max_tokens: 768,
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
        const normalizedIntent = normalizeIntentAlias(parsed.intent);

        // Validate required fields with defaults
        return {
            english_text: parsed.english_text || parsed.text || text,
            original_language: parsed.original_language || 'unknown',
            domain: validDomain(parsed.domain),
            intent: normalizedIntent || 'unknown',
            entities: parsed.entities || {},
            complexity: validComplexity(parsed.complexity),
            summary: parsed.summary || '',
            can_answer_directly: !!parsed.can_answer_directly,
            direct_response: parsed.can_answer_directly ? (parsed.direct_response || null) : null,
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
            can_answer_directly: false,
            direct_response: null,
        };
    }
}

function normalizeIntentAlias(intent) {
    const key = String(intent || '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_');

    if (!key) return 'unknown';
    if (key === 'loan_information' || key === 'loan_details' || key === 'crop_loan') return 'loan_info';
    if (key === 'insurance_information' || key === 'insurance_details' || key === 'claim_status') return 'insurance_claim';
    if (key === 'saving_plan' || key === 'savings_overview' || key === 'financial_overview' || key === 'profit_cost') return 'financial_aid';
    if (key === 'eligibility_check') return 'scheme_eligibility';
    return key;
}

/* ─── Basic keyword routing (last-resort fallback) ─── */

function basicRoute(text, detectedLang) {
    const lower = text.toLowerCase();

    let domain = 'general';
    let intent = 'general_question';
    let entities = {};

    // Simple keyword matching
    const agriKeywords = /crop|farm|soil|seed|harvest|irrigat|pest|wheat|rice|cotton|fertiliz|khet|fasal|kheti/i;
    const marketKeywords = /price|mandi|sell|buy|market|₹|rupee|rate|kilo|quintal|daam|bazaar|bhav/i;
    const schemeKeywords = /scheme|yojana|subsid|loan|insurance|kisan|pm-kisan|bima|kcc|sarkar/i;
    const healthKeywords = /health|doctor|hospital|pain|fever|symptom|medicine|nutrition|pregnant|tabiyat|bukhar|report|scan|xray|x-ray|\bmri\b|\bct\b|\bultrasound\b|\bpathology\b|upload/i;
    const reportKeywords = /report|scan|xray|x-ray|\bmri\b|\bct\b|\bct scan\b|\bultrasound\b|\bpathology\b|lab report|medical report|upload/i;
    const weatherKeywords = /weather|temperature|forecast|rain|humidity|wind|climate|mausam|baarish|barish|temp/i;
    const aqiKeywords = /\baqi\b|air quality|pollution|smog|pm2\.?5|pm10|hawa/i;
    const greetingKeywords = /^(hello|hi|namaste|namaskar|vanakkam|kaise ho|how are)/i;

    if (greetingKeywords.test(lower)) {
        domain = 'general';
        intent = 'greeting';
    } else if (aqiKeywords.test(lower)) {
        domain = 'general';
        intent = 'air_quality_info';
        const location = extractLocationEntity(text);
        if (location) entities.location = location;
    } else if (weatherKeywords.test(lower) && !agriKeywords.test(lower)) {
        domain = 'general';
        intent = 'weather_info';
        const location = extractLocationEntity(text);
        if (location) entities.location = location;
    } else if (agriKeywords.test(lower)) {
        domain = 'agriculture';
        intent = weatherKeywords.test(lower) ? 'weather_impact' : 'crop_advice';
    } else if (marketKeywords.test(lower)) {
        domain = 'market';
        intent = 'crop_prices';
    } else if (schemeKeywords.test(lower)) {
        domain = 'schemes';
        intent = 'scheme_eligibility';
    } else if (reportKeywords.test(lower)) {
        domain = 'health';
        intent = 'medical_report_analysis';
    } else if (healthKeywords.test(lower)) {
        domain = 'health';
        intent = 'symptom_guidance';
    }

    return {
        english_text: text, // Can't translate without LLM
        original_language: detectedLang || 'unknown',
        domain,
        intent,
        entities,
        complexity: 'simple',
        summary: '',
        can_answer_directly: false,
        direct_response: null,
    };
}

function extractLocationEntity(text = '') {
    const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
    if (!cleaned) return '';

    const stopwords = new Set([
        'what', 'is', 'the', 'weather', 'temperature', 'forecast', 'aqi',
        'air', 'quality', 'pollution', 'status', 'report', 'today', 'now',
        'here', 'there', 'please', 'current', 'live', 'show', 'tell', 'me',
    ]);

    const patterns = [
        /\b(?:in|at|for|near|around|of)\s+([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s-]{1,40})/i,
        /\b([a-zA-Z\u0900-\u097F][a-zA-Z\u0900-\u097F\s-]{1,40})\s+(?:weather|temperature|forecast|aqi|air quality|pollution)\b/i,
    ];

    for (const pattern of patterns) {
        const match = cleaned.match(pattern);
        if (match?.[1]) {
            const candidate = match[1]
                .replace(/\b(today|now|please|status|report)\b/gi, '')
                .replace(/\s+/g, ' ')
                .trim();
            const words = candidate.toLowerCase().split(/\s+/).filter(Boolean);
            if (words.length > 0 && !words.every((word) => stopwords.has(word))) {
                return candidate;
            }
        }
    }

    return '';
}

/* ─── Validation helpers ─── */

const VALID_DOMAINS = ['agriculture', 'market', 'schemes', 'health', 'knowledge', 'general'];
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
    extractLocationEntity,
    ANALYSIS_PROMPT,
};
