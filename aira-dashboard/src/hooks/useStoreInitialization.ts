import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { config } from '../config/env';

/**
 * Hook to initialize stores and handle app startup logic
 */
export const useStoreInitialization = () => {
  const refreshUser = useAuthStore((state) => state.refreshUser);
  const setTheme = useAppStore((state) => state.setTheme);
  const theme = useAppStore((state) => state.theme);

  useEffect(() => {
    // Initialize theme on app startup
    const savedTheme = localStorage.getItem('aira-theme') as 'light' | 'dark' | null;
    if (savedTheme && savedTheme !== theme) {
      setTheme(savedTheme);
    }

    // Check for existing token and refresh user data
    const token = localStorage.getItem(config.tokenKey);
    if (token) {
      refreshUser().catch((error) => {
        console.warn('Failed to refresh user on app startup:', error);
        // Don't throw error here, let the user try to login again
      });
    }
  }, [refreshUser, setTheme, theme]);

  // Return initialization status
  const isInitialized = true; // For now, always return true
  
  return { isInitialized };
};