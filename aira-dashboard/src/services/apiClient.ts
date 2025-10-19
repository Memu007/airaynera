import axios from 'axios';
import type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { config } from '../config/env';
import type {
  APIResponse,
  PaginatedResponse,
  LoginRequest,
  LoginResponse,
  User,
  Patient,
  PatientFilters,
  Session,
  SessionFilters,
  DashboardStats,
  APIError as APIErrorType,
} from '../types/api';

// Custom API Error class
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

// API Client class
class APIClient {
  private axios: AxiosInstance;
  private authStore: any; // Will be injected to avoid circular dependency

  constructor() {
    this.axios = axios.create({
      baseURL: config.apiBaseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  // Inject auth store to avoid circular dependency
  setAuthStore(authStore: any) {
    this.authStore = authStore;
  }

  private setupInterceptors() {
    // Request interceptor: Add JWT token to requests
    this.axios.interceptors.request.use(
      (config) => {
        const token = this.authStore?.getState?.()?.token || localStorage.getItem('aira_token');
        
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add request timestamp for debugging
        if (config.isDevelopment) {
          console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
            data: config.data,
            params: config.params,
          });
        }

        return config;
      },
      (error) => {
        console.error('[API Request Error]', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor: Handle errors and token refresh
    this.axios.interceptors.response.use(
      (response: AxiosResponse) => {
        // Log successful responses in development
        if (config.isDevelopment) {
          console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
            status: response.status,
            data: response.data,
          });
        }

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Handle different error scenarios
        if (error.response) {
          const { status, data } = error.response;

          // Token expired - attempt refresh
          if (status === 401 && !originalRequest._retry) {
            originalRequest._retry = true;

            try {
              await this.refreshToken();
              // Retry original request with new token
              return this.axios(originalRequest);
            } catch (refreshError) {
              // Refresh failed, redirect to login
              this.handleAuthFailure();
              throw this.createAPIError(error);
            }
          }

          // Other HTTP errors
          throw this.createAPIError(error);
        }

        // Network or other errors
        if (error.code === 'ECONNABORTED') {
          throw new APIError('Request timeout - please check your connection', 408, 'TIMEOUT');
        }

        if (error.message === 'Network Error') {
          throw new APIError('Network error - please check your internet connection', 0, 'NETWORK_ERROR');
        }

        // Unknown error
        throw new APIError('An unexpected error occurred', 500, 'UNKNOWN_ERROR');
      }
    );
  }

  private createAPIError(axiosError: AxiosError): APIError {
    const response = axiosError.response;
    const status = response?.status || 500;
    const data = response?.data as any;

    const message = data?.message || data?.error || axiosError.message || 'An error occurred';
    const code = data?.code || 'API_ERROR';
    const details = data?.details;

    return new APIError(message, status, code, details);
  }

  private async refreshToken(): Promise<void> {
    const refreshToken = localStorage.getItem('aira_refresh_token');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const response = await this.axios.post('/auth/refresh', {
        refreshToken,
      });

      const { token, refreshToken: newRefreshToken } = response.data.data;

      // Update tokens
      localStorage.setItem('aira_token', token);
      if (newRefreshToken) {
        localStorage.setItem('aira_refresh_token', newRefreshToken);
      }

      // Update auth store if available
      if (this.authStore?.getState?.()?.setToken) {
        this.authStore.getState().setToken(token);
      }
    } catch (error) {
      // Clear invalid tokens
      localStorage.removeItem('aira_token');
      localStorage.removeItem('aira_refresh_token');
      throw error;
    }
  }

  private handleAuthFailure(): void {
    // Clear auth data
    localStorage.removeItem('aira_token');
    localStorage.removeItem('aira_refresh_token');

    // Update auth store
    if (this.authStore?.getState?.()?.logout) {
      this.authStore.getState().logout();
    }

    // Redirect to login (will be handled by React Router)
    window.location.href = '/login';
  }

  // Authentication endpoints
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    const response = await this.axios.post<APIResponse<LoginResponse>>('/auth/login', credentials);
    return response.data.data!;
  }

  async logout(): Promise<void> {
    try {
      await this.axios.post('/auth/logout');
    } catch (error) {
      // Continue with logout even if API call fails
      console.warn('Logout API call failed:', error);
    } finally {
      // Always clear local data
      localStorage.removeItem('aira_token');
      localStorage.removeItem('aira_refresh_token');
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.axios.get<APIResponse<User>>('/auth/me');
    return response.data.data!;
  }

  // Dashboard endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.axios.get<APIResponse<DashboardStats>>('/dashboard/stats');
    return response.data.data!;
  }

  // Patient endpoints
  async getPatients(filters: PatientFilters = {}): Promise<PaginatedResponse<Patient>> {
    const params = new URLSearchParams();
    
    if (filters.search) params.append('search', filters.search);
    if (filters.status && filters.status !== 'all') params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.axios.get<APIResponse<PaginatedResponse<Patient>>>(
      `/patients?${params.toString()}`
    );
    return response.data.data!;
  }

  async getPatient(id: string): Promise<Patient> {
    const response = await this.axios.get<APIResponse<Patient>>(`/patients/${id}`);
    return response.data.data!;
  }

  async createPatient(patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'totalSessions' | 'crisisCount'>): Promise<Patient> {
    const response = await this.axios.post<APIResponse<Patient>>('/patients', patient);
    return response.data.data!;
  }

  async updatePatient(id: string, patient: Partial<Patient>): Promise<Patient> {
    const response = await this.axios.put<APIResponse<Patient>>(`/patients/${id}`, patient);
    return response.data.data!;
  }

  async deletePatient(id: string): Promise<void> {
    await this.axios.delete(`/patients/${id}`);
  }

  // Session endpoints
  async getSessions(filters: SessionFilters = {}): Promise<PaginatedResponse<Session>> {
    const params = new URLSearchParams();
    
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.search) params.append('search', filters.search);
    if (filters.type && filters.type !== 'all') params.append('type', filters.type);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters.dateTo) params.append('dateTo', filters.dateTo);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.limit) params.append('limit', filters.limit.toString());

    const response = await this.axios.get<APIResponse<PaginatedResponse<Session>>>(
      `/sessions?${params.toString()}`
    );
    return response.data.data!;
  }

  async getSession(id: string): Promise<Session> {
    const response = await this.axios.get<APIResponse<Session>>(`/sessions/${id}`);
    return response.data.data!;
  }

  async getPatientSessions(patientId: string, filters: Omit<SessionFilters, 'patientId'> = {}): Promise<PaginatedResponse<Session>> {
    return this.getSessions({ ...filters, patientId });
  }

  // Crisis endpoints
  async getCrisisSessions(filters: Omit<SessionFilters, 'type'> = {}): Promise<PaginatedResponse<Session>> {
    return this.getSessions({ ...filters, type: 'crisis' });
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.axios.get<APIResponse<{ status: string; timestamp: string }>>('/health');
    return response.data.data!;
  }
}

// Create singleton instance
export const apiClient = new APIClient();

// Export types for convenience
export type { APIError as APIErrorType };