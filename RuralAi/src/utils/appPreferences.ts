import * as SecureStore from "expo-secure-store";

export const APP_PREFERENCE_KEYS = {
  ttsEnabled: "rural_ai_tts_enabled",
  lowDataMode: "rural_ai_low_data_mode",
  autoListen: "rural_ai_auto_listen",
} as const;

export async function readStoredBooleanPreference(key: string, fallback: boolean) {
  const stored = await SecureStore.getItemAsync(key);
  if (stored == null) {
    return fallback;
  }
  return stored === "true";
}

export async function writeStoredBooleanPreference(key: string, value: boolean) {
  await SecureStore.setItemAsync(key, value ? "true" : "false");
  return value;
}
