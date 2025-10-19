import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useCacheInvalidation } from './useCacheInvalidation';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';

/**
 * Hook for managing background synchronization of data
 */
export const useBackgroundSync = () => {
  const queryClient = useQueryClient();
  const { invalidateDashboard, invalidateCrisisData } = useCacheInvalidation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const addNotification = useAppStore((state) => state.addNotification);
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncRef = useRef<number>(Date.now());

  // Background sync for critical data
  const performBackgroundSync = async () => {
    if (!isAuthenticated) return;

    try {
      // Invalidate critical data that should be fresh
      await Promise.all([
        invalidateDashboard(),
        invalidateCrisisData(),
      ]);

      lastSyncRef.current = Date.now();
      
      // Optional: Show subtle notification for successful sync
      if (process.env.NODE_ENV === 'development') {
        console.log('Background sync completed at', new Date().toLocaleTimeString());
      }
    } catch (error) {
      console.warn('Background sync failed:', error);
      
      // Show notification for sync failures (but not too frequently)
      const timeSinceLastSync = Date.now() - lastSyncRef.current;
      if (timeSinceLastSync > 5 * 60 * 1000) { // 5 minutes
        addNotification({
          type: 'warning',
          title: 'Sincronización',
          message: 'Algunos datos podrían no estar actualizados',
          duration: 3000,
        });
      }
    }
  };

  // Set up background sync interval
  useEffect(() => {
    if (!isAuthenticated) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Sync every 2 minutes for critical data
    intervalRef.current = setInterval(performBackgroundSync, 2 * 60 * 1000);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAuthenticated]);

  // Sync on window focus (when user returns to app)
  useEffect(() => {
    const handleFocus = () => {
      if (isAuthenticated) {
        const timeSinceLastSync = Date.now() - lastSyncRef.current;
        // Only sync if it's been more than 30 seconds since last sync
        if (timeSinceLastSync > 30 * 1000) {
          performBackgroundSync();
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [isAuthenticated]);

  // Sync on network reconnection
  useEffect(() => {
    const handleOnline = () => {
      if (isAuthenticated) {
        addNotification({
          type: 'success',
          title: 'Conexión restaurada',
          message: 'Sincronizando datos...',
          duration: 2000,
        });
        performBackgroundSync();
      }
    };

    const handleOffline = () => {
      addNotification({
        type: 'warning',
        title: 'Sin conexión',
        message: 'Trabajando en modo offline',
        duration: 3000,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated, addNotification]);

  return {
    performBackgroundSync,
    lastSync: lastSyncRef.current,
  };
};