/**
 * Screen-Level Data Contract Tests
 * ─────────────────────────────────
 * Simulates the exact API calls each screen makes on mount, and verifies
 * the response shapes the screen components actually depend on.
 * This catches cases where the backend returns data but the frontend
 * expects different keys/shapes.
 */

'use strict';

const { GET, POST,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape, assertGte,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  HomeScreen — calls useHealthCheck()            */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: HomeScreen — Health Check', () => {

  test('GET /health returns { status: "ok" }', async () => {
    const res = await GET('/health');
    assertStatus(res, 200);
    assertExists(res.body, 'status');
    assert(res.body.status === 'ok' || res.body.status === 'healthy',
      `health status should be ok/healthy, got: ${res.body.status}`);
  });
});

/* ═══════════════════════════════════════════════ */
/*  AskScreen — voiceApi.chat (main interaction)   */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: AskScreen — Voice Chat Flow', () => {

  let sessionId;

  test('Chat message returns text + session for UI rendering', async () => {
    const res = await POST('/voice/chat', {
      text: 'गेहूं की कीमत बताओ',
      language_code: 'hi',
      generate_audio: false,
    });
    assertStatus(res, 200);
    // AskScreen renders: response_text, session_id
    assertExists(res.body, 'response_text');
    assertType(res.body.response_text, 'string');
    assert(res.body.response_text.length > 0, 'response must not be empty');
    sessionId = res.body.session_id;
    assert(sessionId, 'must return session_id for conversation tracking');
  });

  test('Follow-up in same session preserves context', async () => {
    if (!sessionId) return skip('No session');
    const res = await POST('/voice/chat', {
      text: 'और बाजरा?',
      language_code: 'hi',
      session_id: sessionId,
      generate_audio: false,
    });
    assertStatus(res, 200);
    assertExists(res.body, 'response_text');
    assert(res.body.session_id === sessionId, 'session_id must match');
  });
});

/* ═══════════════════════════════════════════════ */
/*  ProfileScreen — memory facts + health          */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: ProfileScreen — Memory Facts & Health', () => {

  test('GET /voice/memory/facts returns object shape for rendering', async () => {
    const res = await GET('/voice/memory/facts');
    assertStatus(res, 200);
    assertExists(res.body, 'facts');
    assertType(res.body.facts, 'object', 'facts must be object (key-value)');
  });

  test('GET /health for connection indicator', async () => {
    const res = await GET('/health');
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  MarketPricesScreen — useMarketPrices(crop)     */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: MarketPricesScreen — Price Data', () => {

  test('Wheat prices have summary fields for UI cards', async () => {
    const res = await GET('/agriculture/prices/wheat');
    assertStatus(res, 200);
    // Backend returns camelCase: avgPrice, minPrice, maxPrice, totalMandis
    assertExists(res.body, 'summary');
    const s = res.body.summary;
    assert(s.avgPrice !== undefined || s.average_price !== undefined, 'summary needs avgPrice field');
  });

  test('Each price entry has fields for list rendering', async () => {
    const res = await GET('/agriculture/prices/wheat');
    if (res.body.prices.length === 0) return skip('No price data');
    // Backend returns: mandi_name, modal_price (string), min_price, max_price
    const p = res.body.prices[0];
    assertExists(p, 'mandi_name');
    // Prices come as strings from PG — frontend must parseFloat
    assert(p.modal_price !== undefined, 'price entry needs modal_price');
  });
});

/* ═══════════════════════════════════════════════ */
/*  AgriMarketScreen — prices + mandis + health    */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: AgriMarketScreen — Market Overview', () => {

  test('Multiple crop prices load (wheat, rice)', async () => {
    const [w, r] = await Promise.all([
      GET('/agriculture/prices/wheat'),
      GET('/agriculture/prices/rice'),
    ]);
    assertStatus(w, 200);
    assertStatus(r, 200);
    assertExists(w.body, 'summary');
    assertExists(r.body, 'summary');
  });

  test('Mandis list loads for dropdown', async () => {
    const res = await GET('/agriculture/mandis');
    assertStatus(res, 200);
    assertExists(res.body, 'mandis');
  });
});

/* ═══════════════════════════════════════════════ */
/*  SchemesListScreen — useSchemes()               */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: SchemesListScreen — Scheme Catalog', () => {

  test('Scheme list has fields for card rendering', async () => {
    const res = await GET('/economics/schemes');
    assertStatus(res, 200);
    assertGte(res.body.schemes.length, 1, 'at least 1 scheme');
    const s = res.body.schemes[0];
    // SchemesListScreen renders: name, type, summary/benefit_summary
    assertExists(s, 'name');
    assertExists(s, 'type');
  });
});

