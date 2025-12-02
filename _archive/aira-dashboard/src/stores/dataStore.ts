import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PatientFilters, SessionFilters } from '../types/api';

interface DataState {
  // Patient filters and pagination
  patientFilters: PatientFilters;
  patientPage: number;
  setPatientFilters: (filters: PatientFilters) => void;
  setPatientPage: (page: number) => void;
  resetPatientFilters: () => void;

  // Session filters and pagination
  sessionFilters: SessionFilters;
  sessionPage: number;
  setSessionFilters: (filters: SessionFilters) => void;
  setSessionPage: (page: number) => void;
  resetSessionFilters: () => void;

  // UI state
  selectedPatientId: string | null;
  selectedSessionId: string | null;
  setSelectedPatient: (id: string | null) => void;
  setSelectedSession: (id: string | null) => void;

  // Dashboard refresh state
  lastRefresh: number;
  setLastRefresh: () => void;
}

const defaultPatientFilters: PatientFilters = {
  search: '',
  status: 'all',
  page: 1,
  limit: 20,
};

const defaultSessionFilters: SessionFilters = {
  search: '',
  type: 'all',
  page: 1,
  limit: 20,
};

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      // Patient state
      patientFilters: defaultPatientFilters,
      patientPage: 1,
      setPatientFilters: (filters: PatientFilters) => {
        set({ 
          patientFilters: { ...get().patientFilters, ...filters },
          patientPage: filters.page || 1,
        });
      },
      setPatientPage: (page: number) => {
        set({ 
          patientPage: page,
          patientFilters: { ...get().patientFilters, page },
        });
      },
      resetPatientFilters: () => {
        set({ 
          patientFilters: defaultPatientFilters,
          patientPage: 1,
        });
      },

      // Session state
      sessionFilters: defaultSessionFilters,
      sessionPage: 1,
      setSessionFilters: (filters: SessionFilters) => {
        set({ 
          sessionFilters: { ...get().sessionFilters, ...filters },
          sessionPage: filters.page || 1,
        });
      },
      setSessionPage: (page: number) => {
        set({ 
          sessionPage: page,
          sessionFilters: { ...get().sessionFilters, page },
        });
      },
      resetSessionFilters: () => {
        set({ 
          sessionFilters: defaultSessionFilters,
          sessionPage: 1,
        });
      },

      // UI state
      selectedPatientId: null,
      selectedSessionId: null,
      setSelectedPatient: (id: string | null) => {
        set({ selectedPatientId: id });
      },
      setSelectedSession: (id: string | null) => {
        set({ selectedSessionId: id });
      },

      // Dashboard state
      lastRefresh: Date.now(),
      setLastRefresh: () => {
        set({ lastRefresh: Date.now() });
      },
    }),
    {
      name: 'aira-data-state',
      partialize: (state) => ({
        patientFilters: state.patientFilters,
        sessionFilters: state.sessionFilters,
        selectedPatientId: state.selectedPatientId,
        // Don't persist selectedSessionId and lastRefresh
      }),
    }
  )
);