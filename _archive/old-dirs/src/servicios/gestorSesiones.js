/**
 * Gestor de sesiones para AIRA
 * Evita conflictos entre sesiones de web y WhatsApp
 */
const baseDatos = require('./baseDatos');

class GestorSesiones {
  constructor() {
    // Mapa de sesiones activas por origen
    this.sesionesActivas = {
      web: new Map(), // profesionalId -> Set de pacienteId
      whatsapp: new Map() // profesionalId -> Set de pacienteId
    };
  }

  /**
   * Inicia una sesión
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} origen - Origen de la sesión ('web' o 'whatsapp')
   * @returns {Boolean} - true si se pudo iniciar la sesión
   */
  iniciarSesion(profesionalId, pacienteId, origen) {
    try {
      // Verificar si hay una sesión activa en el otro origen
      const otroOrigen = origen === 'web' ? 'whatsapp' : 'web';
      
      if (this.tieneSesionActiva(profesionalId, pacienteId, otroOrigen)) {
        console.warn(`Advertencia: El paciente ${pacienteId} ya tiene una sesión activa en ${otroOrigen}`);
        // No bloqueamos, solo advertimos
      }
      
      // Iniciar sesión en este origen
      if (!this.sesionesActivas[origen].has(profesionalId)) {
        this.sesionesActivas[origen].set(profesionalId, new Set());
      }
      
      this.sesionesActivas[origen].get(profesionalId).add(pacienteId);
      
      // Registrar inicio de sesión
      baseDatos.registrarAuditoria(
        'inicio_sesion',
        profesionalId,
        { pacienteId, origen }
      );
      
      return true;
    } catch (error) {
      console.error('Error al iniciar sesión:', error);
      return false;
    }
  }

  /**
   * Finaliza una sesión
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} origen - Origen de la sesión ('web' o 'whatsapp')
   */
  finalizarSesion(profesionalId, pacienteId, origen) {
    try {
      if (this.sesionesActivas[origen].has(profesionalId)) {
        this.sesionesActivas[origen].get(profesionalId).delete(pacienteId);
        
        // Registrar fin de sesión
        baseDatos.registrarAuditoria(
          'fin_sesion',
          profesionalId,
          { pacienteId, origen }
        );
      }
    } catch (error) {
      console.error('Error al finalizar sesión:', error);
    }
  }

  /**
   * Verifica si hay una sesión activa
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} origen - Origen de la sesión ('web' o 'whatsapp')
   * @returns {Boolean} - true si hay una sesión activa
   */
  tieneSesionActiva(profesionalId, pacienteId, origen) {
    try {
      return (
        this.sesionesActivas[origen].has(profesionalId) &&
        this.sesionesActivas[origen].get(profesionalId).has(pacienteId)
      );
    } catch (error) {
      console.error('Error al verificar sesión activa:', error);
      return false;
    }
  }

  /**
   * Obtiene todas las sesiones activas de un profesional
   * @param {String} profesionalId - ID del profesional
   * @param {String} origen - Origen de la sesión ('web' o 'whatsapp')
   * @returns {Array} - Lista de IDs de pacientes con sesiones activas
   */
  obtenerSesionesActivas(profesionalId, origen) {
    try {
      if (!this.sesionesActivas[origen].has(profesionalId)) {
        return [];
      }
      
      return Array.from(this.sesionesActivas[origen].get(profesionalId));
    } catch (error) {
      console.error('Error al obtener sesiones activas:', error);
      return [];
    }
  }

  /**
   * Limpia las sesiones inactivas
   * Se puede llamar periódicamente para liberar memoria
   */
  limpiarSesionesInactivas() {
    try {
      ['web', 'whatsapp'].forEach(origen => {
        this.sesionesActivas[origen].forEach((pacientes, profesionalId) => {
          if (pacientes.size === 0) {
            this.sesionesActivas[origen].delete(profesionalId);
          }
        });
      });
    } catch (error) {
      console.error('Error al limpiar sesiones inactivas:', error);
    }
  }
}

module.exports = new GestorSesiones();
