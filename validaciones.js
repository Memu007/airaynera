/**
 * Validaciones específicas para AIRA Bot
 * Implementa validaciones según requerimientos de la auditoría
 */

// Lista blanca de obras sociales válidas
const OBRAS_SOCIALES_VALIDAS = ["OSDE", "SWISS", "PAMI", "IOMA", "GALENO"];

/**
 * Valida un DNI según el formato requerido (exactamente 8 dígitos)
 * @param {string} dni - DNI a validar
 * @return {Object} Resultado de validación
 */
function validarDNI(dni) {
  if (!dni) return { valido: false, error: 'DNI es requerido' };
  
  // Eliminar espacios y puntos si existen
  const dniLimpio = dni.toString().replace(/[\s\.]/g, '');
  
  // Validar formato (exactamente 8 dígitos)
  if (!/^[0-9]{8}$/.test(dniLimpio)) {
    return { 
      valido: false, 
      error: 'El DNI debe tener exactamente 8 dígitos numéricos'
    };
  }
  
  return { valido: true, valor: dniLimpio };
}

/**
 * Valida un número de teléfono según formato E.164
 * @param {string} telefono - Teléfono a validar
 * @return {Object} Resultado de validación
 */
function validarTelefono(telefono) {
  if (!telefono) return { valido: false, error: 'Teléfono es requerido' };
  
  // Eliminar espacios, guiones y paréntesis
  let telefonoLimpio = telefono.toString().replace(/[\s\-\(\)]/g, '');
  
  // Agregar prefijo +54 si no existe
  if (!telefonoLimpio.startsWith('+')) {
    // Si empieza con 0, quitarlo
    if (telefonoLimpio.startsWith('0')) {
      telefonoLimpio = telefonoLimpio.substring(1);
    }
    
    // Si empieza con 15, reorganizar para formato argentino
    if (telefonoLimpio.startsWith('15')) {
      telefonoLimpio = telefonoLimpio.substring(2);
      // Agregar 11 por defecto si el número es corto
      if (telefonoLimpio.length < 8) {
        telefonoLimpio = `11${telefonoLimpio}`;
      }
    }
    
    telefonoLimpio = `+54${telefonoLimpio}`;
  }
  
  // Validar formato E.164: + seguido de 10-15 dígitos
  if (!/^\+[0-9]{10,15}$/.test(telefonoLimpio)) {
    return { 
      valido: false, 
      error: 'El teléfono debe tener formato E.164 (ejemplo: +5491156781234)' 
    };
  }
  
  return { valido: true, valor: telefonoLimpio };
}

/**
 * Valida una obra social según la lista blanca
 * @param {string} obraSocial - Obra social a validar
 * @return {Object} Resultado de validación
 */
function validarObraSocial(obraSocial) {
  if (!obraSocial) return { valido: true, valor: '' }; // Es opcional
  
  // Convertir a mayúsculas y quitar espacios extras
  const normalizada = obraSocial.toString().trim().toUpperCase();
  
  // Verificar si está en la lista blanca
  if (!OBRAS_SOCIALES_VALIDAS.includes(normalizada)) {
    return {
      valido: false,
      error: `Obra social no reconocida. Opciones válidas: ${OBRAS_SOCIALES_VALIDAS.join(', ')}`
    };
  }
  
  return { valido: true, valor: normalizada };
}

/**
 * Valida un número de escala de estado anímico (1-5)
 * @param {number} valor - Valor a validar
 * @return {Object} Resultado de validación
 */
function validarEscalaMood(valor) {
  const num = parseInt(valor);
  
  if (isNaN(num) || num < 1 || num > 5) {
    return {
      valido: false,
      error: 'El estado anímico debe ser un número del 1 al 5'
    };
  }
  
  return { valido: true, valor: num };
}

module.exports = {
  OBRAS_SOCIALES_VALIDAS,
  validarDNI,
  validarTelefono,
  validarObraSocial,
  validarEscalaMood
};
