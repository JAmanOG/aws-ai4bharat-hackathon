/**
 * Community API — Feature 1
 * Posts, Voice Rooms, Government Portals/Schemes, Social (bookmarks, follows).
 */
import { communityClient } from './client';

// ── Posts ──
export const communityApi = {
  listPosts: (params?: { page?: number; limit?: number; topic?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.topic) qs.set('topic', params.topic);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return communityClient.get(`/posts${q ? '?' + q : ''}`);
  },

  getPost: (id: string) => communityClient.get(`/posts/${id}`),

  createPost: (data: { title: string; content: string; topic?: string }) =>
    communityClient.post('/posts', data),

  bookmarkPost: (postId: string) => communityClient.post(`/posts/${postId}/bookmark`),

  reportPost: (postId: string, reason: string) =>
    communityClient.post(`/posts/${postId}/report`, { reason }),

  listBookmarks: (page = 1, limit = 10) =>
    communityClient.get(`/bookmarks?page=${page}&limit=${limit}`),

  toggleFollow: (targetUserId: string) => communityClient.post(`/follow/${targetUserId}`),

  listFollowing: (page = 1, limit = 10) =>
    communityClient.get(`/following?page=${page}&limit=${limit}`),
};

// ── Voice Rooms ──
export const voiceRoomApi = {
  listRooms: (params?: { status?: string; topic?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.topic) qs.set('topic', params.topic);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return communityClient.get(`/voice-rooms${q ? '?' + q : ''}`);
  },

  getRoom: (id: string) => communityClient.get(`/voice-rooms/${id}`),

  createRoom: (data: { title: string; topic?: string; maxParticipants?: number }) =>
    communityClient.post('/voice-rooms', data),

  endRoom: (roomId: string) => communityClient.post(`/voice-rooms/${roomId}/end`, {}),
  getRoomToken: (roomId: string) => communityClient.get(`/voice-rooms/${roomId}/token`),
  joinRoom: (roomId: string) => communityClient.post(`/voice-rooms/${roomId}/join`, {}),
  leaveRoom: (roomId: string) => communityClient.post(`/voice-rooms/${roomId}/leave`, {}),
  requestSpeak: (roomId: string) => communityClient.post(`/voice-rooms/${roomId}/request-speak`, {}),
  approveSpeaker: (roomId: string, targetUserId: string) => communityClient.post(`/voice-rooms/${roomId}/approve-speaker/${targetUserId}`, {}),
  revokeSpeaker: (roomId: string, targetUserId: string) => communityClient.post(`/voice-rooms/${roomId}/revoke-speaker/${targetUserId}`, {}),
  getChatMessages: (roomId: string) => communityClient.get(`/voice-rooms/${roomId}/chat`),
  sendChatMessage: (roomId: string, message: string) =>
    communityClient.post(`/voice-rooms/${roomId}/chat`, { message }),
};

// ── Government ──
export const governmentApi = {
  listPortals: (params?: { category?: string; region?: string; search?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set('category', params.category);
    if (params?.region) qs.set('region', params.region);
    if (params?.search) qs.set('search', params.search);
    const q = qs.toString();
    return communityClient.get(`/government/portals${q ? '?' + q : ''}`);
  },

  getPortal: (id: string) => communityClient.get(`/government/portals/${id}`),

  listSchemes: (params?: { categoryId?: string; search?: string; page?: number }) => {
    const qs = new URLSearchParams();
    if (params?.categoryId) qs.set('categoryId', params.categoryId);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    const q = qs.toString();
    return communityClient.get(`/government/schemes${q ? '?' + q : ''}`);
  },

  getScheme: (id: string) => communityClient.get(`/government/schemes/${id}`),

  listSchemeCategories: () => communityClient.get('/government/schemes/categories'),

  createComplaint: (data: { portalName: string; referenceNo: string; description?: string }) =>
    communityClient.post('/government/complaints', data),

  listComplaints: (page = 1) => communityClient.get(`/government/complaints?page=${page}`),
};
