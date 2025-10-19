import React, { useEffect, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { isAuthenticated, refreshTokenIfNeeded, forceLogout } = useAuth();
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Set up automatic token refresh
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear any existing refresh interval
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      return;
    }

    // Check and refresh token every 4 minutes
    refreshIntervalRef.current = setInterval(async () => {
      try {
        await refreshTokenIfNeeded();
      } catch (error) {
        console.error('Auto token refresh failed:', error);
        forceLogout('Tu sesión ha expirado');
      }
    }, 4 * 60 * 1000); // 4 minutes

    // Cleanup on unmount or when authentication changes
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [isAuthenticated, refreshTokenIfNeeded, forceLogout]);

  // Handle page visibility changes
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isAuthenticated) {
        try {
          await refreshTokenIfNeeded();
        } catch (error) {
          console.warn('Token refresh on visibility change failed:', error);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, refreshTokenIfNeeded]);

  // Handle storage events (for multi-tab logout)
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'aira_token' && event.newValue === null) {
        // Token was removed in another tab, force logout
        forceLogout('Sesión cerrada en otra pestaña');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [forceLogout]);

  return <>{children}</>;
};