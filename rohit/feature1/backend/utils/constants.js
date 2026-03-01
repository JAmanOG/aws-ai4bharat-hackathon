/**
 * Constants for the Open Data Service.
 */

// ── Service Base URLs (set via SAM template env vars) ──
const FEATURE1_API_BASE = process.env.FEATURE1_API_BASE || 'http://localhost:3001';
const FEATURE2_API_BASE = process.env.FEATURE2_API_BASE || 'http://localhost:3002';

// ── Upstream service endpoints (relative to base) ──
const SERVICE_ENDPOINTS = {
  profile: {
    base: FEATURE1_API_BASE,
    path: (userId) => `/community/users/${userId}`,
    service: 'feature1',
  },
  community_posts: {
    base: FEATURE1_API_BASE,
    path: (userId) => `/community/posts?authorId=${userId}&limit=100`,
    service: 'feature1',
  },
  businesses: {
    base: FEATURE1_API_BASE,
    path: (userId) => `/community/businesses?ownerId=${userId}&limit=100`,
    service: 'feature1',
  },
  complaints: {
    base: FEATURE1_API_BASE,
    path: (userId) => `/community/government/complaints?userId=${userId}&limit=100`,
    service: 'feature1',
  },
  courses: {
    base: FEATURE2_API_BASE,
    path: () => `/knowledge/my-courses`,
    service: 'feature2',
  },
  learning_profile: {
    base: FEATURE2_API_BASE,
    path: () => `/knowledge/learning-profile`,
    service: 'feature2',
  },
};

// All valid service keys for filtering
const VALID_SERVICES = Object.keys(SERVICE_ENDPOINTS);

// ── Rate Limiting ──
const RATE_LIMIT = {
  maxExports: parseInt(process.env.RATE_LIMIT_MAX || '5', 10),
  windowHours: parseInt(process.env.RATE_LIMIT_WINDOW_HOURS || '1', 10),
};

// ── Export Formats ──
const EXPORT_FORMATS = ['json', 'csv'];

module.exports = {
  FEATURE1_API_BASE,
  FEATURE2_API_BASE,
  SERVICE_ENDPOINTS,
  VALID_SERVICES,
  RATE_LIMIT,
  EXPORT_FORMATS,
};
