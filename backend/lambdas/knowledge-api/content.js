/**
 * Knowledge API Lambda – content.js
 * Content delivery with voice (TTS) and translation support.
 * Satisfies Requirement 7.1: Voice-based learning content in local Indian languages.
 */

const { query } = require('../../utils/db');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { PollyClient, SynthesizeSpeechCommand } = require('@aws-sdk/client-polly');
const { TranslateClient, TranslateTextCommand } = require('@aws-sdk/client-translate');
const { POLLY_VOICE_MAP, TRANSLATE_LANG_MAP, CONTENT_BUCKET } = require('../../utils/constants');

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const polly = new PollyClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const translate = new TranslateClient({ region: process.env.AWS_REGION || 'ap-south-1' });

/**
 * Get module content with optional translation and TTS audio.
 * @param {string} moduleId - Module UUID
 * @param {string} targetLang - Target language code (e.g., 'hi', 'ta')
 * @param {boolean} includeAudio - If true, generate/return audio URL
 */
async function getModuleContent(moduleId, targetLang = 'hi', includeAudio = true) {
    const result = await query(
        `SELECT cm.*, c.title as course_title, c.category
     FROM course_modules cm
     JOIN courses c ON c.id = cm.course_id
     WHERE cm.id = $1`,
        [moduleId]
    );

    if (result.rows.length === 0) return null;

    const module = result.rows[0];
    let contentText = module.content_text;
    let audioUrl = null;

    // Translate if needed
    if (targetLang && targetLang !== module.language && contentText) {
        contentText = await translateText(contentText, module.language, targetLang);
    }

    // Generate or retrieve audio
    if (includeAudio && contentText) {
        audioUrl = await getOrGenerateAudio(moduleId, contentText, targetLang);
    }

    // If there's an existing pre-generated audio file, provide presigned URL
    if (!audioUrl && module.audio_s3_key) {
        audioUrl = await getPresignedUrl(module.audio_s3_key);
    }

    return {
        ...module,
        content_text: contentText,
        content_language: targetLang,
        audio_url: audioUrl,
        is_translated: targetLang !== module.language,
    };
}

/**
 * Translate text using Amazon Translate.
 */
async function translateText(text, sourceLang, targetLang) {
    const sourceCode = TRANSLATE_LANG_MAP[sourceLang] || 'hi';
    const targetCode = TRANSLATE_LANG_MAP[targetLang] || 'en';

    try {
        const response = await translate.send(new TranslateTextCommand({
            Text: text,
            SourceLanguageCode: sourceCode,
            TargetLanguageCode: targetCode,
        }));
        return response.TranslatedText;
    } catch (err) {
        console.error('Translation error:', err.message);
        return text; // Fallback to original
    }
}

/**
 * Generate TTS audio using Amazon Polly, or retrieve cached version from S3.
 */
async function getOrGenerateAudio(moduleId, text, language) {
    const s3Key = `audio/modules/${moduleId}/${language}.mp3`;

    // Check if cached audio exists
    try {
        await s3.send(new GetObjectCommand({ Bucket: CONTENT_BUCKET, Key: s3Key }));
        return await getPresignedUrl(s3Key);
    } catch (err) {
        // Not cached, generate new audio
    }

    // Generate audio with Polly
    const voiceConfig = POLLY_VOICE_MAP[language] || POLLY_VOICE_MAP['hi'];

    try {
        // Polly has a 3000 char limit per request – chunk if needed
        const textChunks = chunkText(text, 2800);
        const audioBuffers = [];

        for (const chunk of textChunks) {
            const response = await polly.send(new SynthesizeSpeechCommand({
                Text: chunk,
                OutputFormat: 'mp3',
                VoiceId: voiceConfig.voiceId,
                Engine: voiceConfig.engine,
                LanguageCode: voiceConfig.langCode || (language === 'en' ? 'en-IN' : 'hi-IN'),
            }));

            const audioBuffer = await streamToBuffer(response.AudioStream);
            audioBuffers.push(audioBuffer);
        }

        // Combine audio buffers
        const combinedAudio = Buffer.concat(audioBuffers);

        // Cache in S3
        await s3.send(new PutObjectCommand({
            Bucket: CONTENT_BUCKET,
            Key: s3Key,
            Body: combinedAudio,
            ContentType: 'audio/mpeg',
        }));

        return await getPresignedUrl(s3Key);
    } catch (err) {
        console.error('Polly TTS error:', err.message);
        return null;
    }
}

/**
 * Generate S3 presigned URL (1 hour expiry).
 */
async function getPresignedUrl(s3Key) {
    const command = new GetObjectCommand({ Bucket: CONTENT_BUCKET, Key: s3Key });
    return await getSignedUrl(s3, command, { expiresIn: 3600 });
}

/**
 * Split text into chunks of maxLen characters, breaking at sentence boundaries.
 */
function chunkText(text, maxLen) {
    if (text.length <= maxLen) return [text];

    const chunks = [];
    let remaining = text;

    while (remaining.length > 0) {
        if (remaining.length <= maxLen) {
            chunks.push(remaining);
            break;
        }

        // Find the last sentence boundary within maxLen
        let splitAt = remaining.lastIndexOf('।', maxLen); // Hindi sentence end
        if (splitAt === -1) splitAt = remaining.lastIndexOf('.', maxLen);
        if (splitAt === -1) splitAt = remaining.lastIndexOf(' ', maxLen);
        if (splitAt === -1) splitAt = maxLen;

        chunks.push(remaining.substring(0, splitAt + 1).trim());
        remaining = remaining.substring(splitAt + 1).trim();
    }

    return chunks;
}

/**
 * Convert a readable stream to a Buffer.
 */
async function streamToBuffer(stream) {
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks);
}

module.exports = { getModuleContent, translateText, getOrGenerateAudio, getPresignedUrl };
