/**
 * Economic Services Contract Tests — mirrors economicsApi
 * Used by: SchemesListScreen, SchemeDetailScreen, SavingsNudgeScreen, EligibilityScreen
 */

'use strict';

const { GET, POST,
  suite, test, skip,
  assert, assertStatus, assertExists, assertType, assertArray, assertShape, assertGte,
} = require('./framework');

/* ═══════════════════════════════════════════════ */
/*  Schemes (economicsApi.getSchemes — SchemesListScreen)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Economic — Schemes (SchemesListScreen)', () => {

  let schemeId;

  test('GET /economics/schemes returns { schemes: Scheme[] }', async () => {
    const res = await GET('/economics/schemes');
    assertStatus(res, 200);
    assertExists(res.body, 'schemes');
    assertArray(res.body.schemes);
    assertGte(res.body.schemes.length, 1, 'at least 1 scheme');

    // Scheme interface: { id, name, type, provider, summary, benefit_summary, ... }
    const s = res.body.schemes[0];
    assert(s.id || s.scheme_id, 'scheme needs id');
    assertExists(s, 'name');
    assertExists(s, 'type');
    schemeId = s.id || s.scheme_id;
  });

  test('GET /economics/schemes with category filter', async () => {
    const res = await GET('/economics/schemes', { type: 'loan' });
    assertStatus(res, 200);
    assertExists(res.body, 'schemes');
  });

  test('GET /economics/schemes/:id returns Scheme detail (SchemeDetailScreen)', async () => {
    if (!schemeId) return skip('No scheme');
    const res = await GET(`/economics/schemes/${schemeId}`);
    assertStatus(res, 200);
    assertExists(res.body, 'name');
    assertExists(res.body, 'type');
    // SchemeDetailScreen depends on these fields
    assert(res.body.summary || res.body.description, 'scheme needs summary/description');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Economic Profile (economicsApi — EligibilityScreen)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Economic — Profile', () => {

  test('POST /economics/profile creates/updates profile', async () => {
    const res = await POST('/economics/profile', {
      annual_income: 180000,
      land_size_acres: 3,
      crop_types: ['wheat', 'rice'],
      has_bank_account: true,
    });
    assertStatus(res, [200, 201]);
  });

  test('GET /economics/profile returns profile data', async () => {
    const res = await GET('/economics/profile');
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Eligibility (economicsApi — EligibilityScreen) */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Economic — Eligibility (EligibilityScreen)', () => {

  test('POST /economics/eligibility/assess returns assessments', async () => {
    const res = await POST('/economics/eligibility/assess', {
      profile: {
        land_size_acres: 3,
        has_bank_account: true,
        annual_income: 180000,
        crop_types: ['wheat'],
      },
    });
    assertStatus(res, 200);
    assertExists(res.body, 'assessments');
    assertArray(res.body.assessments);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Savings Plan (economicsApi — SavingsNudgeScreen)*/
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Economic — Savings (SavingsNudgeScreen)', () => {

  test('POST /economics/savings/plan returns plan', async () => {
    const res = await POST('/economics/savings/plan', {
      monthly_income: 15000,
      monthly_expenses: 10000,
      harvest_months: [4, 10],
    });
    assertStatus(res, 200);
    // Backend returns flat object with savings_ratio, monthly_plan[], narrative
    assert(res.body.savings_ratio !== undefined || res.body.monthly_plan !== undefined,
      'savings plan must return savings_ratio or monthly_plan');
  });
});

/* ═══════════════════════════════════════════════ */
/*  Insurance (economicsApi)                       */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Economic — Insurance Claims', () => {

  test('POST /economics/insurance/claims creates claim', async () => {
    const res = await POST('/economics/insurance/claims', {
      crop_type: 'rice',
      loss_date: '2026-02-15',
      area_affected_acres: 3,
      notes: 'Heavy rains damaged standing crop',
    });
    assertStatus(res, [200, 201]);
    // Backend returns claimId (camelCase)
    assert(res.body.claimId || res.body.claim_id || res.body.id, 'claim must return id');
  });

  test('GET /economics/insurance/claims lists claims', async () => {
    const res = await GET('/economics/insurance/claims', { limit: 10 });
    assertStatus(res, 200);
  });
});

/* ═══════════════════════════════════════════════ */
/*  Nudges (economicsApi — SavingsNudgeScreen)     */
/* ═══════════════════════════════════════════════ */

suite('FE Contract: Economic — Nudges (SavingsNudgeScreen)', () => {

  test('POST /economics/nudges/generate creates nudge', async () => {
    const res = await POST('/economics/nudges/generate', {
      season: 'harvest',
      crop_types: ['wheat'],
    });
    assertStatus(res, [200, 201]);
  });

  test('GET /economics/nudges returns { nudges[] } (useNudges hook)', async () => {
    const res = await GET('/economics/nudges', { limit: 20 });
    assertStatus(res, 200);
    assertExists(res.body, 'nudges');
    assertArray(res.body.nudges);
  });
});
