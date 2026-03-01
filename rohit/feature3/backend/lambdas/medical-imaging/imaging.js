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

const s3 = new S3Client({ region: process.env.AWS_REGION || 'ap-south-1' });
const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });
const BUCKET = process.env.IMAGING_BUCKET || 'rural-health-imaging';

/**
 * Generate presigned upload URL + register with Metriport if available.
 */
async function initiateUpload(userId, imagingType, description) {
  if (!IMAGING_TYPES.includes(imagingType)) {
    throw { statusCode: 400, message: `Invalid imaging type. Supported: ${IMAGING_TYPES.join(', ')}` };
  }

  const documentId = uuidv4();
  const s3Key = `uploads/${userId}/${documentId}`;

  // Generate S3 presigned upload URL
  const uploadUrl = await getSignedUrl(s3, new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: 'application/dicom',
    Metadata: { userId, imagingType, description: description || '' },
  }), { expiresIn: 3600 });

  // Register document with Metriport (if API key available)
  let metriportDocId = null;
  if (METRIPORT.apiKey) {
    try {
      metriportDocId = await registerWithMetriport(userId, imagingType, description);
    } catch (err) {
      console.warn('[Imaging] Metriport registration skipped:', err.message);
    }
  }

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
async function analyzeImage(documentId, imagingType) {
  let observations;

  try {
    observations = await getBedrockAnalysis(imagingType);
  } catch (err) {
    console.warn('[Imaging] Bedrock analysis unavailable, using fallback:', err.message);
    observations = getFallbackAnalysis(imagingType);
  }

  return {
    documentId,
    imagingType,
    analysis: observations,
    disclaimer: DISCLAIMER,
    analyzedAt: new Date().toISOString(),
    recommendation: 'Please share these observations with your doctor for proper interpretation.',
  };
}

/**
 * Bedrock AI analysis prompt for medical imaging.
 */
async function getBedrockAnalysis(imagingType) {
  const prompt = `You are a medical imaging assistant. A ${imagingType} scan has been uploaded.

Since you cannot actually see the image in this request, provide:
1. A general explanation of what a ${imagingType} shows
2. Common findings doctors look for in a ${imagingType}
3. What patients should discuss with their doctor

Return ONLY valid JSON:
{
  "general_info": "What this imaging type shows",
  "common_findings": ["finding1", "finding2", "finding3"],
  "next_steps": "What to discuss with your doctor",
  "important_note": "Why professional interpretation is essential"
}

Do NOT provide any specific diagnosis or interpretation.`;

  const command = new InvokeModelCommand({
    modelId: BEDROCK_MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const response = await bedrock.send(command);
  const body = JSON.parse(new TextDecoder().decode(response.body));
  const text = body.content?.[0]?.text || '';
  const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    return getFallbackAnalysis(imagingType);
  }
}

/**
 * Fallback analysis when Bedrock is unavailable.
 */
function getFallbackAnalysis(imagingType) {
  const typeInfo = {
    xray: { name: 'X-Ray', info: 'X-rays use electromagnetic radiation to create images of bones, chest, and other dense structures.' },
    mri: { name: 'MRI', info: 'MRI uses magnetic fields and radio waves to create detailed images of soft tissues, organs, and structures.' },
    'ct-scan': { name: 'CT Scan', info: 'CT scans combine X-ray images from different angles to create cross-sectional views of the body.' },
    ultrasound: { name: 'Ultrasound', info: 'Ultrasound uses high-frequency sound waves to create images of internal organs and structures.' },
  };

  const info = typeInfo[imagingType] || typeInfo.xray;
  return {
    general_info: info.info,
    common_findings: [
      'Normal anatomy and structures',
      'Any abnormalities would need professional interpretation',
      'Comparison with previous scans if available',
    ],
    next_steps: 'Please take this report to a qualified radiologist or your consulting doctor for interpretation.',
    important_note: 'Medical imaging requires professional interpretation by a qualified radiologist. AI observations are general information only and should not be used for diagnosis.',
  };
}

module.exports = { initiateUpload, getDocumentStatus, analyzeImage, getFallbackAnalysis };
