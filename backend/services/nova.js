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
const agentRegistry = require('./agents');
const { APP_NAME, APP_CONTEXT } = require('./brand');

// Nova may not be in ap-south-1 yet; use cross-region if needed
const NOVA_REGION = process.env.NOVA_REGION || process.env.AWS_REGION || 'us-east-1';
const NOVA_MODEL = process.env.NOVA_MODEL_ID || 'amazon.nova-micro-v1:0';
const FALLBACK_MODEL = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const novaClient = new BedrockRuntimeClient({ region: NOVA_REGION });
const fallbackClient = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const DIRECT_ANSWER_BLOCKED_DOMAINS = new Set(['health', 'knowledge', 'market', 'schemes']);
const DIRECT_ANSWER_BLOCKED_INTENTS = new Set([
    'weather_info',
    'air_quality_info',
    'medical_report_analysis',
    'health_platform_help',
    'symptom_guidance',
    'facility_referral',
    'health_scheme',
    'request_video',
    'request_article',
    'request_course',
    'learning_content',
    'knowledge_query',
    'training_resources',
    'show_resources',
    'create_listing',
    'listing_management',
    'contact_buyer',
    'orders',
    'buyer_connection',
    'crop_prices',
    'mandi_info',
    'price_trend',
    'sell_timing',
]);

