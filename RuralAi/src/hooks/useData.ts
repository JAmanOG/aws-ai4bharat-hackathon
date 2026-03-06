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
  type PricesResult,
  type PriceAlert,
  type Scheme,
  type Course,
} from '../services/api';

/* ─── Market Data ─── */

export function useMarketPrices(crop: string, state?: string, district?: string) {
  return useApi<PricesResult>(
    () => marketApi.getPrices(crop, state, district),
    [crop, state, district],
    !crop,
  );
}

export function usePriceTrend(crop: string, mandiCode?: string, days = 30) {
  return useApi(
    () => marketApi.getPriceTrend(crop, mandiCode, days),
    [crop, mandiCode, days],
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
