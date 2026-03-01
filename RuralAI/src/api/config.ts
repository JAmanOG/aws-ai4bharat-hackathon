/**
 * Centralized API configuration.
 * All backend base URLs are now fetched from environment variables.
 */

const API_CONFIG = {
  /** Feature 1 — Community, Voice Rooms, Government */
  FEATURE1_BASE: process.env.API_FEATURE_1 || '',

  /** Feature 3 — Open Data Export */
  FEATURE2_BASE: process.env.API_FEATURE_2 || '',

  /** Feature 4 — Health Services */
  FEATURE3_BASE: process.env.API_FEATURE_3 || '',
};

/**
 * Mock user for demo mode.
 * In production, this comes from Cognito auth.
 */
export const MOCK_USER = {
  id: 'demo-user-001',
  name: 'Rural User',
  language: 'hi',
  state: 'Maharashtra',
};

export default API_CONFIG;
