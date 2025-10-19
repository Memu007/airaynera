import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../services/apiClient';
import { useErrorHandler } from './useErrorHandler';
import type {
  Patient,
  PatientFilters,
  Session,
  SessionFilters,
  DashboardStats,
  LoginRequest,
} from '../types/api';

// Query Keys
export const queryKeys = {
  // Auth
  currentUser: ['auth', 'currentUser'] as const,
  
  // Dashboard
  dashboardStats: ['dashboard', 'stats'] as const,
  
  // Patients
  patients: (filters?: PatientFilters) => ['patients', filters] as const,
  patient: (id: string) => ['patients', id] as const,
  patientSessions: (patientId: string, filters?: Omit<SessionFilters, 'patientId'>) => 
    ['patients', patientId, 'sessions', filters] as const,
  
  // Sessions
  sessions: (filters?: SessionFilters) => ['sessions', filters] as const,
  session: (id: string) => ['sessions', id] as const,
  crisisSessions: (filters?: Omit<SessionFilters, 'type'>) => 
    ['sessions', 'crisis', filters] as const,
} as const;

// Auth Hooks
export const useLogin = () => {
  const { handleError, handleSuccess } = useErrorHandler();
  
  return useMutation({
    mutationFn: (credentials: LoginRequest) => apiClient.login(credentials),
    onSuccess: () => {
      handleSuccess('Sesión iniciada correctamente', 'Bienvenido');
    },
    onError: (error) => {
      handleError(error, 'Error al iniciar sesión');
    },
  });
};

export const useCurrentUser = () => {
  return useQuery({
    queryKey: queryKeys.currentUser,
    queryFn: () => apiClient.getCurrentUser(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false, // Don't retry on auth errors
  });
};

// Dashboard Hooks
export const useDashboardStats = () => {
  return useQuery({
    queryKey: queryKeys.dashboardStats,
    queryFn: () => apiClient.getDashboardStats(),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 30 * 1000, // Refresh every 30 seconds
  });
};

// Patient Hooks
export const usePatients = (filters: PatientFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.patients(filters),
    queryFn: () => apiClient.getPatients(filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    keepPreviousData: true, // For smooth pagination
  });
};

export const usePatient = (id: string) => {
  return useQuery({
    queryKey: queryKeys.patient(id),
    queryFn: () => apiClient.getPatient(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreatePatient = () => {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();
  
  return useMutation({
    mutationFn: (patient: Omit<Patient, 'id' | 'createdAt' | 'updatedAt' | 'totalSessions' | 'crisisCount'>) =>
      apiClient.createPatient(patient),
    onMutate: async (newPatient) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['patients'] });

      // Snapshot the previous value
      const previousPatients = queryClient.getQueriesData({ queryKey: ['patients'] });

      // Optimistically update to the new value
      queryClient.setQueriesData({ queryKey: ['patients'] }, (old: any) => {
        if (!old) return old;
        
        const optimisticPatient: Patient = {
          ...newPatient,
          id: 'temp-' + Date.now(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          totalSessions: 0,
          crisisCount: 0,
        };

        return {
          ...old,
          items: [optimisticPatient, ...old.items],
          total: old.total + 1,
        };
      });

      // Return a context object with the snapshotted value
      return { previousPatients };
    },
    onError: (error, newPatient, context) => {
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousPatients) {
        context.previousPatients.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      handleError(error, 'Error al crear el paciente');
    },
    onSuccess: (newPatient) => {
      handleSuccess(`Paciente ${newPatient.nombre} creado correctamente`);
    },
    onSettled: () => {
      // Always refetch after error or success
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

export const useUpdatePatient = () => {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();
  
  return useMutation({
    mutationFn: ({ id, patient }: { id: string; patient: Partial<Patient> }) =>
      apiClient.updatePatient(id, patient),
    onMutate: async ({ id, patient }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.patient(id) });
      await queryClient.cancelQueries({ queryKey: ['patients'] });

      // Snapshot the previous values
      const previousPatient = queryClient.getQueryData(queryKeys.patient(id));
      const previousPatients = queryClient.getQueriesData({ queryKey: ['patients'] });

      // Optimistically update the individual patient
      queryClient.setQueryData(queryKeys.patient(id), (old: Patient | undefined) => {
        if (!old) return old;
        return { ...old, ...patient, updatedAt: new Date().toISOString() };
      });

      // Optimistically update patients in lists
      queryClient.setQueriesData({ queryKey: ['patients'] }, (old: any) => {
        if (!old?.items) return old;
        
        return {
          ...old,
          items: old.items.map((p: Patient) => 
            p.id === id ? { ...p, ...patient, updatedAt: new Date().toISOString() } : p
          ),
        };
      });

      return { previousPatient, previousPatients };
    },
    onError: (error, { id }, context) => {
      // Rollback on error
      if (context?.previousPatient) {
        queryClient.setQueryData(queryKeys.patient(id), context.previousPatient);
      }
      if (context?.previousPatients) {
        context.previousPatients.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      handleError(error, 'Error al actualizar el paciente');
    },
    onSuccess: (updatedPatient) => {
      handleSuccess(`Paciente ${updatedPatient.nombre} actualizado correctamente`);
    },
    onSettled: (_, __, { id }) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.patient(id) });
      queryClient.invalidateQueries({ queryKey: ['patients'] });
    },
  });
};

export const useDeletePatient = () => {
  const queryClient = useQueryClient();
  const { handleError, handleSuccess } = useErrorHandler();
  
  return useMutation({
    mutationFn: (id: string) => apiClient.deletePatient(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: queryKeys.patient(deletedId) });
      // Invalidate patients list
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      handleSuccess('Paciente eliminado correctamente');
    },
    onError: (error) => {
      handleError(error, 'Error al eliminar el paciente');
    },
  });
};

// Session Hooks
export const useSessions = (filters: SessionFilters = {}) => {
  return useQuery({
    queryKey: queryKeys.sessions(filters),
    queryFn: () => apiClient.getSessions(filters),
    staleTime: 1 * 60 * 1000, // 1 minute
    keepPreviousData: true,
  });
};

export const useSession = (id: string) => {
  return useQuery({
    queryKey: queryKeys.session(id),
    queryFn: () => apiClient.getSession(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const usePatientSessions = (
  patientId: string, 
  filters: Omit<SessionFilters, 'patientId'> = {}
) => {
  return useQuery({
    queryKey: queryKeys.patientSessions(patientId, filters),
    queryFn: () => apiClient.getPatientSessions(patientId, filters),
    enabled: !!patientId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
};

export const useCrisisSessions = (filters: Omit<SessionFilters, 'type'> = {}) => {
  return useQuery({
    queryKey: queryKeys.crisisSessions(filters),
    queryFn: () => apiClient.getCrisisSessions(filters),
    staleTime: 30 * 1000, // 30 seconds - crisis data should be fresh
    refetchInterval: 60 * 1000, // Refresh every minute
  });
};

// Health Check Hook
export const useHealthCheck = () => {
  return useQuery({
    queryKey: ['health'],
    queryFn: () => apiClient.healthCheck(),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Check every minute
    retry: 3,
  });
};