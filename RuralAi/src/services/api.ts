/**
 * Lightweight API client for the Rural Ecosystem Platform backend.
 * Uses native fetch (available in React Native) — no extra deps needed.
 *
 * Auth: Sends Bearer token when authenticated, falls back to X-User-Id for demo mode.
 */

import { ENV } from '../config/env';
import { logger } from '../utils/logger';

/* ────────────────────────────────────────────── */
/*  Auth token management                          */
/* ────────────────────────────────────────────── */

let _authToken: string | null = null;
let _userId: string = ENV.DEMO_USER_ID;

/** Call from AuthContext when user logs in / out. */
export function setAuthCredentials(token: string | null, userId?: string) {
  _authToken = token;
  _userId = userId || ENV.DEMO_USER_ID;
}

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
  /** Override the default request timeout (ms) */
  timeout?: number;
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
  const { method = 'GET', body, params, headers = {}, signal, timeout } = opts;

  const controller = new AbortController();
  const timeoutMs = timeout ?? ENV.REQUEST_TIMEOUT;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOpts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      // Auth: prefer Bearer token, fall back to X-User-Id for demo mode
      ...(_authToken
        ? { 'Authorization': `Bearer ${_authToken}` }
        : { 'X-User-Id': _userId }),
      ...headers,
    },
    signal: signal ?? controller.signal,
  };

  if (body && method !== 'GET') {
    fetchOpts.body = JSON.stringify(body);
  }

  const url = buildUrl(path, params);

  if (ENV.DEBUG_API) {
    const isVoice = path.startsWith('/voice/');
    logger.info('API', `${method} ${path}`, {
      ...(body ? { bodyKeys: Object.keys(body as any) } : {}),
      ...(isVoice ? { timeout: timeoutMs } : {}),
    });
  }

  try {
    const start = Date.now();
    const res = await fetch(url, fetchOpts);
    const elapsed = Date.now() - start;

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
      logger.error('API', `${method} ${path} → ${res.status} in ${elapsed}ms: ${err.message}`);
      throw err;
    }

    if (ENV.DEBUG_API) {
      logger.debug('API', `${method} ${path} → ${res.status} in ${elapsed}ms`);
    }

    return json as T;
  } catch (err: any) {
    if (err.name === 'AbortError') {
      logger.error('API', `${method} ${path} → TIMEOUT after ${timeoutMs}ms`);
      throw { status: 408, message: 'Request timed out' } as ApiError;
    }
    // Re-throw ApiError as-is
    if (err.status) throw err;
    // Network error
    logger.error('API', `${method} ${path} → NETWORK ERROR: ${err.message}`);
    throw { status: 0, message: err.message ?? 'Network error' } as ApiError;
  } finally {
    clearTimeout(timer);
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

  /** POST with extended timeout (for voice pipeline calls) */
  postVoice: <T = unknown>(path: string, body?: unknown, signal?: AbortSignal) =>
    request<T>(path, { method: 'POST', body, signal, timeout: ENV.VOICE_REQUEST_TIMEOUT }),

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

  updateListingStatus: (id: string, status: string) =>
    api.put(`/agriculture/listings/${id}/status`, { status }),

  searchBuyers: (params?: Record<string, string | number | boolean | undefined>) =>
    api.get('/agriculture/buyers', params),

  registerBuyer: (body: { business_name: string; buyer_type: string; [k: string]: unknown }) =>
    api.post('/agriculture/buyers/register', body),

  getBuyer: (id: string) =>
    api.get(`/agriculture/buyers/${id}`),

  verifyBuyer: (id: string) =>
    api.post(`/agriculture/buyers/${id}/verify`),

  createOrder: (listingId: string, body: { quantity_kg: number; offered_price: number; [k: string]: unknown }) =>
    api.post(`/agriculture/listings/${listingId}/order`, body),

  getOrders: (params?: { role?: string; status?: string }) =>
    api.get('/agriculture/orders', params),

  updateOrder: (id: string, body: Record<string, unknown>) =>
    api.put(`/agriculture/orders/${id}`, body),

  ingestPrices: (body: { records: Array<Record<string, unknown>> }) =>
    api.post('/agriculture/prices/ingest', body),

  checkAlerts: () =>
    api.post('/agriculture/alerts/check'),
};

