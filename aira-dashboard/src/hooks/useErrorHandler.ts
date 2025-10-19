import { useCallback } from 'react';
import { APIError } from '../services/apiClient';
import { useAppStore } from '../stores/appStore';

// User-friendly error messages mapping
const ERROR_MESSAGES: Record<string, string> = {
  // Network errors
  'NETWORK_ERROR': 'Error de conexión. Verifica tu conexión a internet.',
  'TIMEOUT': 'La solicitud tardó demasiado. Intenta nuevamente.',
  
  // Authentication errors
  'INVALID_CREDENTIALS': 'DNI o PIN incorrectos.',
  'TOKEN_EXPIRED': 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
  'UNAUTHORIZED': 'No tienes permisos para realizar esta acción.',
  
  // Validation errors
  'VALIDATION_ERROR': 'Los datos ingresados no son válidos.',
  'DUPLICATE_DNI': 'Ya existe un paciente con este DNI.',
  'INVALID_DNI': 'El DNI ingresado no es válido.',
  
  // Server errors
  'SERVER_ERROR': 'Error interno del servidor. Intenta nuevamente más tarde.',
  'SERVICE_UNAVAILABLE': 'El servicio no está disponible temporalmente.',
  
  // Default
  'UNKNOWN_ERROR': 'Ha ocurrido un error inesperado.',
};

export const useErrorHandler = () => {
  const addNotification = useAppStore((state) => state.addNotification);

  const handleError = useCallback(
    (error: unknown, customMessage?: string) => {
      console.error('Application error:', error);

      let errorMessage = customMessage || 'Ha ocurrido un error inesperado.';
      let errorTitle = 'Error';

      if (error instanceof APIError) {
        // Use custom message from API or map error code
        errorMessage = error.message || ERROR_MESSAGES[error.code || ''] || ERROR_MESSAGES.UNKNOWN_ERROR;
        
        // Set appropriate title based on error type
        if (error.status >= 400 && error.status < 500) {
          errorTitle = 'Error de validación';
        } else if (error.status >= 500) {
          errorTitle = 'Error del servidor';
        } else if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
          errorTitle = 'Error de conexión';
        }
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }

      // Show notification to user
      addNotification({
        id: Date.now().toString(),
        type: 'error',
        title: errorTitle,
        message: errorMessage,
        duration: 5000,
      });

      // Log error for monitoring (in production, this would go to a service like Sentry)
      if (error instanceof APIError) {
        console.error('API Error Details:', {
          message: error.message,
          status: error.status,
          code: error.code,
          details: error.details,
        });
      }
    },
    [addNotification]
  );

  const handleSuccess = useCallback(
    (message: string, title: string = 'Éxito') => {
      addNotification({
        id: Date.now().toString(),
        type: 'success',
        title,
        message,
        duration: 3000,
      });
    },
    [addNotification]
  );

  const handleWarning = useCallback(
    (message: string, title: string = 'Advertencia') => {
      addNotification({
        id: Date.now().toString(),
        type: 'warning',
        title,
        message,
        duration: 4000,
      });
    },
    [addNotification]
  );

  const handleInfo = useCallback(
    (message: string, title: string = 'Información') => {
      addNotification({
        id: Date.now().toString(),
        type: 'info',
        title,
        message,
        duration: 3000,
      });
    },
    [addNotification]
  );

  return {
    handleError,
    handleSuccess,
    handleWarning,
    handleInfo,
  };
};

// Utility function to get user-friendly error message
export const getUserFriendlyErrorMessage = (error: APIError): string => {
  return error.message || ERROR_MESSAGES[error.code || ''] || ERROR_MESSAGES.UNKNOWN_ERROR;
};