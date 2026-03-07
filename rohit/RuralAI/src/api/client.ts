/**
 * Shared API client — wraps fetch with auth headers, error handling, timeouts.
 */
import API_CONFIG, { getMockUser } from './config';

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

  // console.log("Mock user data", user);
  console.log("api 1", API_CONFIG.OPEN_DATA_BASE)
  console.log("api 2", API_CONFIG.COMMUNITY_BASE)
  console.log("api 3", API_CONFIG.HEALTH_BASE)

  const baseUrl = API_CONFIG[baseKey];
  const url = `${baseUrl}${path}`;

  const user = getMockUser();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': user.id,
    'x-user-name': user.name,
    ...extraHeaders,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  console.log(`[API:REQUEST] ${method} ${url}`, body ? body : "");

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    console.log("response in client.ts", res);


    clearTimeout(timeoutId);
    const json = await res.json().catch(() => null);

    if (!res.ok) {
      console.log(`[API:ERROR] ${method} ${url} - Status: ${res.status}`, json);
      return {
        data: null,
        error: json?.message || json?.error || `HTTP ${res.status}`,
        status: res.status,
      };
    }

    console.log(`[API:SUCCESS] ${method} ${url} - Status: ${res.status}`);
    return { data: json, error: null, status: res.status };
  } catch (err: any) {
    clearTimeout(timeoutId);

    if (err.name === 'AbortError') {
      console.log(`[API:TIMEOUT] ${method} ${url} - Request timed out`);
      return { data: null, error: 'Request timed out', status: 0 };
    }

    console.log(`[API:NETWORK_ERROR] ${method} ${url} -`, err.message);
    return { data: null, error: err.message || 'Network error', status: 0 };
  }
}

// ── Convenience methods per feature ──

export const openDataClient = {
  get: <T = any>(path: string) => request<T>('OPEN_DATA_BASE', path, 'GET'),
  post: <T = any>(path: string, body?: any) => request<T>('OPEN_DATA_BASE', path, 'POST', body),
  put: <T = any>(path: string, body?: any) => request<T>('OPEN_DATA_BASE', path, 'PUT', body),
  del: <T = any>(path: string) => request<T>('OPEN_DATA_BASE', path, 'DELETE'),
};

export const communityClient = {
  get: <T = any>(path: string) => request<T>('COMMUNITY_BASE', path, 'GET'),
  post: <T = any>(path: string, body?: any) => request<T>('COMMUNITY_BASE', path, 'POST', body),
  put: <T = any>(path: string, body?: any) => request<T>('COMMUNITY_BASE', path, 'PUT', body),
  del: <T = any>(path: string) => request<T>('COMMUNITY_BASE', path, 'DELETE'),
};

export const healthClient = {
  get: <T = any>(path: string) => request<T>('HEALTH_BASE', path, 'GET'),
  post: <T = any>(path: string, body?: any) => request<T>('HEALTH_BASE', path, 'POST', body),
  put: <T = any>(path: string, body?: any) => request<T>('HEALTH_BASE', path, 'PUT', body),
  del: <T = any>(path: string) => request<T>('HEALTH_BASE', path, 'DELETE'),
};