// ═══════════ Logistics (Req 5) ═══════════

export const logisticsApi = {
  getBargainingGroups: (cropType?: string) =>
    api.get('/agriculture/bargaining/groups', { crop_type: cropType }),

  createBargainingGroup: (body: { crop_type: string; target_quantity_kg: number; [k: string]: unknown }) =>
    api.post('/agriculture/bargaining/groups', body),

  getBargainingGroup: (id: string) =>
    api.get(`/agriculture/bargaining/groups/${id}`),

  joinBargainingGroup: (id: string) =>
    api.post(`/agriculture/bargaining/groups/${id}/join`),

  suggestBargaining: () =>
    api.get('/agriculture/bargaining/suggest'),

  createTransport: (body: { origin: object; destination: object; quantity_kg: number; [k: string]: unknown }) =>
    api.post('/agriculture/logistics', body),

  getTransportRequests: () =>
    api.get('/agriculture/logistics'),

  getVehicleTypes: () =>
    api.get('/agriculture/logistics/vehicles'),

  getTransportById: (id: string) =>
    api.get(`/agriculture/logistics/${id}`),

  updateTransport: (id: string, body: Record<string, unknown>) =>
    api.put(`/agriculture/logistics/${id}`, body),

  estimateTransport: (body: { origin: object; destination: object; quantity_kg: number }) =>
    api.post('/agriculture/logistics/estimate', body),
};

// ═══════════ Precision Agriculture (Req 6) ═══════════

export const precisionApi = {
  analyzeSoil: (body: { location: object; crop_type: string; soil_data?: object }) =>
    api.post('/agriculture/precision/analyze', body),

  analyzePestDisease: (body: { crop_type: string; symptoms: string[]; image_url?: string }) =>
    api.post('/agriculture/precision/pest-disease/analyze', body),

  calculateCarbon: (body: { land_size_acres: number; crop_type: string; practices: Array<{ practice_type: string; frequency?: string }> }) =>
    api.post('/agriculture/precision/carbon/calculate', body),

  getWeatherAdvisory: (body: { lat: number; lon: number; crop_type?: string }) =>
    api.post('/agriculture/precision/weather/advisory', body),

  analyzePractices: (body: { crop_type: string; practices: string[] }) =>
    api.post('/agriculture/precision/practices/analyze', body),

  logPractice: (body: { practice_type: string; crop_type: string; [k: string]: unknown }) =>
    api.post('/agriculture/precision/practices/log', body),

  getPracticeLogs: () =>
    api.get('/agriculture/precision/practices/logs'),
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

  getCourse: (id: string) =>
    api.get('/knowledge/courses/' + id),

  createCourse: (body: { title: string; description: string; difficulty: string; language: string; [k: string]: unknown }) =>
    api.post('/knowledge/courses', body),

  enrollCourse: (courseId: string) =>
    api.post(`/knowledge/courses/${courseId}/enroll`),

  getMyCourses: () =>
    api.get('/knowledge/my-courses'),

  completeModule: (courseId: string, moduleId: string) =>
    api.post(`/knowledge/courses/${courseId}/modules/${moduleId}/complete`),

  getCourseContent: (courseId: string) =>
    api.get(`/knowledge/courses/${courseId}/content`),

  getGovtCourses: () =>
    api.get('/knowledge/govt-courses'),

  getGovtPortals: () =>
    api.get('/knowledge/govt-courses/portals'),

  syncGovtCourses: (body: { portal: string }) =>
    api.post('/knowledge/govt-courses/sync', body),

  autoJoinPeerGroup: () =>
    api.post('/knowledge/peer-groups/join'),

  getMyPeerGroups: () =>
    api.get('/knowledge/peer-groups/my-groups'),

  getPeerGroups: () =>
    api.get('/knowledge/peer-groups'),

  getPeerGroup: (id: string) =>
    api.get(`/knowledge/peer-groups/${id}`),

  joinPeerGroup: (id: string) =>
    api.post(`/knowledge/peer-groups/${id}/join`),

  leavePeerGroup: (id: string) =>
    api.post(`/knowledge/peer-groups/${id}/leave`),

  createPeerGroup: (body: { group_name: string; crop_type?: string; [k: string]: unknown }) =>
    api.post('/knowledge/peer-groups', body),

  startVerification: () =>
    api.post('/knowledge/peer-groups/verify/start'),

  completeVerification: (body: Record<string, unknown>) =>
    api.post('/knowledge/peer-groups/verify/complete', body),

  getRecommendations: () =>
    api.get('/knowledge/recommendations'),

  getRecommendationStatus: () =>
    api.get('/knowledge/recommendations/status'),

  getLearningProfile: () =>
    api.get('/knowledge/learning-profile'),

  updateLearningProfile: (body: Record<string, unknown>) =>
    api.post('/knowledge/learning-profile', body),

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

  generateNudge: (body?: Record<string, unknown>) =>
    api.post('/economics/nudges/generate', body),
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

  deleteMemoryFact: (key: string) =>
    api.delete(`/voice/memory/facts/${encodeURIComponent(key)}`),

  getAgents: () =>
    api.get('/voice/agents'),

  getPipelineHealth: () =>
    api.get('/voice/pipeline/health'),

  transcribe: (body: { audio_base64: string; language_code?: string }) =>
    api.post('/voice/transcribe', body),

  chatAudio: (body: { audio_base64: string; language_code?: string; session_id?: string }) =>
    api.postVoice('/voice/chat/audio', body),
};

