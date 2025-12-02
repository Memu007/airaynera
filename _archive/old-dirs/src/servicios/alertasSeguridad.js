/**
 * Servicio de alertas de seguridad para AIRA
 * Monitorea y notifica eventos importantes relacionados con la seguridad
 */
const baseDatos = require('./baseDatos');
const { firestore } = require('../config/db');

class ServicioAlertasSeguridad {
  constructor() {
    this.db = firestore;
    this.nivelesAlerta = {
      BAJO: 'bajo',
      MEDIO: 'medio',
      ALTO: 'alto',
      CRITICO: 'critico'
    };
    
    // Configuración por defecto
    this.configuracionPorDefecto = {
      intentosLoginFallidos: 3,
      umbralAccesoInusual: 5,
      umbralExportacionMasiva: 10,
      notificarEmail: true,
      notificarWeb: true
    };
  }

  /**
   * Configura las alertas de seguridad para un profesional
   * @param {String} profesionalId - ID del profesional
   * @param {Object} configuracion - Configuración de alertas
   * @returns {Promise<Object>} - Configuración actualizada
   */
  async configurarAlertas(profesionalId, configuracion = {}) {
    try {
      // Combinar con configuración por defecto
      const configActualizada = {
        ...this.configuracionPorDefecto,
        ...configuracion
      };
      
      // Guardar configuración
      await this.db.collection('configuracion').doc(profesionalId).set({
        alertasSeguridad: configActualizada
      }, { merge: true });
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'configuracion_alertas',
        profesionalId,
        { configuracion: configActualizada }
      );
      
      return configActualizada;
    } catch (error) {
      console.error('Error al configurar alertas de seguridad:', error);
      throw error;
    }
  }

  /**
   * Obtiene la configuración de alertas de un profesional
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<Object>} - Configuración de alertas
   */
  async obtenerConfiguracion(profesionalId) {
    try {
      const doc = await this.db.collection('configuracion').doc(profesionalId).get();
      
      if (!doc.exists || !doc.data().alertasSeguridad) {
        // Si no existe, crear con valores por defecto
        await this.configurarAlertas(profesionalId);
        return this.configuracionPorDefecto;
      }
      
      return doc.data().alertasSeguridad;
    } catch (error) {
      console.error('Error al obtener configuración de alertas:', error);
      return this.configuracionPorDefecto;
    }
  }

  /**
   * Registra una alerta de seguridad
   * @param {String} profesionalId - ID del profesional
   * @param {String} tipo - Tipo de alerta
   * @param {String} nivel - Nivel de alerta (bajo, medio, alto, critico)
   * @param {Object} detalles - Detalles de la alerta
   * @returns {Promise<String>} - ID de la alerta
   */
  async registrarAlerta(profesionalId, tipo, nivel, detalles = {}) {
    try {
      // Validar nivel
      if (!Object.values(this.nivelesAlerta).includes(nivel)) {
        nivel = this.nivelesAlerta.MEDIO;
      }
      
      // Crear documento de alerta
      const nuevoDoc = this.db.collection('alertasSeguridad').doc();
      
      await nuevoDoc.set({
        profesionalId,
        tipo,
        nivel,
        detalles,
        timestamp: new Date(),
        leida: false,
        resuelta: false
      });
      
      // Obtener configuración de alertas
      const config = await this.obtenerConfiguracion(profesionalId);
      
      // Enviar notificaciones según configuración
      if (config.notificarWeb) {
        await this.notificarAlertaWeb(profesionalId, tipo, nivel, detalles);
      }
      
      if (config.notificarEmail && nivel === this.nivelesAlerta.ALTO || nivel === this.nivelesAlerta.CRITICO) {
        await this.notificarAlertaEmail(profesionalId, tipo, nivel, detalles);
      }
      
      return nuevoDoc.id;
    } catch (error) {
      console.error('Error al registrar alerta de seguridad:', error);
      throw error;
    }
  }

  /**
   * Notifica una alerta en la interfaz web
   * @param {String} profesionalId - ID del profesional
   * @param {String} tipo - Tipo de alerta
   * @param {String} nivel - Nivel de alerta
   * @param {Object} detalles - Detalles de la alerta
   * @returns {Promise<void>}
   */
  async notificarAlertaWeb(profesionalId, tipo, nivel, detalles) {
    try {
      // En un sistema real, esto podría usar WebSockets o Server-Sent Events
      await baseDatos.registrarNotificacion({
        profesionalId,
        titulo: `Alerta de seguridad: ${tipo}`,
        mensaje: this.generarMensajeAlerta(tipo, nivel, detalles),
        nivel,
        canal: 'web',
        leida: false,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error al notificar alerta web:', error);
    }
  }

  /**
   * Notifica una alerta por email
   * @param {String} profesionalId - ID del profesional
   * @param {String} tipo - Tipo de alerta
   * @param {String} nivel - Nivel de alerta
   * @param {Object} detalles - Detalles de la alerta
   * @returns {Promise<void>}
   */
  async notificarAlertaEmail(profesionalId, tipo, nivel, detalles) {
    try {
      // En un sistema real, aquí se enviaría un email
      console.log(`[EMAIL] Alerta de seguridad para ${profesionalId}: ${tipo} (${nivel})`);
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'notificacion_email',
        profesionalId,
        { tipo, nivel }
      );
    } catch (error) {
      console.error('Error al notificar alerta email:', error);
    }
  }

  /**
   * Genera un mensaje descriptivo para una alerta
   * @param {String} tipo - Tipo de alerta
   * @param {String} nivel - Nivel de alerta
   * @param {Object} detalles - Detalles de la alerta
   * @returns {String} - Mensaje descriptivo
   */
  generarMensajeAlerta(tipo, nivel, detalles) {
    switch (tipo) {
      case 'login_fallido':
        return `Múltiples intentos de inicio de sesión fallidos (${detalles.intentos || '?'} intentos). Verifique la seguridad de su cuenta.`;
      
      case 'acceso_inusual':
        return `Acceso detectado desde ubicación inusual: ${detalles.ubicacion || 'Desconocida'}. IP: ${detalles.ip || 'Desconocida'}.`;
      
      case 'exportacion_masiva':
        return `Exportación masiva de datos detectada: ${detalles.cantidadPacientes || '?'} pacientes. Verifique si fue autorizada.`;
      
      case 'modificacion_sensible':
        return `Modificación de datos sensibles detectada para el paciente ${detalles.pacienteNombre || detalles.pacienteId || 'Desconocido'}.`;
      
      default:
        return `Alerta de seguridad: ${tipo}. Nivel: ${nivel}.`;
    }
  }

  /**
   * Monitorea intentos de login fallidos
   * @param {String} profesionalId - ID del profesional
   * @returns {Promise<void>}
   */
  async monitorearLoginsFallidos(profesionalId) {
    try {
      // Obtener configuración
      const config = await this.obtenerConfiguracion(profesionalId);
      
      // Buscar intentos fallidos recientes (últimas 24 horas)
      const fechaLimite = new Date();
      fechaLimite.setHours(fechaLimite.getHours() - 24);
      
      const snapshot = await this.db.collection('auditoria')
        .where('profesionalId', '==', profesionalId)
        .where('tipo', '==', 'login_fallido')
        .where('timestamp', '>=', fechaLimite)
        .get();
      
      const intentosFallidos = snapshot.docs.length;
      
      // Verificar si supera el umbral
      if (intentosFallidos >= config.intentosLoginFallidos) {
        await this.registrarAlerta(
          profesionalId,
          'login_fallido',
          this.nivelesAlerta.ALTO,
          { intentos: intentosFallidos }
        );
      }
    } catch (error) {
      console.error('Error al monitorear logins fallidos:', error);
    }
  }

  /**
   * Monitorea exportaciones masivas de datos
   * @param {String} profesionalId - ID del profesional
   * @param {Number} cantidadPacientes - Cantidad de pacientes exportados
   * @returns {Promise<void>}
   */
  async monitorearExportacionMasiva(profesionalId, cantidadPacientes) {
    try {
      // Obtener configuración
      const config = await this.obtenerConfiguracion(profesionalId);
      
      // Verificar si supera el umbral
      if (cantidadPacientes >= config.umbralExportacionMasiva) {
        await this.registrarAlerta(
          profesionalId,
          'exportacion_masiva',
          this.nivelesAlerta.MEDIO,
          { cantidadPacientes }
        );
      }
    } catch (error) {
      console.error('Error al monitorear exportación masiva:', error);
    }
  }

  /**
   * Monitorea modificaciones de datos sensibles
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {Object} cambios - Cambios realizados
   * @returns {Promise<void>}
   */
  async monitorearModificacionSensible(profesionalId, pacienteId, cambios) {
    try {
      // Verificar si hay cambios en datos sensibles
      const camposSensibles = ['telefono', 'email', 'obraSocial', 'notas'];
      const tieneCambiosSensibles = Object.keys(cambios).some(campo => 
        camposSensibles.includes(campo)
      );
      
      if (tieneCambiosSensibles) {
        // Obtener nombre del paciente
        const paciente = await baseDatos.obtenerPacientePorId(profesionalId, pacienteId);
        
        await this.registrarAlerta(
          profesionalId,
          'modificacion_sensible',
          this.nivelesAlerta.BAJO,
          { 
            pacienteId,
            pacienteNombre: paciente ? `${paciente.nombre} ${paciente.apellido}` : 'Desconocido',
            camposModificados: Object.keys(cambios).filter(campo => camposSensibles.includes(campo))
          }
        );
      }
    } catch (error) {
      console.error('Error al monitorear modificación sensible:', error);
    }
  }

  /**
   * Obtiene las alertas de un profesional
   * @param {String} profesionalId - ID del profesional
   * @param {Object} opciones - Opciones de filtrado
   * @returns {Promise<Array>} - Alertas del profesional
   */
  async obtenerAlertas(profesionalId, opciones = {}) {
    try {
      let query = this.db.collection('alertasSeguridad')
        .where('profesionalId', '==', profesionalId);
      
      // Filtrar por nivel
      if (opciones.nivel) {
        query = query.where('nivel', '==', opciones.nivel);
      }
      
      // Filtrar por estado de lectura
      if (opciones.leida !== undefined) {
        query = query.where('leida', '==', opciones.leida);
      }
      
      // Filtrar por estado de resolución
      if (opciones.resuelta !== undefined) {
        query = query.where('resuelta', '==', opciones.resuelta);
      }
      
      // Ordenar por timestamp
      query = query.orderBy('timestamp', opciones.ordenDireccion || 'desc');
      
      // Limitar resultados
      if (opciones.limite) {
        query = query.limit(opciones.limite);
      }
      
      const snapshot = await query.get();
      
      return snapshot.docs.map(doc => {
        const datos = doc.data();
        datos.id = doc.id;
        return datos;
      });
    } catch (error) {
      console.error('Error al obtener alertas:', error);
      return [];
    }
  }

  /**
   * Marca una alerta como leída
   * @param {String} profesionalId - ID del profesional
   * @param {String} alertaId - ID de la alerta
   * @returns {Promise<Boolean>} - true si se marcó correctamente
   */
  async marcarComoLeida(profesionalId, alertaId) {
    try {
      const docRef = this.db.collection('alertasSeguridad').doc(alertaId);
      const doc = await docRef.get();
      
      if (!doc.exists || doc.data().profesionalId !== profesionalId) {
        return false;
      }
      
      await docRef.update({
        leida: true,
        fechaLectura: new Date()
      });
      
      return true;
    } catch (error) {
      console.error('Error al marcar alerta como leída:', error);
      return false;
    }
  }

  /**
   * Marca una alerta como resuelta
   * @param {String} profesionalId - ID del profesional
   * @param {String} alertaId - ID de la alerta
   * @param {String} comentario - Comentario sobre la resolución
   * @returns {Promise<Boolean>} - true si se marcó correctamente
   */
  async marcarComoResuelta(profesionalId, alertaId, comentario = '') {
    try {
      const docRef = this.db.collection('alertasSeguridad').doc(alertaId);
      const doc = await docRef.get();
      
      if (!doc.exists || doc.data().profesionalId !== profesionalId) {
        return false;
      }
      
      await docRef.update({
        resuelta: true,
        fechaResolucion: new Date(),
        comentarioResolucion: comentario
      });
      
      // Registrar en auditoría
      await baseDatos.registrarAuditoria(
        'resolucion_alerta',
        profesionalId,
        { 
          alertaId,
          tipo: doc.data().tipo,
          nivel: doc.data().nivel,
          comentario
        }
      );
      
      return true;
    } catch (error) {
      console.error('Error al marcar alerta como resuelta:', error);
      return false;
    }
  }
}

module.exports = new ServicioAlertasSeguridad();
