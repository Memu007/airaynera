import { QueryClient } from '@tanstack/react-query';

// Simple cache persistence using localStorage
const CACHE_KEY = 'aira-query-cache';
const CACHE_VERSION = '1.0';
const MAX_CACHE_AGE = 1000 * 60 * 60 * 24; // 24 hours

// Queries to persist (only non-sensitive data)
const persistableQueries = [
  'dashboard',
  'patients',
  'sessions',
];

// Check if a query should be persisted
const shouldPersistQuery = (queryKey: unknown[]): boolean => {
  if (!Array.isArray(queryKey) || queryKey.length === 0) return false;
  
  const firstKey = String(queryKey[0]);
  return persistableQueries.some(key => firstKey.includes(key));
};

// Save cache to localStorage
const saveCache = (queryClient: QueryClient) => {
  try {
    const cache = queryClient.getQueryCache();
    const queries = cache.getAll();
    
    const persistableData = queries
      .filter(query => shouldPersistQuery(query.queryKey))
      .map(query => ({
        queryKey: query.queryKey,
        data: query.state.data,
        dataUpdatedAt: query.state.dataUpdatedAt,
      }))
      .filter(item => item.data !== undefined);

    const cacheData = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      queries: persistableData,
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
  } catch (error) {
    console.warn('Failed to save query cache:', error);
  }
};

// Load cache from localStorage
const loadCache = (queryClient: QueryClient) => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return;

    const cacheData = JSON.parse(cached);
    
    // Check cache version and age
    if (cacheData.version !== CACHE_VERSION) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }

    const age = Date.now() - cacheData.timestamp;
    if (age > MAX_CACHE_AGE) {
      localStorage.removeItem(CACHE_KEY);
      return;
    }

    // Restore queries to cache
    cacheData.queries.forEach((queryData: any) => {
      queryClient.setQueryData(queryData.queryKey, queryData.data);
    });

    console.log(`Restored ${cacheData.queries.length} queries from cache`);
  } catch (error) {
    console.warn('Failed to load query cache:', error);
    localStorage.removeItem(CACHE_KEY);
  }
};

// Configure query persistence
export const setupQueryPersistence = (queryClient: QueryClient) => {
  if (typeof window === 'undefined') return;

  // Load cache on startup
  loadCache(queryClient);

  // Save cache periodically and on important events
  const saveInterval = setInterval(() => saveCache(queryClient), 5 * 60 * 1000); // Every 5 minutes

  // Save on page unload
  const handleBeforeUnload = () => saveCache(queryClient);
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Save on visibility change (when user switches tabs)
  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      saveCache(queryClient);
    }
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return cleanup function
  return () => {
    clearInterval(saveInterval);
    window.removeEventListener('beforeunload', handleBeforeUnload);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  };
};

// Clear persisted cache (useful for logout)
export const clearPersistedCache = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(CACHE_KEY);
  }
};