/**
 * Lightweight API client for the Rural Ecosystem Platform backend.
 * Uses native fetch (available in React Native) — no extra deps needed.
 */

import { ENV } from '../config/env';

/* ────────────────────────────────────────────── */
/*  Types                                          */
/* ────────────────────────────────────────────── */

export interface ApiError {
  status: number;
  message: string;
  details?: unknown;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/* ────────────────────────────────────────────── */
/*  Core fetch wrapper                             */
/* ────────────────────────────────────────────── */

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, ENV.API_BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== '') url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

async function request<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, params, headers = {}, signal } = opts;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ENV.REQUEST_TIMEOUT);

  const fetchOpts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': ENV.DEMO_USER_ID,
      ...headers,
    },
    signal: signal ?? controller.signal,
  };

  if (body && method !== 'GET') {
    fetchOpts.body = JSON.stringify(body);
  }

  const url = buildUrl(path, params);

  if (ENV.DEBUG_API) {
    console.log(`[API] ${method} ${url}`, body ?? '');
  }

  try {
    const res = await fetch(url, fetchOpts);

    let json: any;
    const text = await res.text();
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = { raw: text };
    }

    if (!res.ok) {
      const err: ApiError = {
        status: res.status,
        message: json?.error ?? json?.message ?? res.statusText,
        details: json?.details,
      };
      throw err;
    }

    return json as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw { status: 408, message: 'Request timed out' } as ApiError;
    }
    // Re-throw ApiError as-is
    if (err.status) throw err;
    // Network error
    throw { status: 0, message: err.message ?? 'Network error' } as ApiError;
  } finally {
    clearTimeout(timeout);
  }
}

/* ────────────────────────────────────────────── */
/*  Convenience methods                            */
/* ────────────────────────────────────────────── */

const api = {
  get: <T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>, signal?: AbortSignal) =>
    request<T>(path, { method: 'GET', params, signal }),

  post: <T = unknown>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal }),

  put: <T = unknown>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body }),

  delete: <T = unknown>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};

export default api;

/* ────────────────────────────────────────────── */
/*  Domain-specific API functions                  */
/* ────────────────────────────────────────────── */

// ═══════════ Health Check ═══════════

export const healthCheck = () => api.get<{ status: string; version: string }>('/health');

// ═══════════ Market Data (Req 5) ═══════════

export interface PriceEntry {
  mandi_name: string;
  price_per_quintal: number;
  state: string;
  district: string;
  date: string;
  change?: 'up' | 'down' | 'same';
}

export interface PricesResult {
  crop: string;
  prices: PriceEntry[];
  summary: { average_price: number; min_price: number; max_price: number; mandi_count: number };
  last_updated: string;
}

export const marketApi = {
  getPrices: (crop: string, state?: string, district?: string) =>
    api.get<PricesResult>(`/agriculture/prices/${encodeURIComponent(crop)}`, { state, district }),

  getPriceTrend: (crop: string, mandiCode?: string, days = 30) =>
    api.get(`/agriculture/prices/${encodeURIComponent(crop)}/trend`, { mandi_code: mandiCode, days }),

  getMandis: (state?: string) =>
    api.get<{ mandis: Array<{ name: string; code: string; state: string; district: string }> }>('/agriculture/mandis', { state }),

  getMandiPrices: (mandiName: string) =>
    api.get(`/agriculture/mandis/${encodeURIComponent(mandiName)}/prices`),
};

// ═══════════ Price Alerts (Req 5) ═══════════

export interface PriceAlert {
  alert_id: string;
  crop_type: string;
  target_price?: number;
  direction?: string;
  active: boolean;
  created_at: string;
}

export const alertsApi = {
  getAlerts: () =>
    api.get<{ alerts: PriceAlert[] }>('/agriculture/alerts'),

  createAlert: (body: { crop_type: string; target_price?: number; direction?: string }) =>
    api.post<PriceAlert>('/agriculture/alerts', body),

  deleteAlert: (id: string) =>
    api.delete(`/agriculture/alerts/${id}`),
};

// ═══════════ Supply Chain (Req 5) ═══════════

export const supplyChainApi = {
  searchListings: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get('/agriculture/listings', params),

  createListing: (body: { crop_type: string; quantity_kg: number; [k: string]: unknown }) =>
    api.post('/agriculture/listings', body),

  getMyListings: (status?: string) =>
    api.get('/agriculture/listings/my', { status }),

  getListing: (id: string) =>
    api.get(`/agriculture/listings/${id}`),

  searchBuyers: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get('/agriculture/buyers', params),
};

// ═══════════ Logistics (Req 5) ═══════════

