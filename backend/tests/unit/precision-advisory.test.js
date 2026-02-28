/**
 * Unit tests for Precision Agriculture – advisory.js
 */

const { runRuleBasedDiagnosis } = require('../../lambdas/precision-agriculture/advisory');

describe('Precision Advisory', () => {
    test('detects nutrient deficiency signals from crop observations', () => {
        const result = runRuleBasedDiagnosis({
            crop_type: 'wheat',
            image_type: 'crop',
            observed_symptoms: ['yellowing leaves', 'pale leaves'],
            weather: { temp_max_c: 30 },
        });

        expect(result.issue_identified).toMatch(/nitrogen deficiency/i);
        expect(result.severity).toMatch(/medium|high|critical/);
        expect(result.recommended_actions.length).toBeGreaterThan(0);
        expect(result.contributing_signals).toContain('nitrogen_deficiency');
    });

    test('detects fungal pressure under humid rainy conditions', () => {
        const result = runRuleBasedDiagnosis({
            crop_type: 'rice',
            observed_symptoms: ['diamond patch on leaf', 'spot lesions'],
            weather: { humidity_pct: 90, rain_mm: 28 },
        });

        expect(result.issue_identified).toMatch(/fungal|stress/i);
        expect(result.severity).toMatch(/high|critical/);
        expect(result.preventive_actions.length).toBeGreaterThan(0);
    });
});
