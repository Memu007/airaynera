/**
 * Validaciones comunes para la aplicación AIRA
 */

const validateEmail = (email) => {
  if (!email || typeof email !== 'string') {
    return false;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
};

const validatePassword = (password) => {
  if (!password || typeof password !== 'string') {
    return false;
  }
  // Mínimo 8 caracteres
  return password.length >= 8;
};

const validatePhone = (phone) => {
  if (!phone || typeof phone !== 'string') {
    return false;
  }
  // Permitir números, espacios, guiones, paréntesis y signo +
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone.trim());
};

const validateDNI = (dni) => {
  if (!dni || typeof dni !== 'string') {
    return false;
  }
  // DNI argentino: 7-8 dígitos
  const cleaned = dni.replace(/\D/g, '');
  return cleaned.length >= 7 && cleaned.length <= 8;
};

const validateRequired = (value) => {
  if (value === null || value === undefined) {
    return false;
  }
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  return true;
};

const sanitizeInput = (input) => {
  if (typeof input !== 'string') {
    return input;
  }
  
  return input
    // Remover scripts maliciosos
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remover otros tags HTML peligrosos
    .replace(/<[^>]*>/g, '')
    // Limpiar espacios
    .trim();
};

const validateDate = (dateString) => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

const validateAge = (birthDate) => {
  if (!validateDate(birthDate)) return false;
  
  const today = new Date();
  const birth = new Date(birthDate);
  const age = today.getFullYear() - birth.getFullYear();
  
  // Validar edad razonable (0-120 años)
  return age >= 0 && age <= 120;
};

const validateSessionDuration = (duration) => {
  if (typeof duration !== 'number') return false;
  // Duración entre 15 minutos y 4 horas
  return duration >= 15 && duration <= 240;
};

const validateName = (name) => {
  if (!name || typeof name !== 'string') return false;
  
  const cleaned = name.trim();
  // Al menos 2 caracteres, solo letras, espacios y algunos caracteres especiales
  const nameRegex = /^[a-zA-ZáéíóúñÁÉÍÓÚÑ\s\-']{2,50}$/;
  return nameRegex.test(cleaned);
};

const validateRole = (role) => {
  const validRoles = ['admin', 'professional', 'user'];
  return validRoles.includes(role);
};

// Validación de datos de paciente
const validatePatientData = (patientData) => {
  const errors = [];
  
  if (!validateRequired(patientData.name)) {
    errors.push('El nombre es requerido');
  } else if (!validateName(patientData.name)) {
    errors.push('El nombre debe tener entre 2 y 50 caracteres y solo contener letras');
  }
  
  if (!validateRequired(patientData.dni)) {
    errors.push('El DNI es requerido');
  } else if (!validateDNI(patientData.dni)) {
    errors.push('El DNI debe tener entre 7 y 8 dígitos');
  }
  
  if (patientData.email && !validateEmail(patientData.email)) {
    errors.push('El email no tiene un formato válido');
  }
  
  if (patientData.phone && !validatePhone(patientData.phone)) {
    errors.push('El teléfono no tiene un formato válido');
  }
  
  if (patientData.birthDate && !validateAge(patientData.birthDate)) {
    errors.push('La fecha de nacimiento no es válida');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// Validación de datos de sesión
const validateSessionData = (sessionData) => {
  const errors = [];
  
  if (!validateRequired(sessionData.patientId)) {
    errors.push('El ID del paciente es requerido');
  }
  
  if (!validateRequired(sessionData.professionalId)) {
    errors.push('El ID del profesional es requerido');
  }
  
  if (!validateRequired(sessionData.date)) {
    errors.push('La fecha es requerida');
  } else if (!validateDate(sessionData.date)) {
    errors.push('La fecha no tiene un formato válido');
  }
  
  if (sessionData.duration && !validateSessionDuration(sessionData.duration)) {
    errors.push('La duración debe estar entre 15 y 240 minutos');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

// Validación de datos de usuario
const validateUserData = (userData) => {
  const errors = [];
  
  if (!validateRequired(userData.name)) {
    errors.push('El nombre es requerido');
  } else if (!validateName(userData.name)) {
    errors.push('El nombre no tiene un formato válido');
  }
  
  if (!validateRequired(userData.email)) {
    errors.push('El email es requerido');
  } else if (!validateEmail(userData.email)) {
    errors.push('El email no tiene un formato válido');
  }
  
  if (!validateRequired(userData.password)) {
    errors.push('La contraseña es requerida');
  } else if (!validatePassword(userData.password)) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  
  if (userData.role && !validateRole(userData.role)) {
    errors.push('El rol no es válido');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
};

module.exports = {
  validateEmail,
  validatePassword,
  validatePhone,
  validateDNI,
  validateRequired,
  sanitizeInput,
  validateDate,
  validateAge,
  validateSessionDuration,
  validateName,
  validateRole,
  validatePatientData,
  validateSessionData,
  validateUserData
}; 