/**
 * Precision Agriculture – carbon footprint scoring.
 * Req 6.3: Calculate footprint and suggest reduction methods.
 */

const EMISSION_FACTORS = {
    urea_application: { unit: 'kg', factor: 1.98, label: 'Urea use' },
    diesel_use: { unit: 'litre', factor: 2.68, label: 'Diesel use' },
    crop_residue_burning: { unit: 'acre', factor: 180, label: 'Residue burning' },
    grid_irrigation: { unit: 'kwh', factor: 0.82, label: 'Electric irrigation' },
    pesticide_spray: { unit: 'spray', factor: 6, label: 'Pesticide spray cycle' },
};

function classifyCarbonIntensity(total) {
    if (total >= 250) return 'high';
    if (total >= 100) return 'medium';
    return 'low';
}

function buildReductionSuggestions(breakdown) {
    return breakdown
        .slice()
        .sort((a, b) => b.emissions_kg_co2e - a.emissions_kg_co2e)
        .slice(0, 3)
        .map((entry) => {
            if (entry.practice_type === 'urea_application') {
                return 'Split nitrogen application and combine it with soil-test-based dosing or neem-coated urea.';
            }
            if (entry.practice_type === 'diesel_use') {
                return 'Bundle field operations and avoid unnecessary diesel pump runtime.';
            }
            if (entry.practice_type === 'crop_residue_burning') {
                return 'Avoid residue burning; prefer mulching, composting, or incorporation into soil.';
            }
            if (entry.practice_type === 'grid_irrigation') {
                return 'Shift irrigation to shorter targeted turns and improve pump scheduling.';
            }
            return 'Review this input and replace blanket applications with need-based use.';
        });
}

function calculateCarbonScore(payload) {
    const practices = Array.isArray(payload.practices) ? payload.practices : [];

    const breakdown = practices
        .map((entry) => {
            const practiceType = String(entry.practice_type || '').toLowerCase();
            const factor = EMISSION_FACTORS[practiceType];

            if (!factor) {
                return {
                    practice_type: practiceType || 'unknown',
                    quantity: Number(entry.quantity || 0),
                    unit: entry.unit || 'unknown',
                    emissions_kg_co2e: 0,
                    counted: false,
                };
            }

            const quantity = Number(entry.quantity || 0);
            return {
                practice_type: practiceType,
                label: factor.label,
                quantity,
                unit: entry.unit || factor.unit,
                emissions_kg_co2e: Number((quantity * factor.factor).toFixed(2)),
                counted: true,
            };
        });

    const total = Number(
        breakdown.reduce((sum, entry) => sum + entry.emissions_kg_co2e, 0).toFixed(2)
    );

    return {
        total_emissions_kg_co2e: total,
        carbon_intensity: classifyCarbonIntensity(total),
        breakdown,
        recommendations: buildReductionSuggestions(breakdown),
        assumptions: [
            'Emission factors are simplified hackathon baselines for advisory use.',
            'Use farm-specific agronomy guidance before changing nutrient or pest management plans.',
        ],
        generatedAt: new Date().toISOString(),
    };
}

module.exports = {
    EMISSION_FACTORS,
    calculateCarbonScore,
};
