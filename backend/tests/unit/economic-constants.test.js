/**
 * Unit tests for shared economic services constants.
 */

const {
    ECONOMIC_SCHEME_TYPES,
    FINANCIAL_SEASONS,
    INSURANCE_CLAIM_STATUS,
} = require('../../utils/constants');

describe('Economic Services Constants', () => {
    test('defines supported scheme types', () => {
        expect(ECONOMIC_SCHEME_TYPES).toEqual(['loan', 'insurance', 'subsidy']);
    });

    test('defines recognized financial seasons', () => {
        expect(FINANCIAL_SEASONS).toEqual(
            expect.arrayContaining(['pre-sowing', 'harvest', 'post-harvest'])
        );
    });

    test('defines insurance claim lifecycle states', () => {
        expect(INSURANCE_CLAIM_STATUS).toEqual(
            expect.arrayContaining(['awaiting_consent', 'draft_ready', 'submitted'])
        );
    });
});
