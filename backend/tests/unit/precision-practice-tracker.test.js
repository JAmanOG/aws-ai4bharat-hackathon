/**
 * Unit tests for Precision Agriculture – practice-tracker.js
 */

const {
    analyzePracticeData,
    normalizePracticeType,
} = require('../../lambdas/precision-agriculture/practice-tracker');

describe('Precision Practice Tracker', () => {
    test('normalizes practice labels to a stable format', () => {
        expect(normalizePracticeType('Flood Irrigation')).toBe('flood_irrigation');
    });

    test('penalizes unsustainable patterns and rewards soil-health actions', () => {
        const result = analyzePracticeData({
            crop_type: 'cotton',
            irrigation_method: 'flood',
            practices: [
                { practice_type: 'pesticide_spray' },
                { practice_type: 'pesticide_spray' },
                { practice_type: 'pesticide_spray' },
                { practice_type: 'urea_application' },
                { practice_type: 'urea_application' },
                { practice_type: 'organic_manure' },
            ],
        });

        expect(result.sustainability_score).toBeLessThan(70);
        expect(result.improvements.join(' ')).toMatch(/flood irrigation|ipm|urea/i);
        expect(result.strengths.join(' ')).toMatch(/soil-health|water-efficient|soil testing|present/i);
    });
});
