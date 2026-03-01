/**
 * Centralized API configuration.
 * All backend base URLs in one place — fill in after deployment.
 */

// TODO: Replace with actual API Gateway URLs after SAM deployment
const API_CONFIG = {
  /** Feature 1 — Community, Voice Rooms, Government */
  FEATURE1_BASE: 'https://YOUR_FEATURE1_API.execute-api.ap-south-1.amazonaws.com/Prod',

  /** Feature 2 — Knowledge, Learning Paths, Peer Groups */
  FEATURE2_BASE: 'https://YOUR_FEATURE2_API.execute-api.ap-south-1.amazonaws.com/Prod',

  /** Feature 3 — Open Data Export */
  FEATURE3_BASE: 'https://YOUR_FEATURE3_API.execute-api.ap-south-1.amazonaws.com/Prod',

  /** Feature 4 — Health Services */
  FEATURE4_BASE: 'https://YOUR_FEATURE4_API.execute-api.ap-south-1.amazonaws.com/Prod',

  /** Feature 6 — Agriculture + Economics */
  FEATURE6_BASE: 'https://YOUR_FEATURE6_API.execute-api.ap-south-1.amazonaws.com/Prod',
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
