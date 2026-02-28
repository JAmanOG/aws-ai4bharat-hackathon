/**
 * Unit tests for Precision Agriculture – carbon.js
 */

const { calculateCarbonScore } = require('../../lambdas/precision-agriculture/carbon');

describe('Precision Carbon Score', () => {
    test('calculates emissions from known farm inputs', () => {
        const result = calculateCarbonScore({
            practices: [
                { practice_type: 'urea_application', quantity: 50, unit: 'kg' },
                { practice_type: 'diesel_use', quantity: 10, unit: 'litre' },
            ],
        });

        expect(result.total_emissions_kg_co2e).toBeCloseTo(125.8, 1);
        expect(result.carbon_intensity).toBe('medium');
        expect(result.breakdown).toHaveLength(2);
    });

    test('ignores unknown practices in emission total', () => {
        const result = calculateCarbonScore({
            practices: [{ practice_type: 'custom_action', quantity: 99 }],
        });

        expect(result.total_emissions_kg_co2e).toBe(0);
        expect(result.breakdown[0].counted).toBe(false);
    });
});
