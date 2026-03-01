/**
 * Shared API client — wraps fetch with auth headers, error handling, timeouts.
 */
import API_CONFIG, { MOCK_USER } from './config';

const TIMEOUT_MS = 15000;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

export interface ApiResponse<T = any> {
  data: T | null;
  error: string | null;
  status: number;
}

/**
 * Core request function.
 */
async function request<T = any>(
  baseKey: keyof typeof API_CONFIG,
  path: string,
  method: HttpMethod = 'GET',
  body?: any,
  extraHeaders?: Record<string, string>,
): Promise<ApiResponse<T>> {
  const baseUrl = API_CONFIG[baseKey];
  const url = `${baseUrl}${path}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': MOCK_USER.id,
    'x-user-name': MOCK_USER.name,
    ...extraHeaders,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        data: null,
        error: json?.message || json?.error || `HTTP ${res.status}`,
        status: res.status,
      };
    }

    return { data: json, error: null, status: res.status };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      return { data: null, error: 'Request timed out', status: 0 };
    }

    return { data: null, error: err.message || 'Network error', status: 0 };
  }
}

// ── Convenience methods per feature ──

export const feature1 = {
  get: <T = any>(path: string) => request<T>('FEATURE1_BASE', path, 'GET'),
  post: <T = any>(path: string, body?: any) => request<T>('FEATURE1_BASE', path, 'POST', body),
  put: <T = any>(path: string, body?: any) => request<T>('FEATURE1_BASE', path, 'PUT', body),
  del: <T = any>(path: string) => request<T>('FEATURE1_BASE', path, 'DELETE'),
};

export const feature3 = {
  get: <T = any>(path: string) => request<T>('FEATURE2_BASE', path, 'GET'),
};

export const feature4 = {
  get: <T = any>(path: string) => request<T>('FEATURE3_BASE', path, 'GET'),
  post: <T = any>(path: string, body?: any) => request<T>('FEATURE3_BASE', path, 'POST', body),
};

