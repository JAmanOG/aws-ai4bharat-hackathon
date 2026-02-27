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
const POLLY_VOICE_MAP = {
    en: { voiceId: 'Aditi', engine: 'standard' },   // English-Indian accent
    hi: { voiceId: 'Aditi', engine: 'standard' },   // Hindi
    ta: { voiceId: 'Aditi', engine: 'standard' },   // Fallback – translate first then TTS
    te: { voiceId: 'Aditi', engine: 'standard' },
    bn: { voiceId: 'Aditi', engine: 'standard' },
    mr: { voiceId: 'Aditi', engine: 'standard' },
    gu: { voiceId: 'Aditi', engine: 'standard' },
    pa: { voiceId: 'Aditi', engine: 'standard' },
    kn: { voiceId: 'Aditi', engine: 'standard' },
    ml: { voiceId: 'Aditi', engine: 'standard' },
    or: { voiceId: 'Aditi', engine: 'standard' },
    as: { voiceId: 'Aditi', engine: 'standard' },
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
};
