/**
 * Symptom Pre-Screening (AI-powered triage).
 * Uses Amazon Bedrock (Claude 3 Haiku) with constrained medical prompts.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { BEDROCK_MODEL_ID, GEMINI_MODEL, GEMINI_API_KEY, HEALTH_DISCLAIMER } = require('../../utils/constants');

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.BEDROCK_ENDPOINT || undefined,
  credentials: {
    accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'test',
    sessionToken: process.env.BEDROCK_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN || undefined,
  },
});

/**
 * Run symptom pre-screening.
 */
async function checkSymptoms(symptoms, age, gender, medicalHistory, userId) {
  const normalizedSymptoms = Array.isArray(symptoms)
    ? symptoms.map((entry) => String(entry || '').trim()).filter(Boolean).join(', ')
    : String(symptoms || '').trim();

  if (!normalizedSymptoms || normalizedSymptoms.length < 5) {
    throw { statusCode: 400, message: 'Please describe your symptoms (at least 5 characters)' };
  }

  let result;
  try {
    result = await getBedrockTriage(normalizedSymptoms, age, gender, medicalHistory);
  } catch (bedrockErr) {
    console.warn('[SymptomChecker] Bedrock failed, trying Gemini fallback:', bedrockErr.message);
    try {
      result = await getGeminiTriage(normalizedSymptoms, age, gender, medicalHistory);
    } catch (geminiErr) {
      console.error('[SymptomChecker] Gemini fallback also failed:', geminiErr.message);
      throw { statusCode: 503, message: `AI Analysis unavailable: Bedrock: ${bedrockErr.message}, Gemini: ${geminiErr.message}` };
    }
  }

  result.disclaimer = HEALTH_DISCLAIMER;
  result.checked_at = new Date().toISOString();

  await logSymptomCheck(userId, normalizedSymptoms, result);
  return result;
}

async function getBedrockTriage(symptoms, age, gender, medicalHistory) {
  const prompt = buildTriagePrompt(symptoms, age, gender, medicalHistory);

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
  return parseTriageResponse(text);
}

function buildTriagePrompt(symptoms, age, gender, medicalHistory) {
  return `You are a rural primary healthcare triage assistant for India.

Patient Information:
- Symptoms: ${symptoms}
- Age: ${age || 'Not provided'}
- Gender: ${gender || 'Not provided'}
- Medical History: ${medicalHistory || 'None provided'}

Provide your assessment in EXACTLY this JSON format (no markdown, just raw JSON):
{
  "possible_conditions": ["condition1", "condition2", "condition3"],
  "risk_level": "Low|Medium|High|Critical",
  "recommended_action": "Clear action step",
  "urgency": "routine|soon|urgent|emergency",
  "home_remedies": ["remedy1", "remedy2"],
  "warning_signs": ["sign that needs immediate attention"]
}

Rules:
- List top 3 most likely conditions only
- Be conservative: if unsure, rate risk higher
- Recommend doctor visit for Medium or higher
- Include practical home remedies for Low risk cases
- Do NOT provide a definitive diagnosis
- Keep language simple for rural users`;
}

function parseTriageResponse(text) {
  try {
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      possible_conditions: ['Unable to determine — please consult a doctor'],
      risk_level: 'Medium',
      recommended_action: 'Please visit your nearest healthcare center for a proper diagnosis.',
      urgency: 'soon',
      home_remedies: [],
      warning_signs: ['If symptoms worsen, seek emergency care immediately'],
    };
  }
}

async function logSymptomCheck(userId, symptoms, result) {
  try {
    await dynamoDB.send(new PutCommand({
      TableName: TABLE_NAMES.SYMPTOM_LOGS,
      Item: {
        userId: userId || 'anonymous',
        checkedAt: new Date().toISOString(),
        logId: uuidv4(),
        symptoms,
        riskLevel: result.risk_level,
        conditions: result.possible_conditions,
        ttl: Math.floor(Date.now() / 1000) + (90 * 24 * 60 * 60),
      },
    }));
  } catch (err) {
    console.error('[SymptomLog] Failed:', err.message);
  }
}

module.exports = { checkSymptoms, buildTriagePrompt, parseTriageResponse };

/**
 * Gemini fallback for symptom triage.
 */
async function getGeminiTriage(symptoms, age, gender, medicalHistory) {
  const apiKey = GEMINI_API_KEY();
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const prompt = buildTriagePrompt(symptoms, age, gender, medicalHistory);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseTriageResponse(text);
}
