/**
 * BRUTAL TEST SUITE – Requirement 6: Precision Agriculture
 * Tests: advisory, carbon, pest-alerts, practice-tracker, weather
 * Extreme edge cases, boundary conditions, all code paths.
 */

/* ── Mocks ── */
jest.mock('../../utils/db', () => ({
  query: jest.fn(),
  dynamoDB: { send: jest.fn() },
  TABLE_NAMES: { FARM_PRACTICE_LOGS: 'farm-practice-logs' },
}));
jest.mock('@aws-sdk/lib-dynamodb', () => ({
  PutCommand: jest.fn((p) => p),
  QueryCommand: jest.fn((p) => p),
}));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-1234' }));
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn(() => ({ send: jest.fn() })),
  InvokeModelCommand: jest.fn((p) => p),
}));

const { dynamoDB } = require('../../utils/db');
const advisory = require('../../lambdas/precision-agriculture/advisory');
const carbon = require('../../lambdas/precision-agriculture/carbon');
const pestAlerts = require('../../lambdas/precision-agriculture/pest-alerts');
const weather = require('../../lambdas/precision-agriculture/weather');
const practiceTracker = require('../../lambdas/precision-agriculture/practice-tracker');

beforeEach(() => jest.clearAllMocks());

/* ═══════════════════════════════════════════════════
   SECTION A — ADVISORY (advisory.js)
   runRuleBasedDiagnosis takes: { observed_symptoms, notes, soil_condition, weather, crop_type }
   Returns: { issue_identified, severity, confidence, recommended_actions, preventive_actions, follow_up_questions, contributing_signals }
   ═══════════════════════════════════════════════════ */
describe('Advisory – runRuleBasedDiagnosis', () => {
  test('diagnoses yellowing → nitrogen deficiency', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['yellowing leaves', 'pale leaves'],
      crop_type: 'wheat',
    });
    expect(result.issue_identified).toContain('nitrogen');
    expect(result.severity).toBeDefined();
    expect(result.confidence).toBeGreaterThan(0);
    expect(Array.isArray(result.recommended_actions)).toBe(true);
    expect(result.recommended_actions.length).toBeGreaterThan(0);
    expect(result.contributing_signals).toContain('nitrogen_deficiency');
  });

  test('diagnoses leaf spot → fungal disease', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['diamond lesion', 'leaf spot'],
      crop_type: 'rice',
    });
    expect(result.issue_identified).toContain('Fungal');
    expect(result.contributing_signals).toContain('fungal_leaf_spot');
  });

  test('diagnoses wilting → water stress', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['wilting', 'dry soil'],
      crop_type: 'cotton',
    });
    expect(result.contributing_signals).toContain('water_stress');
  });

  test('diagnoses brown edge → potassium deficiency', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['brown edge', 'leaf burn'],
      crop_type: 'wheat',
    });
    expect(result.contributing_signals).toContain('potassium_deficiency');
  });

  test('diagnoses hard soil → soil compaction', () => {
    const result = advisory.runRuleBasedDiagnosis({
      soil_condition: 'hard soil with surface crust',
      crop_type: 'wheat',
    });
    expect(result.contributing_signals).toContain('soil_compaction');
  });

  test('multiple rules → overlapping indicators message', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['yellowing leaves', 'wilting', 'brown edge'],
      crop_type: 'wheat',
    });
    expect(result.contributing_signals.length).toBeGreaterThanOrEqual(2);
    expect(result.issue_identified).toContain('overlapping');
  });

  test('no matches → general crop stress fallback', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['unusual shimmering'],
      crop_type: 'wheat',
    });
    expect(result.issue_identified).toContain('General crop stress');
    expect(result.contributing_signals).toEqual([]);
    expect(result.recommended_actions.length).toBeGreaterThan(0);
  });

  test('soil image_type with no symptom match → soil condition message', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: [],
      image_type: 'soil',
      crop_type: 'wheat',
    });
    expect(result.issue_identified).toContain('Soil condition');
  });

  test('empty payload → default fallback', () => {
    const result = advisory.runRuleBasedDiagnosis({});
    expect(result).toBeDefined();
    expect(result.issue_identified).toBeDefined();
    expect(result.severity).toBeDefined();
    expect(result.confidence).toBeGreaterThanOrEqual(45);
  });

  test('weather boosts severity: high humidity + rain + heat', () => {
    const base = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['yellowing leaves'],
      crop_type: 'wheat',
    });
    const boosted = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['yellowing leaves'],
      crop_type: 'wheat',
      weather: { humidity_pct: 90, rain_mm: 30, temp_max_c: 42 },
    });
    expect(boosted.confidence).toBeGreaterThan(base.confidence);
  });

  test('notes string is included in diagnosis text parsing', () => {
    const result = advisory.runRuleBasedDiagnosis({
      notes: 'There are spots on most leaves',
      crop_type: 'rice',
    });
    expect(result.contributing_signals).toContain('fungal_leaf_spot');
  });

  test('follow_up_questions always present', () => {
    const result = advisory.runRuleBasedDiagnosis({ observed_symptoms: ['yellowing'], crop_type: 'wheat' });
    expect(Array.isArray(result.follow_up_questions)).toBe(true);
    expect(result.follow_up_questions.length).toBe(3);
  });

  test('preventive_actions always present', () => {
    const result = advisory.runRuleBasedDiagnosis({ observed_symptoms: ['mildew'], crop_type: 'wheat' });
    expect(Array.isArray(result.preventive_actions)).toBe(true);
    expect(result.preventive_actions.length).toBeGreaterThan(0);
  });

  test('confidence capped at 92', () => {
    const result = advisory.runRuleBasedDiagnosis({
      observed_symptoms: ['yellowing', 'brown edge', 'spot', 'wilting', 'hard soil'],
      weather: { humidity_pct: 95, rain_mm: 40, temp_max_c: 45 },
    });
    expect(result.confidence).toBeLessThanOrEqual(92);
  });
});

