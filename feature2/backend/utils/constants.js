/**
 * Shared constants for the Rural Community Platform.
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
};

const BUSINESS_CATEGORIES = [
  'dairy',
  'poultry-livestock',
  'apiculture-forest-produce',
  'agriculture-horticulture',
  'textiles-handicrafts',
  'food-processing',
  'rural-services',
  'trading-retail',
];

const KNOWLEDGE_TOPICS = [
  'agriculture',
  'livestock',
  'business',
  'government',
  'infrastructure',
  'general',
];

const GOVT_PORTAL_CATEGORIES = [
  'infrastructure',
  'roads',
  'water',
  'electricity',
  'sanitation',
  'general',
];

const SCHEME_CATEGORIES = [
  'housing',
  'roads-transport',
  'water-sanitation',
  'electricity-energy',
  'agriculture-irrigation',
  'rural-development',
  'health-nutrition',
  'education-skill',
];

const LIVELIHOOD_CATEGORIES = [
  'crop_failure',
  'livestock_loss',
  'business_closure',
  'natural_disaster',
  'unemployment',
];

const VOICE_ROOM_ROLES = {
  MODERATOR: 'moderator',
  SPEAKER: 'speaker',
  LISTENER: 'listener',
};

const VOICE_ROOM_STATUS = {
  ACTIVE: 'active',
  ENDED: 'ended',
};

const MAX_ROOM_PARTICIPANTS = 50;
const RECONNECT_WINDOW_MS = 30000;

module.exports = {
  SUPPORTED_LANGUAGES,
  BUSINESS_CATEGORIES,
  KNOWLEDGE_TOPICS,
  GOVT_PORTAL_CATEGORIES,
  SCHEME_CATEGORIES,
  LIVELIHOOD_CATEGORIES,
  VOICE_ROOM_ROLES,
  VOICE_ROOM_STATUS,
  MAX_ROOM_PARTICIPANTS,
  RECONNECT_WINDOW_MS,
};
