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
const knowledgeAgent = require('./knowledge');
const generalAgent = require('./general');

/* ─── Domain → Agent mapping ─── */
const AGENTS = {
    agriculture: agricultureAgent,
    market: marketAgent,
    schemes: schemesAgent,
    health: healthAgent,
    knowledge: knowledgeAgent,
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
    crop_price_query: 'market',
    price_trend: 'market',
    mandi_info: 'market',
    mandi_price_query: 'market',
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
    loan_information: 'schemes',
    loan_details: 'schemes',
    insurance_claim: 'schemes',
    insurance_information: 'schemes',
    insurance_details: 'schemes',
    document_help: 'schemes',
    financial_aid: 'schemes',
    financial_overview: 'schemes',
    savings_overview: 'schemes',
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
    medical_report_analysis: 'health',
    health_platform_help: 'health',

    // Knowledge
    request_video: 'knowledge',
    request_article: 'knowledge',
    request_course: 'knowledge',
    knowledge_query: 'knowledge',
    learning_content: 'knowledge',
    training_resources: 'knowledge',
    show_resources: 'knowledge',
    peer_learning: 'knowledge',

    // General
    greeting: 'general',
    general_question: 'general',
    digital_literacy: 'general',
    app_help: 'general',
    weather_info: 'general',
    air_quality_info: 'general',
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
