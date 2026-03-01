/**
 * Community API — Feature 1
 * Posts, Voice Rooms, Government Portals/Schemes, Social (bookmarks, follows).
 */
import { feature1 } from './client';

// ── Posts ──
export const communityApi = {
  listPosts: (params?: { page?: number; limit?: number; topic?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.topic) qs.set('topic', params.topic);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return feature1.get(`/posts${q ? '?' + q : ''}`);
  },

  getPost: (id: string) => feature1.get(`/posts/${id}`),

  createPost: (data: { title: string; content: string; topic?: string }) =>
    feature1.post('/posts', data),

  bookmarkPost: (postId: string) => feature1.post(`/posts/${postId}/bookmark`),

  reportPost: (postId: string, reason: string) =>
    feature1.post(`/posts/${postId}/report`, { reason }),

  listBookmarks: (page = 1, limit = 10) =>
    feature1.get(`/bookmarks?page=${page}&limit=${limit}`),

  toggleFollow: (targetUserId: string) => feature1.post(`/follow/${targetUserId}`),

  listFollowing: (page = 1, limit = 10) =>
    feature1.get(`/following?page=${page}&limit=${limit}`),
};

// ── Voice Rooms ──
export const voiceRoomApi = {
  listRooms: (params?: { status?: string; topic?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.topic) qs.set('topic', params.topic);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return feature1.get(`/voice-rooms${q ? '?' + q : ''}`);
  },

  getRoom: (id: string) => feature1.get(`/voice-rooms/${id}`),

  createRoom: (data: { title: string; topic?: string; maxParticipants?: number }) =>
    feature1.post('/voice-rooms', data),

  endRoom: (id: string) => feature1.post(`/voice-rooms/${id}/end`),

  getChatMessages: (roomId: string, limit = 50) =>
    feature1.get(`/voice-rooms/${roomId}/chat?limit=${limit}`),
};

// ── Government ──
export const governmentApi = {
  listPortals: (params?: { category?: string; region?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.region) qs.set('region', params.region);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return feature1.get(`/government/portals${q ? '?' + q : ''}`);
  },

  getPortal: (id: string) => feature1.get(`/government/portals/${id}`),

  listSchemes: (params?: { categoryId?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.categoryId) qs.set('categoryId', params.categoryId);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString();
    return feature1.get(`/government/schemes${q ? '?' + q : ''}`);
  },

  getScheme: (id: string) => feature1.get(`/government/schemes/${id}`),

  listSchemeCategories: () => feature1.get('/government/schemes/categories'),

  createComplaint: (data: { portalName: string; referenceNo: string; description?: string }) =>
    feature1.post('/government/complaints', data),

  listComplaints: (page = 1) => feature1.get(`/government/complaints?page=${page}`),
};