export const logisticsApi = {
  getBargainingGroups: (cropType?: string) =>
    api.get('/agriculture/bargaining/groups', { crop_type: cropType }),

  getLogisticsQuote: (body: { origin: object; destination: object; quantity_kg: number }) =>
    api.post('/agriculture/logistics/quote', body),

  getTransportOptions: (origin?: string, destination?: string) =>
    api.get('/agriculture/logistics/options', { origin, destination }),
};

// ═══════════ Precision Agriculture (Req 6) ═══════════

export const precisionApi = {
  analyzeSoil: (body: { location: object; crop_type: string; soil_data?: object }) =>
    api.post('/agriculture/precision/analyze', body),

  analyzePestDisease: (body: { crop_type: string; symptoms: string[]; image_url?: string }) =>
    api.post('/agriculture/precision/pest-disease/analyze', body),

  calculateCarbon: (body: { land_size_acres: number; crop_type: string; practices: string[] }) =>
    api.post('/agriculture/precision/carbon/calculate', body),

  getWeatherAdvisory: (lat: number, lon: number, cropType?: string) =>
    api.get('/agriculture/precision/weather/advisory', { lat, lon, crop_type: cropType }),

  getPractices: () =>
    api.get('/agriculture/precision/practices'),

  logPractice: (body: { practice_type: string; crop_type: string }) =>
    api.post('/agriculture/precision/practices', body),
};

// ═══════════ Knowledge (Req 7) ═══════════

export interface Course {
  course_id: string;
  title: string;
  description: string;
  difficulty: string;
  language: string;
  estimated_hours: number;
  modules: Array<{ module_id: string; title: string }>;
}

export const knowledgeApi = {
  getCourses: (language?: string, difficulty?: string) =>
    api.get<{ courses: Course[] }>('/knowledge/courses', { language, difficulty }),

  getMyCourses: () =>
    api.get('/knowledge/my-courses'),

  getPeerGroups: () =>
    api.get('/knowledge/peer-groups'),

  getRecommendations: () =>
    api.get('/knowledge/recommendations'),

  getLearningProfile: () =>
    api.get('/knowledge/learning-profile'),

  getGovtCourses: () =>
    api.get('/knowledge/govt-courses'),

  getProgressSummary: () =>
    api.get('/knowledge/progress-summary'),
};

// ═══════════ Economic Services (Req 8) ═══════════

export interface Scheme {
  id: string;
  name: string;
  type: string;
  provider: string;
  summary: string;
  benefit_summary: string;
  states: string[];
  min_land_acres: number;
  requires_bank_account: boolean;
  recommended_for: string[];
  documents_required: string[];
  apply_url?: string;
  helpline?: string;
  verified?: boolean;
}

export const economicsApi = {
  getProfile: () =>
    api.get('/economics/profile'),

  updateProfile: (body: Record<string, unknown>) =>
    api.post('/economics/profile', body),

  getSchemes: (params?: { category?: string; state?: string }) =>
    api.get<{ schemes: Scheme[] }>('/economics/schemes', params),

  getScheme: (id: string) =>
    api.get<Scheme>(`/economics/schemes/${id}`),

  assessEligibility: (body: Record<string, unknown>) =>
    api.post('/economics/eligibility/assess', body),

  getSavingsPlan: (body: Record<string, unknown>) =>
    api.post('/economics/savings/plan', body),

  createInsuranceClaim: (body: Record<string, unknown>) =>
    api.post('/economics/insurance/claims', body),

  getInsuranceClaims: (limit = 20) =>
    api.get('/economics/insurance/claims', { limit }),

  getNudges: (limit = 20) =>
    api.get('/economics/nudges', { limit }),
};

// ═══════════ Voice (Req 2) ═══════════

export const voiceApi = {
  chat: (text: string, opts?: { language_code?: string; session_id?: string; generate_audio?: boolean }) =>
    api.post('/voice/chat', { text, language_code: opts?.language_code ?? 'hi', session_id: opts?.session_id, generate_audio: opts?.generate_audio ?? true }),

  synthesize: (text: string, languageCode = 'hi') =>
    api.post<{ audio_base64: string; request_id: string }>('/voice/synthesize', { text, language_code: languageCode }),

  translate: (text: string, targetLanguage: string, sourceLanguage = 'auto') =>
    api.post<{ translated_text: string }>('/voice/translate', { text, source_language: sourceLanguage, target_language: targetLanguage }),

  getLanguages: () =>
    api.get<{ languages: Array<{ code: string; bcp47: string; name: string; tts_available: boolean }> }>('/voice/languages'),

  getSessions: (limit = 10) =>
    api.get('/voice/sessions', { limit }),

  getSessionHistory: (sessionId: string, limit = 50) =>
    api.get(`/voice/sessions/${sessionId}`, { limit }),

  getMemoryFacts: () =>
    api.get<{ facts: Record<string, string> }>('/voice/memory/facts'),
};