// ═══════════ Auth (Req 13) ═══════════

export const authApi = {
  /** Get user profile */
  getProfile: () =>
    api.get<{ success: boolean; profile: Record<string, unknown> }>('/auth/profile'),

  /** Get unified profile (user + memory facts + domain data) */
  getUnifiedProfile: () =>
    api.get<{ success: boolean; profile: Record<string, unknown> }>('/auth/profile/unified'),

  /** Update profile */
  updateProfile: (body: Record<string, unknown>) =>
    api.put('/auth/profile', body),

  /** Get DigiLocker authorization URL */
  getDigilockerUrl: () =>
    api.get<{ authorizationUrl: string }>('/auth/digilocker/authorize'),

  /** Verify Aadhaar via DigiLocker */
  verifyAadhaar: (aadhaarNumber: string) =>
    api.post<{ success: boolean; verified: boolean; maskedAadhaar: string; name: string }>(
      '/auth/digilocker/verify',
      { aadhaarNumber },
    ),

  /** Get personalized recommendations */
  getRecommendations: () =>
    api.get<{ success: boolean; recommendations: Array<Record<string, unknown>> }>('/auth/recommendations'),

  /** Submit feedback on a recommendation */
  submitFeedback: (body: { interactionId?: string; domain?: string; rating: number; action?: string }) =>
    api.post('/auth/recommendations/feedback', body),

  /** Track action on a recommendation */
  trackRecommendationAction: (id: string, body: { action: string }) =>
    api.post(`/auth/recommendations/${id}/action`, body),

  /** Get engagement analytics */
  getEngagement: () =>
    api.get('/auth/engagement'),

  /** Find matching peers */
  findPeers: () =>
    api.get('/auth/peers'),

  /** Get user's peer groups */
  getGroups: () =>
    api.get<{ success: boolean; groups: Array<Record<string, unknown>> }>('/auth/groups'),

  /** Join a peer group */
  joinGroup: (groupId: string) =>
    api.post(`/auth/groups/${groupId}/join`),

  /** Leave a peer group */
  leaveGroup: (groupId: string) =>
    api.post(`/auth/groups/${groupId}/leave`),
};