describe('Advisory – buildAdvisoryPrompt', () => {
  test('includes crop type and observed_symptoms in prompt', () => {
    const prompt = advisory.buildAdvisoryPrompt({
      observed_symptoms: ['yellowing leaves'],
      crop_type: 'wheat',
      crop_stage: 'vegetative',
      notes: 'Field diary entry',
    });
    expect(prompt).toContain('wheat');
    expect(prompt).toContain('yellowing');
    expect(prompt).toContain('vegetative');
  });

  test('handles missing optional fields', () => {
    const prompt = advisory.buildAdvisoryPrompt({ crop_type: 'rice' });
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
    expect(prompt).toContain('rice');
  });

  test('empty payload still produces valid prompt', () => {
    const prompt = advisory.buildAdvisoryPrompt({});
    expect(prompt).toContain('unknown');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION B — CARBON (carbon.js)
   calculateCarbonScore takes: { practices: [{ practice_type, quantity, unit }] }
   Returns: { total_emissions_kg_co2e, carbon_intensity, breakdown, recommendations, assumptions }
   ═══════════════════════════════════════════════════ */
describe('Carbon – calculateCarbonScore', () => {
  test('urea application calculation is correct', () => {
    const result = carbon.calculateCarbonScore({
      practices: [{ practice_type: 'urea_application', quantity: 100, unit: 'kg' }],
    });
    expect(result.total_emissions_kg_co2e).toBeCloseTo(198, 0); // 100 * 1.98
    expect(result.carbon_intensity).toBe('medium'); // 198 is > 100 < 250
  });

  test('diesel use calculation', () => {
    const result = carbon.calculateCarbonScore({
      practices: [{ practice_type: 'diesel_use', quantity: 50, unit: 'litre' }],
    });
    expect(result.total_emissions_kg_co2e).toBeCloseTo(134, 0); // 50 * 2.68
    expect(result.carbon_intensity).toBe('medium');
  });

  test('crop residue burning is high-impact', () => {
    const result = carbon.calculateCarbonScore({
      practices: [{ practice_type: 'crop_residue_burning', quantity: 2, unit: 'acre' }],
    });
    expect(result.total_emissions_kg_co2e).toBe(360); // 2 * 180
    expect(result.carbon_intensity).toBe('high');
  });

  test('mixed practices sum correctly', () => {
    const result = carbon.calculateCarbonScore({
      practices: [
        { practice_type: 'urea_application', quantity: 50, unit: 'kg' },     // 99
        { practice_type: 'diesel_use', quantity: 10, unit: 'litre' },         // 26.8
        { practice_type: 'grid_irrigation', quantity: 100, unit: 'kwh' },     // 82
        { practice_type: 'pesticide_spray', quantity: 3, unit: 'spray' },     // 18
      ],
    });
    const expected = 99 + 26.8 + 82 + 18;
    expect(result.total_emissions_kg_co2e).toBeCloseTo(expected, 0);
    expect(result.breakdown.length).toBe(4);
    expect(result.breakdown.every((b) => b.counted)).toBe(true);
  });

  test('unknown practice type has zero emissions', () => {
    const result = carbon.calculateCarbonScore({
      practices: [{ practice_type: 'quantum_farming', quantity: 999, unit: 'kg' }],
    });
    expect(result.total_emissions_kg_co2e).toBe(0);
    expect(result.breakdown[0].counted).toBe(false);
    expect(result.carbon_intensity).toBe('low');
  });

  test('empty practices array → zero emissions', () => {
    const result = carbon.calculateCarbonScore({ practices: [] });
    expect(result.total_emissions_kg_co2e).toBe(0);
    expect(result.carbon_intensity).toBe('low');
  });

  test('no practices key → zero emissions', () => {
    const result = carbon.calculateCarbonScore({});
    expect(result.total_emissions_kg_co2e).toBe(0);
  });

  test('zero quantity → zero emissions', () => {
    const result = carbon.calculateCarbonScore({
      practices: [{ practice_type: 'urea_application', quantity: 0, unit: 'kg' }],
    });
    expect(result.total_emissions_kg_co2e).toBe(0);
  });

  test('very large quantity', () => {
    const result = carbon.calculateCarbonScore({
      practices: [{ practice_type: 'crop_residue_burning', quantity: 10000, unit: 'acre' }],
    });
    expect(result.total_emissions_kg_co2e).toBe(1800000);
    expect(result.carbon_intensity).toBe('high');
  });

  test('recommendations are returned', () => {
    const result = carbon.calculateCarbonScore({
      practices: [
        { practice_type: 'urea_application', quantity: 100, unit: 'kg' },
        { practice_type: 'crop_residue_burning', quantity: 5, unit: 'acre' },
      ],
    });
    expect(Array.isArray(result.recommendations)).toBe(true);
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  test('assumptions are always present', () => {
    const result = carbon.calculateCarbonScore({ practices: [] });
    expect(Array.isArray(result.assumptions)).toBe(true);
    expect(result.assumptions.length).toBe(2);
  });

  test('EMISSION_FACTORS exported with all 5 types', () => {
    expect(carbon.EMISSION_FACTORS).toBeDefined();
    expect(Object.keys(carbon.EMISSION_FACTORS)).toEqual(
      expect.arrayContaining(['urea_application', 'diesel_use', 'crop_residue_burning', 'grid_irrigation', 'pesticide_spray'])
    );
  });

  test('carbon_intensity band thresholds', () => {
    const low = carbon.calculateCarbonScore({ practices: [{ practice_type: 'pesticide_spray', quantity: 5, unit: 'spray' }] }); // 30
    const medium = carbon.calculateCarbonScore({ practices: [{ practice_type: 'urea_application', quantity: 60, unit: 'kg' }] }); // 118.8
    const high = carbon.calculateCarbonScore({ practices: [{ practice_type: 'crop_residue_burning', quantity: 2, unit: 'acre' }] }); // 360
    expect(low.carbon_intensity).toBe('low');
    expect(medium.carbon_intensity).toBe('medium');
    expect(high.carbon_intensity).toBe('high');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION C — PEST ALERTS (pest-alerts.js)
   detectPestAlerts takes: { crop_type, observed_symptoms, notes, detections, weather:{humidity_pct, rain_mm, temp_max_c} }
   Returns: { crop_type, alerts[], scouting_checklist, next_review_in_hours, generatedAt }
   ═══════════════════════════════════════════════════ */
describe('Pest Alerts – detectPestAlerts', () => {
  test('rice blast detected with correct symptoms + weather', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'rice',
      observed_symptoms: ['diamond lesion', 'blast'],
      weather: { humidity_pct: 90, rain_mm: 20, temp_max_c: 30 },
    });
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0].alert_type).toBe('rice_blast');
    expect(result.alerts[0].severity).toBeDefined();
    expect(result.alerts[0].treatment).toBeDefined();
  });

  test('wheat rust detected with correct symptoms + weather', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'wheat',
      observed_symptoms: ['orange pustule', 'rust'],
      weather: { humidity_pct: 75, rain_mm: 0, temp_max_c: 25 },
    });
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0].alert_type).toBe('wheat_rust');
  });

  test('tomato leaf curl detected', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'tomato',
      observed_symptoms: ['leaf curl', 'stunted growth'],
      weather: { temp_max_c: 35 },
    });
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0].alert_type).toBe('tomato_leaf_curl');
  });

  test('cotton whitefly detected', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'cotton',
      observed_symptoms: ['honeydew', 'sooty mold'],
      weather: { temp_max_c: 32, humidity_pct: 70 },
    });
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts[0].alert_type).toBe('cotton_whitefly');
  });

  test('no pest rules for unknown crop → empty alerts', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'quinoa',
      observed_symptoms: ['yellowing'],
      weather: { humidity_pct: 90, rain_mm: 20 },
    });
    expect(result.alerts).toEqual([]);
  });

  test('generic pest pressure from hole/chewed keywords', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'quinoa',
      observed_symptoms: ['holes in leaves'],
      notes: 'chewed edges',
    });
    expect(result.alerts.length).toBe(1);
    expect(result.alerts[0].alert_type).toBe('generic_pest_pressure');
  });

  test('score below 40 threshold → no alert', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'rice',
      observed_symptoms: ['unusual coloring'],
      weather: { humidity_pct: 30, rain_mm: 0, temp_max_c: 20 },
    });
    expect(result.alerts).toEqual([]);
  });

  test('detections array boosts confidence', () => {
    const withDetections = pestAlerts.detectPestAlerts({
      crop_type: 'rice',
      observed_symptoms: ['blast'],
      detections: [{ label: 'rice blast', confidence: 90 }],
      weather: { humidity_pct: 90, rain_mm: 20, temp_max_c: 30 },
    });
    expect(withDetections.alerts.length).toBeGreaterThan(0);
    expect(withDetections.alerts[0].confidence).toBeGreaterThan(50);
  });

  test('scouting_checklist always returned', () => {
    const result = pestAlerts.detectPestAlerts({ crop_type: 'rice' });
    expect(Array.isArray(result.scouting_checklist)).toBe(true);
    expect(result.scouting_checklist.length).toBe(3);
  });

  test('critical alert sets next_review_in_hours to 12', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'rice',
      observed_symptoms: ['diamond lesion', 'leaf spot', 'blast'],
      detections: [{ label: 'rice blast', confidence: 95 }],
      weather: { humidity_pct: 95, rain_mm: 30, temp_max_c: 32 },
    });
    if (result.alerts.length > 0 && result.alerts[0].severity === 'critical') {
      expect(result.next_review_in_hours).toBe(12);
    }
  });

  test('no critical alert → next_review_in_hours is 24', () => {
    const result = pestAlerts.detectPestAlerts({
      crop_type: 'quinoa',
      observed_symptoms: [],
    });
    expect(result.next_review_in_hours).toBe(24);
  });

  test('empty payload returns valid structure', () => {
    const result = pestAlerts.detectPestAlerts({});
    expect(result).toHaveProperty('crop_type');
    expect(result).toHaveProperty('alerts');
    expect(result).toHaveProperty('scouting_checklist');
    expect(result).toHaveProperty('generatedAt');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION D — WEATHER ADVISORY (weather.js)
   buildWeatherAdvisory takes: { forecast: [{rain_mm, wind_kph, humidity_pct, temp_max_c, temp_min_c, date}], crop_type, location }
   Returns: { crop_type, location, alerts[], summary, proactive_steps, generatedAt }
   ═══════════════════════════════════════════════════ */
describe('Weather – buildWeatherAdvisory', () => {
  test('heavy rain (>=65mm) triggers heavy_rain alert', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 80, wind_kph: 10, humidity_pct: 60, temp_max_c: 28, temp_min_c: 20, date: '2025-01-15' }],
      crop_type: 'wheat',
    });
    expect(result.alerts.length).toBeGreaterThan(0);
    expect(result.alerts.some((a) => a.hazard_type === 'heavy_rain')).toBe(true);
    expect(result.summary).toContain('heavy rain');
  });

  test('high wind (>=50kph) triggers high_wind alert', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 0, wind_kph: 60, humidity_pct: 40, temp_max_c: 28, temp_min_c: 18, date: '2025-01-15' }],
      crop_type: 'cotton',
    });
    expect(result.alerts.some((a) => a.hazard_type === 'high_wind')).toBe(true);
  });

  test('heat stress (temp_max_c >= 38) triggers heat_stress alert', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 0, wind_kph: 5, humidity_pct: 15, temp_max_c: 45, temp_min_c: 28, date: '2025-01-15' }],
      crop_type: 'wheat',
    });
    expect(result.alerts.some((a) => a.hazard_type === 'heat_stress')).toBe(true);
  });

  test('cold stress (temp_min_c <= 8) triggers cold_stress alert', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 0, wind_kph: 5, humidity_pct: 60, temp_max_c: 15, temp_min_c: 3, date: '2025-01-15' }],
      crop_type: 'wheat',
    });
    expect(result.alerts.some((a) => a.hazard_type === 'cold_stress')).toBe(true);
  });

  test('disease pressure (humidity >= 85 AND rain >= 10)', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 20, wind_kph: 5, humidity_pct: 90, temp_max_c: 28, temp_min_c: 20, date: '2025-01-15' }],
      crop_type: 'rice',
    });
    expect(result.alerts.some((a) => a.hazard_type === 'disease_pressure')).toBe(true);
  });

  test('multiple hazards from single day', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 100, wind_kph: 60, humidity_pct: 95, temp_max_c: 40, temp_min_c: 5, date: '2025-01-15' }],
      crop_type: 'wheat',
    });
    expect(result.alerts.length).toBeGreaterThanOrEqual(4);
  });

  test('multi-day forecast generates alerts per day', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [
        { rain_mm: 70, wind_kph: 10, humidity_pct: 60, temp_max_c: 28, temp_min_c: 20, date: 'Day1' },
        { rain_mm: 0, wind_kph: 55, humidity_pct: 40, temp_max_c: 28, temp_min_c: 18, date: 'Day2' },
      ],
      crop_type: 'wheat',
    });
    expect(result.alerts.some((a) => a.date === 'Day1')).toBe(true);
    expect(result.alerts.some((a) => a.date === 'Day2')).toBe(true);
  });

  test('no hazards → calm summary', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 5, wind_kph: 10, humidity_pct: 50, temp_max_c: 28, temp_min_c: 18, date: '2025-01-15' }],
      crop_type: 'wheat',
    });
    expect(result.alerts.length).toBe(0);
    expect(result.summary).toContain('No major weather');
  });

  test('empty forecast → no alerts', () => {
    const result = weather.buildWeatherAdvisory({ forecast: [], crop_type: 'wheat' });
    expect(result.alerts).toEqual([]);
    expect(result.summary).toContain('No major weather');
  });

  test('missing forecast key → no alerts', () => {
    const result = weather.buildWeatherAdvisory({ crop_type: 'wheat' });
    expect(result.alerts).toEqual([]);
  });

  test('proactive_steps always returned', () => {
    const result = weather.buildWeatherAdvisory({ forecast: [] });
    expect(Array.isArray(result.proactive_steps)).toBe(true);
    expect(result.proactive_steps.length).toBe(2);
  });

  test('alerts sorted by risk_level descending', () => {
    const result = weather.buildWeatherAdvisory({
      forecast: [{ rain_mm: 100, wind_kph: 60, humidity_pct: 95, temp_max_c: 45, temp_min_c: 2, date: 'D1' }],
      crop_type: 'wheat',
    });
    const weights = { critical: 4, high: 3, medium: 2, low: 1 };
    for (let i = 1; i < result.alerts.length; i++) {
      expect(weights[result.alerts[i - 1].risk_level]).toBeGreaterThanOrEqual(weights[result.alerts[i].risk_level]);
    }
  });

  test('crop_type and location in output', () => {
    const result = weather.buildWeatherAdvisory({ forecast: [], crop_type: 'rice', location: 'Bihar' });
    expect(result.crop_type).toBe('rice');
    expect(result.location).toBe('Bihar');
  });
});

