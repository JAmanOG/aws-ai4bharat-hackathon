/**
 * Unit tests for Economic Services – nudges.js
 */

const { buildSeasonalMessages } = require('../../lambdas/economic-services/nudges');

describe('Economic Nudges', () => {
    test('generates harvest-season savings guidance', () => {
        const message = buildSeasonalMessages({ crop_types: ['wheat'] }, 'harvest');

        expect(message).toMatch(/Harvest season/i);
        expect(message).toMatch(/savings|crop cycle/i);
    });

    test('falls back to pre-sowing guidance for unknown seasons', () => {
        const message = buildSeasonalMessages({ crop_types: ['rice'] }, 'unknown');

        expect(message).toMatch(/Pre-sowing/i);
    });
});
