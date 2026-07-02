import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Lightweight data-fetching cache with TTL.
 * Shared across all component instances to prevent duplicate
 * network requests when navigating between routes.
 *
 * Example usage:
 *   const { data: profile, loading } = useCachedQuery(
 *     `profile-${userId}`,
 *     () => supabase.from('profiles').select('*').eq('id', userId).single().then(r => r.data),
 *     { ttl: 5 * 60 * 1000 }
 *   );
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes

// Global cache shared across all hook instances
const queryCache = new Map<string, CacheEntry<any>>();
// Track in-flight requests to prevent duplicate fetches
const inflightRequests = new Map<string, Promise<any>>();

export function invalidateCache(key: string) {
  queryCache.delete(key);
  inflightRequests.delete(key);
}

export function invalidateCachePrefix(prefix: string) {
  for (const key of queryCache.keys()) {
    if (key.startsWith(prefix)) {
      queryCache.delete(key);
      inflightRequests.delete(key);
    }
  }
}

interface UseCachedQueryOptions {
  /** Cache time-to-live in milliseconds. Default: 5 minutes */
  ttl?: number;
  /** If true, skip fetching (useful for conditional queries) */
  enabled?: boolean;
}

export function useCachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: UseCachedQueryOptions = {}
) {
  const { ttl = DEFAULT_TTL, enabled = true } = options;

  const [data, setData] = useState<T | null>(() => {
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }
    return null;
  });
  const [loading, setLoading] = useState(!data && enabled);
  const [error, setError] = useState<Error | null>(null);

  // Prevent stale closures
  const fetcherRef = useRef(fetcher);

  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const fetchData = useCallback(async () => {
    // Check cache first
    const cached = queryCache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      setData(cached.data);
      setLoading(false);
      return cached.data;
    }

    // Deduplicate in-flight requests
    let promise = inflightRequests.get(key);
    if (!promise) {
      promise = fetcherRef.current();
      inflightRequests.set(key, promise);
    }

    try {
      setLoading(true);
      const result = await promise;
      queryCache.set(key, { data: result, timestamp: Date.now() });
      setData(result);
      setError(null);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      inflightRequests.delete(key);
      setLoading(false);
    }
  }, [key, ttl]);

  useEffect(() => {
    if (!enabled) return;
    fetchData();
  }, [fetchData, enabled]);

  const refetch = useCallback(() => {
    queryCache.delete(key);
    inflightRequests.delete(key);
    return fetchData();
  }, [key, fetchData]);

  return { data, loading, error, refetch };
}
