/**
 * Unit tests for shared precision agriculture constants.
 */

const {
    PRECISION_IMAGE_TYPES,
    PRECISION_RISK_LEVELS,
    FARM_PRACTICE_TYPES,
} = require('../../utils/constants');

describe('Precision Agriculture Constants', () => {
    test('defines supported image types for precision analysis', () => {
        expect(PRECISION_IMAGE_TYPES).toEqual(
            expect.arrayContaining(['crop', 'leaf', 'soil', 'field'])
        );
    });

    test('defines risk levels in increasing severity', () => {
        expect(PRECISION_RISK_LEVELS).toEqual(['low', 'medium', 'high', 'critical']);
    });

    test('includes core practice types used by the precision module', () => {
        expect(FARM_PRACTICE_TYPES).toEqual(
            expect.arrayContaining(['urea_application', 'pesticide_spray', 'soil_testing'])
        );
    });
});
