/**
 * Knowledge API — Feature 2
 * Courses, Enrollment, Learning Paths, Content, Govt Courses.
 */
import { feature2 } from './client';

export const knowledgeApi = {
  // ── Courses ──
  listCourses: (params?: { language?: string; category?: string; difficulty?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.language) qs.set('language', params.language);
    if (params?.category) qs.set('category', params.category);
    if (params?.difficulty) qs.set('difficulty', params.difficulty);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString();
    return feature2.get(`/knowledge/courses${q ? '?' + q : ''}`);
  },

  getCourse: (id: string) => feature2.get(`/knowledge/courses/${id}`),

  createCourse: (data: any) => feature2.post('/knowledge/courses', data),

  // ── Enrollment ──
  enrollInCourse: (courseId: string) => feature2.post(`/knowledge/courses/${courseId}/enroll`),

  getMyCourses: (status?: string) =>
    feature2.get(`/knowledge/my-courses${status ? '?status=' + status : ''}`),

  completeModule: (courseId: string, moduleId: string, data?: any) =>
    feature2.post(`/knowledge/courses/${courseId}/modules/${moduleId}/complete`, data),

  // ── Content ──
  getCourseContent: (courseId: string, language = 'hi') =>
    feature2.get(`/knowledge/courses/${courseId}/content?language=${language}`),

  // ── Govt Courses ──
  listGovtCourses: (params?: { language?: string; category?: string; portal?: string }) => {
    const qs = new URLSearchParams();
    if (params?.language) qs.set('language', params.language);
    if (params?.category) qs.set('category', params.category);
    if (params?.portal) qs.set('portal', params.portal);
    const q = qs.toString();
    return feature2.get(`/knowledge/govt-courses${q ? '?' + q : ''}`);
  },

  listGovtPortals: () => feature2.get('/knowledge/govt-courses/portals'),
};
