/**
 * Aggregator — calls feature1 and feature2 APIs in parallel,
 * passes responses through adapters, and returns a unified export object.
 */

const axios = require('axios');
const { SERVICE_ENDPOINTS, VALID_SERVICES } = require('../../utils/constants');
const adapters = require('./adapters');

// Map service key → adapter function
const ADAPTER_MAP = {
  profile: adapters.adaptProfile,
  community_posts: adapters.adaptCommunityPosts,
  businesses: adapters.adaptBusinesses,
  complaints: adapters.adaptComplaints,
  courses: adapters.adaptCourses,
  learning_profile: adapters.adaptLearningProfile,
};

// Map service key → response data extractor (some APIs wrap data in a key)
const DATA_EXTRACTORS = {
  profile: (data) => data,
  community_posts: (data) => data.posts || data,
  businesses: (data) => data.businesses || data,
  complaints: (data) => data.complaints || data,
  courses: (data) => data.courses || data,
  learning_profile: (data) => data,
};

/**
 * Fetch data from a single service endpoint.
 * Returns { key, data } on success, { key, data: null, error } on failure.
 */
async function fetchService(key, userId, authToken) {
  const endpoint = SERVICE_ENDPOINTS[key];
  if (!endpoint) return { key, data: null, error: 'Unknown service' };

  const url = `${endpoint.base}${endpoint.path(userId)}`;

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = authToken;
    headers['X-User-Id'] = userId;

    const response = await axios.get(url, { headers, timeout: 10000 });
    const rawData = response.data;
    const extractedData = DATA_EXTRACTORS[key](rawData);

    return { key, data: extractedData };
  } catch (err) {
    console.warn(`[Aggregator] Failed to fetch ${key} from ${url}:`, err.message);
    return { key, data: null, error: err.message };
  }
}

/**
 * Aggregate user data from all (or selected) services.
 *
 * @param {string} userId
 * @param {string[]} serviceKeys — which services to include (default: all)
 * @param {string} authToken — forwarded auth token
 * @returns {object} — unified export object
 */
async function aggregateUserData(userId, serviceKeys = VALID_SERVICES, authToken = null) {
  // Filter to valid service keys only
  const keys = serviceKeys.filter(k => VALID_SERVICES.includes(k));
  if (keys.length === 0) {
    throw new Error('INVALID_SERVICES');
  }

  // Fetch all services in parallel
  const results = await Promise.all(
    keys.map(key => fetchService(key, userId, authToken))
  );

  // Build the export object
  const exportData = {
    export_metadata: {
      user_id: userId,
      exported_at: new Date().toISOString(),
      services_included: keys.filter(k => results.find(r => r.key === k && r.data !== null)),
      services_failed: keys.filter(k => results.find(r => r.key === k && r.data === null)),
      format: 'json',
    },
  };

  // Run each result through its adapter
  for (const { key, data } of results) {
    const adapter = ADAPTER_MAP[key];
    if (adapter && data !== null) {
      exportData[key] = adapter(data);
    } else if (data === null) {
      exportData[key] = key === 'profile' || key === 'learning_profile' ? null : [];
    }
  }

  return exportData;
}

module.exports = { aggregateUserData, fetchService };
