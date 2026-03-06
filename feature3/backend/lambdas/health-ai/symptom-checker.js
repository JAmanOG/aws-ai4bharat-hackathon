/**
 * Module 1 — Symptom Pre-Screening (AI-powered triage).
 * Uses Amazon Bedrock (Claude 3 Haiku) with constrained medical prompts.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { BEDROCK_MODEL_ID, DISCLAIMER } = require('../../utils/constants');

const bedrock = new BedrockRuntimeClient({
  region: process.env.AWS_REGION || 'ap-south-1',
  endpoint: process.env.BEDROCK_ENDPOINT,
  credentials: {
    accessKeyId: process.env.BEDROCK_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.BEDROCK_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || 'test',
    sessionToken: process.env.BEDROCK_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN
  }
});

/**
 * Run symptom pre-screening.
 * @param {string} symptoms — free-text symptoms description
 * @param {number} age
 * @param {string} gender
 * @param {string} medicalHistory — optional
 * @param {string} userId
 */
async function checkSymptoms(symptoms, age, gender, medicalHistory, userId) {
  console.log(`[ACTION] Symptom check requested. User: ${userId}, Age: ${age}, Gender: ${gender}`);
  console.log(`[TRACE] Input Symptoms: "${symptoms}" | History: "${medicalHistory || 'None'}"`);

  if (!symptoms || symptoms.trim().length < 5) {
    console.log(`[ACTION] Rejected: symptoms description too short`);
    throw { statusCode: 400, message: 'Please describe your symptoms (at least 5 characters)' };
  }

  let result;
  try {
    console.log(`[TRACE] Invoking Bedrock for triage analysis...`);
    result = await getBedrockTriage(symptoms, age, gender, medicalHistory);
    console.log(`[TRACE] Bedrock Triage Result: ${JSON.stringify(result)}`);
  } catch (err) {
    console.error('[SymptomChecker] Bedrock invocation failed:', err.message);
    throw { statusCode: 503, message: `AI Analysis unavailable: ${err.message}` };
  }

  result.disclaimer = DISCLAIMER;
  result.checked_at = new Date().toISOString();

  // Log for audit
  await logSymptomCheck(userId, symptoms, result);

  return result;
}

/**
 * Call Bedrock Claude for AI-powered triage.
 */
async function getBedrockTriage(symptoms, age, gender, medicalHistory) {
  console.log(`[ACTION] Building triage prompt for Bedrock Claude inference`);
  const prompt = buildTriagePrompt(symptoms, age, gender, medicalHistory);

  console.log(`[ACTION] Executing ModelInvokeCommand on Bedrock (${BEDROCK_MODEL_ID})`);

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
  console.log(`[ACTION] Received ${text.length} chars of completion from Bedrock. Parsing...`);

  return parseTriageResponse(text);
}

/**
 * Build constrained triage prompt.
 */
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

/**
 * Parse Bedrock response text into structured object.
 */
function parseTriageResponse(text) {
  try {
    // Try direct JSON parse
    const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(cleaned);
  } catch {
    // Fallback: extract what we can
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


/**
 * Log symptom check to DynamoDB for audit.
 */
async function logSymptomCheck(userId, symptoms, result) {
  try {
    console.log(`[ACTION] Auditing symptom check to DynamoDB for user ${userId}`);
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
