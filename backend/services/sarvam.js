/**
 * Sarvam AI API client – STT, TTS, Translation, and Chat.
 *
 * Models used:
 *  - STT:        Saaras v3  (22 Indian languages, auto-detect, code-mix)
 *  - TTS:        Bulbul v3  (30+ voices, 11 languages, pace/temperature)
 *  - Translate:  sarvam-translate:v1  (23 languages)
 *  - Chat:       Sarvam-M   (FREE, best Indic benchmarks, 8K context)
 *
 * All methods are thin wrappers around https://api.sarvam.ai
 */

const fs = require('fs');
const path = require('path');

const SARVAM_BASE = 'https://api.sarvam.ai';
const API_KEY = () => process.env.SARVAM_API_KEY || '';

/* ─── BCP-47 language codes supported by Sarvam ─── */
const SARVAM_LANGUAGES = {
    hi: { code: 'hi-IN', name: 'Hindi' },
    en: { code: 'en-IN', name: 'English' },
    bn: { code: 'bn-IN', name: 'Bengali' },
    ta: { code: 'ta-IN', name: 'Tamil' },
    te: { code: 'te-IN', name: 'Telugu' },
    mr: { code: 'mr-IN', name: 'Marathi' },
    gu: { code: 'gu-IN', name: 'Gujarati' },
    kn: { code: 'kn-IN', name: 'Kannada' },
    ml: { code: 'ml-IN', name: 'Malayalam' },
    pa: { code: 'pa-IN', name: 'Punjabi' },
    or: { code: 'od-IN', name: 'Odia' },
    as: { code: 'as-IN', name: 'Assamese' },
    ur: { code: 'ur-IN', name: 'Urdu' },
    ne: { code: 'ne-IN', name: 'Nepali' },
    sa: { code: 'sa-IN', name: 'Sanskrit' },
    mai: { code: 'mai-IN', name: 'Maithili' },
    doi: { code: 'doi-IN', name: 'Dogri' },
    kok: { code: 'kok-IN', name: 'Konkani' },
    sd: { code: 'sd-IN', name: 'Sindhi' },
    ks: { code: 'ks-IN', name: 'Kashmiri' },
    sat: { code: 'sat-IN', name: 'Santali' },
    mni: { code: 'mni-IN', name: 'Manipuri' },
    brx: { code: 'brx-IN', name: 'Bodo' },
};

/* ─── Default TTS speakers per language (Bulbul v3) ─── */
const DEFAULT_SPEAKERS = {
    'hi-IN': 'Shubh',
    'en-IN': 'Amelia',
    'bn-IN': 'Priya',
    'ta-IN': 'Kavitha',
    'te-IN': 'Shreya',
    'mr-IN': 'Ritu',
    'gu-IN': 'Neha',
    'kn-IN': 'Kavya',
    'ml-IN': 'Pooja',
    'pa-IN': 'Simran',
    'od-IN': 'Roopa',
    'as-IN': 'Ishita',
};

/**
 * Helper to get BCP-47 code from short language code.
 * @param {string} lang – short code (e.g. 'hi') or BCP-47 (e.g. 'hi-IN')
 * @returns {string} BCP-47 code
 */
function toBcp47(lang) {
    if (!lang) return 'hi-IN';
    if (lang.includes('-')) return lang; // already BCP-47
    return SARVAM_LANGUAGES[lang]?.code || 'hi-IN';
}

/* ════════════════════════════════════════════════════════ */
/*  Speech-to-Text (Saaras v3)                             */
/* ════════════════════════════════════════════════════════ */

/**
 * Transcribe audio using Sarvam Saaras v3.
 * @param {Buffer} audioBuffer - Audio file buffer (WAV, MP3, WebM, OGG, etc.)
 * @param {object} opts
 * @param {string} [opts.languageCode='unknown'] - BCP-47 or 'unknown' for auto-detect
 * @param {string} [opts.model='saaras:v3']
 * @param {string} [opts.mode='transcribe'] - transcribe|translate|verbatim|translit|codemix
 * @param {boolean} [opts.withTimestamps=false]
 * @returns {Promise<{transcript: string, language_code: string, language_probability: number|null, request_id: string}>}
 */
