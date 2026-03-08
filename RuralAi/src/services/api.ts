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
let _userName: string = 'Demo User';

/** Call from AuthContext when user logs in / out. */
export function setAuthCredentials(token: string | null, userId?: string, userName?: string) {
  _authToken = token;
  _userId = userId || ENV.DEMO_USER_ID;
  _userName = userName || 'Demo User';
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
  const hasJsonBody = method !== 'GET' && body !== undefined;

  const controller = new AbortController();
  const timeoutMs = timeout ?? ENV.REQUEST_TIMEOUT;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOpts: RequestInit = {
    method,
    headers: {
      ...(hasJsonBody ? { 'Content-Type': 'application/json' } : {}),
      // Auth: prefer Bearer token, fall back to X-User-Id for demo mode
      ...(_authToken
        ? { 'Authorization': `Bearer ${_authToken}`, 'X-User-Name': _userName }
        : { 'X-User-Id': _userId, 'X-User-Name': _userName }),
      ...headers,
    },
    signal: signal ?? controller.signal,
  };

  if (hasJsonBody) {
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
  crop_type?: string;
  prices: PriceEntry[];
  summary: { average_price: number; min_price: number; max_price: number; mandi_count: number };
  last_updated: string;
  source?: string;
  fresh?: boolean;
  message?: string;
}

interface RawPriceEntry {
  mandi_name?: string;
  market?: string;
  price_per_quintal?: number | string;
  modal_price?: number | string;
  price?: number | string;
  state?: string;
  district?: string;
  date?: string;
  trade_date?: string;
  arrival_date?: string;
  change?: 'up' | 'down' | 'same';
}

interface RawPricesResult {
  crop?: string;
  crop_type?: string;
  prices?: RawPriceEntry[];
  summary?: {
    average_price?: number | string;
    avgPrice?: number | string;
    min_price?: number | string;
    minPrice?: number | string;
    max_price?: number | string;
    maxPrice?: number | string;
    mandi_count?: number | string;
    totalMandis?: number | string;
  } | null;
  last_updated?: string;
  source?: string;
  fresh?: boolean;
  message?: string;
}

function toNumericValue(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizePriceEntry(entry: RawPriceEntry): PriceEntry {
  return {
    mandi_name: String(entry.mandi_name ?? entry.market ?? 'Unknown mandi'),
    price_per_quintal: toNumericValue(entry.price_per_quintal ?? entry.modal_price ?? entry.price),
    state: String(entry.state ?? ''),
    district: String(entry.district ?? ''),
    date: String(entry.date ?? entry.trade_date ?? entry.arrival_date ?? ''),
    change: entry.change,
  };
}

function normalizePriceSummary(summary?: RawPricesResult['summary']) {
  return {
    average_price: toNumericValue(summary?.average_price ?? summary?.avgPrice),
    min_price: toNumericValue(summary?.min_price ?? summary?.minPrice),
    max_price: toNumericValue(summary?.max_price ?? summary?.maxPrice),
    mandi_count: toNumericValue(summary?.mandi_count ?? summary?.totalMandis),
  };
}

export const marketApi = {
  getPrices: async (crop: string, state?: string, district?: string, days?: number, limit?: number) => {
    const result = await api.get<RawPricesResult>(`/agriculture/prices/${encodeURIComponent(crop)}`, {
      state,
      district,
      days,
      limit,
    });
    return {
      crop: String(result.crop ?? result.crop_type ?? crop),
      crop_type: result.crop_type,
      prices: Array.isArray(result.prices) ? result.prices.map(normalizePriceEntry) : [],
      summary: normalizePriceSummary(result.summary),
      last_updated: result.last_updated ?? new Date().toISOString(),
      source: result.source,
      fresh: result.fresh,
      message: result.message,
    } satisfies PricesResult;
  },

  getPriceTrend: (crop: string, mandiCode?: string, days = 30, state?: string) =>
    api.get(`/agriculture/prices/${encodeURIComponent(crop)}/trend`, { mandi_code: mandiCode, days, state }),

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

export interface KnowledgeExternalResource {
  id: string;
  kind: "official" | "video" | "article" | "live";
  title: string;
  url: string;
  snippet?: string;
  thumbnail?: string;
  source?: string;
  viewers?: string;
  published?: string;
  live?: boolean;
}

export interface KnowledgeExternalSearchResult {
  query: string;
  language: string;
  videos: KnowledgeExternalResource[];
  articles: KnowledgeExternalResource[];
  live_streams: KnowledgeExternalResource[];
  official_sources: KnowledgeExternalResource[];
  cached?: boolean;
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

  searchResources: (params?: { q?: string; language?: string; limit?: number }) =>
    api.get<KnowledgeExternalSearchResult>('/knowledge/resources/search', params as any),

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

  getSchemes: (params?: { category?: string; type?: string; state?: string }) =>
    api.get<{ schemes: Scheme[] }>('/economics/schemes', {
      ...params,
      type: params?.type ?? params?.category,
    }),

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

// ═══════════ Community (Posts, Bookmarks, Follows) ═══════════

export interface CommunityPost {
  id: string;
  title: string;
  content: string;
  topic: string;
  author_id: string;
  author_name?: string;
  likes: number;
  bookmark_count: number;
  created_at: string;
}

export const communityApi = {
  createPost: (body: { title: string; content: string; topic?: string }) =>
    api.post<CommunityPost>('/community/posts', body),

  listPosts: (params?: { page?: number; limit?: number; topic?: string; search?: string }) =>
    api.get<{ posts: CommunityPost[]; total: number; page: number; limit: number }>('/community/posts', params as any),

  getPost: (id: string) =>
    api.get<CommunityPost>(`/community/posts/${id}`),

  toggleBookmark: (postId: string) =>
    api.post(`/community/bookmarks/${postId}`),

  listBookmarks: () =>
    api.get<Array<{ post_id: string; created_at: string }>>('/community/bookmarks'),

  toggleFollow: (targetUserId: string) =>
    api.post(`/community/follow/${targetUserId}`),

  listFollowing: () =>
    api.get('/community/following'),

  reportPost: (postId: string, body: { reason: string }) =>
    api.post(`/community/posts/${postId}/report`, body),
};

// ═══════════ Business Directory ═══════════

export interface BusinessCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  subcategories: Array<{ id: string; name: string; sortOrder: number }>;
}

export interface Business {
  id: string;
  name: string;
  phone: string;
  address: string;
  category_id: string;
  category_name?: string;
  description?: string;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
}

export const businessApi = {
  listCategories: () =>
    api.get<BusinessCategory[]>('/business/categories'),

  getCategory: (id: string) =>
    api.get<BusinessCategory>(`/business/categories/${id}`),

  createBusiness: (body: { name: string; phone: string; address: string; categoryId: string; [k: string]: unknown }) =>
    api.post<Business>('/business/listings', body),

  listBusinesses: (params?: { page?: number; limit?: number; search?: string; categoryId?: string }) =>
    api.get<{ businesses: Business[]; total: number; page: number; limit: number }>('/business/listings', params as any),

  getBusiness: (id: string) =>
    api.get<Business>(`/business/listings/${id}`),

  updateBusiness: (id: string, body: Record<string, unknown>) =>
    api.put(`/business/listings/${id}`, body),

  deactivateBusiness: (id: string) =>
    api.delete(`/business/listings/${id}`),
};

// ═══════════ Government Portals & Schemes ═══════════

export interface GovtPortal {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  region: string;
}

export interface GovtScheme {
  id: string;
  name: string;
  description: string;
  category: string;
  benefits: string;
  eligibility_criteria: Record<string, unknown>;
  documents_required: string[];
  application_url?: string;
  helpline?: string;
}

export const governmentApi = {
  listPortals: (params?: { category?: string; region?: string; search?: string }) =>
    api.get<{ portals: GovtPortal[]; total: number }>('/government/portals', params as any),

  getPortal: (id: string) =>
    api.get<GovtPortal>(`/government/portals/${id}`),

  listSchemes: (params?: { category?: string; state?: string; search?: string; page?: number; limit?: number }) =>
    api.get<{ schemes: GovtScheme[]; pagination: Record<string, unknown> }>('/government/schemes', params as any),

  getScheme: (id: string) =>
    api.get<GovtScheme>(`/government/schemes/${id}`),

  listSchemeCategories: () =>
    api.get('/government/scheme-categories'),

  createComplaint: (body: { portalId: string; category: string; subject: string; description?: string }) =>
    api.post('/government/complaints', body),

  listComplaints: () =>
    api.get('/government/complaints'),
};

// ═══════════ Livelihood ═══════════

export interface LivelihoodCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
}

export interface LivelihoodGuidance {
  id: string;
  category_id: string;
  title: string;
  content: string;
  difficulty: string;
}

export const livelihoodApi = {
  listCategories: () =>
    api.get<LivelihoodCategory[]>('/livelihood/categories'),

  listGuidance: (params?: { categoryId?: string; search?: string }) =>
    api.get<LivelihoodGuidance[]>('/livelihood/guidance', params as any),

  getGuidance: (id: string) =>
    api.get<LivelihoodGuidance>(`/livelihood/guidance/${id}`),
};

// ═══════════ Health AI ═══════════

export interface SymptomCheckResult {
  risk_level: string;
  possible_conditions: string[];
  recommended_action: string;
  urgency?: string;
  home_remedies: string[];
  recommendations?: string[];
  warning_signs: string[];
  disclaimer: string;
  checked_at?: string;
}

export interface HealthArticle {
  id: string;
  topic: string;
  title: string;
  content: string;
  language: string;
  created_at: string;
}

export interface HealthPortal {
  id: string;
  name: string;
  description: string;
  url: string;
  category: string;
  eligibility_criteria?: Record<string, unknown>;
  services_offered?: string[];
}

export interface HealthProvider {
  id: string;
  name: string;
  type: string;
  city: string;
  state?: string;
  address: string;
  phone?: string;
  website?: string;
  services?: string[];
  rating?: number;
  has_online_booking?: boolean;
}

export type HealthImagingType = 'xray' | 'mri' | 'ct_scan' | 'ultrasound' | 'pathology';

export interface HealthImagingUploadResponse {
  documentId: string;
  uploadUrl: string;
  s3Key?: string;
  imagingType: HealthImagingType;
  status: string;
  expiresIn?: string;
  instructions?: string[];
}

export interface HealthImagingAnalysis {
  general_info?: string;
  common_findings?: string[];
  next_steps?: string;
  important_note?: string;
}

export interface HealthImagingAnalysisResponse {
  documentId: string;
  imagingType: HealthImagingType;
  analysis: HealthImagingAnalysis;
  disclaimer?: string;
  analyzedAt?: string;
  recommendation?: string;
}

export const healthApi = {
  checkSymptoms: (body: { symptoms: string[]; age: number; gender: string; duration?: string; severity?: string; existingConditions?: string[] }) =>
    api.post<SymptomCheckResult>('/health/symptoms/check', body),

  listArticles: (params?: { topic?: string; language?: string; page?: number; limit?: number }) =>
    api.get<{ articles: HealthArticle[]; total: number }>('/health/articles', params as any),

  getArticle: (id: string) =>
    api.get<HealthArticle>(`/health/articles/${id}`),

  generateArticle: (body: { topic: string; language?: string }) =>
    api.post<HealthArticle>('/health/articles/generate', body),

  listHealthPortals: (params?: { category?: string; search?: string }) =>
    api.get<HealthPortal[]>('/health/portals', params as any),

  getHealthPortal: (id: string) =>
    api.get<HealthPortal>(`/health/portals/${id}`),

  checkEligibility: (body: { age: number; location: string; income?: number; familySize?: number; bplCard?: boolean; aadhaar?: boolean; gender?: string }) =>
    api.post('/health/eligibility-check', body),

  listProviders: (params?: { city?: string; type?: string; search?: string; page?: number; limit?: number }) =>
    api.get<{ providers: HealthProvider[]; total: number }>('/health/providers', params as any),

  getProvider: (id: string) =>
    api.get<HealthProvider>(`/health/providers/${id}`),

  initiateUpload: (body: { fileName: string; fileType: string; imagingType: HealthImagingType; metadata?: Record<string, unknown> }) =>
    api.post<HealthImagingUploadResponse>('/health/imaging/upload', body),

  getDocumentStatus: (id: string) =>
    api.get(`/health/imaging/${id}/status`),

  analyzeImage: (id: string, imagingType?: HealthImagingType) =>
    api.post<HealthImagingAnalysisResponse>(`/health/imaging/${id}/analyze`, imagingType ? { imagingType } : {}),
};

export interface VisionAttachmentAnalysis {
  attachmentKind: "crop_image" | "field_image" | "medical_image" | "medical_document" | "object_image" | "general_image" | "unknown";
  title: string;
  summary: string;
  keyObservations: string[];
  questionsToAsk: string[];
  suggestedDomain: "agriculture" | "health" | "general";
  suggestedIntent?: string;
  spokenPromptHint?: string;
  confidence?: number;
  provider?: string;
}

export const visionApi = {
  analyzeAttachment: (body: {
    fileBase64: string;
    fileType: "image/jpeg" | "image/png";
    fileName?: string;
    source?: "camera" | "document";
    userPrompt?: string;
  }) =>
    api.post<VisionAttachmentAnalysis>("/vision/analyze", body),
};

// ═══════════ Open Data Export ═══════════

export const openDataApi = {
  exportUserData: (userId: string, format: 'json' | 'csv' = 'json') =>
    api.get(`/open-data/export/${userId}`, { format }),
};

// ═══════════ Voice Rooms (Twitter Spaces-like) ═══════════

export interface VoiceRoom {
  roomId: string;
  title: string;
  description?: string | null;
  topics: string[];
  status: 'active' | 'ended';
  isPrivate: boolean;
  isRecording: boolean;
  maxParticipants: number;
  creatorId: string;
  creatorName: string;
  participantCount: number;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
  participants?: VoiceRoomParticipant[];
  metrics?: { duration: number; peakParticipants: number; endedAt: string };
}

export interface VoiceRoomParticipant {
  roomId: string;
  userId: string;
  userName: string;
  role: 'moderator' | 'speaker' | 'listener';
  isMuted: boolean;
  isBlocked: boolean;
  joinedAt: string;
  leftAt?: string | null;
  requestedSpeak?: boolean;
}

export interface VoiceRoomChatMessage {
  roomId: string;
  messageId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface VoiceRoomPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export const voiceRoomApi = {
  // Rooms
  createRoom: (body: { title: string; description?: string; topics?: string[]; isPrivate?: boolean; maxParticipants?: number }) =>
    api.post<VoiceRoom>('/voice-rooms', body),

  listRooms: (params?: { page?: number; limit?: number; status?: string; topic?: string; search?: string }) =>
    api.get<{ rooms: VoiceRoom[]; pagination: VoiceRoomPagination }>('/voice-rooms', params as any),

  getRoom: (roomId: string) =>
    api.get<VoiceRoom>(`/voice-rooms/${roomId}`),

  endRoom: (roomId: string) =>
    api.post<{ roomId: string; status: string; endedAt: string; metrics: any }>(`/voice-rooms/${roomId}/end`),

  // Join / Leave / Token
  joinRoom: (roomId: string) =>
    api.post<{ roomId: string; userId: string; role: string }>(`/voice-rooms/${roomId}/join`),

  leaveRoom: (roomId: string) =>
    api.post<{ roomId: string; userId: string; leftAt: string }>(`/voice-rooms/${roomId}/leave`),

  getRoomToken: (roomId: string) =>
    api.get<{ roomId: string; token: string | null; role: string }>(`/voice-rooms/${roomId}/token`),

  // Chat
  getChatMessages: (roomId: string, params?: { limit?: number; lastKey?: string }) =>
    api.get<{ messages: VoiceRoomChatMessage[]; nextKey: string | null }>(`/voice-rooms/${roomId}/chat`, params as any),

  sendChatMessage: (roomId: string, content: string) =>
    api.post<VoiceRoomChatMessage>(`/voice-rooms/${roomId}/chat`, { content }),

  // Moderation
  muteUser: (roomId: string, targetUserId: string) =>
    api.post(`/voice-rooms/${roomId}/mute/${targetUserId}`),

  unmuteUser: (roomId: string, targetUserId: string) =>
    api.post(`/voice-rooms/${roomId}/unmute/${targetUserId}`),

  kickUser: (roomId: string, targetUserId: string) =>
    api.post(`/voice-rooms/${roomId}/kick/${targetUserId}`),

  banUser: (roomId: string, targetUserId: string) =>
    api.post(`/voice-rooms/${roomId}/ban/${targetUserId}`),

  transferModerator: (roomId: string, targetUserId: string) =>
    api.post(`/voice-rooms/${roomId}/transfer-moderator`, { targetUserId }),

  toggleRecording: (roomId: string) =>
    api.post(`/voice-rooms/${roomId}/toggle-recording`),

  togglePrivacy: (roomId: string) =>
    api.post(`/voice-rooms/${roomId}/toggle-privacy`),

  requestToSpeak: (roomId: string) =>
    api.post(`/voice-rooms/${roomId}/request-speak`),

  approveSpeaker: (roomId: string, targetUserId: string) =>
    api.post(`/voice-rooms/${roomId}/approve-speaker/${targetUserId}`),

  revokeSpeaker: (roomId: string, targetUserId: string) =>
    api.post(`/voice-rooms/${roomId}/revoke-speaker/${targetUserId}`),
};
