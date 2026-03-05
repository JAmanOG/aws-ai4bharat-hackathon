/**
 * Amazon Transcribe Service – STT + Language Identification
 *
 * Uses Amazon Transcribe (batch via S3) for speech-to-text with
 * automatic language identification across Indian languages.
 *
 * Flow:
 *   1. Upload audio to S3 temp location
 *   2. Start TranscriptionJob (with IdentifyLanguage if needed)
 *   3. Poll for completion (typically 3-8 seconds for short clips)
 *   4. Parse result, clean up S3
 *
 * Fallback: Sarvam STT (for faster response or unsupported formats)
 *
 * Supported Indian languages by Transcribe:
 *   en-IN, hi-IN, ta-IN, te-IN, kn-IN, ml-IN
 *
 * For other Indian languages (Bengali, Marathi, Gujarati, etc.),
 * auto-falls back to Sarvam STT which supports 22 languages.
 */

const { v4: uuid } = require('uuid');
const {
    TranscribeClient,
    StartTranscriptionJobCommand,
    GetTranscriptionJobCommand,
    DeleteTranscriptionJobCommand,
} = require('@aws-sdk/client-transcribe');
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const sarvam = require('./sarvam');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const transcribeClient = new TranscribeClient({ region: REGION });
const s3Client = new S3Client({ region: REGION });

const TEMP_BUCKET = process.env.CONTENT_BUCKET || process.env.TRANSCRIBE_BUCKET || 'rural-platform-content-dev';
const TEMP_PREFIX = 'temp/transcribe';
const POLL_INTERVAL_MS = 1000;
const MAX_POLL_ATTEMPTS = 30; // 30 seconds max wait

/* ─── Transcribe-supported Indian language codes ─── */
const TRANSCRIBE_LANGUAGES = [
    'en-IN', 'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN',
    'en-US', 'en-GB', // common fallbacks
];

/* ─── Audio format detection from buffer header ─── */
function detectMediaFormat(buffer) {
    if (!buffer || buffer.length < 4) return 'wav';

    const header = buffer.slice(0, 12).toString('hex');

    // WAV: starts with "RIFF"
    if (header.startsWith('52494646')) return 'wav';
    // OGG: starts with "OggS"
    if (header.startsWith('4f676753')) return 'ogg';
    // FLAC: starts with "fLaC"
    if (header.startsWith('664c6143')) return 'flac';
    // MP3: starts with ID3 or 0xFF 0xFB
    if (header.startsWith('494433') || header.startsWith('fffb') || header.startsWith('fff3')) return 'mp3';
    // MP4/M4A: has "ftyp" at offset 4
    if (header.slice(8, 16) === '66747970') return 'mp4';
    // WebM: starts with 0x1A 0x45 0xDF 0xA3
    if (header.startsWith('1a45dfa3')) return 'webm';
    // AMR: starts with "#!AMR"
    if (header.startsWith('2321414d')) return 'amr';

    return 'wav'; // default fallback
}

/* ═══════════════════════════════════════════════════════ */
/*  Amazon Transcribe (batch via S3)                       */
/* ═══════════════════════════════════════════════════════ */

/**
 * Transcribe audio using Amazon Transcribe with language identification.
 *
 * @param {Buffer} audioBuffer – Audio file data
 * @param {object} opts
 * @param {string} [opts.languageCode] – BCP-47 code or 'unknown' for auto-detect
 * @param {string} [opts.mediaFormat]  – Override format detection
 * @returns {Promise<{transcript: string, language_code: string, provider: string, confidence: number|null}>}
 */
