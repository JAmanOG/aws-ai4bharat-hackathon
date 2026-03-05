/**
 * Agent Registry
 *
 * Central registry for all domain AI agents. Maps intent domains
 * to the appropriate agent handler.
 */

const agricultureAgent = require('./agriculture');
const marketAgent = require('./market');
const schemesAgent = require('./schemes');
const healthAgent = require('./health');
const generalAgent = require('./general');

/* ─── Domain → Agent mapping ─── */
const AGENTS = {
    agriculture: agricultureAgent,
    market: marketAgent,
    schemes: schemesAgent,
    health: healthAgent,
    general: generalAgent,
};

/* ─── Intent → Domain mapping (for fine-grained routing) ─── */
const INTENT_DOMAIN_MAP = {
    // Agriculture
    crop_advice: 'agriculture',
    soil_management: 'agriculture',
    weather_impact: 'agriculture',
    irrigation: 'agriculture',
    pest_disease: 'agriculture',
    farming_technique: 'agriculture',
    seasonal_planning: 'agriculture',
    fertilizer: 'agriculture',
    post_harvest: 'agriculture',
    organic_farming: 'agriculture',

    // Market
    crop_prices: 'market',
    price_trend: 'market',
    mandi_info: 'market',
    sell_timing: 'market',
    buyer_connection: 'market',
    supply_chain: 'market',
    msp_info: 'market',
    transport_logistics: 'market',

    // Schemes
    scheme_eligibility: 'schemes',
    scheme_application: 'schemes',
    subsidy_info: 'schemes',
    loan_info: 'schemes',
    insurance_claim: 'schemes',
    document_help: 'schemes',
    financial_aid: 'schemes',
    deadline_reminder: 'schemes',

    // Health
    symptom_guidance: 'health',
    nutrition_advice: 'health',
    maternal_health: 'health',
    child_health: 'health',
    first_aid: 'health',
    heat_prevention: 'health',
    health_scheme: 'health',
    facility_referral: 'health',

    // General
    greeting: 'general',
    general_question: 'general',
    digital_literacy: 'general',
    app_help: 'general',
    weather_info: 'general',
    unknown: 'general',
};

/**
 * Get agent for a given domain name.
 * @param {string} domain – 'agriculture' | 'market' | 'schemes' | 'health' | 'general'
 * @returns {object} Agent module with handle() method
 */
function getAgent(domain) {
    return AGENTS[domain] || AGENTS.general;
}

/**
 * Resolve domain from a fine-grained intent.
 * @param {string} intent – e.g. 'crop_prices', 'pest_disease'
 * @returns {string} Domain name
 */
function resolveDomain(intent) {
    return INTENT_DOMAIN_MAP[intent] || 'general';
}

/**
 * List all registered agents with their metadata.
 */
function listAgents() {
    return Object.entries(AGENTS).map(([name, agent]) => ({
        name,
        description: agent.description,
        supportedIntents: agent.supportedIntents,
    }));
}

module.exports = {
    getAgent,
    resolveDomain,
    listAgents,
    AGENTS,
    INTENT_DOMAIN_MAP,
};
