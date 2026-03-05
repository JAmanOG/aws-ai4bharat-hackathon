/**
 * Generic async-data hook with loading / error / refresh support.
 * Works with any API call — just pass a fetcher function.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ApiError } from '../services/api';
import { logger } from '../utils/logger';

interface UseApiState<T> {
  data: T | null;
  loading: boolean;
  error: ApiError | null;
  refresh: () => void;
}

/**
 * @param fetcher  Async function returning data.
 * @param deps     Re-fetch when these change (like useEffect deps).
 * @param skip     If true, don't auto-fetch on mount.
 */
export function useApi<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[] = [],
  skip = false,
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState<ApiError | null>(null);
  const mountedRef = useRef(true);
  const triggerRef = useRef(0);

  const load = useCallback(() => {
    triggerRef.current += 1;
    const id = triggerRef.current;
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetcher(controller.signal)
      .then((result) => {
        if (mountedRef.current && id === triggerRef.current) {
          logger.debug('useApi', 'Data loaded', { id });
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current && id === triggerRef.current) {
          logger.warn('useApi', 'Fetch error', { id, message: err?.message });
          setError(err);
          setLoading(false);
        }
      });

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mountedRef.current = true;
    if (!skip) {
      const cancel = load();
      return () => {
        cancel?.();
      };
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, skip]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return { data, loading, error, refresh: load };
}
