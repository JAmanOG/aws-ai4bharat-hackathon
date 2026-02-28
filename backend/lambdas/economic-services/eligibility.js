/**
 * Economic Services – loan and scheme eligibility assessment.
 * Req 8.2: Assess loan eligibility based on farming data.
 */

const { getEconomicProfile } = require('./profile');
const { getSchemeById } = require('./schemes');

function evaluateSchemeEligibility(profile, scheme) {
    const reasons = [];
    const gaps = [];

    if ((profile.land_size_acres || 0) >= scheme.min_land_acres) {
        reasons.push(`Land size meets the minimum ${scheme.min_land_acres} acre requirement.`);
    } else {
        gaps.push(`Increase or document at least ${scheme.min_land_acres} acre of eligible landholding.`);
    }

    if (scheme.requires_bank_account) {
        if (profile.has_bank_account) reasons.push('Bank account requirement is satisfied.');
        else gaps.push('A bank account is required before application.');
    }

    if (profile.digilocker_verified) {
        reasons.push('DigiLocker verification can speed up document readiness.');
    } else {
        gaps.push('Complete DigiLocker verification to simplify KYC and document checks.');
    }

    return {
        eligible: gaps.length === 0,
        reasons,
        gaps,
        confidence: gaps.length === 0 ? 88 : Math.max(45, 80 - gaps.length * 12),
    };
}

async function assessLoanEligibility(userId, payload = {}) {
    const profile = payload.profile || await getEconomicProfile(userId);
    if (!profile) {
        return {
            eligible: false,
            message: 'Economic profile not found. Save land, crop, and bank details first.',
            missing_profile: true,
        };
    }

    const schemeIds = Array.isArray(payload.scheme_ids) && payload.scheme_ids.length
        ? payload.scheme_ids
        : ['kisan-credit-card', 'agriculture-infrastructure-fund'];

    const assessments = schemeIds
        .map(getSchemeById)
        .filter(Boolean)
        .map((scheme) => ({
            scheme_id: scheme.id,
            scheme_name: scheme.name,
            ...evaluateSchemeEligibility(profile, scheme),
            documents_required: scheme.documents_required,
        }));

    return {
        userId,
        profile_summary: {
            land_size_acres: profile.land_size_acres || 0,
            crop_types: profile.crop_types || [],
            has_bank_account: !!profile.has_bank_account,
            digilocker_verified: !!profile.digilocker_verified,
        },
        assessments,
        generatedAt: new Date().toISOString(),
    };
}

module.exports = {
    assessLoanEligibility,
    evaluateSchemeEligibility,
};
