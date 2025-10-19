// API Response Types
export interface APIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
  nextPage?: number;
  prevPage?: number;
}

// Authentication Types
export interface LoginRequest {
  dni: string;
  pin: string;
}

export interface LoginResponse {
  user: User;
  token: string;
  refreshToken?: string;
}

export interface User {
  id: string;
  dni: string;
  nombre: string;
  especialidad: string;
  matricula?: string;
  email?: string;
  telefono?: string;
  createdAt: string;
  lastLogin: string;
}

// Patient Types
export interface Patient {
  id: string;
  nombre: string;
  dni: string;
  obraSocial?: string;
  telefono?: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  lastSession?: string;
  totalSessions: number;
  crisisCount: number;
}

export interface PatientFilters {
  search?: string;
  status?: 'active' | 'inactive' | 'all';
  page?: number;
  limit?: number;
}

// Session Types
export interface Session {
  id: string;
  patientId: string;
  patientName: string;
  observaciones: string;
  resumen?: string;
  moodScore?: number;
  sessionType: 'regular' | 'crisis' | 'followup';
  crisisDetected: boolean;
  crisisSeverity?: 'low' | 'medium' | 'high';
  durationMinutes?: number;
  createdAt: string;
  createdVia: 'whatsapp' | 'web';
}

export interface SessionFilters {
  patientId?: string;
  search?: string;
  type?: 'all' | 'crisis' | 'regular' | 'followup';
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

// Dashboard Stats Types
export interface DashboardStats {
  totalPatients: number;
  activePatients: number;
  monthlySessions: number;
  crisisDetected: number;
  aiResponseRate: number;
  patientsTrend?: number;
  sessionsTrend?: number;
  aiTrend?: number;
}

// Error Types
export interface APIError {
  message: string;
  status: number;
  code?: string;
  details?: any;
}