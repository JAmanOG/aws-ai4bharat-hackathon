/**
 * Unit tests for Economic Services – insurance.js
 */

const { assessDamageEvidence } = require('../../lambdas/economic-services/insurance');

describe('Economic Insurance', () => {
    test('detects flood-related claim evidence', () => {
        const result = assessDamageEvidence({
            damage_signals: ['flooded field', 'waterlogging visible'],
        });

        expect(result.probable_cause).toMatch(/flood|waterlogging/i);
        expect(result.severity).toBe('high');
        expect(result.claim_readiness_score).toBeGreaterThan(75);
    });

    test('defaults to generic crop damage when no strong signal is present', () => {
        const result = assessDamageEvidence({
            damage_signals: ['leaf damage'],
        });

        expect(result.probable_cause).toMatch(/general crop damage/i);
    });
});
