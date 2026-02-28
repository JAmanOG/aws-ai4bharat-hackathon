/**
 * Unit tests for Precision Agriculture – weather.js
 */

const { buildWeatherAdvisory } = require('../../lambdas/precision-agriculture/weather');

describe('Precision Weather Advisory', () => {
    test('detects heavy rain and high wind hazards', () => {
        const result = buildWeatherAdvisory({
            crop_type: 'tomato',
            forecast: [
                { date: '2026-03-01', rain_mm: 80, wind_kph: 55, humidity_pct: 88, temp_max_c: 31 },
            ],
        });

        const hazardTypes = result.alerts.map((alert) => alert.hazard_type);
        expect(hazardTypes).toContain('heavy_rain');
        expect(hazardTypes).toContain('high_wind');
    });

    test('returns calm summary when no major threshold is crossed', () => {
        const result = buildWeatherAdvisory({
            forecast: [
                { date: '2026-03-01', rain_mm: 2, wind_kph: 10, humidity_pct: 40, temp_max_c: 28, temp_min_c: 18 },
            ],
        });

        expect(result.alerts).toHaveLength(0);
        expect(result.summary).toMatch(/no major weather-triggered advisory/i);
    });
});
