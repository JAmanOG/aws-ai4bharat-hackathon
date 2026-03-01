/**
 * Shared constants used across all modules.
 */

const SUPPORTED_LANGUAGES = {
    en: 'English',
    hi: 'Hindi',
    ta: 'Tamil',
    te: 'Telugu',
    bn: 'Bengali',
    mr: 'Marathi',
    gu: 'Gujarati',
    pa: 'Punjabi',
    kn: 'Kannada',
    ml: 'Malayalam',
    or: 'Odia',
    as: 'Assamese',
};

// Amazon Polly voice IDs for Indian languages
// Uses neural/generative voices where available for higher quality TTS
const POLLY_VOICE_MAP = {
    en: { voiceId: 'Kajal', engine: 'neural', langCode: 'en-IN' },   // English-Indian neural
    hi: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },   // Hindi neural
    ta: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },   // Fallback – translate to Hindi then TTS
    te: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    bn: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    mr: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    gu: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    pa: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    kn: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    ml: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    or: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
    as: { voiceId: 'Kajal', engine: 'neural', langCode: 'hi-IN' },
};

// Amazon Translate language codes
const TRANSLATE_LANG_MAP = {
    en: 'en',
    hi: 'hi',
    ta: 'ta',
    te: 'te',
    bn: 'bn',
    mr: 'mr',
    gu: 'gu',
    pa: 'pa',
    kn: 'kn',
    ml: 'ml',
    or: 'or',
    as: 'as',
};

const COURSE_CATEGORIES = [
    'agriculture',
    'animal-husbandry',
    'handicrafts',
    'digital-literacy',
    'financial-literacy',
    'health-hygiene',
    'entrepreneurship',
    'government-schemes',
    'sustainable-farming',
    'water-management',
];

const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'];

const ENROLLMENT_STATUS = {
    ACTIVE: 'active',
    COMPLETED: 'completed',
    PAUSED: 'paused',
    DROPPED: 'dropped',
};

const MODULE_STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
};

const CONTENT_BUCKET = process.env.CONTENT_BUCKET || 'rural-platform-knowledge-content';

// ── Agriculture Supply Chain Constants ──

const CROP_TYPES = [
    'wheat', 'rice', 'maize', 'soybean', 'cotton', 'sugarcane',
    'mustard', 'chana', 'onion', 'tomato', 'potato', 'brinjal',
    'cauliflower', 'cabbage', 'peas', 'mango', 'banana', 'apple',
    'turmeric', 'chilli', 'garlic', 'ginger', 'groundnut', 'sunflower',
    'jute', 'tea', 'coffee', 'rubber', 'coconut', 'cashew',
];

const BUYER_TYPES = ['wholesaler', 'retailer', 'processor', 'exporter', 'FPO'];

const LISTING_STATUS = {
    ACTIVE: 'active',
    SOLD: 'sold',
    EXPIRED: 'expired',
    CANCELLED: 'cancelled',
};

const TRADE_ORDER_STATUS = {
    PENDING: 'pending',
    ACCEPTED: 'accepted',
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    DISPUTED: 'disputed',
};

const PAYMENT_STATUS = {
    UNPAID: 'unpaid',
    PARTIAL: 'partial',
    PAID: 'paid',
    REFUNDED: 'refunded',
};

const LOGISTICS_STATUS = {
    REQUESTED: 'requested',
    ASSIGNED: 'assigned',
    IN_TRANSIT: 'in_transit',
    DELIVERED: 'delivered',
    CANCELLED: 'cancelled',
};

const VEHICLE_TYPES = ['tractor', 'pickup', 'mini-truck', 'truck', 'tempo'];

const BARGAINING_STATUS = {
    FORMING: 'forming',
    ACTIVE: 'active',
    NEGOTIATING: 'negotiating',
    SOLD: 'sold',
    DISSOLVED: 'dissolved',
};

const QUALITY_GRADES = ['premium', 'standard', 'economy'];

const MARKET_DATA_SOURCES = ['e-NAM', 'agmarknet', 'manual'];

// ── Precision Agriculture Constants ──

const PRECISION_IMAGE_TYPES = ['crop', 'leaf', 'soil', 'field'];
const PRECISION_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];
const FARM_PRACTICE_TYPES = [
    'urea_application',
    'diesel_use',
    'crop_residue_burning',
    'grid_irrigation',
    'flood_irrigation',
    'drip_irrigation',
    'pesticide_spray',
    'pest_scouting',
    'organic_manure',
    'mulching',
    'soil_testing',
];

// ── Economic Services Constants ──

const ECONOMIC_SCHEME_TYPES = ['loan', 'insurance', 'subsidy'];
const FINANCIAL_SEASONS = ['pre-sowing', 'sowing', 'mid-season', 'harvest', 'post-harvest'];
const INSURANCE_CLAIM_STATUS = ['awaiting_consent', 'draft_ready', 'submitted', 'under_review', 'settled'];

// ── Voice Interface Constants ──

const VOICE_LANGUAGES = {
    hi: { name: 'Hindi', bcp47: 'hi-IN', ttsVoice: 'Shubh' },
    en: { name: 'English', bcp47: 'en-IN', ttsVoice: 'Amelia' },
    bn: { name: 'Bengali', bcp47: 'bn-IN', ttsVoice: 'Priya' },
    ta: { name: 'Tamil', bcp47: 'ta-IN', ttsVoice: 'Kavitha' },
    te: { name: 'Telugu', bcp47: 'te-IN', ttsVoice: 'Shreya' },
    mr: { name: 'Marathi', bcp47: 'mr-IN', ttsVoice: 'Ritu' },
    gu: { name: 'Gujarati', bcp47: 'gu-IN', ttsVoice: 'Neha' },
    kn: { name: 'Kannada', bcp47: 'kn-IN', ttsVoice: 'Kavya' },
    ml: { name: 'Malayalam', bcp47: 'ml-IN', ttsVoice: 'Pooja' },
    pa: { name: 'Punjabi', bcp47: 'pa-IN', ttsVoice: 'Simran' },
    or: { name: 'Odia', bcp47: 'od-IN', ttsVoice: 'Roopa' },
    as: { name: 'Assamese', bcp47: 'as-IN', ttsVoice: 'Ishita' },
};

const VOICE_INTENT_DOMAINS = [
    'agriculture_advice',
    'market_prices',
    'weather',
    'government_schemes',
    'health',
    'learning',
    'general',
];

module.exports = {
    SUPPORTED_LANGUAGES,
    POLLY_VOICE_MAP,
    TRANSLATE_LANG_MAP,
    COURSE_CATEGORIES,
    DIFFICULTY_LEVELS,
    ENROLLMENT_STATUS,
    MODULE_STATUS,
    CONTENT_BUCKET,
    // Agriculture
    CROP_TYPES,
    BUYER_TYPES,
    LISTING_STATUS,
    TRADE_ORDER_STATUS,
    PAYMENT_STATUS,
    LOGISTICS_STATUS,
    VEHICLE_TYPES,
    BARGAINING_STATUS,
    QUALITY_GRADES,
    MARKET_DATA_SOURCES,
    PRECISION_IMAGE_TYPES,
    PRECISION_RISK_LEVELS,
    FARM_PRACTICE_TYPES,
    ECONOMIC_SCHEME_TYPES,
    FINANCIAL_SEASONS,
    INSURANCE_CLAIM_STATUS,
    VOICE_LANGUAGES,
    VOICE_INTENT_DOMAINS,
};
