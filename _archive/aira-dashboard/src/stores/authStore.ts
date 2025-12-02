import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiClient } from '../services/apiClient';
import { config } from '../config/env';
import { clearPersistedCache } from '../config/queryPersistence';
import type { User, LoginRequest } from '../types/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (credentials: LoginRequest) => {
        set({ isLoading: true });
        try {
          const response = await apiClient.login(credentials);
          
          // Store tokens using config constants
          localStorage.setItem(config.tokenKey, response.token);
          if (response.refreshToken) {
            localStorage.setItem(config.refreshTokenKey, response.refreshToken);
          }
          
          set({
            user: response.user,
            token: response.token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await apiClient.logout();
        } catch (error) {
          console.warn('Logout API call failed:', error);
        } finally {
          get().clearAuth();
          set({ isLoading: false });
        }
      },

      refreshUser: async () => {
        const token = localStorage.getItem(config.tokenKey);
        if (!token) {
          get().clearAuth();
          return;
        }

        try {
          const user = await apiClient.getCurrentUser();
          set({
            user,
            token,
            isAuthenticated: true,
          });
        } catch (error) {
          get().clearAuth();
          throw error;
        }
      },

      setUser: (user: User) => {
        set({ user, isAuthenticated: true });
      },

      setToken: (token: string) => {
        localStorage.setItem(config.tokenKey, token);
        set({ token });
      },

      clearAuth: () => {
        localStorage.removeItem(config.tokenKey);
        localStorage.removeItem(config.refreshTokenKey);
        clearPersistedCache(); // Clear React Query cache
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
      },
    }),
    {
      name: 'aira-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Initialize API client with auth store to avoid circular dependency
apiClient.setAuthStore(useAuthStore);