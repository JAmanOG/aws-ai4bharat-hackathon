/**
 * Unit tests for Precision Agriculture – pest-alerts.js
 */

const { detectPestAlerts } = require('../../lambdas/precision-agriculture/pest-alerts');

describe('Precision Pest Alerts', () => {
    test('raises rice blast warning when symptoms and weather align', () => {
        const result = detectPestAlerts({
            crop_type: 'rice',
            observed_symptoms: ['blast visible on leaves', 'diamond lesion'],
            weather: { humidity_pct: 92, rain_mm: 20, temp_max_c: 27 },
        });

        expect(result.alerts).toHaveLength(1);
        expect(result.alerts[0].alert_type).toBe('rice_blast');
        expect(result.alerts[0].severity).toMatch(/high|critical/);
    });

    test('falls back to generic pest pressure when only chewing damage is reported', () => {
        const result = detectPestAlerts({
            crop_type: 'maize',
            observed_symptoms: ['chewed leaves with insect damage'],
        });

        expect(result.alerts[0].alert_type).toBe('generic_pest_pressure');
    });
});