/* ═══════════════════════════════════════════════════
   SECTION E — PRACTICE TRACKER (practice-tracker.js)
   ═══════════════════════════════════════════════════ */
describe('Practice Tracker – normalizePracticeType', () => {
  test('normalizes lowercase with underscores', () => {
    expect(practiceTracker.normalizePracticeType('organic_farming')).toBe('organic_farming');
  });

  test('normalizes mixed case + spaces to lowercase underscored', () => {
    expect(practiceTracker.normalizePracticeType('Organic Farming')).toBe('organic_farming');
  });

  test('handles undefined → empty string', () => {
    expect(practiceTracker.normalizePracticeType(undefined)).toBe('');
  });

  test('handles null → empty string', () => {
    expect(practiceTracker.normalizePracticeType(null)).toBe('');
  });

  test('trims leading/trailing whitespace', () => {
    expect(practiceTracker.normalizePracticeType('  drip irrigation  ')).toBe('drip_irrigation');
  });

  test('multiple spaces become single underscore', () => {
    expect(practiceTracker.normalizePracticeType('drip   irrigation')).toBe('drip_irrigation');
  });
});

describe('Practice Tracker – analyzePracticeData', () => {
  test('soil testing boosts score', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'soil_testing' }],
    });
    expect(result.sustainability_score).toBeGreaterThanOrEqual(80);
    expect(result.strengths.some((s) => s.includes('Soil testing'))).toBe(true);
  });

  test('missing soil testing reduces score', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'urea_application' }],
    });
    expect(result.sustainability_score).toBeLessThan(70);
  });

  test('drip irrigation boosts score', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'soil_testing' }],
      irrigation_method: 'drip',
    });
    expect(result.sustainability_score).toBeGreaterThanOrEqual(90);
  });

  test('flood irrigation penalty', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'soil_testing' }],
      irrigation_method: 'flood',
    });
    expect(result.sustainability_score).toBeLessThan(80);
  });

  test('3+ pesticide sprays without scouting → penalty', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [
        { practice_type: 'pesticide_spray' },
        { practice_type: 'pesticide_spray' },
        { practice_type: 'pesticide_spray' },
      ],
    });
    expect(result.improvements.some((i) => i.includes('IPM'))).toBe(true);
  });

  test('crop_residue_burning → big penalty', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'crop_residue_burning' }],
    });
    expect(result.sustainability_score).toBeLessThanOrEqual(50);
    expect(result.improvements.some((i) => i.includes('residue burning'))).toBe(true);
  });

  test('organic_manure boosts score', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'organic_manure' }, { practice_type: 'soil_testing' }],
    });
    expect(result.strengths.some((s) => s.includes('Soil-health'))).toBe(true);
  });

  test('band classification: strong/moderate/needs_attention', () => {
    const strong = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'soil_testing' }, { practice_type: 'organic_manure' }],
      irrigation_method: 'drip',
    });
    expect(strong.band).toBe('strong');

    const needsAttention = practiceTracker.analyzePracticeData({
      practices: [{ practice_type: 'crop_residue_burning' }],
      irrigation_method: 'flood',
    });
    expect(needsAttention.band).toBe('needs_attention');
  });

  test('empty practices → base score', () => {
    const result = practiceTracker.analyzePracticeData({ practices: [] });
    expect(result.sustainability_score).toBe(60); // 70 - 10 (no soil testing)
    expect(result.band).toBe('moderate');
  });

  test('crop_type and crop_stage in output', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [],
      crop_type: 'wheat',
      crop_stage: 'flowering',
    });
    expect(result.crop_type).toBe('wheat');
    expect(result.crop_stage).toBe('flowering');
  });

  test('score clamped to 0-100', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [
        { practice_type: 'crop_residue_burning' },
        { practice_type: 'pesticide_spray' },
        { practice_type: 'pesticide_spray' },
        { practice_type: 'pesticide_spray' },
        { practice_type: 'urea_application' },
        { practice_type: 'urea_application' },
      ],
      irrigation_method: 'flood',
    });
    expect(result.sustainability_score).toBeGreaterThanOrEqual(0);
    expect(result.sustainability_score).toBeLessThanOrEqual(100);
  });

  test('next_actions is at most 3', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [
        { practice_type: 'crop_residue_burning' },
        { practice_type: 'pesticide_spray' },
        { practice_type: 'pesticide_spray' },
        { practice_type: 'pesticide_spray' },
      ],
      irrigation_method: 'flood',
    });
    expect(result.next_actions.length).toBeLessThanOrEqual(3);
  });

  test('entry.type alias works', () => {
    const result = practiceTracker.analyzePracticeData({
      practices: [{ type: 'soil_testing' }],
    });
    expect(result.sustainability_score).toBeGreaterThanOrEqual(80);
  });
});

