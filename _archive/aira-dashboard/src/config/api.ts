import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { config } from './env';
import type { 
  APIResponse, 
  PaginatedResponse, 
  LoginCredentials, 
  AuthResponse, 
  User, 
  Patient, 
  Session, 
  DashboardStats,
  PatientFilters,
  SessionFilters 
} from '../types';

export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class APIClient {
  private axios: AxiosInstance;

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

  private setupInterceptors() {
    // Request interceptor: agregar JWT token
    this.axios.interceptors.request.use((config) => {
      const token = localStorage.getItem('aira_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor: manejar errores
    this.axios.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        const status = error.response?.status || 500;
        const message = (error.response?.data as any)?.message || 'Error de conexión';
        const code = (error.response?.data as any)?.code;

        // Si es 401, limpiar token y redirigir al login
        if (status === 401) {
          localStorage.removeItem('aira_token');
          window.location.href = '/login';
        }

        throw new APIError(message, status, code);
      }
    );
  }

  // Auth endpoints
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    // Convertir DNI a email temporal para compatibilidad con backend
    const loginData = {
      dni: credentials.dni,
      pin: credentials.pin
    };
    
    const response = await this.axios.post<APIResponse<AuthResponse>>('/auth/login', loginData);
    if (!response.data.success || !response.data.data) {
      throw new APIError(response.data.error || 'Login failed', 400);
    }
    return response.data.data;
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.axios.get<APIResponse<User>>('/auth/me');
    if (!response.data.success || !response.data.data) {
      throw new APIError(response.data.error || 'Failed to get user', 400);
    }
    return response.data.data;
  }

  // Dashboard endpoints
  async getDashboardStats(professionalId: string): Promise<DashboardStats> {
    const response = await this.axios.get<APIResponse<DashboardStats>>(`/dashboard/stats/${professionalId}`);
    if (!response.data.success || !response.data.data) {
      throw new APIError(response.data.error || 'Failed to get stats', 400);
    }
    return response.data.data;
  }

  // Patient endpoints
  async getPatients(filters: PatientFilters = {}): Promise<PaginatedResponse<Patient>> {
    const params = new URLSearchParams();
    if (filters.search) params.append('search', filters.search);
    if (filters.status) params.append('status', filters.status);
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString());
    if (filters.dateTo) params.append('dateTo', filters.dateTo.toISOString());

    const response = await this.axios.get<APIResponse<PaginatedResponse<Patient>>>(`/patients?${params}`);
    if (!response.data.success || !response.data.data) {
      throw new APIError(response.data.error || 'Failed to get patients', 400);
    }
    return response.data.data;
  }

  async createPatient(patientData: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'totalSessions' | 'crisisCount'>): Promise<Patient> {
    const response = await this.axios.post<APIResponse<Patient>>('/patients', patientData);
    if (!response.data.success || !response.data.data) {
      throw new APIError(response.data.error || 'Failed to create patient', 400);
    }
    return response.data.data;
  }

  async updatePatientStatus(patientId: string, status: 'active' | 'inactive'): Promise<void> {
    const response = await this.axios.patch<APIResponse<void>>(`/patients/${patientId}/status`, { status });
    if (!response.data.success) {
      throw new APIError(response.data.error || 'Failed to update patient status', 400);
    }
  }

  // Session endpoints
  async getSessions(filters: SessionFilters = {}): Promise<PaginatedResponse<Session>> {
    const params = new URLSearchParams();
    if (filters.patientId) params.append('patientId', filters.patientId);
    if (filters.crisisOnly) params.append('crisisOnly', 'true');
    if (filters.dateFrom) params.append('dateFrom', filters.dateFrom.toISOString());
    if (filters.dateTo) params.append('dateTo', filters.dateTo.toISOString());
    if (filters.sessionType) params.append('sessionType', filters.sessionType);

    const response = await this.axios.get<APIResponse<PaginatedResponse<Session>>>(`/sessions?${params}`);
    if (!response.data.success || !response.data.data) {
      throw new APIError(response.data.error || 'Failed to get sessions', 400);
    }
    return response.data.data;
  }

  async getPatientSessions(patientId: string): Promise<Session[]> {
    const response = await this.axios.get<APIResponse<Session[]>>(`/patients/${patientId}/sessions`);
    if (!response.data.success || !response.data.data) {
      throw new APIError(response.data.error || 'Failed to get patient sessions', 400);
    }
    return response.data.data;
  }
}

export const apiClient = new APIClient();