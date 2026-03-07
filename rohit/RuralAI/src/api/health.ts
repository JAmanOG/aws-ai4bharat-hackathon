/**
 * Health API — Feature 4
 * Symptom check, Medical imaging, Govt portals, Providers, Knowledge base.
 */
import { healthClient } from './client';

export const healthApi = {
  // ── Module 1: Symptom Checker ──
  checkSymptoms: (data: { symptoms: string; age?: number; gender?: string; medicalHistory?: string }) =>
    healthClient.post('/health/symptom-check', data),

  // ── Module 2: Medical Imaging ──
  initiateUpload: (data: { imagingType: string; description?: string; contentType?: string }) =>
    healthClient.post('/health/imaging/upload', data),

  getDocumentStatus: (docId: string) => healthClient.get(`/health/imaging/${docId}`),

  analyzeImage: (docId: string, imagingType = 'xray') =>
    healthClient.post(`/health/imaging/${docId}/analyze`, { imagingType }),

  // ── Module 3: Govt Health Portals ──
  listGovtPortals: (params?: { category?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return healthClient.get(`/health/govt-portals${q ? '?' + q : ''}`);
  },

  getGovtPortal: (id: string) => healthClient.get(`/health/govt-portals/${id}`),

  checkEligibility: (data: { age: number; income?: number; location: string; bplCard?: boolean; familySize?: number }) =>
    healthClient.post('/health/eligibility-check', data),

  // ── Module 4: Private Providers ──
  listProviders: (params?: { city?: string; type?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.city) qs.set('city', params.city);
    if (params?.type) qs.set('type', params.type);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString();
    return healthClient.get(`/health/providers${q ? '?' + q : ''}`);
  },

  getProvider: (id: string) => healthClient.get(`/health/providers/${id}`),

  // ── Module 5: Knowledge Base ──
  listArticles: (topic?: string) =>
    healthClient.get(`/health/articles${topic ? '?topic=' + topic : ''}`),

  getArticle: (id: string) => healthClient.get(`/health/articles/${id}`),

  generateArticle: (topic: string, language = 'en') =>
    healthClient.post('/health/articles/generate', { topic, language }),
};
