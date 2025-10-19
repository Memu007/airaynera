// Core Domain Models
export interface User {
  id: string;
  dni: string;
  nombre: string;
  especialidad: string;
  matricula: string;
  email?: string;
  telefono?: string;
  createdAt: Date;
  lastLogin: Date;
}

export interface Patient {
  id: string;
  nombre: string;
  dni: string;
  obraSocial?: string;
  telefono?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
  lastSession?: Date;
  totalSessions: number;
  crisisCount: number;
}

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
  createdAt: Date;
  createdVia: 'whatsapp' | 'web';
}

// API Response Types
export interface APIResponse<T> {
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
  nextPage?: number;
}

// Auth Types
export interface LoginCredentials {
  dni: string;
  pin: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// Dashboard Types
export interface DashboardStats {
  totalPatients: number;
  monthlySessions: number;
  crisisDetected: number;
  aiResponseRate: number;
  patientsTrend?: number;
  sessionsTrend?: number;
  aiTrend?: number;
}

// Filter Types
export interface PatientFilters {
  search?: string;
  status?: 'active' | 'inactive';
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SessionFilters {
  patientId?: string;
  crisisOnly?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
  sessionType?: 'regular' | 'crisis' | 'followup';
}

// Notification Types
export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}