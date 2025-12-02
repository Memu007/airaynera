import { QueryClient } from '@tanstack/react-query';
import { APIError } from '../services/apiClient';
import { config } from './env';
import { setupQueryPersistence } from './queryPersistence';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: config.defaultStaleTime,
      gcTime: config.defaultCacheTime,
      retry: (failureCount, error) => {
        // Don't retry on authentication errors
        if (error instanceof APIError) {
          if (error.status === 401 || error.status === 403) {
            return false;
          }
          // Don't retry on 4xx client errors (except auth)
          if (error.status >= 400 && error.status < 500) {
            return false;
          }
        }
        
        // Retry up to 3 times for network/server errors
        return failureCount < 3;
      },
      refetchOnWindowFocus: false, // Disable automatic refetch on window focus
      refetchOnReconnect: true, // Refetch when network reconnects
    },
    mutations: {
      retry: (failureCount, error) => {
        // Don't retry mutations on client errors
        if (error instanceof APIError && error.status >= 400 && error.status < 500) {
          return false;
        }
        // Only retry once for mutations
        return failureCount < 1;
      },
    },
  },
});

// Setup query persistence
setupQueryPersistence(queryClient);