import * as SecureStore from "expo-secure-store";

export const LANGUAGE_PREF_KEY = "rural_ai_language_pref";

export const APP_LANGUAGES = [
  { code: "hi", label: "हिन्दी", description: "Hindi" },
  { code: "en", label: "English", description: "English" },
  { code: "mr", label: "मराठी", description: "Marathi" },
  { code: "bn", label: "বাংলা", description: "Bengali" },
  { code: "ta", label: "தமிழ்", description: "Tamil" },
  { code: "te", label: "తెలుగు", description: "Telugu" },
  { code: "gu", label: "ગુજરાતી", description: "Gujarati" },
  { code: "kn", label: "ಕನ್ನಡ", description: "Kannada" },
  { code: "pa", label: "ਪੰਜਾਬੀ", description: "Punjabi" },
  { code: "ml", label: "മലയാളം", description: "Malayalam" },
  { code: "or", label: "ଓଡ଼ିଆ", description: "Odia" },
  { code: "as", label: "অসমীয়া", description: "Assamese" },
] as const;

const SHORT_TO_BCP47: Record<string, string> = {
  hi: "hi-IN",
  en: "en-IN",
  mr: "mr-IN",
  bn: "bn-IN",
  ta: "ta-IN",
  te: "te-IN",
  gu: "gu-IN",
  kn: "kn-IN",
  pa: "pa-IN",
  ml: "ml-IN",
  or: "or-IN",
  as: "as-IN",
};

export function normalizeAppLanguage(code?: string | null) {
  if (!code) return "hi";
  const cleaned = String(code).trim().toLowerCase();
  if (!cleaned) return "hi";
  return cleaned.includes("-") ? cleaned.split("-")[0] : cleaned;
}

export function toVoiceLanguageCode(code?: string | null) {
  const normalized = normalizeAppLanguage(code);
  return SHORT_TO_BCP47[normalized] ?? `${normalized}-IN`;
}

export async function readStoredLanguagePreference() {
  const stored = await SecureStore.getItemAsync(LANGUAGE_PREF_KEY);
  return stored ? normalizeAppLanguage(stored) : null;
}

export async function writeStoredLanguagePreference(code: string) {
  const normalized = normalizeAppLanguage(code);
  await SecureStore.setItemAsync(LANGUAGE_PREF_KEY, normalized);
  return normalized;
}
