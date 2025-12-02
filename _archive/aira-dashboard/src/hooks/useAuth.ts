import { useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { jwtDecode } from 'jwt-decode';
import { useAuthStore } from '../stores/authStore';
import { useAppStore } from '../stores/appStore';
import { config } from '../config/env';
import { apiClient } from '../services/apiClient';
import type { User, LoginRequest } from '../types/api';

interface DecodedToken {
  id: string;
  role: 'professional' | 'admin';
  exp: number;
}

// Define los permisos para cada rol
const rolePermissions: Record<string, string[]> = {
  professional: ['view_dashboard', 'manage_patients', 'manage_sessions'],
  admin: ['view_dashboard', 'manage_patients', 'manage_sessions', 'admin_panel'],
};

/**
 * Comprehensive authentication hook
 */
export const useAuth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Auth store
  const {
    user,
    token,
    isAuthenticated,
    isLoading,
    login: storeLogin,
    logout: storeLogout,
    refreshUser,
    clearAuth,
  } = useAuthStore();

  // App store for notifications
  const addNotification = useAppStore((state) => state.addNotification);

  const decodedToken = useMemo((): DecodedToken | null => {
    if (!token) return null;
    try {
      return jwtDecode<DecodedToken>(token);
    } catch (error) {
      console.error('Failed to decode token:', error);
      return null;
    }
  }, [token]);

  const isTokenExpired = useMemo(() => {
    if (!decodedToken) return true;
    return Date.now() >= decodedToken.exp * 1000;
  }, [decodedToken]);
  
  const userRole = useMemo(() => {
    return decodedToken?.role || null;
  }, [decodedToken]);

  const hasPermission = useCallback((permission: string) => {
    if (!userRole) return false;
    return rolePermissions[userRole]?.includes(permission) || false;
  }, [userRole]);

  // Check if token is expired
  const isTokenExpired = useMemo(() => {
    if (!token) return true;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      return payload.exp < currentTime;
    } catch {
      return true;
    }
  }, [token]);

  // Enhanced login function
  const login = useCallback(async (credentials: LoginRequest) => {
    try {
      await storeLogin(credentials);
      
      // Redirect to intended page or dashboard
      const from = (location.state as any)?.from || '/';
      navigate(from, { replace: true });
      
      return true;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }, [storeLogin, navigate, location.state]);

  // Enhanced logout function
  const logout = useCallback(async (showNotification = true) => {
    try {
      await storeLogout();
      
      if (showNotification) {
        addNotification({
          type: 'info',
          title: 'Sesión cerrada',
          message: 'Has cerrado sesión correctamente',
          duration: 3000,
        });
      }
      
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout failed:', error);
      // Force logout even if API call fails
      clearAuth();
      navigate('/login', { replace: true });
    }
  }, [storeLogout, addNotification, navigate, clearAuth]);

  // Auto-refresh token when it's about to expire
  const refreshTokenIfNeeded = useCallback(async () => {
    if (!token || !user) return false;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const currentTime = Date.now() / 1000;
      const timeUntilExpiry = payload.exp - currentTime;
      
      // Refresh if token expires in less than 5 minutes
      if (timeUntilExpiry < 5 * 60) {
        await refreshUser();
        return true;
      }
      
      return false;
    } catch (error) {
      console.warn('Token refresh check failed:', error);
      return false;
    }
  }, [token, user, refreshUser]);

  // Check authentication status
  const checkAuth = useCallback(async () => {
    const storedToken = localStorage.getItem(config.tokenKey);
    
    if (!storedToken) {
      clearAuth();
      return false;
    }

    if (isTokenExpired) {
      try {
        await refreshUser();
        return true;
      } catch (error) {
        console.warn('Token refresh failed:', error);
        clearAuth();
        addNotification({
          type: 'warning',
          title: 'Sesión expirada',
          message: 'Por favor, inicia sesión nuevamente',
          duration: 4000,
        });
        return false;
      }
    }

    return true;
  }, [isTokenExpired, refreshUser, clearAuth, addNotification]);

  // Force logout (for security reasons)
  const forceLogout = useCallback((reason?: string) => {
    clearAuth();
    
    addNotification({
      type: 'error',
      title: 'Sesión terminada',
      message: reason || 'Tu sesión ha sido terminada por seguridad',
      duration: 5000,
    });
    
    navigate('/login', { replace: true });
  }, [clearAuth, addNotification, navigate]);

  // Get user permissions (placeholder for future implementation)
  const hasPermission = useCallback((permission: string) => {
    // TODO: Implement permission checking based on user role
    return true;
  }, []);

  // Get user role
  const userRole = useMemo(() => {
    // TODO: Extract role from user data
    return user ? 'professional' : null;
  }, [user]);

  return {
    // State
    user,
    token,
    isAuthenticated: isAuthenticated && !isTokenExpired,
    isLoading,
    isTokenExpired,
    userRole,

    // Actions
    login,
    logout,
    refreshTokenIfNeeded,
    checkAuth,
    forceLogout,
    hasPermission,
  };
};