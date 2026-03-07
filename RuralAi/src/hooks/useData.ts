/**
 * Domain-specific hooks that wrap useApi with the correct API calls.
 * Import these in screens instead of calling api functions directly.
 */

import { useApi } from './useApi';
import {
  marketApi,
  alertsApi,
  economicsApi,
  knowledgeApi,
  precisionApi,
  voiceApi,
  logisticsApi,
  supplyChainApi,
  authApi,
  healthCheck,
  communityApi,
  businessApi,
  governmentApi,
  livelihoodApi,
  healthApi,
  voiceRoomApi,
  type PricesResult,
  type PriceAlert,
  type Scheme,
  type Course,
  type CommunityPost,
  type BusinessCategory,
  type Business,
  type GovtPortal,
  type GovtScheme,
  type LivelihoodCategory,
  type LivelihoodGuidance,
  type HealthArticle,
  type HealthPortal,
  type HealthProvider,
  type VoiceRoom,
  type VoiceRoomPagination,
  type VoiceRoomChatMessage,
  type KnowledgeExternalSearchResult,
} from '../services/api';

/* ─── Market Data ─── */

export function useMarketPrices(crop: string, state?: string, district?: string) {
  return useApi<PricesResult>(
    () => marketApi.getPrices(crop, state, district),
    [crop, state, district],
    !crop,
  );
}

export function usePriceTrend(crop: string, mandiCode?: string, days = 30, state?: string) {
  return useApi(
    () => marketApi.getPriceTrend(crop, mandiCode, days, state),
    [crop, mandiCode, days, state],
    !crop,
  );
}

export function useMandis(state?: string) {
  return useApi(
    () => marketApi.getMandis(state),
    [state],
  );
}

export function useMandiPrices(mandiName: string) {
  return useApi(
    () => marketApi.getMandiPrices(mandiName),
    [mandiName],
    !mandiName,
  );
}

/* ─── Price Alerts ─── */

export function usePriceAlerts() {
  return useApi<{ alerts: PriceAlert[] }>(
    () => alertsApi.getAlerts(),
    [],
  );
}

/* ─── Supply Chain ─── */

export function useMyListings(status?: string) {
  return useApi(
    () => supplyChainApi.getMyListings(status),
    [status],
  );
}

export function useOrders(role?: string, status?: string) {
  return useApi(
    () => supplyChainApi.getOrders({ role, status }),
    [role, status],
  );
}

export function useBuyers(params?: Record<string, string | number | boolean | undefined>) {
  return useApi(
    () => supplyChainApi.searchBuyers(params),
    [JSON.stringify(params)],
  );
}

/* ─── Logistics & Bargaining ─── */

export function useBargainingGroups(cropType?: string) {
  return useApi(
    () => logisticsApi.getBargainingGroups(cropType),
    [cropType],
  );
}

export function useBargainingSuggestions() {
  return useApi(
    () => logisticsApi.suggestBargaining(),
    [],
  );
}

export function useTransportRequests() {
  return useApi(
    () => logisticsApi.getTransportRequests(),
    [],
  );
}

export function useVehicleTypes() {
  return useApi(
    () => logisticsApi.getVehicleTypes(),
    [],
  );
}

/* ─── Economic Schemes ─── */

export function useSchemes(category?: string, state?: string) {
  return useApi<{ schemes: Scheme[] }>(
    () => economicsApi.getSchemes({ category, state }),
    [category, state],
  );
}

export function useSchemeDetail(id: string) {
  return useApi<Scheme>(
    () => economicsApi.getScheme(id),
    [id],
    !id,
  );
}

export function useNudges(limit = 20) {
  return useApi(
    () => economicsApi.getNudges(limit),
    [limit],
  );
}

export function useEconomicProfile() {
  return useApi(
    () => economicsApi.getProfile(),
    [],
  );
}

export function useInsuranceClaims(limit = 20) {
  return useApi(
    () => economicsApi.getInsuranceClaims(limit),
    [limit],
  );
}

/* ─── Knowledge ─── */

