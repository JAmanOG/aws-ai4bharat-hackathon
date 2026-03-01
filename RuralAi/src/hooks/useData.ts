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

export function useMandis(state?: string) {
  return useApi(
    () => marketApi.getMandis(state),
    [state],
  );
}

/* ─── Price Alerts ─── */

export function usePriceAlerts() {
  return useApi<{ alerts: PriceAlert[] }>(
    () => alertsApi.getAlerts(),
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

/* ─── Knowledge ─── */

export function useCourses(language?: string, difficulty?: string) {
  return useApi<{ courses: Course[] }>(
    () => knowledgeApi.getCourses(language, difficulty),
    [language, difficulty],
  );
}

export function usePeerGroups() {
  return useApi(
    () => knowledgeApi.getPeerGroups(),
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

/* ─── Precision Agriculture ─── */

export function useWeatherAdvisory(lat: number, lon: number, crop?: string) {
  return useApi(
    () => precisionApi.getWeatherAdvisory(lat, lon, crop),
    [lat, lon, crop],
    !lat || !lon,
  );
}

/* ─── Health ─── */

export function useHealthCheck() {
  return useApi(
    () => healthCheck(),
    [],
  );
}
