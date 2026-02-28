/**
 * Constants for Health Services.
 */

const BEDROCK_MODEL_ID = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-haiku-20240307-v1:0';

const METRIPORT = {
  apiKey: process.env.METRIPORT_API_KEY || '',
  baseUrl: process.env.METRIPORT_BASE_URL || 'https://api.sandbox.metriport.com',
  facilityId: process.env.METRIPORT_FACILITY_ID || '',
};

const RISK_LEVELS = ['Low', 'Medium', 'High', 'Critical'];

const HEALTH_TOPICS = [
  'diabetes', 'hypertension', 'malaria', 'dengue', 'tuberculosis',
  'anemia', 'nutrition', 'maternal-health', 'child-health', 'sanitation',
  'mental-health', 'first-aid', 'vaccination', 'covid-19', 'waterborne-diseases',
];

const PROVIDER_TYPES = ['hospital', 'pharmacy', 'telemedicine', 'lab', 'clinic', 'govt-hospital'];

const IMAGING_TYPES = ['xray', 'mri', 'ct-scan', 'ultrasound'];

const DISCLAIMER = 'This is not a medical diagnosis. AI-generated observations are for informational purposes only. Please consult a certified healthcare professional for medical advice.';

module.exports = { BEDROCK_MODEL_ID, METRIPORT, RISK_LEVELS, HEALTH_TOPICS, PROVIDER_TYPES, IMAGING_TYPES, DISCLAIMER };
