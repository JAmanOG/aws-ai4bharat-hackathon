/**
 * Precision Agriculture Contract Tests — mirrors precisionApi
 * Used by: SymptomCheckerScreen (indirectly via voice chat)
 */

'use strict';

const { GET, POST,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  Crop Analysis (precisionApi.analyzeSoil)       */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Precision — Crop Analysis', () => {

  test('POST /agriculture/precision/analyze returns diagnosis', async () => {
    const res = await POST('/agriculture/precision/analyze', {
      crop: 'rice',
      symptoms: ['yellowing_leaves', 'stunted_growth'],
      location: { lat: 25.3, lng: 77.2 },
    });
    assertStatus(res, 200);
    // Backend returns issue_identified + severity + confidence
    assertExists(res.body, 'issue_identified');
    assertExists(res.body, 'confidence');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Pest Detection (precisionApi.analyzePestDisease)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Precision — Pest Detection', () => {

  test('POST /agriculture/precision/pest-disease/analyze returns detections', async () => {
    const res = await POST('/agriculture/precision/pest-disease/analyze', {
      crop_type: 'rice',
      symptoms: ['brown_spots'],
    });
    assertStatus(res, 200);
    // Backend returns { crop_type, alerts[], scouting_checklist[] }
    assertExists(res.body, 'crop_type');
    assertExists(res.body, 'alerts');
    assertArray(res.body.alerts);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Carbon Footprint (precisionApi.calculateCarbon)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Precision — Carbon Footprint', () => {

  test('POST /agriculture/precision/carbon/calculate returns emissions data', async () => {
    // Backend schema: practices must be array of { practice_type, quantity, unit } objects
    const res = await POST('/agriculture/precision/carbon/calculate', {
      practices: [
        { practice_type: 'irrigation', quantity: 5, unit: 'acres' },
        { practice_type: 'fertilizer', quantity: 100, unit: 'kg' },
        { practice_type: 'organic_compost', quantity: 200, unit: 'kg' },
      ],
    });
    assertStatus(res, 200);
    assertExists(res.body, 'total_emissions_kg_co2e');
    assertExists(res.body, 'carbon_intensity');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Weather Advisory (precisionApi.getWeatherAdvisory)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Precision — Weather Advisory', () => {

  test('POST /agriculture/precision/weather/advisory returns alerts', async () => {
    const res = await POST('/agriculture/precision/weather/advisory', {
      location: { lat: 25.3, lon: 83.0 },
      crop_type: 'rice',
      forecast: [{ temp_c: 42, humidity: 30, conditions: 'clear' }],
    });
    assertStatus(res, 200);
    assertExists(res.body, 'alerts');
    assertArray(res.body.alerts);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Practice Tracking (precisionApi)               */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Precision — Practice Tracking', () => {

  test('POST /agriculture/precision/practices/log stores a practice', async () => {
    const res = await POST('/agriculture/precision/practices/log', {
      practice_type: 'organic_compost',
      crop_type: 'wheat',
      notes: 'Applied vermicompost',
    });
    assertStatus(res, [200, 201]);
  });

  test('GET /agriculture/precision/practices/logs returns stored practices', async () => {
    const res = await GET('/agriculture/precision/practices/logs');
    assertStatus(res, 200);
  });

  test('POST /agriculture/precision/practices/analyze returns sustainability score', async () => {
    // Backend schema: practices must be array of { practice_type, type } objects
    const res = await POST('/agriculture/precision/practices/analyze', {
      crop_type: 'rice',
      crop_stage: 'vegetative',
      irrigation_method: 'drip',
      practices: [
        { practice_type: 'organic_compost', type: 'fertilizer' },
        { practice_type: 'drip_irrigation', type: 'irrigation' },
      ],
    });
    assertStatus(res, 200);
    assertExists(res.body, 'sustainability_score');
    assertExists(res.body, 'band');
  });
});