export function useCourses(language?: string, difficulty?: string) {
  return useApi<{ courses: Course[] }>(
    () => knowledgeApi.getCourses(language, difficulty),
    [language, difficulty],
  );
}

export function useMyCourses() {
  return useApi(
    () => knowledgeApi.getMyCourses(),
    [],
  );
}

export function useCourseContent(courseId: string) {
  return useApi(
    () => knowledgeApi.getCourseContent(courseId),
    [courseId],
    !courseId,
  );
}

export function usePeerGroups() {
  return useApi(
    () => knowledgeApi.getPeerGroups(),
    [],
  );
}

export function useMyPeerGroups() {
  return useApi(
    () => knowledgeApi.getMyPeerGroups(),
    [],
  );
}

export function useRecommendations() {
  return useApi(
    () => knowledgeApi.getRecommendations(),
    [],
  );
}

export function useLearningProfile() {
  return useApi(
    () => knowledgeApi.getLearningProfile(),
    [],
  );
}

export function useProgressSummary() {
  return useApi(
    () => knowledgeApi.getProgressSummary(),
    [],
  );
}

export function useGovtCourses() {
  return useApi(
    () => knowledgeApi.getGovtCourses(),
    [],
  );
}

export function useKnowledgeResourceSearch(q?: string, language?: string, limit = 4) {
  return useApi<KnowledgeExternalSearchResult>(
    () => knowledgeApi.searchResources({ q, language, limit }),
    [q, language, limit],
    !q,
  );
}

/* ─── Precision Agriculture ─── */

export function useWeatherAdvisory(lat: number, lon: number, crop?: string) {
  return useApi(
    () => precisionApi.getWeatherAdvisory({ lat, lon, crop_type: crop }),
    [lat, lon, crop],
    !lat || !lon,
  );
}

export function usePracticeLogs() {
  return useApi(
    () => precisionApi.getPracticeLogs(),
    [],
  );
}

/* ─── Health ─── */

export function useHealthCheck() {
  return useApi(
    () => healthCheck(),
    [],
  );
}

/* ─── Voice ─── */

export function useVoiceLanguages() {
  return useApi(
    () => voiceApi.getLanguages(),
    [],
  );
}

export function useVoiceSessions(limit = 10) {
  return useApi(
    () => voiceApi.getSessions(limit),
    [limit],
  );
}

export function useSessionHistory(sessionId: string) {
  return useApi(
    () => voiceApi.getSessionHistory(sessionId),
    [sessionId],
    !sessionId,
  );
}

export function useMemoryFacts() {
  return useApi(
    () => voiceApi.getMemoryFacts(),
    [],
  );
}

export function useVoiceAgents() {
  return useApi(
    () => voiceApi.getAgents(),
    [],
  );
}

export function usePipelineHealth() {
  return useApi(
    () => voiceApi.getPipelineHealth(),
    [],
  );
}

/* ─── Auth ─── */

export function useAuthProfile() {
  return useApi(
    () => authApi.getProfile(),
    [],
  );
}

export function useUnifiedProfile() {
  return useApi(
    () => authApi.getUnifiedProfile(),
    [],
  );
}

export function useAuthRecommendations() {
  return useApi(
    () => authApi.getRecommendations(),
    [],
  );
}

export function useEngagement() {
  return useApi(
    () => authApi.getEngagement(),
    [],
  );
}

export function useAuthPeers() {
  return useApi(
    () => authApi.findPeers(),
    [],
  );
}

export function useAuthGroups() {
  return useApi(
    () => authApi.getGroups(),
    [],
  );
}

/* ─── Community ─── */

export function useCommunityPosts(params?: { page?: number; limit?: number; topic?: string; search?: string }) {
  return useApi<{ posts: CommunityPost[]; total: number }>(
    () => communityApi.listPosts(params),
    [JSON.stringify(params)],
  );
}

export function useCommunityPost(id: string) {
  return useApi<CommunityPost>(
    () => communityApi.getPost(id),
    [id],
    !id,
  );
}

export function useCommunityBookmarks() {
  return useApi(
    () => communityApi.listBookmarks(),
    [],
  );
}

