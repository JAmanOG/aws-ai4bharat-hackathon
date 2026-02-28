/**
 * Unit tests for Economic Services – savings.js
 */

const { generateSavingsPlan } = require('../../lambdas/economic-services/savings');

describe('Economic Savings Plan', () => {
    test('creates reserve and emergency targets from harvest income', () => {
        const result = generateSavingsPlan({
            expected_harvest_income_inr: 100000,
            harvest_months: ['April', 'May'],
            seasonal_expenses: [
                { category: 'seed', amount_inr: 12000, due_month: 'June' },
                { category: 'fertilizer', amount_inr: 8000, due_month: 'July' },
            ],
        });

        expect(result.reserve_target_inr).toBe(30000);
        expect(result.emergency_buffer_inr).toBe(10000);
        expect(result.monthly_plan).toHaveLength(2);
    });

    test('returns guidance when harvest income is missing', () => {
        const result = generateSavingsPlan({});

        expect(result.reserve_target_inr).toBe(0);
        expect(result.narrative).toMatch(/Add expected harvest income/i);
    });
});
