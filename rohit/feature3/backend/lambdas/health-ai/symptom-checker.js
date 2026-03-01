/**
 * Module 1 — Symptom Pre-Screening (AI-powered triage).
 * Uses Amazon Bedrock (Claude 3 Haiku) with constrained medical prompts.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');
const { dynamoDB, TABLE_NAMES } = require('../../utils/db');
const { BEDROCK_MODEL_ID, DISCLAIMER } = require('../../utils/constants');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

/**
 * Run symptom pre-screening.
 * @param {string} symptoms — free-text symptoms description
 * @param {number} age
 * @param {string} gender
 * @param {string} medicalHistory — optional
 * @param {string} userId
 */
async function checkSymptoms(symptoms, age, gender, medicalHistory, userId) {
  if (!symptoms || symptoms.trim().length < 5) {
    throw { statusCode: 400, message: 'Please describe your symptoms (at least 5 characters)' };
  }

  let result;
  try {
    result = await getBedrockTriage(symptoms, age, gender, medicalHistory);
  } catch (err) {
    console.warn('[SymptomChecker] Bedrock unavailable, using fallback rules:', err.message);
    result = getFallbackTriage(symptoms);
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
 * Keyword-based fallback triage when Bedrock is unavailable.
 */
function getFallbackTriage(symptoms) {
  const s = symptoms.toLowerCase();

  // Emergency keywords
  const emergency = ['chest pain', 'breathing difficulty', 'unconscious', 'seizure', 'heavy bleeding', 'snake bite', 'poisoning'];
  if (emergency.some(k => s.includes(k))) {
    return {
      possible_conditions: ['Potentially serious condition detected'],
      risk_level: 'Critical',
      recommended_action: 'SEEK IMMEDIATE EMERGENCY CARE. Call 108 or go to nearest hospital.',
      urgency: 'emergency',
      home_remedies: [],
      warning_signs: ['Do not delay medical attention'],
    };
  }

  // High risk keywords
  const highRisk = ['high fever', 'blood in', 'severe pain', 'persistent vomiting', 'jaundice', 'swelling'];
  if (highRisk.some(k => s.includes(k))) {
    return {
      possible_conditions: ['Condition requires medical evaluation'],
      risk_level: 'High',
      recommended_action: 'Visit a doctor within 24 hours. If symptoms worsen, go to emergency.',
      urgency: 'urgent',
      home_remedies: ['Stay hydrated', 'Rest'],
      warning_signs: ['Watch for worsening symptoms'],
    };
  }

  // Common conditions
  if (s.includes('fever') || s.includes('cold') || s.includes('cough')) {
    return {
      possible_conditions: ['Common cold/flu', 'Viral infection', 'Seasonal illness'],
      risk_level: 'Low',
      recommended_action: 'Rest and monitor symptoms. Visit doctor if fever persists beyond 3 days.',
      urgency: 'routine',
      home_remedies: ['Drink warm fluids', 'Rest', 'Take paracetamol as directed', 'Steam inhalation for congestion'],
      warning_signs: ['Fever above 103°F', 'Difficulty breathing', 'Symptoms not improving after 3 days'],
    };
  }

  if (s.includes('headache') || s.includes('body pain')) {
    return {
      possible_conditions: ['Tension headache', 'Dehydration', 'Stress-related pain'],
      risk_level: 'Low',
      recommended_action: 'Rest, stay hydrated, and take OTC pain relief. See doctor if persistent.',
      urgency: 'routine',
      home_remedies: ['Drink plenty of water', 'Rest in a dark quiet room', 'Apply cold compress'],
      warning_signs: ['Sudden severe headache', 'Vision changes', 'Neck stiffness'],
    };
  }

  // Default
  return {
    possible_conditions: ['Unable to determine without AI analysis'],
    risk_level: 'Medium',
    recommended_action: 'Please visit your nearest Primary Health Centre (PHC) for proper evaluation.',
    urgency: 'soon',
    home_remedies: ['Stay hydrated', 'Rest'],
    warning_signs: ['If symptoms worsen or new symptoms appear, seek medical care'],
  };
}

/**
 * Log symptom check to DynamoDB for audit.
 */
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

module.exports = { checkSymptoms, getFallbackTriage, buildTriagePrompt, parseTriageResponse };
