/**
 * Shared constants used across the Knowledge module.
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

module.exports = {
    SUPPORTED_LANGUAGES,
    POLLY_VOICE_MAP,
    TRANSLATE_LANG_MAP,
    COURSE_CATEGORIES,
    DIFFICULTY_LEVELS,
    ENROLLMENT_STATUS,
    MODULE_STATUS,
    CONTENT_BUCKET,
};