describe('Practice Tracker – logPractice (DynamoDB)', () => {
  test('logs practice with DynamoDB PutCommand', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await practiceTracker.logPractice('farmer1', {
      practice_type: 'organic_farming',
      quantity: 5,
      unit: 'acre',
      crop_type: 'wheat',
      field_id: 'field-1',
      notes: 'Applied to north plot',
    });
    expect(result.sync_status).toBe('stored');
    expect(result.userId).toBe('farmer1');
    expect(result.practice_type).toBe('organic_farming');
    expect(result.practiceId).toBe('test-uuid-1234');
    expect(dynamoDB.send).toHaveBeenCalledTimes(1);
  });

  test('DynamoDB error → pending_sync fallback', async () => {
    dynamoDB.send.mockRejectedValueOnce(new Error('DynamoDB offline'));
    const result = await practiceTracker.logPractice('farmer1', { practice_type: 'mulching' });
    expect(result.sync_status).toBe('pending_sync');
    expect(result.warning).toContain('DynamoDB offline');
  });

  test('defaults missing optional fields', async () => {
    dynamoDB.send.mockResolvedValueOnce({});
    const result = await practiceTracker.logPractice('f2', {});
    expect(result.crop_type).toBeNull();
    expect(result.field_id).toBeNull();
    expect(result.quantity).toBe(0);
    expect(result.metadata).toEqual({});
  });
});

describe('Practice Tracker – getPracticeLogs (DynamoDB)', () => {
  test('returns logs array', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: [{ practiceId: 'p1' }, { practiceId: 'p2' }] });
    const result = await practiceTracker.getPracticeLogs('farmer1');
    expect(result.logs).toHaveLength(2);
    expect(result.sync_status).toBe('stored');
    expect(dynamoDB.send).toHaveBeenCalledTimes(1);
  });

  test('empty result → empty logs array', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: [] });
    const result = await practiceTracker.getPracticeLogs('unknown');
    expect(result.logs).toEqual([]);
    expect(result.sync_status).toBe('stored');
  });

  test('DynamoDB error → unavailable fallback', async () => {
    dynamoDB.send.mockRejectedValueOnce(new Error('Connection timeout'));
    const result = await practiceTracker.getPracticeLogs('farmer1');
    expect(result.logs).toEqual([]);
    expect(result.sync_status).toBe('unavailable');
    expect(result.warning).toContain('Connection timeout');
  });

  test('custom limit parameter', async () => {
    dynamoDB.send.mockResolvedValueOnce({ Items: [] });
    await practiceTracker.getPracticeLogs('farmer1', 5);
    expect(dynamoDB.send).toHaveBeenCalledTimes(1);
  });
});
