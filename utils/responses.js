// Utilidad para respuestas consistentes
const ERROR_CODES = {
  // Client errors 4xx
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  UNPROCESSABLE_ENTITY: 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  
  // Server errors 5xx
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  
  // Business logic errors
  INVALID_JSON: 'INVALID_JSON',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MAINTENANCE_MODE: 'MAINTENANCE_MODE',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS'
};

// Mensajes user-friendly por código
const ERROR_MESSAGES = {
  [ERROR_CODES.BAD_REQUEST]: 'Solicitud inválida',
  [ERROR_CODES.UNAUTHORIZED]: 'No autorizado',
  [ERROR_CODES.FORBIDDEN]: 'Acceso denegado',
  [ERROR_CODES.NOT_FOUND]: 'Recurso no encontrado',
  [ERROR_CODES.CONFLICT]: 'Conflicto con el estado actual',
  [ERROR_CODES.UNPROCESSABLE_ENTITY]: 'Datos de entrada inválidos',
  [ERROR_CODES.TOO_MANY_REQUESTS]: 'Demasiadas solicitudes, intente más tarde',
  [ERROR_CODES.INTERNAL_ERROR]: 'Error interno del servidor',
  [ERROR_CODES.NOT_IMPLEMENTED]: 'Funcionalidad no implementada',
  [ERROR_CODES.SERVICE_UNAVAILABLE]: 'Servicio temporalmente no disponible',
  [ERROR_CODES.INVALID_JSON]: 'JSON malformado en la solicitud',
  [ERROR_CODES.VALIDATION_ERROR]: 'Error de validación',
  [ERROR_CODES.MAINTENANCE_MODE]: 'Sistema en mantenimiento',
  [ERROR_CODES.SESSION_EXPIRED]: 'Sesión expirada',
  [ERROR_CODES.INSUFFICIENT_PERMISSIONS]: 'Permisos insuficientes'
};

/**
 * Envía una respuesta de error consistente
 * @param {Response} res - Express response object
 * @param {number} status - HTTP status code
 * @param {string} code - Error code from ERROR_CODES
 * @param {string} [details] - Optional detailed message for debugging
 * @param {Array} [errors] - Optional validation errors array
 */
function sendError(res, status, code, details = null, errors = null) {
  const response = {
    error: ERROR_MESSAGES[code] || code,
    code
  };
  
  if (details && process.env.NODE_ENV !== 'production') {
    response.details = details;
  }
  
  if (errors && errors.length > 0) {
    response.errors = errors;
  }
  
  return res.status(status).json(response);
}

/**
 * Envía una respuesta exitosa consistente
 * @param {Response} res - Express response object
 * @param {*} data - Response data
 * @param {number} [status=200] - HTTP status code
 * @param {Object} [meta] - Optional metadata
 */
function sendSuccess(res, data, status = 200, meta = null) {
  const response = {
    success: true,
    data
  };
  
  if (meta) {
    response.meta = meta;
  }
  
  return res.status(status).json(response);
}

/**
 * Envía una respuesta de creación exitosa
 * @param {Response} res - Express response object
 * @param {*} data - Created resource data
 * @param {string} [location] - Optional Location header
 */
function sendCreated(res, data, location = null) {
  if (location) {
    res.location(location);
  }
  return sendSuccess(res, data, 201);
}

/**
 * Envía una respuesta de eliminación exitosa
 * @param {Response} res - Express response object
 */
function sendDeleted(res) {
  return res.status(204).send();
}

module.exports = {
  ERROR_CODES,
  ERROR_MESSAGES,
  sendError,
  sendSuccess,
  sendCreated,
  sendDeleted
};
