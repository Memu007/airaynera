import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { queryKeys } from './useApi';

/**
 * Hook for managing cache invalidation strategies
 */
export const useCacheInvalidation = () => {
  const queryClient = useQueryClient();

  // Invalidate all patient-related queries
  const invalidatePatients = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['patients'] });
  }, [queryClient]);

  // Invalidate all session-related queries
  const invalidateSessions = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sessions'] });
  }, [queryClient]);

  // Invalidate dashboard stats
  const invalidateDashboard = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
  }, [queryClient]);

  // Invalidate specific patient data
  const invalidatePatient = useCallback((patientId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.patient(patientId) });
    queryClient.invalidateQueries({ queryKey: ['patients', patientId, 'sessions'] });
  }, [queryClient]);

  // Invalidate specific session data
  const invalidateSession = useCallback((sessionId: string) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.session(sessionId) });
  }, [queryClient]);

  // Invalidate all crisis-related data
  const invalidateCrisisData = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sessions', 'crisis'] });
    queryClient.invalidateQueries({ queryKey: queryKeys.dashboardStats });
  }, [queryClient]);

  // Invalidate all data (useful for logout or major updates)
  const invalidateAll = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  // Clear all cache (more aggressive than invalidate)
  const clearAllCache = useCallback(() => {
    queryClient.clear();
  }, [queryClient]);

  // Prefetch commonly used data
  const prefetchDashboardData = useCallback(async () => {
    await Promise.all([
      queryClient.prefetchQuery({
        queryKey: queryKeys.dashboardStats,
        staleTime: 2 * 60 * 1000, // 2 minutes
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.patients({ page: 1, limit: 20 }),
        staleTime: 2 * 60 * 1000,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.crisisSessions({ page: 1, limit: 10 }),
        staleTime: 30 * 1000, // 30 seconds for crisis data
      }),
    ]);
  }, [queryClient]);

  return {
    invalidatePatients,
    invalidateSessions,
    invalidateDashboard,
    invalidatePatient,
    invalidateSession,
    invalidateCrisisData,
    invalidateAll,
    clearAllCache,
    prefetchDashboardData,
  };
};