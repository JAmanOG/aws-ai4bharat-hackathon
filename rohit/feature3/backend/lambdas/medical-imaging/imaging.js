/**
 * Module 2 — Medical Imaging.
 * Metriport SDK for FHIR document management + Bedrock for AI observations.
 */

const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { METRIPORT, BEDROCK_MODEL_ID, DISCLAIMER, IMAGING_TYPES } = require('../../utils/constants');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: !!process.env.S3_ENDPOINT, // Required for LocalStack
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
  }
});
const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.BEDROCK_ENDPOINT,
  credentials: {
    accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'test',
    sessionToken: process.env.BEDROCK_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN
  }
});
const BUCKET = process.env.IMAGING_BUCKET || 'rural-health-imaging';

/**
 * Generate presigned upload URL + register with Metriport if available.
 */
async function initiateUpload(userId, imagingType, description, contentType = 'application/dicom') {
  console.log(`[ACTION] User ${userId} requested medical image upload. Type: ${imagingType}, ContentType: ${contentType}`);
  if (!IMAGING_TYPES.includes(imagingType)) {
    console.log(`[ACTION] Upload rejected: Invalid imaging type ${imagingType}`);
    throw { statusCode: 400, message: `Invalid imaging type. Supported: ${IMAGING_TYPES.join(', ')}` };
  }

  const documentId = uuidv4();
  const s3Key = `uploads/${userId}/${documentId}`;

  // Generate S3 presigned upload URL
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
    Metadata: { userId, imagingType, description: description || '' },
  }), { expiresIn: 3600 });

  let metriportDocId = null;
  try {
    if (METRIPORT.apiKey) {
      metriportDocId = await registerWithMetriport(userId, imagingType, description);
    }
  } catch (err) {
    console.warn('[ACTION] Failed to register with Metriport, continuing without it:', err.message);
  }

  console.log(`[TRACE] Generated S3 Key: ${s3Key} | Document ID: ${documentId}`);
  if (metriportDocId) console.log(`[TRACE] Registered with Metriport. MetriportDocID: ${metriportDocId}`);

  return {
    documentId,
    uploadUrl,
    s3Key,
    metriportDocumentId: metriportDocId,
    imagingType,
    status: 'pending_upload',
    expiresIn: '1 hour',
    instructions: [
      `Upload your ${imagingType} image using PUT request to the uploadUrl`,
      'Include Content-Type header matching your file type',
      'After upload, call POST /imaging/{id}/analyze to get AI observations',
    ],
  };
}

/**
 * Register document with Metriport FHIR API.
 */
async function registerWithMetriport(userId, imagingType, description) {
  console.log(`[ACTION] Registering ${imagingType} document with Metriport FHIR for user ${userId}`);
  const response = await axios.post(
    `${METRIPORT.baseUrl}/medical/v1/document/upload?patientId=${userId}`,
    {
      description: description || `${imagingType} scan`,
      type: {
        text: `Medical ${imagingType.toUpperCase()} Image`,
        coding: [{ code: 'DICOM', system: 'http://terminology.hl7.org/CodeSystem/media-type' }],
      },
      context: {
        period: { start: new Date().toISOString() },
        facilityType: { text: 'Rural Health Center' },
      },
    },
    {
      headers: {
        'x-api-key': METRIPORT.apiKey,
        'Content-Type': 'application/json',
      },
    }
  );
  return response.data?.id || null;
}

/**
 * Get document status.
 */
async function getDocumentStatus(documentId) {
  console.log(`[ACTION] Fetching imaging document status for ID: ${documentId}`);
  // In production, we'd query Metriport + S3 metadata
  // For demo, return synthesized status
  return {
    documentId,
    status: 'uploaded',
    canAnalyze: true,
    disclaimer: DISCLAIMER,
  };
}

/**
 * Analyze uploaded medical image with AI.
 * Uses Bedrock for general observations (NOT diagnosis).
 */
async function analyzeImage(documentId, imagingType, userId) {
  console.log(`[ACTION] Starting AI analysis for imaging document ID: ${documentId} (${imagingType})`);
  let analysis;
  try {
    console.log(`[TRACE] Invoking Bedrock Vision for image analysis...`);
    analysis = await getBedrockAnalysis(imagingType, documentId, userId);
  } catch (err) {
    console.error('[Imaging] Bedrock analysis failed:', err.message);
    throw { statusCode: 503, message: `AI Image Analysis unavailable: ${err.message}` };
  }

  return {
    documentId,
    imagingType,
    analysis: analysis,
    disclaimer: DISCLAIMER,
    analyzedAt: new Date().toISOString(),
    recommendation: 'Please share these observations with your doctor for proper interpretation.',
  };
}

/**
 * Convert S3 stream to base64 string
 */
async function streamToString(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('base64')));
  });
}

/**
 * Bedrock AI analysis prompt for medical imaging using Claude 3 Vision.
 */
async function getBedrockAnalysis(imagingType, documentId, userId) {
  console.log(`[ACTION] Requesting Bedrock vision analysis for imaging type: ${imagingType}, docId: ${documentId}, user: ${userId}`);

  let base64Image = null;
  const s3Key = `uploads/${userId}/${documentId}`;

  try {
    const s3Response = await s3.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    }));
    base64Image = await streamToString(s3Response.Body);
    console.log(`[TRACE] Successfully retrieved image from S3: ${s3Key}`);
  } catch (err) {
    console.warn(`[WARN] Failed to retrieve image from S3 (${s3Key}):`, err.message);
    // If the image doesn't exist (e.g., using simulated UI), we fallback so UI doesn't crash
    throw new Error(`Failed to retrieve image from S3: ${err.message}`);
  }

  let prompt = `You are a medical imaging assistant analyzing a ${imagingType} scan. `;

  if (base64Image) {
    prompt += `Review the provided image carefully and provide your observations based ONLY on the visual evidence.`;
  } else {
    // This branch should ideally not be hit if the S3 retrieval throws an error
    prompt += `Since you cannot actually see the image in this request (file missing from S3), provide general information about this scan type.`;
  }

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
    content: []
  }];

  if (base64Image) {
    messages[0].content.push({
      type: "image",
      source: {
        // Assume jpeg for demo, robust implementation would check content type from S3
        type: "base64",
        media_type: "image/jpeg",
        data: base64Image
      }
    });
  }

  messages[0].content.push({
    type: "text",
    text: prompt
  });

  const command = new InvokeModelCommand({
    // Upgraded to Claude 3 Haiku for vision capabilities
    modelId: 'anthropic.claude-3-haiku-20240307-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: messages,
    }),
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const text = body.content?.[0]?.text || '';
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseError) {
    console.error(`[ERROR] Failed to parse Bedrock response for ${documentId}: ${parseError.message}. Raw text: ${cleaned}`);
    throw new Error(`Failed to parse AI analysis response: ${parseError.message}`);
  }
}


module.exports = { initiateUpload, getDocumentStatus, analyzeImage };
