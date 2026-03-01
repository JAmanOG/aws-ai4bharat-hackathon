/**
 * Module 3 — Government Health Portals.
 * Curated data from Aurora + AI-powered eligibility checking.
 */

const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');
const { query } = require('../../utils/db');
const { BEDROCK_MODEL_ID, DISCLAIMER } = require('../../utils/constants');

const bedrock = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'ap-south-1' });

/**
 * List government health portals with optional filters.
 */
async function listPortals(category, search) {
  let sql = `SELECT * FROM health_portals WHERE 1=1`;
  const params = [];
  let idx = 1;

  if (category) {
    sql += ` AND category = $${idx++}`;
    params.push(category);
  }
  if (search) {
    sql += ` AND (name ILIKE $${idx} OR description ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }

  sql += ' ORDER BY name';
  const result = await query(sql, params);
  return result.rows;
}

/**
 * Get portal by ID.
 */
async function getPortal(portalId) {
  const result = await query('SELECT * FROM health_portals WHERE id = $1', [portalId]);
  return result.rows[0] || null;
}

/**
 * AI-powered eligibility check for government schemes.
 */
async function checkEligibility(userInfo) {
  const { age, income, familySize, location, bplCard, aadhaar } = userInfo;

  if (!age || !location) {
    throw { statusCode: 400, message: 'Age and location are required for eligibility check' };
  }

  // Get all portals for context
  const portals = await query('SELECT name, category, eligibility_criteria, services_offered FROM health_portals');

  let result;
  try {
    result = await getBedrockEligibility(userInfo, portals.rows);
  } catch (err) {
    console.warn('[Eligibility] Bedrock unavailable, using rule-based check:', err.message);
    result = getRuleBasedEligibility(userInfo, portals.rows);
  }

  result.disclaimer = DISCLAIMER;
  return result;
}

/**
 * Bedrock-powered eligibility assessment.
 */
async function getBedrockEligibility(userInfo, portals) {
  const portalSummary = portals.map(p =>
    `${p.name} (${p.category}): ${JSON.stringify(p.eligibility_criteria)}`
  ).join('\n');

  const prompt = `You are a government scheme eligibility advisor for rural India.

User Information:
- Age: ${userInfo.age}
- Monthly Income: ${userInfo.income || 'Not provided'}
- Family Size: ${userInfo.familySize || 'Not provided'}
- Location: ${userInfo.location}
- BPL Card: ${userInfo.bplCard ? 'Yes' : 'No/Unknown'}
- Aadhaar: ${userInfo.aadhaar ? 'Available' : 'Not provided'}

Available Government Health Schemes:
${portalSummary}

Return ONLY valid JSON:
{
  "eligible_schemes": [
    {"name": "scheme name", "likely_eligible": true, "reason": "why eligible", "next_steps": "what to do"}
  ],
  "documents_needed": ["doc1", "doc2"],
  "nearest_help": "Where to go for enrollment assistance"
}`;

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
    return getRuleBasedEligibility(userInfo, portals);
  }
}

/**
 * Rule-based eligibility fallback.
 */
function getRuleBasedEligibility(userInfo, portals) {
  const eligible = [];

  // eSanjeevani — everyone
  eligible.push({ name: 'eSanjeevani', likely_eligible: true, reason: 'Free telemedicine for all citizens', next_steps: 'Register at esanjeevani.in' });

  // Ayushman Bharat — BPL families
  if (userInfo.bplCard || (userInfo.income && parseInt(userInfo.income) < 15000)) {
    eligible.push({ name: 'Ayushman Bharat (PM-JAY)', likely_eligible: true, reason: 'BPL/low income family', next_steps: 'Check at mera.pmjay.gov.in or call 14555' });
  }

  // Jan Aushadhi — everyone
  eligible.push({ name: 'Jan Aushadhi Kendras', likely_eligible: true, reason: 'Generic medicines available to all', next_steps: 'Find nearest kendra at janaushadhi.gov.in' });

  // NHM — pregnant women, children
  if (userInfo.age < 18 || (userInfo.gender === 'female' && userInfo.age >= 18 && userInfo.age <= 45)) {
    eligible.push({ name: 'National Health Mission', likely_eligible: true, reason: 'Priority for maternal/child health', next_steps: 'Contact nearest ASHA worker or PHC' });
  }

  return {
    eligible_schemes: eligible,
    documents_needed: ['Aadhaar Card', 'Ration Card (if BPL)', 'Mobile Number'],
    nearest_help: 'Visit your nearest Common Service Centre (CSC) or Primary Health Centre (PHC) for enrollment assistance.',
  };
}

module.exports = { listPortals, getPortal, checkEligibility };