/* ─── Analysis prompt — single LLM call for translate + understand + route + direct answer ─── */
const ANALYSIS_PROMPT = `You are the AI router for ${APP_NAME}. ${APP_CONTEXT}

Given a user's spoken input (possibly in Hindi, Tamil, Telugu, etc.), perform these tasks:

1. TRANSLATE: Convert the input to English (if already English, keep as-is)
2. DETECT LANGUAGE: Identify the input language
3. CLASSIFY INTENT: Determine the domain and sub-intent
4. EXTRACT ENTITIES: Pull out key entities (crop, location, amount, etc.)
5. ASSESS COMPLEXITY: Is this simple, moderate, or complex?
6. DIRECT ANSWER: If the query is simple enough that you can confidently answer it yourself (greetings, basic general knowledge, simple app guidance, basic farming tips, or casual conversation), set can_answer_directly=true and provide the answer in direct_response. Keep it brief (1-3 sentences) since this will be spoken aloud via TTS. If the user speaks Hindi or another Indian language, respond in the same language. If the query requires real-time data (live prices, live weather, AQI, air quality), tool access, specific scheme details, platform-specific health flows, or complex domain expertise, set can_answer_directly=false.

Available domains:
- agriculture: crop advice, soil, weather, irrigation, pest/disease, farming techniques
- market: crop prices, mandi info, price trends, sell timing, MSP, buyers, create produce listing, manage listing, contact buyer, orders
- schemes: government schemes, subsidies, loans, insurance, eligibility, documents
- health: symptoms, symptom screening, AI doctor follow-up questions, nutrition, maternal health, first aid, facility referral, medical report upload, medical report insights, scan analysis, health dashboard guidance
- knowledge: requests for videos, articles, courses, training content, learning resources, educational material, "show me a video", "find articles about", "courses on"
- general: greetings, general questions, app help, digital literacy, city weather, AQI, air quality

IMPORTANT: If the user asks the app name, platform name, or what this assistant is called, treat it as domain="general", intent="app_help", and recognize the app name as ${APP_NAME}.
IMPORTANT: When a user asks to see, watch, or find videos, articles, courses, or learning content, ALWAYS use domain="knowledge" and NEVER set can_answer_directly=true. These requests require fetching actual resources.
IMPORTANT: When a user asks about uploading a medical report, analyzing an MRI or X-ray or CT or ultrasound or lab report, or asks what they can do on the health screening screen, use domain="health", intent="medical_report_analysis" or "health_platform_help", and NEVER set can_answer_directly=true.
IMPORTANT: When a user describes symptoms, asks for symptom screening, starts an AI doctor consultation, or answers a doctor follow-up with age, gender, or additional symptoms, use domain="health", intent="symptom_guidance", and NEVER set can_answer_directly=true.
IMPORTANT: When a user asks for current weather, temperature, rainfall, forecast, AQI, air quality, or pollution for a city or place, use domain="general", intent="weather_info" or "air_quality_info", extract the location, and NEVER set can_answer_directly=true. Only use agriculture domain for crop-specific weather impact or farming weather advice.
IMPORTANT: When a user says they want to sell produce, list produce, post a sell order, create a listing, mark a listing sold, cancel a listing, contact a buyer, or review buyer requests/orders, use domain="market" with one of these intents: "create_listing", "listing_management", "contact_buyer", "orders", or "buyer_connection". NEVER set can_answer_directly=true for these workflows because the app should open the market screen and use saved profile data.

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
        return normalizeAnalysisResult({
            english_text: parsed.english_text || parsed.text || text,
            original_language: parsed.original_language || parsed.detected_language || 'unknown',
            domain: parsed.domain,
            intent: parsed.intent,
            entities: parsed.entities || {},
            complexity: parsed.complexity,
            summary: parsed.summary || '',
            can_answer_directly: !!parsed.can_answer_directly,
            direct_response: parsed.can_answer_directly ? (parsed.direct_response || null) : null,
        });
    } catch {
        console.warn('[Nova] Failed to parse analysis JSON, using safe defaults');
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
    if (key === 'prices' || key === 'price' || key === 'market_price' || key === 'price_info') return 'crop_prices';
    if (key === 'weather' || key === 'weather_query') return 'weather_info';
    if (key === 'aqi' || key === 'air_quality') return 'air_quality_info';
    if (key === 'video' || key === 'videos') return 'request_video';
    if (key === 'article' || key === 'articles') return 'request_article';
    if (key === 'course' || key === 'courses' || key === 'training') return 'request_course';
    if (key === 'symptoms' || key === 'symptom_check' || key === 'doctor_consultation') return 'symptom_guidance';
    if (key === 'report_upload' || key === 'report_analysis' || key === 'scan_analysis') return 'medical_report_analysis';
    if (key === 'loan_information' || key === 'loan_details' || key === 'crop_loan') return 'loan_info';
    if (key === 'insurance_information' || key === 'insurance_details' || key === 'claim_status') return 'insurance_claim';
    if (key === 'saving_plan' || key === 'savings_overview' || key === 'financial_overview' || key === 'profit_cost') return 'financial_aid';
    if (key === 'eligibility_check') return 'scheme_eligibility';
    if (key === 'sell_produce' || key === 'sell_order' || key === 'create_sell_order' || key === 'listing_creation' || key === 'listing_create') return 'create_listing';
    if (key === 'buyer_requests' || key === 'market_orders' || key === 'order_status' || key === 'show_orders') return 'orders';
    if (key === 'listing_update' || key === 'cancel_listing' || key === 'mark_sold') return 'listing_management';
    if (key === 'buyer_contact' || key === 'connect_buyer') return 'contact_buyer';
    return key;
}

/* ─── Basic keyword routing (last-resort fallback) ─── */

function basicRoute(text, detectedLang) {
    return classifyTextWithFallback(text, detectedLang);
}

function normalizeText(text = '') {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function collectIntentSignals(text = '') {
    const normalized = normalizeText(text);
    const wordCount = normalized ? normalized.split(/\s+/).filter(Boolean).length : 0;
    const location = extractLocationEntity(normalized);

    const greeting = wordCount <= 6
        && /^(hello|hi|hey|namaste|namaskar|vanakkam|how are you|kaise ho|good morning|good evening)(\b|[!,.? ]|$)/i.test(normalized);
    const appHelp = /\b(app name|platform name|assistant name|what(?:'s| is) your name|who are you|what is this app|how do i use (?:this )?app|help me use (?:the )?app)\b/i.test(normalized);

    const agriCore = /\b(crop|crops|farm|farming|soil|seed|harvest|irrigat(?:e|ion)?|pest|disease|fertili[sz]er|field|plant|farmer|wheat|rice|cotton|maize|millet|soybean|mustard|onion|tomato|potato|khet|fasal|kheti|beej|mitti|sinchai|khad|गेहूं|धान|फसल|खेती|खेत|कीड़े?)\b/i.test(normalized);
    const weather = /\b(weather|temperature|forecast|rain(?:fall)?|humidity|wind|climate|mausam|baarish|barish|temp)\b/i.test(normalized);
    const aqi = /\b(aqi|air quality|pollution|smog|pm2\.?5|pm10|hawa)\b/i.test(normalized);
    const cropWeatherImpact = agriCore && weather;

    const produceTerms = /\b(crop|produce|vegetable|vegetables|fruit|fruits|grain|grains|wheat|rice|cotton|maize|millet|soybean|mustard|onion|tomato|potato|gehu|gehun|धान|फसल|उपज)\b/i;
    const listingManage = /\b(cancel listing|remove listing|delete listing|close listing|mark(?:\s+\w+){0,2}\s+sold|sold(?:\s+\w+){0,2}\s+listing)\b|बंद लिस्टिंग|हटा लिस्टिंग/i.test(normalized);
    const contactBuyer = /\b(contact buyer|call buyer|connect buyer|buyer number|buyer phone|buyer details)\b/i.test(normalized);
    const orders = /\b(my orders|order updates|buyer requests?|request orders?|orders?)\b|ऑर्डर|रिक्वेस्ट/i.test(normalized);
    const listingCreate = /\b(create listing|post listing|list my produce|list my crop|sell order|sale order|listing)\b/i.test(normalized)
        || (/\bsell\b/i.test(normalized) && (produceTerms.test(normalized) || /\blisting\b/i.test(normalized)))
        || /बेचना|लिस्टिंग/i.test(normalized);
    const marketPrice = /\b(price|prices|mandi|msp|market price|bazaar|bhav|daam)\b/i.test(normalized)
        || (/\brate\b/i.test(normalized) && (produceTerms.test(normalized) || /\bbazaar\b/i.test(normalized)))
        || (/₹|\brupees?\b/i.test(normalized) && /\b(?:quintal|per\s+(?:kg|kilo|quintal))\b/i.test(normalized))
        || ((/₹|\brupees?\b|\bquintal\b|\bper\s+(?:kg|kilo|quintal)\b/i.test(normalized))
            && (produceTerms.test(normalized) || /\b(?:market|mandi|price)\b/i.test(normalized)));

    const schemeLoan = /\b(loan|crop loan|bank loan|credit|kcc|interest|कर्ज|लोन)\b/i.test(normalized);
    const schemeInsurance = /\b(insurance|claim|pmfby|bima|बीमा|क्लेम)\b/i.test(normalized);
    const schemeGeneral = /\b(scheme|schemes|yojana|subsid(?:y|ies)|pm-kisan|kisan samman|sarkari|sarkar|योजना|सब्सिडी|सरकारी)\b/i.test(normalized)
        || schemeLoan
        || schemeInsurance;

    const medicalReport = /\b(upload (?:a )?(?:medical |lab |blood )?report|medical report|lab report|blood report|report insights|get insights|x[\s-]?ray|mri|ct(?:\s+scan)?|ultrasound|pathology|scan result|analy[sz]e (?:my )?(?:report|scan|x[\s-]?ray|mri|ct|ultrasound))\b|(?:अपलोड|रिपोर्ट|स्कैन|एमआरआई|एक्सरे).*(?:इंसाइट|विश्लेषण|अपलोड|जांच)/i.test(normalized);
    const healthPlatformHelp = /\b(health screening|symptom checker|upload report|get insights)\b.*\b(how|what|use|screen)\b|\bwhat can i do\b.*\bhealth\b|स्वास्थ्य स्क्रीन|हेल्थ स्क्रीन/i.test(normalized);
    const healthSymptom = /\b(health|doctor|hospital|pain|fever|symptom|medicine|nutrition|pregnant|tabiyat|bukhar|cough|headache|vomit(?:ing)?|dizziness|weakness|rash|triage|screening)\b|लक्षण|खांसी|दर्द|बुखार/i.test(normalized)
        && !medicalReport;

    const knowledgeVideo = (/\b(?:show|find|play|watch|suggest|need|want)\b.*\bvideos?\b/i.test(normalized)
        || /\bvideos?\b.*\b(?:about|on|for)\b/i.test(normalized)
        || /(?:वीडियो.*(?:दिखा|ढूंढ|खोज)|(?:दिखा|ढूंढ|खोज).*(?:वीडियो))/i.test(normalized));
    const knowledgeArticle = (/\b(?:show|find|read|suggest|need|want)\b.*\barticles?\b/i.test(normalized)
        || /\barticles?\b.*\b(?:about|on|for)\b/i.test(normalized)
        || /(?:आर्टिकल|लेख).*(?:दिखा|ढूंढ|खोज)|(?:दिखा|ढूंढ|खोज).*(?:आर्टिकल|लेख)/i.test(normalized));
    const knowledgeCourse = (/\b(?:show|find|suggest|need|want|learn)\b.*\b(courses?|training|tutorials?|lessons?|classes?|webinars?)\b/i.test(normalized)
        || /\b(courses?|training|tutorials?|lessons?|classes?|webinars?)\b.*\b(?:about|on|for)\b/i.test(normalized)
        || /(?:कोर्स|प्रशिक्षण|ट्रेनिंग).*(?:दिखा|ढूंढ|खोज)|(?:दिखा|ढूंढ|खोज).*(?:कोर्स|प्रशिक्षण|ट्रेनिंग)/i.test(normalized));
    const knowledgeGeneric = /\b(learning resources?|study materials?|resource links?|official resources?|training resources?)\b/i.test(normalized);

    return {
        location,
        greeting,
        appHelp,
        agriCore,
        weather,
        aqi,
        cropWeatherImpact,
        listingManage,
        contactBuyer,
        orders,
        listingCreate,
        marketPrice,
        schemeLoan,
        schemeInsurance,
        schemeGeneral,
        medicalReport,
        healthPlatformHelp,
        healthSymptom,
        knowledgeVideo,
        knowledgeArticle,
        knowledgeCourse,
        knowledgeGeneric,
    };
}

function inferIntentFromSignals(signals) {
    const entities = {};
    if (signals.location && (signals.weather || signals.aqi)) {
        entities.location = signals.location;
    }

    if (signals.greeting) {
        return { domain: 'general', intent: 'greeting', entities };
    }

    if (signals.appHelp) {
        return { domain: 'general', intent: 'app_help', entities };
    }

    if (signals.knowledgeVideo) {
        return { domain: 'knowledge', intent: 'request_video', entities };
    }

    if (signals.knowledgeArticle) {
        return { domain: 'knowledge', intent: 'request_article', entities };
    }

    if (signals.knowledgeCourse) {
        return { domain: 'knowledge', intent: 'request_course', entities };
    }

    if (signals.knowledgeGeneric) {
        return { domain: 'knowledge', intent: 'learning_content', entities };
    }

    if (signals.medicalReport) {
        return { domain: 'health', intent: 'medical_report_analysis', entities };
    }

    if (signals.healthPlatformHelp) {
        return { domain: 'health', intent: 'health_platform_help', entities };
    }

    if (signals.listingManage) {
        return { domain: 'market', intent: 'listing_management', entities };
    }

    if (signals.contactBuyer) {
        return { domain: 'market', intent: 'contact_buyer', entities };
    }

    if (signals.orders) {
        return { domain: 'market', intent: 'orders', entities };
    }

    if (signals.listingCreate) {
        return { domain: 'market', intent: 'create_listing', entities };
    }

    if (signals.aqi) {
        return { domain: 'general', intent: 'air_quality_info', entities };
    }

    if (signals.weather && !signals.cropWeatherImpact) {
        return { domain: 'general', intent: 'weather_info', entities };
    }

    if (signals.healthSymptom) {
        return { domain: 'health', intent: 'symptom_guidance', entities };
    }

    if (signals.schemeInsurance) {
        return { domain: 'schemes', intent: 'insurance_claim', entities };
    }

    if (signals.schemeLoan) {
        return { domain: 'schemes', intent: 'loan_info', entities };
    }

    if (signals.marketPrice) {
        return { domain: 'market', intent: 'crop_prices', entities };
    }

    if (signals.cropWeatherImpact) {
        return { domain: 'agriculture', intent: 'weather_impact', entities };
    }

    if (signals.agriCore) {
        return { domain: 'agriculture', intent: 'crop_advice', entities };
    }

    if (signals.schemeGeneral) {
        return { domain: 'schemes', intent: 'scheme_eligibility', entities };
    }

    return { domain: 'general', intent: 'general_question', entities };
}

function classifyTextWithFallback(text, detectedLang = 'unknown') {
    const normalizedText = normalizeText(text);
    const keywordRoute = inferIntentFromSignals(collectIntentSignals(normalizedText));

    return {
        english_text: normalizedText || String(text || ''),
        original_language: detectedLang || 'unknown',
        domain: keywordRoute.domain,
        intent: keywordRoute.intent,
        entities: keywordRoute.entities,
        complexity: 'simple',
        summary: '',
        can_answer_directly: false,
        direct_response: null,
    };
}

function shouldPreferHeuristicRoute(current, heuristic) {
    if (!heuristic || heuristic.intent === 'general_question') {
        return false;
    }

    if (current.intent === heuristic.intent && current.domain === heuristic.domain) {
        return false;
    }

    const currentIntentDomain = agentRegistry.resolveDomain(current.intent);
    const currentLooksWeak = current.intent === 'unknown'
        || current.intent === 'general_question'
        || (current.domain === 'general' && currentIntentDomain === 'general');

    if (currentLooksWeak) {
        return true;
    }

    if (DIRECT_ANSWER_BLOCKED_INTENTS.has(heuristic.intent)) {
        return true;
    }

    if ((heuristic.intent === 'weather_info' || heuristic.intent === 'air_quality_info') && current.intent !== heuristic.intent) {
        return true;
    }

    return heuristic.domain !== current.domain && heuristic.domain !== 'general';
}

function normalizeAnalysisResult(analysis) {
    const englishText = normalizeText(analysis.english_text || '');
    const heuristic = classifyTextWithFallback(englishText, analysis.original_language || 'unknown');
    const normalizedIntent = normalizeIntentAlias(analysis.intent);
    const entities = analysis.entities && typeof analysis.entities === 'object' ? { ...analysis.entities } : {};

    let result = {
        english_text: englishText || String(analysis.english_text || ''),
        original_language: analysis.original_language || 'unknown',
        domain: validDomain(analysis.domain),
        intent: normalizedIntent || 'unknown',
        entities,
        complexity: validComplexity(analysis.complexity),
        summary: analysis.summary || '',
        can_answer_directly: !!analysis.can_answer_directly,
        direct_response: analysis.can_answer_directly ? (analysis.direct_response || null) : null,
    };

    const intentDomain = agentRegistry.resolveDomain(result.intent);
    if (intentDomain !== 'general' && result.domain !== intentDomain) {
        result.domain = intentDomain;
    }

    if (shouldPreferHeuristicRoute(result, heuristic)) {
        result = {
            ...result,
            domain: heuristic.domain,
            intent: heuristic.intent,
            entities: { ...result.entities, ...heuristic.entities },
        };
    } else if (
        !result.entities.location
        && heuristic.entities.location
        && (result.intent === 'weather_info' || result.intent === 'air_quality_info')
    ) {
        result.entities.location = heuristic.entities.location;
    }

    if (
        DIRECT_ANSWER_BLOCKED_DOMAINS.has(result.domain)
        || DIRECT_ANSWER_BLOCKED_INTENTS.has(result.intent)
    ) {
        result.can_answer_directly = false;
        result.direct_response = null;
    }

    return result;
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
    const normalized = String(d || '').trim().toLowerCase();
    return VALID_DOMAINS.includes(normalized) ? normalized : 'general';
}

function validComplexity(c) {
    const normalized = String(c || '').trim().toLowerCase();
    return VALID_COMPLEXITIES.includes(normalized) ? normalized : 'simple';
}

module.exports = {
    analyzeAndRoute,
    parseAnalysisResponse,
    basicRoute,
    extractLocationEntity,
    ANALYSIS_PROMPT,
};