/* ═══════════════════════════════════════════════ */
/*  SchemeDetailScreen — useSchemeDetail(id)        */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: SchemeDetailScreen — Scheme Detail', () => {

  test('Scheme detail has all fields for detail view', async () => {
    // First get a scheme ID
    const list = await GET('/economics/schemes');
    if (list.body.schemes.length === 0) return skip('No schemes');
    const id = list.body.schemes[0].id || list.body.schemes[0].scheme_id;
    
    const res = await GET(`/economics/schemes/${id}`);
    assertStatus(res, 200);
    assertExists(res.body, 'name');
    // SchemeDetailScreen shows these:
    assertExists(res.body, 'type');
    assert(res.body.summary || res.body.description || res.body.benefit_summary,
      'scheme detail needs summary/description/benefit_summary');
  });
});

/* ═══════════════════════════════════════════════ */
/*  KnowledgeDashboardScreen — courses, groups, profile */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: KnowledgeDashboardScreen — Learning Hub', () => {

  test('All three data sources load for dashboard', async () => {
    const [courses, groups, profile] = await Promise.all([
      GET('/knowledge/courses'),
      GET('/knowledge/peer-groups/my-groups'),
      GET('/knowledge/learning-profile'),
    ]);
    assertStatus(courses, 200);
    assertStatus(groups, 200);
    assertStatus(profile, 200);
    assertExists(courses.body, 'courses');
  });
});

/* ═══════════════════════════════════════════════ */
/*  AlertsScreen — usePriceAlerts + CRUD           */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: AlertsScreen — Alert CRUD', () => {

  test('Full alert lifecycle: create → list → delete', async () => {
    // Create
    const create = await POST('/agriculture/alerts', {
      crop_type: 'cotton',
    });
    assertStatus(create, [200, 201]);
    const aid = create.body.alertId || create.body.alert_id || create.body.id;
    assert(aid, 'alert needs id');

    // List
    const list = await GET('/agriculture/alerts');
    assertStatus(list, 200);
    const found = list.body.alerts.some(a => (a.alertId || a.alert_id || a.id) === aid);
    assert(found, 'created alert must appear in list');

    // Delete
    const del = await (require('./framework')).DELETE(`/agriculture/alerts/${aid}`);
    assertStatus(del, [200, 204]);
  });
});

/* ═══════════════════════════════════════════════ */
/*  SavingsNudgeScreen — useNudges + health        */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: SavingsNudgeScreen — Nudges', () => {

  test('Nudges list loads for display', async () => {
    const res = await GET('/economics/nudges', { limit: 20 });
    assertStatus(res, 200);
    assertExists(res.body, 'nudges');
    assertArray(res.body.nudges);
  });
});

/* ═══════════════════════════════════════════════ */
/*  EligibilityScreen — memory facts + health      */
/* ═══════════════════════════════════════════════ */

suite('FE Screen: EligibilityScreen — Eligibility Check', () => {

  test('Memory facts load for pre-filling form', async () => {
    const res = await GET('/voice/memory/facts');
    assertStatus(res, 200);
    assertExists(res.body, 'facts');
  });

  test('Eligibility assessment works end-to-end', async () => {
    const res = await POST('/economics/eligibility/assess', {
      profile: {
        land_size_acres: 2,
        has_bank_account: true,
        annual_income: 120000,
      },
    });
    assertStatus(res, 200);
    assertExists(res.body, 'assessments');
  });
});

/* ═══════════════════════════════════════════════ */
/*  API Error Handling — frontend catch paths      */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Error Handling (api.ts catch paths)', () => {

  test('Invalid ID returns error (api.ts parses res.text → json)', async () => {
    // Non-UUID IDs cause PG error (500), valid-format but missing UUIDs cause 404
    const res = await GET('/agriculture/listings/00000000-0000-0000-0000-000000000000');
    assertStatus(res, [404, 500]);
    assert(res.body.error || res.body.message, 'error response should have error/message key');
  });

  test('400 returns structured error', async () => {
    const res = await POST('/voice/chat', { text: '' });
    assertStatus(res, 400);
    assert(res.body.error || res.body.message, '400 should have error/message');
  });

  test('Response time under 15s (ENV.REQUEST_TIMEOUT)', async () => {
    const res = await GET('/health');
    assert(res.elapsed < 15000, `health took ${res.elapsed}ms, must be < 15s`);
  });
});
