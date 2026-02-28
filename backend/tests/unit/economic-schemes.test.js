/**
 * Unit tests for Economic Services – schemes.js
 */

const { filterSchemes, getSchemeById } = require('../../lambdas/economic-services/schemes');

describe('Economic Schemes', () => {
    test('filters schemes by type and state', () => {
        const result = filterSchemes({ type: 'loan', state: 'Maharashtra' });

        expect(result.schemes.length).toBeGreaterThan(0);
        expect(result.schemes.every((scheme) => scheme.type === 'loan')).toBe(true);
    });

    test('gets scheme by id', () => {
        const scheme = getSchemeById('kisan-credit-card');

        expect(scheme).toBeTruthy();
        expect(scheme.name).toMatch(/Kisan Credit Card/i);
    });
});
