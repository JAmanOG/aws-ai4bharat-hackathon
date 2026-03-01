/**
 * Agriculture + Economics API — Feature 6
 * Market data, supply chain, precision agriculture, economic services.
 */
import { feature6 } from './client';

// ── Market Data ──
export const marketApi = {
  getPrices: (crop: string, params?: { state?: string; district?: string }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.district) qs.set('district', params.district);
    const q = qs.toString();
    return feature6.get(`/agriculture/prices/${crop.toLowerCase()}${q ? '?' + q : ''}`);
  },

  getPriceTrend: (crop: string, params?: { state?: string; days?: number }) => {
    const qs = new URLSearchParams();
    if (params?.state) qs.set('state', params.state);
    if (params?.days) qs.set('days', String(params.days));
    const q = qs.toString();
    return feature6.get(`/agriculture/prices/${crop.toLowerCase()}/trend${q ? '?' + q : ''}`);
  },

  getMandis: (state?: string) =>
    feature6.get(`/agriculture/mandis${state ? '?state=' + state : ''}`),

  getMandiPrices: (mandiName: string) =>
    feature6.get(`/agriculture/mandis/${encodeURIComponent(mandiName)}/prices`),

  // ── Price Alerts ──
  subscribePriceAlert: (data: { crop_type: string; threshold_percent?: number; target_price?: number }) =>
    feature6.post('/agriculture/alerts', data),

  getUserAlerts: () => feature6.get('/agriculture/alerts'),

  deleteAlert: (alertId: string) => feature6.del(`/agriculture/alerts/${alertId}`),
};

// ── Supply Chain ──
export const supplyChainApi = {
  createListing: (data: { crop_type: string; quantity_kg: number; quality_grade?: string; asking_price_per_kg?: number }) =>
    feature6.post('/agriculture/listings', data),

  searchListings: (params?: { crop_type?: string; state?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.crop_type) qs.set('crop_type', params.crop_type);
    if (params?.state) qs.set('state', params.state);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString();
    return feature6.get(`/agriculture/listings${q ? '?' + q : ''}`);
  },

  getMyListings: (status?: string) =>
    feature6.get(`/agriculture/listings/my${status ? '?status=' + status : ''}`),

  getListing: (id: string) => feature6.get(`/agriculture/listings/${id}`),

  searchBuyers: (params?: { crop_type?: string; state?: string; verified?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.crop_type) qs.set('crop_type', params.crop_type);
    if (params?.state) qs.set('state', params.state);
    if (params?.verified) qs.set('verified', 'true');
    const q = qs.toString();
    return feature6.get(`/agriculture/buyers${q ? '?' + q : ''}`);
  },

  getOrders: (role: 'farmer' | 'buyer' = 'farmer', status?: string) => {
    const qs = new URLSearchParams({ role });
    if (status) qs.set('status', status);
    return feature6.get(`/agriculture/orders?${qs.toString()}`);
  },
};

// ── Precision Agriculture ──
export const precisionApi = {
  analyzeFarmImage: (data: any) => feature6.post('/agriculture/precision/analyze', data),

  detectPestAlerts: (data: any) => feature6.post('/agriculture/precision/pest-disease/analyze', data),

  calculateCarbon: (practices: any[]) =>
    feature6.post('/agriculture/precision/carbon/calculate', { practices }),

  getWeatherAdvisory: (forecast: any[]) =>
    feature6.post('/agriculture/precision/weather/advisory', { forecast }),

  logPractice: (data: { practice_type: string;[key: string]: any }) =>
    feature6.post('/agriculture/precision/practices/log', data),

  getPracticeLogs: (limit = 20) =>
    feature6.get(`/agriculture/precision/practices/logs?limit=${limit}`),
};

// ── Economic Services ──
export const economicsApi = {
  getProfile: () => feature6.get('/economics/profile'),

  upsertProfile: (data: any) => feature6.post('/economics/profile', data),

  listSchemes: (params?: { type?: string; category?: string; income_max?: number }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.category) qs.set('category', params.category);
    if (params?.income_max) qs.set('income_max', String(params.income_max));
    const q = qs.toString();
    return feature6.get(`/economics/schemes${q ? '?' + q : ''}`);
  },

  getScheme: (id: string) => feature6.get(`/economics/schemes/${id}`),

  assessLoanEligibility: (data: any) => feature6.post('/economics/eligibility/assess', data),

  generateSavingsPlan: (data: any) => feature6.post('/economics/savings/plan', data),

  createInsuranceClaim: (data: { crop_type: string;[key: string]: any }) =>
    feature6.post('/economics/insurance/claims', data),

  listInsuranceClaims: (limit = 20) => feature6.get(`/economics/insurance/claims?limit=${limit}`),

  generateNudge: (data: any) => feature6.post('/economics/nudges/generate', data),

  listNudges: (limit = 20) => feature6.get(`/economics/nudges?limit=${limit}`),
};
