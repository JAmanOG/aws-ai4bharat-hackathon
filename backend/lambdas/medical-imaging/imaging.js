/**
 * Medical Imaging.
 * S3 presigned URLs + Bedrock Vision for AI observations.
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { v4: uuidv4 } = require('uuid');
const { BEDROCK_MODEL_ID, HEALTH_DISCLAIMER, IMAGING_TYPES } = require('../../utils/constants');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.S3_ENDPOINT || undefined,
  forcePathStyle: !!process.env.S3_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  },
});

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.BEDROCK_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'test',
    sessionToken: process.env.BEDROCK_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN || undefined,
  },
});

const BUCKET = process.env.IMAGING_BUCKET || 'rural-health-imaging';

/**
 * Generate presigned upload URL.
 */
async function initiateUpload(userId, imagingType, description, contentType = 'application/dicom') {
  if (!IMAGING_TYPES.includes(imagingType)) {
    throw { statusCode: 400, message: `Invalid imaging type. Supported: ${IMAGING_TYPES.join(', ')}` };
  }

  const documentId = uuidv4();
  const s3Key = `uploads/${userId}/${documentId}`;

  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
    Metadata: { userId, imagingType, description: description || '' },
  }), { expiresIn: 3600 });

  return {
    documentId,
    uploadUrl,
    s3Key,
    imagingType,
    status: 'pending_upload',
    expiresIn: '1 hour',
    instructions: [
      `Upload your ${imagingType} image using PUT request to the uploadUrl`,
      'Include Content-Type header matching your file type',
      'After upload, call POST /health/imaging/{id}/analyze to get AI observations',
    ],
  };
}

/**
 * Get document status.
 */
async function getDocumentStatus(documentId) {
  return {
    documentId,
    status: 'uploaded',
    canAnalyze: true,
    disclaimer: HEALTH_DISCLAIMER,
  };
}

/**
 * Analyze uploaded medical image with AI.
 */
async function analyzeImage(documentId, imagingType, userId) {
  let analysis;
  try {
    analysis = await getBedrockAnalysis(imagingType, documentId, userId);
  } catch (err) {
    console.error('[Imaging] Bedrock analysis failed:', err.message);
    throw { statusCode: 503, message: `AI Image Analysis unavailable: ${err.message}` };
  }

  return {
    documentId,
    imagingType,
    analysis,
    disclaimer: HEALTH_DISCLAIMER,
    analyzedAt: new Date().toISOString(),
    recommendation: 'Please share these observations with your doctor for proper interpretation.',
  };
}

async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
  });
}

async function getBedrockAnalysis(imagingType, documentId, userId) {
  let base64Image = null;
  const s3Key = `uploads/${userId}/${documentId}`;

  try {
    const s3Response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    }));
    base64Image = await streamToString(s3Response.Body);
  } catch (err) {
    console.warn(`[WARN] Failed to retrieve image from S3 (${s3Key}):`, err.message);
    throw new Error(`Failed to retrieve image from S3: ${err.message}`);
  }

  let prompt = `You are a medical imaging assistant analyzing a ${imagingType} scan. `;
  prompt += `Review the provided image carefully and provide your observations based ONLY on the visual evidence.`;
  prompt += `

Provide:
1. A general explanation of what this scan shows
2. Specific common findings or abnormalities you observe (or typically look for)
3. What the patient should discuss with their doctor

Return ONLY valid JSON:
{
  "general_info": "What this shows...",
  "common_findings": ["finding1", "finding2"],
  "next_steps": "What to discuss",
  "important_note": "Why professional interpretation is essential"
}

Do NOT provide any binding medical diagnosis.`;

  const messages = [{
    role: 'user',
    content: [
      {
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/jpeg',
          data: base64Image,
        },
      },
      {
        type: 'text',
        text: prompt,
      },
    ],
  }];

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages,
    }),
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const text = body.content?.[0]?.text || '';
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    throw new Error(`Failed to parse AI analysis response: ${parseError.message}`);
  }
}

module.exports = { initiateUpload, getDocumentStatus, analyzeImage };
