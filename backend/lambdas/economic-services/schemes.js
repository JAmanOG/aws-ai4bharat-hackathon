/**
 * Economic Services – government scheme catalog and filtering.
 * Req 8.1: Access to relevant government loan schemes.
 */

const SCHEME_CATALOG = [
    {
        id: 'kisan-credit-card',
        name: 'Kisan Credit Card',
        type: 'loan',
        provider: 'Government of India',
        summary: 'Working capital support for crop cultivation and allied farm activities.',
        states: ['all'],
        min_land_acres: 0.25,
        requires_bank_account: true,
        recommended_for: ['crop cultivation', 'seasonal input purchase'],
        documents_required: ['Aadhaar', 'land record', 'bank account details'],
        benefit_summary: 'Flexible crop loan access with interest support for eligible farmers.',
    },
    {
        id: 'agriculture-infrastructure-fund',
        name: 'Agriculture Infrastructure Fund',
        type: 'loan',
        provider: 'Government of India',
        summary: 'Medium to long-term financing for farm-gate and post-harvest infrastructure.',
        states: ['all'],
        min_land_acres: 1,
        requires_bank_account: true,
        recommended_for: ['storage', 'grading', 'packaging', 'FPO investment'],
        documents_required: ['Aadhaar', 'project plan', 'bank account details'],
        benefit_summary: 'Interest subvention support for eligible agricultural infrastructure projects.',
    },
    {
        id: 'pmfby',
        name: 'Pradhan Mantri Fasal Bima Yojana',
        type: 'insurance',
        provider: 'Government of India',
        summary: 'Crop insurance support for notified crops against weather and yield losses.',
        states: ['all'],
        min_land_acres: 0,
        requires_bank_account: true,
        recommended_for: ['crop loss protection'],
        documents_required: ['Aadhaar', 'bank account details', 'land record', 'crop sown details'],
        benefit_summary: 'Insurance support to reduce financial loss after crop damage.',
    },
    {
        id: 'state-farm-mechanization',
        name: 'State Farm Mechanization Support',
        type: 'subsidy',
        provider: 'State Agriculture Department',
        summary: 'Subsidy guidance for small farm tools and mechanization support.',
        states: ['madhya pradesh', 'maharashtra', 'uttar pradesh', 'gujarat', 'karnataka'],
        min_land_acres: 0.5,
        requires_bank_account: true,
        recommended_for: ['farm machinery purchase'],
        documents_required: ['Aadhaar', 'land record', 'quotation', 'bank account details'],
        benefit_summary: 'Partial subsidy support for farm equipment, subject to state availability.',
    },
];

function simplifyScheme(scheme) {
    return {
        id: scheme.id,
        name: scheme.name,
        type: scheme.type,
        provider: scheme.provider,
        summary: scheme.summary,
        benefit_summary: scheme.benefit_summary,
        documents_required: scheme.documents_required,
        recommended_for: scheme.recommended_for,
    };
}

function filterSchemes(filters = {}) {
    const state = String(filters.state || '').toLowerCase();
    const type = String(filters.type || '').toLowerCase();
    const search = String(filters.search || '').toLowerCase();
    const landSize = Number(filters.land_size_acres || 0);

    const schemes = SCHEME_CATALOG.filter((scheme) => {
        if (type && scheme.type !== type) return false;
        if (search) {
            const haystack = `${scheme.name} ${scheme.summary} ${(scheme.recommended_for || []).join(' ')}`.toLowerCase();
            if (!haystack.includes(search)) return false;
        }
        if (state && !(scheme.states.includes('all') || scheme.states.includes(state))) return false;
        if (landSize && landSize < scheme.min_land_acres) return false;
        return true;
    }).map(simplifyScheme);

    return {
        schemes,
        count: schemes.length,
        available_types: ['loan', 'insurance', 'subsidy'],
    };
}

function getSchemeById(schemeId) {
    return SCHEME_CATALOG.find((scheme) => scheme.id === schemeId) || null;
}

module.exports = {
    SCHEME_CATALOG,
    filterSchemes,
    getSchemeById,
};
