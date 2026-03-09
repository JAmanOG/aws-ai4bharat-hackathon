/**
 * Environment configuration for the RuralAi app.
 * Centralizes API base URL and feature flags.
 *
 * For real-device testing, set EXPO_PUBLIC_API_URL before starting Expo:
 *   EXPO_PUBLIC_API_URL=http://192.168.x.x:3000 npx expo start
 * Or point to the production ALB:
 *   EXPO_PUBLIC_API_URL=http://rural-alb-dev-2139845854.ap-south-1.elb.amazonaws.com
 *
 * Note: Current ALB endpoint is HTTP-only. Android release builds require
 * `expo.android.usesCleartextTraffic = true` in app.json for this URL.
 */

import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach host localhost;
// iOS simulator and web use localhost directly.
// Real devices MUST set EXPO_PUBLIC_API_URL — these fallbacks only work in emulator.
const LOCALHOST =
  Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const ENV = {
  /** Backend API base URL (no trailing slash) */
  API_BASE_URL:
    process.env.EXPO_PUBLIC_API_URL ??
    'http://rural-alb-dev-2139845854.ap-south-1.elb.amazonaws.com',

  /** User ID header sent in dev/demo mode */
  DEMO_USER_ID: process.env.EXPO_PUBLIC_DEMO_USER_ID ?? 'demo-user',

  /** Default request timeout in ms (for most API calls) */
  REQUEST_TIMEOUT: 15_000,

  /** Extended timeout for voice/audio endpoints (STT + LLM + TTS pipeline) */
  VOICE_REQUEST_TIMEOUT: 60_000,

  /** Whether to log API calls to console */
  DEBUG_API: __DEV__,
} as const;
