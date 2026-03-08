const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { sanitizeModelOutput } = require('./llm');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

const BEDROCK_MODEL_ID = process.env.VISION_BEDROCK_MODEL_ID
    || process.env.BEDROCK_MODEL_ID
    || 'anthropic.claude-3-haiku-20240307-v1:0';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png']);
const ALLOWED_KINDS = new Set([
    'crop_image',
    'field_image',
    'medical_image',
    'medical_document',
    'object_image',
    'general_image',
    'unknown',
]);
const ALLOWED_DOMAINS = new Set(['agriculture', 'health', 'general']);

function buildVisionPrompt({ fileName = '', source = '', userPrompt = '' }) {
    return `You are analyzing one farmer-uploaded attachment for the Rural Ecosystem Platform.

Context:
- File name: ${fileName || 'unknown'}
- Source: ${source || 'unknown'}
- Optional user request: ${userPrompt || 'none'}

Look at the image and return ONLY valid JSON with this exact shape:
{
  "attachment_kind": "crop_image|field_image|medical_image|medical_document|object_image|general_image|unknown",
  "title": "short title",
  "summary": "2 to 3 sentences grounded only in visible evidence",
  "key_observations": ["observation 1", "observation 2", "observation 3"],
  "questions_to_ask": ["question 1", "question 2"],
  "suggested_domain": "agriculture|health|general",
  "suggested_intent": "crop_advice|medical_report_analysis|general_question",
  "spoken_prompt_hint": "short example of what the user can ask next",
  "confidence": 0
}

Rules:
- If this looks like a crop, leaf, field, soil, plant disease, pest damage, or farm scene, use agriculture.
- If this looks like a scan, lab report, medical report photo, prescription, or health document, use health.
- If it is a normal object, tool, or everyday item, use general.
- Never invent text that is not visible.
- For health content, do not give a diagnosis; describe observations and suggest discussing with a clinician.
- Keep summary practical and concise.`;
}

function parseJsonObject(rawText = '') {
    const cleaned = sanitizeModelOutput(rawText);
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error('Vision model did not return JSON');
    }
    return JSON.parse(match[0]);
}

function inferDomain(kind = '') {
    if (kind.startsWith('crop') || kind.startsWith('field')) return 'agriculture';
    if (kind.startsWith('medical')) return 'health';
    return 'general';
}

function inferIntent(kind = '', domain = '') {
    if (domain === 'health') return 'medical_report_analysis';
    if (domain === 'agriculture') return 'crop_advice';
    if (kind === 'object_image') return 'general_question';
    return 'general_question';
}

function defaultPromptHint(kind = '', domain = '') {
    if (domain === 'health') {
        return 'Ask what this report or scan shows, what the key findings mean, or what to discuss with a doctor.';
    }
    if (domain === 'agriculture') {
        return 'Ask what issue is visible in this crop, how serious it looks, or what action to take next.';
    }
    if (kind === 'object_image') {
        return 'Ask what this object is, what it is used for, or what details matter.';
    }
    return 'Ask what this image shows or what you want to know about it.';
}

function normalizeList(value, limit = 4) {
    if (!Array.isArray(value)) return [];
    return value
        .map((entry) => String(entry || '').trim())
        .filter(Boolean)
        .slice(0, limit);
}

function normalizeVisionResponse(parsed, provider) {
    const rawKind = String(parsed.attachment_kind || parsed.attachmentKind || '').trim();
    const attachmentKind = ALLOWED_KINDS.has(rawKind) ? rawKind : 'unknown';

    const rawDomain = String(parsed.suggested_domain || parsed.suggestedDomain || '').trim();
    const suggestedDomain = ALLOWED_DOMAINS.has(rawDomain) ? rawDomain : inferDomain(attachmentKind);

    const suggestedIntent = String(parsed.suggested_intent || parsed.suggestedIntent || '').trim()
        || inferIntent(attachmentKind, suggestedDomain);

    const title = String(parsed.title || '').trim() || 'Attachment Analysis';
    const summary = String(parsed.summary || '').trim() || 'Attachment analyzed. Ask a follow-up question about it.';
    const keyObservations = normalizeList(parsed.key_observations || parsed.keyObservations);
    const questionsToAsk = normalizeList(parsed.questions_to_ask || parsed.questionsToAsk, 3);
    const spokenPromptHint = String(parsed.spoken_prompt_hint || parsed.spokenPromptHint || '').trim()
        || defaultPromptHint(attachmentKind, suggestedDomain);
    const confidenceValue = Number(parsed.confidence);
    const confidence = Number.isFinite(confidenceValue)
        ? Math.max(0, Math.min(100, Math.round(confidenceValue)))
        : undefined;

    return {
        attachmentKind,
        title,
        summary,
        keyObservations,
        questionsToAsk,
        suggestedDomain,
        suggestedIntent,
        spokenPromptHint,
        confidence,
        provider,
    };
}

async function callBedrockVision({ fileBase64, fileType, prompt }) {
    const command = new InvokeModelCommand({
        modelId: BEDROCK_MODEL_ID,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 900,
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: fileType,
                                data: fileBase64,
                            },
                        },
                        {
                            type: 'text',
                            text: prompt,
                        },
                    ],
                },
            ],
        }),
    });

    const response = await bedrock.send(command);
    const data = JSON.parse(Buffer.from(response.body).toString('utf-8'));
    const text = data.content?.[0]?.text || '';
    return normalizeVisionResponse(parseJsonObject(text), 'bedrock-vision');
}

async function callGeminiVision({ fileBase64, fileType, prompt }) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY not set');
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [
                {
                    role: 'user',
                    parts: [
                        {
                            inline_data: {
                                mime_type: fileType,
                                data: fileBase64,
                            },
                        },
                        {
                            text: prompt,
                        },
                    ],
                },
            ],
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 900,
            },
        }),
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gemini vision error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return normalizeVisionResponse(parseJsonObject(text), 'gemini-vision');
}

async function analyzeAttachment({ fileBase64, fileType, fileName = '', source = '', userPrompt = '' }) {
    if (!SUPPORTED_IMAGE_TYPES.has(fileType)) {
        throw { statusCode: 400, message: 'Only JPG and PNG images are supported for generic attachment analysis.' };
    }
    if (!fileBase64) {
        throw { statusCode: 400, message: 'Missing image data.' };
    }

    const prompt = buildVisionPrompt({ fileName, source, userPrompt });
    let lastError;

    for (const provider of [callBedrockVision, callGeminiVision]) {
        try {
            return await provider({ fileBase64, fileType, prompt });
        } catch (err) {
            lastError = err;
        }
    }

    throw {
        statusCode: 503,
        message: `Attachment analysis unavailable: ${lastError?.message || 'all vision providers failed'}`,
    };
}

module.exports = {
    analyzeAttachment,
    SUPPORTED_IMAGE_TYPES,
};
