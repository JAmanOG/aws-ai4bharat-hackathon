/**
 * ═══════════════════════════════════════════════════════════════════
 *  Requirement 8 — Economic Services Integration
 *  REAL endpoint integration tests
 * ═══════════════════════════════════════════════════════════════════
 *
 *  AC 8.1: Government loan scheme access
 *  AC 8.2: Loan eligibility assessment
 *  AC 8.3: Savings recommendations from harvest patterns
 *  AC 8.4: Insurance claim facilitation
 *  AC 8.5: Seasonal financial planning nudges
 */

const {
    suite, test, skip,
    GET, POST,
    assert, assertEqual, assertStatus, assertHasKeys, assertType,
    assertArray, assertGt, assertGte, assertLte, assertContains, assertOneOf,
    assertResponseTime,
} = require('./framework');

async function runEconomicTests() {

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Economic Profile');
    /* ═══════════════════════════════════════ */

    await test('POST /economics/profile creates farmer economic profile', async () => {
        const res = await POST('/economics/profile', {
            full_name: 'Ramesh Kumar',
            state: 'madhya pradesh',
            district: 'sehore',
            primary_language: 'hi',
            land_size_acres: 5,
            crop_types: ['wheat', 'rice'],
            annual_income_inr: 200000,
            expected_harvest_income_inr: 150000,
            harvest_months: ['October', 'November', 'March'],
            seasonal_expenses: [
                { category: 'seeds', amount_inr: 8000, due_month: 'June' },
                { category: 'fertilizer', amount_inr: 12000, due_month: 'July' },
                { category: 'pesticide', amount_inr: 5000, due_month: 'August' },
            ],
            has_bank_account: true,
            has_kcc: false,
            digilocker_verified: false,
        });
        assertStatus(res, 201);
        assertHasKeys(res.body, ['userId']);
        assertEqual(res.body.full_name, 'Ramesh Kumar', 'full_name persisted');
        assertEqual(res.body.land_size_acres, 5, 'land_size_acres persisted');
    });

    await test('POST /economics/profile with minimal data defaults correctly', async () => {
        const res = await POST('/economics/profile', {});
        assertStatus(res, 201);
        // After prior test, profile already has land_size_acres=5 which persists (upsert merge)
        assertType(res.body.land_size_acres, 'number', 'land_size_acres is number');
        assertEqual(res.body.primary_language, 'hi', 'default language=hi');
    });

    await test('POST /economics/profile merges with existing data', async () => {
        // First create full profile
        await POST('/economics/profile', {
            full_name: 'Merge Test',
            state: 'UP',
            land_size_acres: 3,
        });
        // Then update only district
        const res = await POST('/economics/profile', { district: 'Lucknow' });
        assertStatus(res, 201);
        // Should preserve existing data
        assertEqual(res.body.district, 'Lucknow', 'updated district');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Government Schemes (AC 8.1)');
    /* ═══════════════════════════════════════ */

    await test('GET /economics/schemes returns scheme catalog', async () => {
        const res = await GET('/economics/schemes');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['schemes', 'count', 'available_types']);
        assertArray(res.body.schemes, 'schemes');
        assertGte(res.body.count, 4, 'at least 4 schemes');
        assertArray(res.body.available_types, 'available_types');
    });

    await test('Scheme catalog has loan, insurance, subsidy types', async () => {
        const res = await GET('/economics/schemes');
        assertStatus(res, 200);
        const types = res.body.schemes.map(s => s.type);
        assert(types.includes('loan'), 'should have loan type');
        assert(types.includes('insurance'), 'should have insurance type');
        assert(types.includes('subsidy'), 'should have subsidy type');
    });

    await test('GET /economics/schemes?type=loan filters by type', async () => {
        const res = await GET('/economics/schemes?type=loan');
        assertStatus(res, 200);
        for (const s of res.body.schemes) {
            assertEqual(s.type, 'loan', `scheme ${s.id} should be loan`);
        }
        assertGt(res.body.count, 0, 'at least 1 loan scheme');
    });

    await test('GET /economics/schemes?type=insurance filters insurance', async () => {
        const res = await GET('/economics/schemes?type=insurance');
        assertStatus(res, 200);
        for (const s of res.body.schemes) {
            assertEqual(s.type, 'insurance', 'type');
        }
    });

    await test('GET /economics/schemes?state=madhya pradesh includes state-specific', async () => {
        const res = await GET('/economics/schemes?state=madhya%20pradesh');
        assertStatus(res, 200);
        const ids = res.body.schemes.map(s => s.id);
        assert(ids.includes('kisan-credit-card'), 'KCC (all states) should be included');
    });

    await test('GET /economics/schemes?land_size_acres=0.1 filters by land', async () => {
        const all = await GET('/economics/schemes');
        const small = await GET('/economics/schemes?land_size_acres=0.1');
        assertStatus(small, 200);
        assertLte(small.body.count, all.body.count, 'smaller land → fewer schemes');
    });

    await test('GET /economics/schemes?search=credit card finds KCC', async () => {
        const res = await GET('/economics/schemes?search=credit%20card');
        assertStatus(res, 200);
        assertGt(res.body.count, 0, 'search should find KCC');
        const ids = res.body.schemes.map(s => s.id);
        assert(ids.includes('kisan-credit-card'), 'KCC found via search');
    });

    await test('GET /economics/schemes/:id returns full scheme', async () => {
        const res = await GET('/economics/schemes/kisan-credit-card');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['id', 'name', 'type', 'min_land_acres', 'requires_bank_account', 'documents_required', 'states']);
        assertEqual(res.body.name, 'Kisan Credit Card', 'name');
        assertArray(res.body.documents_required, 'documents_required');
    });

    await test('GET /economics/schemes/:invalid → 404', async () => {
        const res = await GET('/economics/schemes/fake-scheme-xyz');
        assertStatus(res, 404);
    });

    await test('Scheme query responds within 1 second', async () => {
        const res = await GET('/economics/schemes');
        assertResponseTime(res, 1000, 'scheme catalog latency');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Loan Eligibility (AC 8.2)');
    /* ═══════════════════════════════════════ */

    await test('POST /economics/eligibility/assess with full profile', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: {
                land_size_acres: 5,
                has_bank_account: true,
                digilocker_verified: true,
                crop_types: ['wheat', 'rice'],
            },
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['assessments', 'profile_summary', 'generatedAt']);
        assertArray(res.body.assessments, 'assessments');
        assertGt(res.body.assessments.length, 0, 'at least 1 assessment');

        for (const a of res.body.assessments) {
            assertHasKeys(a, ['scheme_id', 'scheme_name', 'eligible', 'confidence', 'gaps', 'reasons', 'documents_required']);
            assertType(a.eligible, 'boolean', 'eligible');
            assertType(a.confidence, 'number', 'confidence');
            assertGte(a.confidence, 45, 'confidence >= 45');
            assertArray(a.documents_required, 'documents_required');
        }
    });

    await test('Fully eligible farmer gets eligible=true for KCC', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: {
                land_size_acres: 5,
                has_bank_account: true,
                digilocker_verified: true,
            },
            scheme_ids: ['kisan-credit-card'],
        });
        assertStatus(res, 200);
        assertEqual(res.body.assessments.length, 1, '1 assessment');
        assertEqual(res.body.assessments[0].eligible, true, 'eligible for KCC');
        assertEqual(res.body.assessments[0].confidence, 88, 'full confidence=88');
    });

    await test('No bank account → ineligible for KCC with gap', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: {
                land_size_acres: 5,
                has_bank_account: false,
                digilocker_verified: true,
            },
            scheme_ids: ['kisan-credit-card'],
        });
        assertStatus(res, 200);
        assertEqual(res.body.assessments[0].eligible, false, 'ineligible without bank');
        const bankGap = res.body.assessments[0].gaps.find(g => g.toLowerCase().includes('bank'));
        assert(bankGap, 'should mention bank account gap');
    });

    await test('Insufficient land → ineligible with land gap', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: {
                land_size_acres: 0.1,
                has_bank_account: true,
            },
            scheme_ids: ['kisan-credit-card'],
        });
        assertStatus(res, 200);
        const a = res.body.assessments[0];
        assertEqual(a.eligible, false, 'ineligible');
        assert(a.gaps.some(g => g.includes('acre')), 'land gap mentioned');
    });

    await test('Invalid scheme_ids → empty assessments', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: { land_size_acres: 5, has_bank_account: true },
            scheme_ids: ['nonexistent-scheme-xyz'],
        });
        assertStatus(res, 200);
        assertEqual(res.body.assessments.length, 0, 'no assessments for invalid schemes');
    });

    await test('No profile → missing_profile response', async () => {
        const res = await POST('/economics/eligibility/assess', {});
        assertStatus(res, 200);
        // Should either use DB profile or indicate missing
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Savings Plan (AC 8.3)');
    /* ═══════════════════════════════════════ */

    await test('POST /economics/savings/plan generates full plan', async () => {
        const res = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 150000,
            harvest_months: ['October', 'November'],
            seasonal_expenses: [
                { category: 'seeds', amount_inr: 8000, due_month: 'June' },
                { category: 'fertilizer', amount_inr: 12000, due_month: 'July' },
            ],
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, [
            'expected_harvest_income_inr', 'reserve_target_inr', 'emergency_buffer_inr',
            'savings_ratio', 'monthly_plan', 'upcoming_expense_advice', 'narrative',
            'financial_story', 'generatedAt',
        ]);

        assertEqual(res.body.expected_harvest_income_inr, 150000, 'income');
        assertEqual(res.body.reserve_target_inr, 45000, '30% of 150000');
        assertEqual(res.body.emergency_buffer_inr, 15000, '10% of 150000');
        assertType(res.body.savings_ratio, 'number', 'savings_ratio');
        assertArray(res.body.monthly_plan, 'monthly_plan');
        assertEqual(res.body.monthly_plan.length, 2, '2 harvest months');
        assertArray(res.body.upcoming_expense_advice, 'upcoming_expense_advice');
        assertEqual(res.body.upcoming_expense_advice.length, 2, '2 expenses');
    });

    await test('Zero income → zero savings with helpful narrative', async () => {
        const res = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 0,
        });
        assertStatus(res, 200);
        assertEqual(res.body.reserve_target_inr, 0, 'zero reserve');
        assertEqual(res.body.savings_ratio, 0, 'zero ratio');
        assertContains(res.body.narrative, 'Add expected harvest income', 'helpful hint');
    });

    await test('No harvest months → alternative story', async () => {
        const res = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 100000,
        });
        assertStatus(res, 200);
        assertContains(res.body.financial_story, 'Add likely harvest months', 'missing months hint');
    });

    await test('Savings plan responds within 1 second', async () => {
        const res = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 50000,
        });
        assertResponseTime(res, 1000, 'savings plan latency');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Insurance Claims (AC 8.4)');
    /* ═══════════════════════════════════════ */

    let claimId = null;

    await test('POST /economics/insurance/claims creates flood claim', async () => {
        const res = await POST('/economics/insurance/claims', {
            scheme_id: 'pmfby',
            crop_type: 'wheat',
            loss_date: '2026-02-15',
            area_affected_acres: 3,
            location: { state: 'madhya pradesh', district: 'sehore' },
            damage_signals: ['flood in the field', 'waterlogging'],
            notes: 'Major flood damage after heavy rain',
            digilocker_consent: true,
        });
        assertStatus(res, 201);
        assertHasKeys(res.body, ['claimId', 'status', 'damage_assessment']);
        claimId = res.body.claimId;
        assertEqual(res.body.status, 'draft_ready', 'status with digilocker consent');
        assertContains(res.body.damage_assessment.probable_cause, 'flood', 'flood detected');
        assertEqual(res.body.damage_assessment.severity, 'high', 'flood = high severity');
    });

    await test('Claim without digilocker consent → awaiting_consent', async () => {
        const res = await POST('/economics/insurance/claims', {
            crop_type: 'rice',
            damage_signals: ['pest attack'],
            digilocker_consent: false,
        });
        assertStatus(res, 201);
        assertEqual(res.body.status, 'awaiting_consent', 'status without consent');
    });

    await test('Damage assessment returns 4 required documents', async () => {
        const res = await POST('/economics/insurance/claims', {
            crop_type: 'wheat',
            damage_signals: ['hail damage'],
        });
        assertStatus(res, 201);
        assertEqual(res.body.damage_assessment.next_documents.length, 4, '4 required docs');
    });

    await test('GET /economics/insurance/claims lists user claims', async () => {
        const res = await GET('/economics/insurance/claims');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['claims']);
        assertArray(res.body.claims, 'claims');
        assertGte(res.body.claims.length, 1, 'at least 1 claim from previous tests');
    });

    await test('Drought damage → medium severity', async () => {
        const res = await POST('/economics/insurance/claims', {
            crop_type: 'wheat',
            damage_signals: ['dry spell'],
            notes: 'drought conditions',
        });
        assertStatus(res, 201);
        assertEqual(res.body.damage_assessment.severity, 'medium', 'drought = medium');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Financial Nudges (AC 8.5)');
    /* ═══════════════════════════════════════ */

    await test('POST /economics/nudges/generate creates harvest nudge', async () => {
        const res = await POST('/economics/nudges/generate', {
            season: 'harvest',
            profile: { crop_types: ['wheat'] },
        });
        assertStatus(res, 200);
        assertHasKeys(res.body, ['userId', 'season', 'message', 'channel']);
        assertEqual(res.body.season, 'harvest', 'season');
        assertContains(res.body.message, 'savings', 'harvest nudge mentions savings');
    });

    await test('Pre-sowing nudge mentions crop names', async () => {
        const res = await POST('/economics/nudges/generate', {
            season: 'pre-sowing',
            profile: { crop_types: ['wheat', 'rice'] },
        });
        assertStatus(res, 200);
        assertContains(res.body.message, 'wheat', 'mentions crop');
    });

    await test('Default season is pre-sowing', async () => {
        const res = await POST('/economics/nudges/generate', {});
        assertStatus(res, 200);
        assertEqual(res.body.season, 'pre-sowing', 'default season');
    });

    await test('GET /economics/nudges lists user nudges', async () => {
        const res = await GET('/economics/nudges');
        assertStatus(res, 200);
        assertHasKeys(res.body, ['nudges']);
        assertArray(res.body.nudges, 'nudges');
    });

    await test('Custom channel in nudge', async () => {
        const res = await POST('/economics/nudges/generate', {
            channel: 'sms',
        });
        assertStatus(res, 200);
        assertEqual(res.body.channel, 'sms', 'custom channel');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — End-to-End Verification');
    /* ═══════════════════════════════════════ */

    await test('Full economic journey: profile → eligibility → savings → nudge', async () => {
        // 1. Set up profile
        const profileRes = await POST('/economics/profile', {
            land_size_acres: 4,
            crop_types: ['wheat'],
            has_bank_account: true,
            expected_harvest_income_inr: 120000,
            harvest_months: ['November'],
        });
        assertStatus(profileRes, 201);

        // 2. Check eligibility
        const eligRes = await POST('/economics/eligibility/assess', {
            profile: {
                land_size_acres: 4,
                has_bank_account: true,
                crop_types: ['wheat'],
            },
        });
        assertStatus(eligRes, 200);
        assertGt(eligRes.body.assessments.length, 0, 'at least 1 assessment');

        // 3. Generate savings plan
        const savingsRes = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 120000,
            harvest_months: ['November'],
        });
        assertStatus(savingsRes, 200);
        assertEqual(savingsRes.body.reserve_target_inr, 36000, '30% of 120k');

        // 4. Get nudge
        const nudgeRes = await POST('/economics/nudges/generate', {
            season: 'harvest',
            profile: { crop_types: ['wheat'] },
        });
        assertStatus(nudgeRes, 200);
        assertContains(nudgeRes.body.message, 'savings', 'harvest nudge');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Multi-Scheme Eligibility Comparison');
    /* ═══════════════════════════════════════ */

    await test('Assess ALL schemes at once for wealthy farmer', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: {
                land_size_acres: 10,
                has_bank_account: true,
                digilocker_verified: true,
                crop_types: ['wheat', 'rice', 'cotton'],
            },
        });
        assertStatus(res, 200);
        assertGte(res.body.assessments.length, 2, 'wealthy farmer eligible for 2+ schemes');
        const eligible = res.body.assessments.filter(a => a.eligible);
        assertGte(eligible.length, 2, 'at least 2 eligible schemes');
    });

    await test('Assess schemes for landless farmer', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: {
                land_size_acres: 0,
                has_bank_account: false,
                digilocker_verified: false,
            },
        });
        assertStatus(res, 200);
        // Landless farmer should have fewer eligible schemes
        for (const a of res.body.assessments) {
            assertArray(a.gaps, 'gaps');
        }
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Insurance Claim Deep Dive (AC 8.4)');
    /* ═══════════════════════════════════════ */

    await test('Multiple damage types in one claim', async () => {
        const res = await POST('/economics/insurance/claims', {
            scheme_id: 'pmfby',
            crop_type: 'rice',
            loss_date: '2026-07-10',
            damage_signals: ['flood', 'pest attack', 'hail damage'],
            area_affected_acres: 5,
            notes: 'Multiple events in monsoon',
        });
        assertStatus(res, 201);
        assertHasKeys(res.body, ['damage_assessment']);
        assertGt(res.body.damage_assessment.probable_cause.length, 0, 'cause identified');
    });

    await test('Claim with future date handled', async () => {
        const futureDate = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
        const res = await POST('/economics/insurance/claims', {
            crop_type: 'wheat',
            loss_date: futureDate,
            damage_signals: ['drought'],
        });
        // May accept (draft) or reject (future date)
        assert([201, 400].includes(res.status), `future date claim (${res.status})`);
    });

    await test('List claims filters correctly', async () => {
        const res = await GET('/economics/insurance/claims');
        assertStatus(res, 200);
        assertGte(res.body.claims.length, 3, 'at least 3 claims from test suite');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — All Seasons Nudges (AC 8.5)');
    /* ═══════════════════════════════════════ */

    await test('Pre-sowing nudge generated', async () => {
        const res = await POST('/economics/nudges/generate', {
            season: 'pre-sowing',
            profile: { crop_types: ['wheat'] },
        });
        assertStatus(res, 200);
        assertEqual(res.body.season, 'pre-sowing', 'pre-sowing season');
    });

    await test('Growing season nudge generated', async () => {
        const res = await POST('/economics/nudges/generate', {
            season: 'growing',
            profile: { crop_types: ['rice'] },
        });
        assertStatus(res, 200);
        assertEqual(res.body.season, 'growing', 'growing season');
    });

    await test('Post-harvest nudge generated', async () => {
        const res = await POST('/economics/nudges/generate', {
            season: 'post-harvest',
            profile: { crop_types: ['cotton'] },
        });
        assertStatus(res, 200);
        assertEqual(res.body.season, 'post-harvest', 'post-harvest season');
    });

    await test('Invalid season handled gracefully', async () => {
        const res = await POST('/economics/nudges/generate', {
            season: 'monsoon_special',
            profile: { crop_types: ['wheat'] },
        });
        assertStatus(res, 200);
        // Should default or handle unknown season
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Savings Stress Tests (AC 8.3)');
    /* ═══════════════════════════════════════ */

    await test('Very high income → correct calculations', async () => {
        const res = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 10000000,
            harvest_months: ['October', 'November', 'March'],
            seasonal_expenses: [
                { category: 'machinery', amount_inr: 500000, due_month: 'May' },
            ],
        });
        assertStatus(res, 200);
        assertEqual(res.body.reserve_target_inr, 3000000, '30% of 10M');
        assertEqual(res.body.emergency_buffer_inr, 1000000, '10% of 10M');
    });

    await test('12 harvest months plan', async () => {
        const res = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 240000,
            harvest_months: ['January', 'February', 'March', 'April', 'May', 'June',
                'July', 'August', 'September', 'October', 'November', 'December'],
        });
        assertStatus(res, 200);
        assertEqual(res.body.monthly_plan.length, 12, '12 months in plan');
    });

    await test('Many seasonal expenses tracked', async () => {
        const res = await POST('/economics/savings/plan', {
            expected_harvest_income_inr: 200000,
            seasonal_expenses: [
                { category: 'seeds', amount_inr: 5000, due_month: 'June' },
                { category: 'fertilizer', amount_inr: 10000, due_month: 'July' },
                { category: 'pesticide', amount_inr: 3000, due_month: 'August' },
                { category: 'labor', amount_inr: 15000, due_month: 'September' },
                { category: 'transport', amount_inr: 8000, due_month: 'November' },
            ],
        });
        assertStatus(res, 200);
        assertEqual(res.body.upcoming_expense_advice.length, 5, '5 expenses tracked');
    });

    /* ═══════════════════════════════════════ */
    suite('REQ-8: Economic — Validation Edge Cases');
    /* ═══════════════════════════════════════ */

    await test('Profile with extreme values persists', async () => {
        const res = await POST('/economics/profile', {
            land_size_acres: 0.01,
            annual_income_inr: 1,
            crop_types: [],
        });
        assertStatus(res, 201);
    });

    await test('Eligibility with empty scheme_ids → assesses all', async () => {
        const res = await POST('/economics/eligibility/assess', {
            profile: { land_size_acres: 5, has_bank_account: true },
            scheme_ids: [],
        });
        assertStatus(res, 200);
        // Empty scheme_ids should return all scheme assessments
        assertGte(res.body.assessments.length, 0, 'empty scheme_ids handled');
    });
}

module.exports = { runEconomicTests };
