/**
 * Centralized API configuration.
 * All backend base URLs are now fetched from environment variables.
 */

const API_CONFIG = {
  /** Feature 1 — Open Data Export (port 3001) */
  OPEN_DATA_BASE: process.env.EXPO_PUBLIC_API_FEATURE_1 || 'http://localhost:3001',

  /** Feature 2 — Community, Voice Rooms, Government (port 3002) */
  COMMUNITY_BASE: process.env.EXPO_PUBLIC_API_FEATURE_2 || 'http://localhost:3002',

  /** Feature 3 — Health Services (port 3003) */
  HEALTH_BASE: process.env.EXPO_PUBLIC_API_FEATURE_3 || 'http://localhost:3003',

  AWS: {
    region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
    endpoint: process.env.EXPO_PUBLIC_AWS_ENDPOINT || 'http://localhost:4566',
    credentials: {
      accessKeyId: process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY || 'test',
      sessionToken: process.env.EXPO_PUBLIC_AWS_SESSION_TOKEN || 'test',
    },
  },
  AGORA_APP_ID: process.env.EXPO_PUBLIC_AGORA_APP_ID || process.env.AGORA_APP_ID || '10b05d0636634fb7b108be1a94a9babf',
};



/**
 * Mock users for demo mode.
 */
export const MOCK_USERS = [
  {
    id: '4edbc9c5-ebc5-421f-8ea5-c75ce0904baa',
    name: 'Rural User',
    language: 'hi',
    state: 'Maharashtra',
  },
  {
    id: '550e8400-e29b-41d4-a716-446655440000',
    name: 'Farmer Joe',
    language: 'en',
    state: 'Punjab',
  }
];

// In-memory user selection (resets on app restart unless we use AsyncStorage)
let currentUserIndex = 0;

export const getMockUser = () => MOCK_USERS[currentUserIndex];
export const switchMockUser = (index: number) => {
  if (index >= 0 && index < MOCK_USERS.length) {
    currentUserIndex = index;
    console.log(`[AUTH] Switched to mock user: ${MOCK_USERS[index].name} (${MOCK_USERS[index].id})`);
  }
};


export default API_CONFIG;
