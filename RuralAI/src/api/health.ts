/**
 * Health API — Feature 4
 * Symptom check, Medical imaging, Govt portals, Providers, Knowledge base.
 */
import { feature4 } from './client';

export const healthApi = {
  // ── Module 1: Symptom Checker ──
  checkSymptoms: (data: { symptoms: string; age?: number; gender?: string; medicalHistory?: string }) =>
    feature4.post('/health/symptom-check', data),

  // ── Module 2: Medical Imaging ──
  initiateUpload: (data: { imagingType: string; description?: string }) =>
    feature4.post('/health/imaging/upload', data),

  getDocumentStatus: (docId: string) => feature4.get(`/health/imaging/${docId}`),

  analyzeImage: (docId: string, imagingType = 'xray') =>
    feature4.post(`/health/imaging/${docId}/analyze`, { imagingType }),

  // ── Module 3: Govt Health Portals ──
  listGovtPortals: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return feature4.get(`/health/govt-portals${q ? '?' + q : ''}`);
  },

  getGovtPortal: (id: string) => feature4.get(`/health/govt-portals/${id}`),

  checkEligibility: (data: { age: number; income?: number; location: string; bplCard?: boolean; familySize?: number }) =>
    feature4.post('/health/eligibility-check', data),

  // ── Module 4: Private Providers ──
  listProviders: (params?: { city?: string; type?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.city) qs.set('city', params.city);
    if (params?.type) qs.set('type', params.type);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString();
    return feature4.get(`/health/providers${q ? '?' + q : ''}`);
  },

  getProvider: (id: string) => feature4.get(`/health/providers/${id}`),

  // ── Module 5: Knowledge Base ──
  listArticles: (topic?: string) =>
    feature4.get(`/health/articles${topic ? '?topic=' + topic : ''}`),

  getArticle: (id: string) => feature4.get(`/health/articles/${id}`),

  generateArticle: (topic: string, language = 'en') =>
    feature4.post('/health/articles/generate', { topic, language }),
};
