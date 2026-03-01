/**
 * Environment configuration for the RuralAi app.
 * Centralizes API base URL and feature flags.
 */

import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach host localhost;
// iOS simulator and web use localhost directly.
const LOCALHOST =
  Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const ENV = {
  /** Backend API base URL (no trailing slash) */
  API_BASE_URL:
    process.env.EXPO_PUBLIC_API_URL ?? `http://${LOCALHOST}:3000`,

  /** User ID header sent in dev/demo mode */
  DEMO_USER_ID: process.env.EXPO_PUBLIC_DEMO_USER_ID ?? 'demo-user',

  /** Request timeout in ms */
  REQUEST_TIMEOUT: 15_000,

  /** Whether to log API calls to console */
  DEBUG_API: __DEV__,
} as const;