async function transcribeWithAmazon(audioBuffer, opts = {}) {
    const jobName = `voice-${Date.now()}-${uuid().slice(0, 8)}`;
    const mediaFormat = opts.mediaFormat || detectMediaFormat(audioBuffer);
    const s3Key = `${TEMP_PREFIX}/${jobName}.${mediaFormat}`;
    const languageCode = opts.languageCode;
    const useAutoDetect = !languageCode || languageCode === 'unknown';

    // 1. Upload audio to S3
    await s3Client.send(new PutObjectCommand({
        Bucket: TEMP_BUCKET,
        Key: s3Key,
        Body: audioBuffer,
        ContentType: `audio/${mediaFormat}`,
    }));

    // 2. Build transcription job params
    const jobParams = {
        TranscriptionJobName: jobName,
        Media: {
            MediaFileUri: `s3://${TEMP_BUCKET}/${s3Key}`,
        },
        MediaFormat: mediaFormat,
        OutputBucketName: TEMP_BUCKET,
        OutputKey: `${TEMP_PREFIX}/results/${jobName}.json`,
    };

    if (useAutoDetect) {
        // Automatic language identification
        jobParams.IdentifyLanguage = true;
        jobParams.LanguageOptions = TRANSCRIBE_LANGUAGES.join(',');
    } else {
        jobParams.LanguageCode = languageCode;
    }

    // 3. Start transcription job
    await transcribeClient.send(new StartTranscriptionJobCommand(jobParams));

    // 4. Poll for completion
    let transcript = '';
    let detectedLang = languageCode || 'unknown';
    let confidence = null;

    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL_MS);

        const { TranscriptionJob: job } = await transcribeClient.send(
            new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
        );

        if (job.TranscriptionJobStatus === 'COMPLETED') {
            // Fetch result from TranscriptFileUri
            const resultUrl = job.Transcript?.TranscriptFileUri;
            if (resultUrl) {
                const res = await fetch(resultUrl);
                const data = await res.json();
                transcript = data.results?.transcripts?.[0]?.transcript || '';

                // Extract detected language from language identification
                if (useAutoDetect && data.results?.language_identification) {
                    const langResult = data.results.language_identification
                        .sort((a, b) => (b.score || 0) - (a.score || 0))[0];
                    if (langResult) {
                        detectedLang = langResult.code || detectedLang;
                        confidence = langResult.score || null;
                    }
                }

                // Also check job-level language code
                if (job.LanguageCode) {
                    detectedLang = job.LanguageCode;
                }
            }
            break;
        }

        if (job.TranscriptionJobStatus === 'FAILED') {
            throw new Error(`Transcribe job failed: ${job.FailureReason}`);
        }
    }

    // 5. Cleanup S3 + job (best effort)
    cleanup(jobName, s3Key).catch(() => {});

    if (!transcript) {
        throw new Error('Transcription returned empty result');
    }

    return {
        transcript,
        language_code: detectedLang,
        provider: 'amazon-transcribe',
        confidence,
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  Sarvam STT Fallback                                    */
/* ═══════════════════════════════════════════════════════ */

/**
 * Fallback to Sarvam STT for languages/formats not supported by Transcribe.
 */
async function transcribeWithSarvam(audioBuffer, opts = {}) {
    const langBcp47 = opts.languageCode === 'unknown' ? 'unknown' : (opts.languageCode || 'unknown');

    const result = await sarvam.transcribe(audioBuffer, {
        languageCode: langBcp47,
        mode: opts.mode || 'transcribe',
    });

    return {
        transcript: result.transcript,
        language_code: result.language_code || opts.languageCode || 'unknown',
        provider: 'sarvam-stt',
        confidence: result.language_probability || null,
    };
}

/* ═══════════════════════════════════════════════════════ */
/*  Hybrid STT (Sarvam primary — fast, Amazon fallback)    */
/* ═══════════════════════════════════════════════════════ */

/**
 * Main transcription entry point.
 *
 * Priority: Sarvam STT first (single HTTP call, ~1-3s, 22 Indian languages)
 * Fallback: Amazon Transcribe (batch S3 job, 5-30s, 6 languages)
 *
 * @param {Buffer} audioBuffer
 * @param {object} opts
 * @returns {Promise<{transcript: string, language_code: string, provider: string, confidence: number|null}>}
 */
async function transcribe(audioBuffer, opts = {}) {
    const start = Date.now();
    let sarvamError = null;

    // Try Sarvam STT first (faster, covers more Indian languages)
    try {
        console.log(`[Transcribe] → Trying Sarvam STT (${audioBuffer.length} bytes)...`);
        const result = await transcribeWithSarvam(audioBuffer, opts);
        console.log(`[Transcribe] ✓ Sarvam STT succeeded in ${Date.now() - start}ms: "${(result.transcript || '').substring(0, 80)}" [${result.language_code}]`);
        return result;
    } catch (sarvamErr) {
        sarvamError = sarvamErr;
        console.warn(`[Transcribe] ⚠ Sarvam STT failed (${Date.now() - start}ms): ${sarvamErr.message}`);
    }

    // Fallback to Amazon Transcribe (slower but reliable)
    try {
        console.log(`[Transcribe] → Falling back to Amazon Transcribe...`);
        const result = await transcribeWithAmazon(audioBuffer, opts);
        console.log(`[Transcribe] ✓ Amazon Transcribe succeeded in ${Date.now() - start}ms: "${(result.transcript || '').substring(0, 80)}" [${result.language_code}]`);
        return result;
    } catch (amazonErr) {
        console.error(`[Transcribe] ✗ Both STT providers failed after ${Date.now() - start}ms. Sarvam: ${sarvamError?.message || 'N/A'}, Amazon: ${amazonErr.message}`);
        throw new Error(`All STT providers failed. Last error: ${amazonErr.message}`);
    }
}

/* ─── Helpers ─── */

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function cleanup(jobName, s3Key) {
    try {
        await s3Client.send(new DeleteObjectCommand({ Bucket: TEMP_BUCKET, Key: s3Key }));
    } catch {}
    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: TEMP_BUCKET,
            Key: `${TEMP_PREFIX}/results/${jobName}.json`,
        }));
    } catch {}
    try {
        await transcribeClient.send(new DeleteTranscriptionJobCommand({ TranscriptionJobName: jobName }));
    } catch {}
}

module.exports = {
    transcribe,
    transcribeWithAmazon,
    transcribeWithSarvam,
    detectMediaFormat,
    TRANSCRIBE_LANGUAGES,
};