async function transcribe(audioBuffer, opts = {}) {
    const {
        languageCode = 'unknown',
        model = 'saaras:v3',
        mode = 'transcribe',
        withTimestamps = false,
    } = opts;

    // Build multipart form
    const boundary = `----SarvamBoundary${Date.now()}`;
    const parts = [];

    // file part
    parts.push(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="file"; filename="audio.wav"\r\n` +
        `Content-Type: audio/wav\r\n\r\n`
    );
    parts.push(audioBuffer);
    parts.push('\r\n');

    // model
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\n${model}\r\n`);
    // language_code
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="language_code"\r\n\r\n${languageCode}\r\n`);
    // mode
    if (model === 'saaras:v3') {
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="mode"\r\n\r\n${mode}\r\n`);
    }
    // with_timestamps
    if (withTimestamps) {
        parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="with_timestamps"\r\n\r\ntrue\r\n`);
    }
    parts.push(`--${boundary}--\r\n`);

    // Combine into single buffer
    const bodyParts = parts.map(p => (typeof p === 'string' ? Buffer.from(p) : p));
    const body = Buffer.concat(bodyParts);

    const res = await fetch(`${SARVAM_BASE}/speech-to-text`, {
        method: 'POST',
        headers: {
            'api-subscription-key': API_KEY(),
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
    });

    if (!res.ok) {
        const errText = await res.text();
        throw Object.assign(new Error(`Sarvam STT error ${res.status}: ${errText}`), {
            status: res.status,
            provider: 'sarvam-stt',
        });
    }

    return res.json();
}

/* ════════════════════════════════════════════════════════ */
/*  Text-to-Speech (Bulbul v3)                             */
/* ════════════════════════════════════════════════════════ */

/**
 * Synthesize speech using Sarvam Bulbul v3.
 * @param {string} text - Text to speak (max 2500 chars)
 * @param {object} opts
 * @param {string} [opts.targetLanguageCode='hi-IN']
 * @param {string} [opts.speaker] - One of 30+ Bulbul v3 voices
 * @param {number} [opts.pace=1] - 0.5 to 2.0
 * @param {number} [opts.temperature=0.6] - 0.01 to 2.0
 * @param {string} [opts.model='bulbul:v3']
 * @returns {Promise<{audios: string[], request_id: string}>} audios are base64-encoded WAV
 */
async function synthesize(text, opts = {}) {
    const {
        targetLanguageCode = 'hi-IN',
        speaker,
        pace = 1,
        temperature = 0.6,
        model = 'bulbul:v3',
    } = opts;

    const langCode = toBcp47(targetLanguageCode);
    const chosenSpeaker = speaker || DEFAULT_SPEAKERS[langCode] || 'Shubh';

    const payload = {
        text,
        target_language_code: langCode,
        speaker: chosenSpeaker,
        model,
        pace,
        temperature,
    };

    const res = await fetch(`${SARVAM_BASE}/text-to-speech`, {
        method: 'POST',
        headers: {
            'api-subscription-key': API_KEY(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw Object.assign(new Error(`Sarvam TTS error ${res.status}: ${errText}`), {
            status: res.status,
            provider: 'sarvam-tts',
        });
    }

    return res.json();
}

/* ════════════════════════════════════════════════════════ */
/*  Translation (sarvam-translate:v1)                      */
/* ════════════════════════════════════════════════════════ */

/**
 * Translate text using Sarvam Translate.
 * @param {string} text - Input text (max 2000 chars)
 * @param {string} sourceLang - Source language code (short or BCP-47, or 'auto')
 * @param {string} targetLang - Target language code
 * @param {object} [opts]
 * @param {string} [opts.model='sarvam-translate:v1']
 * @param {string} [opts.mode='formal'] - formal|modern-colloquial|classic-colloquial|code-mixed
 * @returns {Promise<{translated_text: string, source_language_code: string, request_id: string}>}
 */
async function translate(text, sourceLang, targetLang, opts = {}) {
    const {
        model = 'sarvam-translate:v1',
        mode = 'formal',
    } = opts;

    const payload = {
        input: text,
        source_language_code: sourceLang === 'auto' ? 'auto' : toBcp47(sourceLang),
        target_language_code: toBcp47(targetLang),
        model,
        mode: model === 'sarvam-translate:v1' ? 'formal' : mode,
    };

    const res = await fetch(`${SARVAM_BASE}/translate`, {
        method: 'POST',
        headers: {
            'api-subscription-key': API_KEY(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw Object.assign(new Error(`Sarvam Translate error ${res.status}: ${errText}`), {
            status: res.status,
            provider: 'sarvam-translate',
        });
    }

    return res.json();
}

/* ════════════════════════════════════════════════════════ */
/*  Chat Completion (Sarvam-M) — FREE                      */
/* ════════════════════════════════════════════════════════ */

/**
 * Chat completion using Sarvam-M.
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {object} [opts]
 * @param {number} [opts.temperature=0.2]
 * @param {number} [opts.maxTokens=1024]
 * @param {boolean} [opts.stream=false]
 * @param {boolean} [opts.wikiGrounding=false]
 * @param {string} [opts.reasoningEffort] - 'low'|'medium'|'high' (enables thinking mode)
 * @returns {Promise<{content: string, usage: object, id: string}>}
 */
async function chat(messages, opts = {}) {
    const {
        temperature = 0.2,
        maxTokens = 1024,
        stream = false,
        wikiGrounding = false,
        reasoningEffort,
    } = opts;

    const payload = {
        model: 'sarvam-m',
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
        wiki_grounding: wikiGrounding,
    };

    if (reasoningEffort) {
        payload.reasoning_effort = reasoningEffort;
    }

    const res = await fetch(`${SARVAM_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'api-subscription-key': API_KEY(),
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errText = await res.text();
        throw Object.assign(new Error(`Sarvam Chat error ${res.status}: ${errText}`), {
            status: res.status,
            provider: 'sarvam-m',
        });
    }

    const data = await res.json();
    const choice = data.choices?.[0];

    return {
        content: choice?.message?.content || '',
        usage: data.usage || {},
        id: data.id || '',
        provider: 'sarvam-m',
    };
}

module.exports = {
    transcribe,
    synthesize,
    translate,
    chat,
    toBcp47,
    SARVAM_LANGUAGES,
    DEFAULT_SPEAKERS,
};
