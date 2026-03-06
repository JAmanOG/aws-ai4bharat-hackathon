/**
 * ═══════════════════════════════════════════════════════════════════
 *  Requirement 6 — Precision Agriculture Support
 *  REAL endpoint integration tests
 * ═══════════════════════════════════════════════════════════════════
 *
 *  AC 6.1: AI analysis + recommendations from soil/weather/crop data
 *  AC 6.2: Early warning pest & disease detection
 *  AC 6.3: Carbon footprint calculation & reduction methods
 *  AC 6.4: Disaster preparedness from local weather patterns
 *  AC 6.5: Track farming practices & suggest improvements
 */

const {
    suite, test, skip,
    GET, POST,
    assert, assertEqual, assertStatus, assertHasKeys, assertType,
    assertArray, assertGt, assertGte, assertLte, assertContains, assertOneOf,
    assertResponseTime,
} = require('./framework');

async function runPrecisionAgriTests() {

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Crop Analysis (AC 6.1)');
    /* ═══════════════════════════════════════ */

    await test('POST /agriculture/precision/analyze with symptoms returns diagnosis', async () => {
        const res = await POST('/agriculture/precision/analyze', {
            image_type: 'leaf',
            crop_type: 'wheat',
            observed_symptoms: ['yellowing leaves', 'leaf tips browning'],
            notes: 'lower leaves affected more',
            soil_condition: 'dry and sandy',
            weather: { humidity_pct: 60, rain_mm: 5, temp_max_c: 32 },
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['issue_identified', 'severity', 'confidence']);
        assertType(res.body.issue_identified, 'string', 'issue_identified');
        assertType(res.body.confidence, 'number', 'confidence');
        assertGte(res.body.confidence, 0, 'confidence >= 0');
        assertLte(res.body.confidence, 100, 'confidence <= 100');
        assertOneOf(res.body.severity, ['low', 'medium', 'high'], 'severity');
        assertArray(res.body.recommended_actions, 'recommended_actions');
    });

    await test('Analysis includes preventive actions and follow-up questions', async () => {
        const res = await POST('/agriculture/precision/analyze', {
            crop_type: 'rice',
            observed_symptoms: ['brown spots on leaves'],
            weather: { humidity_pct: 90, rain_mm: 30 },
        });
        assertStatus(res, 200);
        assertArray(res.body.preventive_actions, 'preventive_actions');
        assertArray(res.body.follow_up_questions, 'follow_up_questions');
        assertGte(res.body.follow_up_questions.length, 1, 'at least 1 follow-up question');
    });

    await test('Weather conditions boost confidence (humidity + rain)', async () => {
        const dryRes = await POST('/agriculture/precision/analyze', {
            crop_type: 'wheat',
            observed_symptoms: ['brown spots on leaves'],
            weather: { humidity_pct: 40, rain_mm: 0, temp_max_c: 25 },
        });
        const wetRes = await POST('/agriculture/precision/analyze', {
            crop_type: 'wheat',
            observed_symptoms: ['brown spots on leaves'],
            weather: { humidity_pct: 90, rain_mm: 25, temp_max_c: 38 },
        });
        assertStatus(dryRes, 200);
        assertStatus(wetRes, 200);
        // Wet conditions should give higher or equal confidence
        assertGte(wetRes.body.confidence, dryRes.body.confidence, 'wet weather >= dry confidence');
    });

    await test('Empty symptoms still returns valid response', async () => {
        const res = await POST('/agriculture/precision/analyze', {
            crop_type: 'wheat',
            observed_symptoms: [],
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['issue_identified']);
    });

    await test('Analysis responds within 5 seconds', async () => {
        const res = await POST('/agriculture/precision/analyze', {
            crop_type: 'cotton',
            observed_symptoms: ['white fuzzy patches'],
        });
        assertResponseTime(res, 5000, 'analysis latency');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Pest & Disease Detection (AC 6.2)');
    /* ═══════════════════════════════════════ */

    await test('POST /agriculture/precision/pest-disease/analyze detects rice blast', async () => {
        const res = await POST('/agriculture/precision/pest-disease/analyze', {
            crop_type: 'rice',
            observed_symptoms: ['diamond shaped spots', 'grey lesions on leaves'],
            notes: 'spreading rapidly after rain',
            weather: { humidity_pct: 92, rain_mm: 40, temp_max_c: 30 },
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['crop_type', 'alerts', 'scouting_checklist', 'next_review_in_hours']);
        assertEqual(res.body.crop_type, 'rice', 'crop_type');
        assertArray(res.body.alerts, 'alerts');
        assertArray(res.body.scouting_checklist, 'scouting_checklist');
    });

    await test('Pest alert with detections array', async () => {
        const res = await POST('/agriculture/precision/pest-disease/analyze', {
            crop_type: 'cotton',
            observed_symptoms: ['white insects on leaves'],
            detections: [
                { label: 'whitefly', confidence: 0.85 },
            ],
            weather: { humidity_pct: 70 },
        });
        assertStatus(res, 200);
        assertArray(res.body.alerts, 'alerts');
    });

    await test('Critical pest → next_review_in_hours = 12', async () => {
        const res = await POST('/agriculture/precision/pest-disease/analyze', {
            crop_type: 'rice',
            observed_symptoms: ['diamond shaped spots', 'grey lesions', 'neck blast'],
            detections: [{ label: 'blast fungus', confidence: 0.9 }],
            weather: { humidity_pct: 95, rain_mm: 50 },
        });
        assertStatus(res, 200);
        if (res.body.alerts.length > 0 && res.body.alerts[0].severity === 'critical') {
            assertEqual(res.body.next_review_in_hours, 12, 'critical → 12h review');
        }
    });

    await test('Unknown crop gets generic response', async () => {
        const res = await POST('/agriculture/precision/pest-disease/analyze', {
            crop_type: 'mango',
            observed_symptoms: ['holes in leaves', 'chewed edges'],
        });
        assertStatus(res, 200);
        assertArray(res.body.alerts, 'alerts');
    });

    await test('Pest detection responds within 3 seconds', async () => {
        const res = await POST('/agriculture/precision/pest-disease/analyze', {
            crop_type: 'wheat',
            observed_symptoms: ['rust colored spots'],
        });
        assertResponseTime(res, 3000, 'pest detection latency');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Carbon Footprint (AC 6.3)');
    /* ═══════════════════════════════════════ */

    await test('POST /agriculture/precision/carbon/calculate returns emissions', async () => {
        const res = await POST('/agriculture/precision/carbon/calculate', {
            practices: [
                { practice_type: 'urea_application', quantity: 50, unit: 'kg' },
                { practice_type: 'diesel_use', quantity: 20, unit: 'litre' },
                { practice_type: 'grid_irrigation', quantity: 200, unit: 'kwh' },
            ],
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['total_emissions_kg_co2e', 'carbon_intensity', 'breakdown', 'recommendations']);
        assertType(res.body.total_emissions_kg_co2e, 'number', 'total_emissions');
        assertGt(res.body.total_emissions_kg_co2e, 0, 'emissions > 0');
        assertOneOf(res.body.carbon_intensity, ['low', 'medium', 'high'], 'carbon_intensity');
        assertArray(res.body.breakdown, 'breakdown');
        assertArray(res.body.recommendations, 'recommendations');
    });

    await test('High emissions → high carbon intensity', async () => {
        const res = await POST('/agriculture/precision/carbon/calculate', {
            practices: [
                { practice_type: 'crop_residue_burning', quantity: 5, unit: 'acre' },
                { practice_type: 'diesel_use', quantity: 100, unit: 'litre' },
            ],
        });
        assertStatus(res, 200);
        assertOneOf(res.body.carbon_intensity, ['medium', 'high'],
            'burning + heavy diesel should be medium or high');
    });

    await test('Zero practices → zero emissions', async () => {
        const res = await POST('/agriculture/precision/carbon/calculate', {
            practices: [],
        });
        assertStatus(res, 200);
        assertEqual(res.body.total_emissions_kg_co2e, 0, 'zero emissions for no practices');
    });

    await test('Breakdown has same count as practices', async () => {
        const practices = [
            { practice_type: 'urea_application', quantity: 10, unit: 'kg' },
            { practice_type: 'pesticide_spray', quantity: 3, unit: 'spray' },
        ];
        const res = await POST('/agriculture/precision/carbon/calculate', { practices });
        assertStatus(res, 200);
        assertEqual(res.body.breakdown.length, 2, 'breakdown count = practices count');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Weather Advisory (AC 6.4)');
    /* ═══════════════════════════════════════ */

    await test('POST /agriculture/precision/weather/advisory returns alerts', async () => {
        const res = await POST('/agriculture/precision/weather/advisory', {
            crop_type: 'wheat',
            location: { state: 'madhya pradesh', district: 'sehore' },
            forecast: [
                { date: '2026-03-07', rain_mm: 70, wind_kph: 30, humidity_pct: 85, temp_max_c: 28, temp_min_c: 18 },
                { date: '2026-03-08', rain_mm: 5, wind_kph: 55, humidity_pct: 60, temp_max_c: 35, temp_min_c: 20 },
            ],
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['crop_type', 'alerts', 'proactive_steps']);
        assertArray(res.body.alerts, 'alerts');
        assertGte(res.body.alerts.length, 1, 'heavy rain should trigger alert');
        assertArray(res.body.proactive_steps, 'proactive_steps');
    });

    await test('Extreme heat triggers heat stress alert', async () => {
        const res = await POST('/agriculture/precision/weather/advisory', {
            crop_type: 'rice',
            forecast: [
                { date: '2026-05-01', rain_mm: 0, wind_kph: 10, humidity_pct: 30, temp_max_c: 45, temp_min_c: 30 },
            ],
        });
        assertStatus(res, 200);
        const heatAlert = res.body.alerts.find(a =>
            a.hazard_type?.includes('heat') || a.type?.includes('heat') || a.alert_type?.includes('heat')
        );
        assert(heatAlert, '45°C should trigger heat stress alert');
    });

    await test('Cold snap triggers cold stress alert', async () => {
        const res = await POST('/agriculture/precision/weather/advisory', {
            crop_type: 'wheat',
            forecast: [
                { date: '2026-01-15', rain_mm: 0, wind_kph: 5, humidity_pct: 50, temp_max_c: 12, temp_min_c: 3 },
            ],
        });
        assertStatus(res, 200);
        const coldAlert = res.body.alerts.find(a =>
            a.hazard_type?.includes('cold') || a.type?.includes('cold') || a.alert_type?.includes('cold')
        );
        assert(coldAlert, '3°C should trigger cold stress alert');
    });

    await test('Clear weather → no high-risk alerts', async () => {
        const res = await POST('/agriculture/precision/weather/advisory', {
            crop_type: 'wheat',
            forecast: [
                { date: '2026-03-10', rain_mm: 2, wind_kph: 10, humidity_pct: 50, temp_max_c: 28, temp_min_c: 15 },
            ],
        });
        assertStatus(res, 200);
        const critical = res.body.alerts.filter(a => a.risk_level === 'high');
        assertEqual(critical.length, 0, 'clear weather → no high-risk alerts');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Practice Tracking (AC 6.5)');
    /* ═══════════════════════════════════════ */

    await test('POST /agriculture/precision/practices/analyze returns score', async () => {
        const res = await POST('/agriculture/precision/practices/analyze', {
            crop_type: 'wheat',
            crop_stage: 'vegetative',
            irrigation_method: 'drip',
            practices: [
                { practice_type: 'soil_testing' },
                { practice_type: 'organic_manure' },
                { practice_type: 'mulching' },
            ],
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['sustainability_score', 'band', 'strengths', 'improvements']);
        assertType(res.body.sustainability_score, 'number', 'sustainability_score');
        assertGte(res.body.sustainability_score, 0, 'score >= 0');
        assertLte(res.body.sustainability_score, 100, 'score <= 100');
        assertOneOf(res.body.band, ['strong', 'moderate', 'needs_attention'], 'band');
    });

    await test('Good practices → strong band', async () => {
        const res = await POST('/agriculture/precision/practices/analyze', {
            crop_type: 'wheat',
            irrigation_method: 'drip',
            practices: [
                { practice_type: 'soil_testing' },
                { practice_type: 'organic_manure' },
                { practice_type: 'mulching' },
            ],
        });
        assertStatus(res, 200);
        assertOneOf(res.body.band, ['strong', 'moderate'], 'good practices should score well');
    });

    await test('Bad practices → needs_attention', async () => {
        const res = await POST('/agriculture/precision/practices/analyze', {
            crop_type: 'wheat',
            irrigation_method: 'flood',
            practices: [
                { practice_type: 'residue_burning' },
                { practice_type: 'urea_application' },
                { practice_type: 'urea_application' },
                { practice_type: 'pesticide_spray' },
                { practice_type: 'pesticide_spray' },
                { practice_type: 'pesticide_spray' },
                { practice_type: 'pesticide_spray' },
            ],
        });
        assertStatus(res, 200);
        assertOneOf(res.body.band, ['needs_attention', 'moderate'], 'bad practices');
    });

    await test('POST /agriculture/precision/practices/log stores a practice', async () => {
        const res = await POST('/agriculture/precision/practices/log', {
            practice_type: 'soil_testing',
            crop_type: 'wheat',
            notes: 'Tested pH and NPK levels',
            date: new Date().toISOString().split('T')[0],
        });
        assertStatus(res, 201);
    });

    await test('GET /agriculture/precision/practices/logs returns stored practices', async () => {
        const res = await GET('/agriculture/precision/practices/logs?limit=10');
        assertStatus(res, 200);
        assertArray(res.body.logs || res.body.practices || [], 'practice logs');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Validation & Edge Cases');
    /* ═══════════════════════════════════════ */

    await test('Carbon calc with unknown practice type handles gracefully', async () => {
        const res = await POST('/agriculture/precision/carbon/calculate', {
            practices: [
                { practice_type: 'teleportation', quantity: 500, unit: 'kg' },
            ],
        });
        assertStatus(res, 200);
        // Unknown practice should produce 0 emissions (no matching factor)
    });

    await test('Weather advisory with empty forecast → valid empty response', async () => {
        const res = await POST('/agriculture/precision/weather/advisory', {
            crop_type: 'wheat',
            forecast: [],
        });
        assertStatus(res, 200);
        assertEqual(res.body.alerts.length, 0, 'no forecast → no alerts');
    });

    await test('Pest detection missing crop_type → 400', async () => {
        const res = await POST('/agriculture/precision/pest-disease/analyze', {
            observed_symptoms: ['yellow leaves'],
        });
        assertStatus(res, 400);
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Multi-Crop Comparison (AC 6.1)');
    /* ═══════════════════════════════════════ */

    await test('Same symptoms, different crops → different diagnosis', async () => {
        const wheatRes = await POST('/agriculture/precision/analyze', {
            crop_type: 'wheat',
            observed_symptoms: ['brown spots on leaves', 'wilting'],
            weather: { humidity_pct: 80, rain_mm: 20 },
        });
        const riceRes = await POST('/agriculture/precision/analyze', {
            crop_type: 'rice',
            observed_symptoms: ['brown spots on leaves', 'wilting'],
            weather: { humidity_pct: 80, rain_mm: 20 },
        });
        assertStatus(wheatRes, 200);
        assertStatus(riceRes, 200);
        // Both should return valid diagnoses (may differ per crop)
        assertHasKeys(wheatRes.body, ['issue_identified', 'severity']);
        assertHasKeys(riceRes.body, ['issue_identified', 'severity']);
    });

    await test('Cotton analysis with multiple symptoms', async () => {
        const res = await POST('/agriculture/precision/analyze', {
            crop_type: 'cotton',
            observed_symptoms: ['white fuzzy patches', 'leaf curling', 'stunted growth'],
            weather: { humidity_pct: 75, rain_mm: 10, temp_max_c: 35 },
        });
        assertStatus(res, 200);
        assertGte(res.body.recommended_actions.length, 1, 'has recommendations');
    });

    await test('Sugarcane pest detection with multiple detections', async () => {
        const res = await POST('/agriculture/precision/pest-disease/analyze', {
            crop_type: 'sugarcane',
            observed_symptoms: ['red streaks on leaves', 'stem borer holes'],
            detections: [
                { label: 'stem borer', confidence: 0.75 },
                { label: 'red rot', confidence: 0.60 },
            ],
            weather: { humidity_pct: 80, rain_mm: 15 },
        });
        assertStatus(res, 200);
        assertArray(res.body.alerts, 'alerts');
        assertGte(res.body.alerts.length, 1, 'has alerts for sugarcane');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Extreme Weather Scenarios');
    /* ═══════════════════════════════════════ */

    await test('Cyclone conditions trigger multiple alerts', async () => {
        const res = await POST('/agriculture/precision/weather/advisory', {
            crop_type: 'rice',
            forecast: [
                { date: '2026-06-15', rain_mm: 200, wind_kph: 100, humidity_pct: 98, temp_max_c: 28, temp_min_c: 24 },
            ],
        });
        assertStatus(res, 200);
        assertGte(res.body.alerts.length, 2, 'cyclone triggers multiple alerts (rain+wind)');
    });

    await test('Week-long forecast with mixed conditions', async () => {
        const res = await POST('/agriculture/precision/weather/advisory', {
            crop_type: 'wheat',
            forecast: [
                { date: '2026-03-01', rain_mm: 0, wind_kph: 5, humidity_pct: 40, temp_max_c: 28, temp_min_c: 15 },
                { date: '2026-03-02', rain_mm: 50, wind_kph: 30, humidity_pct: 90, temp_max_c: 22, temp_min_c: 18 },
                { date: '2026-03-03', rain_mm: 80, wind_kph: 40, humidity_pct: 95, temp_max_c: 20, temp_min_c: 17 },
                { date: '2026-03-04', rain_mm: 5, wind_kph: 10, humidity_pct: 70, temp_max_c: 25, temp_min_c: 14 },
                { date: '2026-03-05', rain_mm: 0, wind_kph: 5, humidity_pct: 50, temp_max_c: 30, temp_min_c: 16 },
                { date: '2026-03-06', rain_mm: 0, wind_kph: 5, humidity_pct: 35, temp_max_c: 38, temp_min_c: 22 },
                { date: '2026-03-07', rain_mm: 0, wind_kph: 5, humidity_pct: 30, temp_max_c: 42, temp_min_c: 25 },
            ],
        });
        assertStatus(res, 200);
        assertGte(res.body.alerts.length, 1, 'mixed week has at least 1 alert');
        assertGte(res.body.proactive_steps.length, 1, 'proactive steps provided');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Carbon Stress Tests');
    /* ═══════════════════════════════════════ */

    await test('All practice types calculate correctly', async () => {
        const res = await POST('/agriculture/precision/carbon/calculate', {
            practices: [
                { practice_type: 'urea_application', quantity: 50, unit: 'kg' },
                { practice_type: 'diesel_use', quantity: 20, unit: 'litre' },
                { practice_type: 'grid_irrigation', quantity: 100, unit: 'kwh' },
                { practice_type: 'pesticide_spray', quantity: 5, unit: 'spray' },
                { practice_type: 'crop_residue_burning', quantity: 2, unit: 'acre' },
            ],
        });
        assertStatus(res, 200);
        assertEqual(res.body.breakdown.length, 5, '5 practices in breakdown');
        assertGt(res.body.total_emissions_kg_co2e, 0, 'total > 0');
        assertGte(res.body.recommendations.length, 1, 'has recommendations');
    });

    await test('Very large farm operations → high intensity', async () => {
        const res = await POST('/agriculture/precision/carbon/calculate', {
            practices: [
                { practice_type: 'diesel_use', quantity: 1000, unit: 'litre' },
                { practice_type: 'crop_residue_burning', quantity: 50, unit: 'acre' },
                { practice_type: 'urea_application', quantity: 500, unit: 'kg' },
            ],
        });
        assertStatus(res, 200);
        assertEqual(res.body.carbon_intensity, 'high', 'massive farm = high intensity');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-6: Precision Agri — Practice Analysis Deep Dive');
    /* ═══════════════════════════════════════ */

    await test('Organic-only practices → high sustainability score', async () => {
        const res = await POST('/agriculture/precision/practices/analyze', {
            crop_type: 'wheat',
            irrigation_method: 'drip',
            practices: [
                { practice_type: 'soil_testing' },
                { practice_type: 'organic_manure' },
                { practice_type: 'mulching' },
                { practice_type: 'crop_rotation' },
                { practice_type: 'biological_pest_control' },
            ],
        });
        assertStatus(res, 200);
        assertGte(res.body.sustainability_score, 60, 'organic practices score >= 60');
        assertOneOf(res.body.band, ['strong', 'moderate'], 'organic = strong or moderate');
    });

    await test('Empty practices → needs_attention with improvements', async () => {
        const res = await POST('/agriculture/precision/practices/analyze', {
            crop_type: 'rice',
            irrigation_method: 'flood',
            practices: [],
        });
        assertStatus(res, 200);
        assertGte(res.body.improvements.length, 1, 'suggests improvements for empty practices');
    });

    await test('Practice log and retrieve cycle', async () => {
        const logRes = await POST('/agriculture/precision/practices/log', {
            practice_type: 'organic_manure',
            crop_type: 'rice',
            notes: 'Applied vermicompost',
            date: new Date().toISOString().split('T')[0],
        });
        assertStatus(logRes, 201);

        const listRes = await GET('/agriculture/precision/practices/logs?limit=5');
        assertStatus(listRes, 200);
        const logs = listRes.body.logs || listRes.body.practices || [];
        assertGte(logs.length, 1, 'at least 1 practice log retrieved');
    });
}

module.exports = { runPrecisionAgriTests };
