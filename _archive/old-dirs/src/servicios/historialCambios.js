/**
 * Servicio de historial de cambios para AIRA
 * Registra todos los cambios en datos de pacientes y sesiones
 */
const { firestore } = require('../config/db');
const baseDatos = require('./baseDatos');

class ServicioHistorialCambios {
  constructor() {
    this.db = firestore;
  }

  /**
   * Registra un cambio en el historial
   * @param {String} profesionalId - ID del profesional
   * @param {String} entidadId - ID de la entidad modificada (paciente, sesión)
   * @param {String} tipoEntidad - Tipo de entidad ('paciente', 'sesion', etc)
   * @param {Object} cambios - Objeto con los cambios realizados
   * @param {String} origen - Origen del cambio ('web', 'whatsapp')
   * @returns {Promise<String>} - ID del registro de cambio
   */
  async registrarCambio(profesionalId, entidadId, tipoEntidad, cambios, origen = 'web') {
    try {
      // Crear documento de cambio
      const nuevoDoc = this.db.collection('historialCambios').doc();
      
      await nuevoDoc.set({
        profesionalId,
        entidadId,
        tipoEntidad,
        cambios,
        origen,
        timestamp: new Date(),
        usuario: cambios.usuario || profesionalId
      });
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'registro_cambio',
        profesionalId,
        { entidadId, tipoEntidad, origen }
      );
      
      return nuevoDoc.id;
    } catch (error) {
      console.error('Error al registrar cambio en historial:', error);
      throw error;
    }
  }

  /**
   * Obtiene el historial de cambios de una entidad
   * @param {String} profesionalId - ID del profesional
   * @param {String} entidadId - ID de la entidad
   * @param {String} tipoEntidad - Tipo de entidad ('paciente', 'sesion', etc)
   * @returns {Promise<Array>} - Historial de cambios
   */
  async obtenerHistorial(profesionalId, entidadId, tipoEntidad) {
    try {
      const snapshot = await this.db.collection('historialCambios')
        .where('profesionalId', '==', profesionalId)
        .where('entidadId', '==', entidadId)
        .where('tipoEntidad', '==', tipoEntidad)
        .orderBy('timestamp', 'desc')
        .get();
      
      return snapshot.docs.map(doc => {
        const datos = doc.data();
        datos.id = doc.id;
        return datos;
      });
    } catch (error) {
      console.error('Error al obtener historial de cambios:', error);
      throw error;
    }
  }

  /**
   * Detecta cambios entre dos objetos
   * @param {Object} original - Objeto original
   * @param {Object} nuevo - Objeto nuevo
   * @returns {Object} - Objeto con los cambios detectados
   */
  detectarCambios(original, nuevo) {
    const cambios = {};
    
    // Recorrer propiedades del objeto nuevo
    Object.keys(nuevo).forEach(propiedad => {
      // Si la propiedad existe en el original y es diferente
      if (
        original.hasOwnProperty(propiedad) && 
        JSON.stringify(original[propiedad]) !== JSON.stringify(nuevo[propiedad])
      ) {
        cambios[propiedad] = {
          anterior: original[propiedad],
          nuevo: nuevo[propiedad]
        };
      }
      // Si la propiedad no existe en el original
      else if (!original.hasOwnProperty(propiedad)) {
        cambios[propiedad] = {
          anterior: null,
          nuevo: nuevo[propiedad]
        };
      }
    });
    
    // Detectar propiedades eliminadas
    Object.keys(original).forEach(propiedad => {
      if (!nuevo.hasOwnProperty(propiedad)) {
        cambios[propiedad] = {
          anterior: original[propiedad],
          nuevo: null
        };
      }
    });
    
    return cambios;
  }

  /**
   * Obtiene una versión específica de una entidad
   * @param {String} profesionalId - ID del profesional
   * @param {String} entidadId - ID de la entidad
   * @param {String} tipoEntidad - Tipo de entidad ('paciente', 'sesion', etc)
   * @param {Date} fecha - Fecha de la versión a obtener
   * @returns {Promise<Object>} - Versión de la entidad en la fecha especificada
   */
  async obtenerVersionEntidad(profesionalId, entidadId, tipoEntidad, fecha) {
    try {
      // Obtener todos los cambios hasta la fecha
      const snapshot = await this.db.collection('historialCambios')
        .where('profesionalId', '==', profesionalId)
        .where('entidadId', '==', entidadId)
        .where('tipoEntidad', '==', tipoEntidad)
        .where('timestamp', '<=', fecha)
        .orderBy('timestamp', 'asc')
        .get();
      
      if (snapshot.empty) {
        throw new Error('No se encontraron versiones para la fecha especificada');
      }
      
      // Obtener entidad actual
      let entidadActual;
      if (tipoEntidad === 'paciente') {
        const doc = await this.db.collection('pacientes').doc(entidadId).get();
        entidadActual = doc.data();
      } else if (tipoEntidad === 'sesion') {
        const doc = await this.db.collection('sesiones').doc(entidadId).get();
        entidadActual = doc.data();
      } else {
        throw new Error('Tipo de entidad no soportado');
      }
      
      // Aplicar cambios en orden inverso hasta llegar a la fecha
      const cambios = snapshot.docs.map(doc => doc.data());
      let entidadEnFecha = { ...entidadActual };
      
      for (let i = cambios.length - 1; i >= 0; i--) {
        const cambio = cambios[i];
        
        // Revertir cada cambio
        Object.keys(cambio.cambios).forEach(propiedad => {
          if (cambio.cambios[propiedad].anterior !== null) {
            entidadEnFecha[propiedad] = cambio.cambios[propiedad].anterior;
          } else {
            delete entidadEnFecha[propiedad];
          }
        });
      }
      
      return entidadEnFecha;
    } catch (error) {
      console.error('Error al obtener versión de entidad:', error);
      throw error;
    }
  }
}

module.exports = new ServicioHistorialCambios();
