/**
 * Unit tests for Economic Services – eligibility.js
 */

const { evaluateSchemeEligibility } = require('../../lambdas/economic-services/eligibility');
const { getSchemeById } = require('../../lambdas/economic-services/schemes');

describe('Economic Eligibility', () => {
    test('marks a complete profile as eligible for KCC', () => {
        const scheme = getSchemeById('kisan-credit-card');
        const result = evaluateSchemeEligibility({
            land_size_acres: 2,
            has_bank_account: true,
            digilocker_verified: true,
        }, scheme);

        expect(result.eligible).toBe(true);
        expect(result.gaps).toHaveLength(0);
        expect(result.confidence).toBeGreaterThan(80);
    });

    test('identifies missing bank and KYC readiness gaps', () => {
        const scheme = getSchemeById('agriculture-infrastructure-fund');
        const result = evaluateSchemeEligibility({
            land_size_acres: 0.5,
            has_bank_account: false,
            digilocker_verified: false,
        }, scheme);

        expect(result.eligible).toBe(false);
        expect(result.gaps.join(' ')).toMatch(/bank account|DigiLocker|eligible landholding/i);
    });
});
