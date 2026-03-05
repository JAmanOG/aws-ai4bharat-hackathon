/**
 * Unified LLM service with quad-fallback chain:
 *   1. Sarvam-M         (FREE, best Indic — primary for simple queries)
 *   2. AWS Nova Micro    (cheapest Bedrock model — fast classification/generation)
 *   3. Bedrock Claude 3 Haiku  (AWS-sponsored — deep reasoning)
 *   4. Google Gemini     (generous credits — final fallback)
 *
 * Each provider conforms to a common interface:
 *   { content: string, provider: string, usage: object }
 */

const sarvam = require('./sarvam');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const novaBedrock = new BedrockRuntimeClient({ region: process.env.NOVA_REGION || process.env.AWS_REGION || 'us-east-1' });

const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';
const NOVA_MODEL = process.env.NOVA_MODEL_ID || 'amazon.nova-micro-v1:0';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const GEMINI_API_KEY = () => process.env.GEMINI_API_KEY || '';

/* ─── Provider 1: Sarvam-M ─── */

async function callSarvam(messages, opts = {}) {
    return sarvam.chat(messages, {
        temperature: opts.temperature ?? 0.2,
        maxTokens: opts.maxTokens ?? 1024,
        wikiGrounding: opts.wikiGrounding ?? false,
        reasoningEffort: opts.reasoningEffort,
    });
}

/* ─── Provider 2: AWS Nova Micro (via Bedrock) ─── */

async function callNova(messages, opts = {}) {
    // Convert messages to Nova format
    const systemMsgs = messages.filter(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const payload = {
        messages: nonSystemMsgs.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: [{ text: m.content }],
        })),
        inferenceConfig: {
            maxTokens: opts.maxTokens || 1024,
            temperature: opts.temperature ?? 0.2,
        },
    };

    if (systemMsgs.length > 0) {
        payload.system = systemMsgs.map(m => ({ text: m.content }));
    }

    const command = new InvokeModelCommand({
        modelId: NOVA_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    });

    const response = await novaBedrock.send(command);
    const data = JSON.parse(Buffer.from(response.body).toString('utf-8'));

    const text = data.output?.message?.content?.[0]?.text || '';

    return {
        content: text,
        provider: 'nova-micro',
        usage: {
            prompt_tokens: data.usage?.inputTokens || 0,
            completion_tokens: data.usage?.outputTokens || 0,
            total_tokens: (data.usage?.inputTokens || 0) + (data.usage?.outputTokens || 0),
        },
    };
}

/* ─── Provider 3: Bedrock Claude Haiku ─── */

async function callBedrock(messages, opts = {}) {
    // Convert standard messages to Anthropic Messages API format
    const systemMsgs = messages.filter(m => m.role === 'system');
    const nonSystemMsgs = messages.filter(m => m.role !== 'system');

    const payload = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: opts.maxTokens || 1024,
        temperature: opts.temperature ?? 0.3,
        messages: nonSystemMsgs.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content,
        })),
    };

    if (systemMsgs.length > 0) {
        payload.system = systemMsgs.map(m => m.content).join('\n\n');
    }

    const command = new InvokeModelCommand({
        modelId: BEDROCK_MODEL,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(payload),
    });

    const response = await bedrock.send(command);
    const data = JSON.parse(Buffer.from(response.body).toString('utf-8'));

    return {
        content: data.content?.[0]?.text || '',
        provider: 'bedrock-claude',
        usage: {
            prompt_tokens: data.usage?.input_tokens || 0,
            completion_tokens: data.usage?.output_tokens || 0,
            total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
        },
    };
}

/* ─── Provider 4: Google Gemini ─── */

async function callGemini(messages, opts = {}) {
    const apiKey = GEMINI_API_KEY();
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    // Convert messages to Gemini format
    const systemInstruction = messages
        .filter(m => m.role === 'system')
        .map(m => m.content)
        .join('\n\n');

    const contents = messages
        .filter(m => m.role !== 'system')
        .map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }],
        }));

    const payload = {
        contents,
        generationConfig: {
            temperature: opts.temperature ?? 0.3,
            maxOutputTokens: opts.maxTokens || 1024,
        },
    };

    if (systemInstruction) {
        payload.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw Object.assign(new Error(`Gemini error ${res.status}: ${errText}`), {
            status: res.status,
            provider: 'gemini',
        });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    return {
        content: text,
        provider: 'gemini',
        usage: {
            prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
            completion_tokens: data.usageMetadata?.candidatesTokenCount || 0,
            total_tokens: data.usageMetadata?.totalTokenCount || 0,
        },
    };
}

/* ════════════════════════════════════════════════════════ */
/*  Main entry point — quad-fallback chain                 */
/* ════════════════════════════════════════════════════════ */

/**
 * Generate a response using the LLM chain:
 *   Sarvam-M → Nova Micro → Bedrock Claude → Gemini
 *
 * @param {Array<{role: string, content: string}>} messages
 * @param {object} [opts]
 * @param {number} [opts.temperature=0.2]
 * @param {number} [opts.maxTokens=1024]
 * @param {boolean} [opts.wikiGrounding=false]
 * @param {string} [opts.preferredProvider] - Force a specific provider
 * @returns {Promise<{content: string, provider: string, usage: object}>}
 */
async function generateResponse(messages, opts = {}) {
    const providers = [
        { name: 'sarvam-m', fn: callSarvam },
        { name: 'nova-micro', fn: callNova },
        { name: 'bedrock-claude', fn: callBedrock },
        { name: 'gemini', fn: callGemini },
    ];

    // If preferred provider is specified, try it first
    if (opts.preferredProvider) {
        const preferred = providers.find(p => p.name === opts.preferredProvider);
        if (preferred) {
            providers.splice(providers.indexOf(preferred), 1);
            providers.unshift(preferred);
        }
    }

    let lastError = null;

    for (const provider of providers) {
        try {
            const result = await provider.fn(messages, opts);
            return result;
        } catch (err) {
            lastError = err;
            console.warn(`[LLM] ${provider.name} failed: ${err.message}. Trying next...`);
        }
    }

    throw Object.assign(
        new Error(`All LLM providers failed. Last error: ${lastError?.message}`),
        { status: 503, provider: 'none' }
    );
}

module.exports = {
    generateResponse,
    callSarvam,
    callNova,
    callBedrock,
    callGemini,
};