export function useCommunityFollowing() {
  return useApi(
    () => communityApi.listFollowing(),
    [],
  );
}

/* ─── Business Directory ─── */

export function useBusinessCategories() {
  return useApi<BusinessCategory[]>(
    () => businessApi.listCategories(),
    [],
  );
}

export function useBusinessListings(params?: { page?: number; limit?: number; search?: string; categoryId?: string }) {
  return useApi<{ businesses: Business[]; total: number }>(
    () => businessApi.listBusinesses(params),
    [JSON.stringify(params)],
  );
}

export function useBusinessDetail(id: string) {
  return useApi<Business>(
    () => businessApi.getBusiness(id),
    [id],
    !id,
  );
}

/* ─── Government ─── */

export function useGovtPortals(params?: { category?: string; region?: string; search?: string }) {
  return useApi<{ portals: GovtPortal[]; total: number }>(
    () => governmentApi.listPortals(params),
    [JSON.stringify(params)],
  );
}

export function useGovtSchemes(params?: { category?: string; state?: string; search?: string; page?: number; limit?: number }) {
  return useApi(
    () => governmentApi.listSchemes(params),
    [JSON.stringify(params)],
  );
}

export function useGovtSchemeDetail(id: string) {
  return useApi<GovtScheme>(
    () => governmentApi.getScheme(id),
    [id],
    !id,
  );
}

export function useGovtSchemeCategories() {
  return useApi(
    () => governmentApi.listSchemeCategories(),
    [],
  );
}

export function useGovtComplaints() {
  return useApi(
    () => governmentApi.listComplaints(),
    [],
  );
}

/* ─── Livelihood ─── */

export function useLivelihoodCategories() {
  return useApi<LivelihoodCategory[]>(
    () => livelihoodApi.listCategories(),
    [],
  );
}

export function useLivelihoodGuidance(params?: { categoryId?: string; search?: string }) {
  return useApi<LivelihoodGuidance[]>(
    () => livelihoodApi.listGuidance(params),
    [JSON.stringify(params)],
  );
}

export function useLivelihoodGuidanceDetail(id: string) {
  return useApi<LivelihoodGuidance>(
    () => livelihoodApi.getGuidance(id),
    [id],
    !id,
  );
}

/* ─── Health (New) ─── */

export function useHealthArticles(params?: { topic?: string; language?: string; page?: number; limit?: number }) {
  return useApi<{ articles: HealthArticle[]; total: number }>(
    () => healthApi.listArticles(params),
    [JSON.stringify(params)],
  );
}

export function useHealthArticle(id: string) {
  return useApi<HealthArticle>(
    () => healthApi.getArticle(id),
    [id],
    !id,
  );
}

export function useHealthPortals(params?: { category?: string; search?: string }) {
  return useApi<HealthPortal[]>(
    () => healthApi.listHealthPortals(params),
    [JSON.stringify(params)],
  );
}

export function useHealthProviders(params?: { city?: string; type?: string; search?: string; page?: number; limit?: number }) {
  return useApi<{ providers: HealthProvider[]; total: number }>(
    () => healthApi.listProviders(params),
    [JSON.stringify(params)],
  );
}

/* ─── Voice Rooms (Twitter Spaces) ─── */

export function useVoiceRooms(params?: { page?: number; limit?: number; status?: string; topic?: string; search?: string }) {
  return useApi<{ rooms: VoiceRoom[]; pagination: VoiceRoomPagination }>(
    () => voiceRoomApi.listRooms(params),
    [JSON.stringify(params)],
  );
}

export function useVoiceRoom(roomId: string) {
  return useApi<VoiceRoom>(
    () => voiceRoomApi.getRoom(roomId),
    [roomId],
    !roomId,
  );
}

export function useVoiceRoomChat(roomId: string, params?: { limit?: number }) {
  return useApi<{ messages: VoiceRoomChatMessage[]; nextKey: string | null }>(
    () => voiceRoomApi.getChatMessages(roomId, params),
    [roomId, JSON.stringify(params)],
    !roomId,
  );
}
