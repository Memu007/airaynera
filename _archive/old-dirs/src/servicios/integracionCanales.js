/**
 * Servicio de integración entre canales para AIRA
 * Permite una transición fluida entre web y WhatsApp
 */
const baseDatos = require('./baseDatos');
const gestorSesiones = require('./gestorSesiones');

class ServicioIntegracionCanales {
  constructor() {
    this.canales = ['web', 'whatsapp'];
  }

  /**
   * Sincroniza sesiones entre web y WhatsApp
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @returns {Promise<Object>} - Estado de la sincronización
   */
  async sincronizarSesiones(profesionalId, pacienteId) {
    try {
      // Verificar sesiones activas en ambos canales
      const sesionWeb = gestorSesiones.tieneSesionActiva(profesionalId, pacienteId, 'web');
      const sesionWhatsapp = gestorSesiones.tieneSesionActiva(profesionalId, pacienteId, 'whatsapp');
      
      // Estado de sincronización
      const estado = {
        sesionWeb,
        sesionWhatsapp,
        sesionCruzada: sesionWeb && sesionWhatsapp,
        sincronizado: false
      };
      
      // Si hay sesión cruzada, notificar a ambos canales
      if (estado.sesionCruzada) {
        await this.notificarSesionCruzada(profesionalId, pacienteId);
        
        // Registrar evento
        await baseDatos.registrarAuditoria(
          'sesion_cruzada_detectada',
          profesionalId,
          { pacienteId, canales: this.canales }
        );
        
        estado.sincronizado = true;
      }
      
      return estado;
    } catch (error) {
      console.error('Error al sincronizar sesiones:', error);
      throw error;
    }
  }

  /**
   * Notifica a ambos canales sobre una sesión cruzada
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @returns {Promise<void>}
   */
  async notificarSesionCruzada(profesionalId, pacienteId) {
    try {
      // Obtener datos del paciente
      const paciente = await baseDatos.obtenerPacientePorId(profesionalId, pacienteId);
      
      if (!paciente) {
        throw new Error('Paciente no encontrado');
      }
      
      // Mensaje para web
      await this.enviarNotificacionWeb(
        profesionalId,
        `Sesión activa en WhatsApp con ${paciente.nombre}`,
        'Puede continuar la conversación aquí o en WhatsApp'
      );
      
      // Mensaje para WhatsApp
      await this.enviarNotificacionWhatsApp(
        profesionalId,
        pacienteId,
        `Sesión activa en la web con ${paciente.nombre}. Puede continuar la conversación aquí o en la web.`
      );
    } catch (error) {
      console.error('Error al notificar sesión cruzada:', error);
    }
  }

  /**
   * Envía una notificación a la interfaz web
   * @param {String} profesionalId - ID del profesional
   * @param {String} titulo - Título de la notificación
   * @param {String} mensaje - Mensaje de la notificación
   * @returns {Promise<void>}
   */
  async enviarNotificacionWeb(profesionalId, titulo, mensaje) {
    try {
      // En un sistema real, esto podría usar WebSockets o Server-Sent Events
      await baseDatos.registrarNotificacion({
        profesionalId,
        titulo,
        mensaje,
        canal: 'web',
        leida: false,
        timestamp: new Date()
      });
    } catch (error) {
      console.error('Error al enviar notificación web:', error);
    }
  }

  /**
   * Envía una notificación a WhatsApp
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} mensaje - Mensaje a enviar
   * @returns {Promise<void>}
   */
  async enviarNotificacionWhatsApp(profesionalId, pacienteId, mensaje) {
    try {
      // En un sistema real, esto enviaría un mensaje a través de la API de WhatsApp
      await baseDatos.registrarMensajeWhatsApp(
        profesionalId,
        pacienteId,
        {
          telefono: 'sistema',
          mensaje,
          tipo: 'texto',
          direccion: 'salida',
          estado: 'enviado'
        }
      );
    } catch (error) {
      console.error('Error al enviar notificación WhatsApp:', error);
    }
  }

  /**
   * Transfiere el contexto de una sesión entre canales
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} canalOrigen - Canal de origen ('web' o 'whatsapp')
   * @param {String} canalDestino - Canal de destino ('web' o 'whatsapp')
   * @returns {Promise<Boolean>} - true si la transferencia fue exitosa
   */
  async transferirContexto(profesionalId, pacienteId, canalOrigen, canalDestino) {
    try {
      // Validar canales
      if (!this.canales.includes(canalOrigen) || !this.canales.includes(canalDestino)) {
        throw new Error('Canal no válido');
      }
      
      // Obtener contexto del canal origen
      const contextoSesion = await this.obtenerContextoSesion(profesionalId, pacienteId, canalOrigen);
      
      if (!contextoSesion) {
        return false;
      }
      
      // Guardar contexto en el canal destino
      await this.guardarContextoSesion(profesionalId, pacienteId, canalDestino, contextoSesion);
      
      // Registrar transferencia
      await baseDatos.registrarAuditoria(
        'transferencia_contexto',
        profesionalId,
        { 
          pacienteId, 
          canalOrigen, 
          canalDestino 
        }
      );
      
      return true;
    } catch (error) {
      console.error('Error al transferir contexto:', error);
      return false;
    }
  }

  /**
   * Obtiene el contexto de una sesión
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} canal - Canal ('web' o 'whatsapp')
   * @returns {Promise<Object>} - Contexto de la sesión
   */
  async obtenerContextoSesion(profesionalId, pacienteId, canal) {
    try {
      // Buscar la última sesión activa
      const sesiones = await baseDatos.obtenerSesionesPorPaciente(
        profesionalId, 
        pacienteId,
        { 
          limite: 1,
          ordenarPor: 'fecha',
          ordenDireccion: 'desc',
          filtroOrigen: canal
        }
      );
      
      if (sesiones.length === 0) {
        return null;
      }
      
      const ultimaSesion = sesiones[0];
      
      // Obtener mensajes recientes si es WhatsApp
      let mensajesRecientes = [];
      if (canal === 'whatsapp') {
        mensajesRecientes = await baseDatos.obtenerMensajesRecientes(profesionalId, pacienteId, 10);
      }
      
      // Construir contexto
      return {
        sesionId: ultimaSesion.id,
        fecha: ultimaSesion.fecha,
        observaciones: ultimaSesion.observaciones,
        estadoAnimo: ultimaSesion.estadoAnimo,
        mensajesRecientes,
        canal
      };
    } catch (error) {
      console.error('Error al obtener contexto de sesión:', error);
      return null;
    }
  }

  /**
   * Guarda el contexto de una sesión
   * @param {String} profesionalId - ID del profesional
   * @param {String} pacienteId - ID del paciente
   * @param {String} canal - Canal ('web' o 'whatsapp')
   * @param {Object} contexto - Contexto de la sesión
   * @returns {Promise<Boolean>} - true si se guardó correctamente
   */
  async guardarContextoSesion(profesionalId, pacienteId, canal, contexto) {
    try {
      // Crear una nueva sesión con el contexto transferido
      await baseDatos.registrarSesion(
        profesionalId,
        pacienteId,
        {
          fecha: new Date(),
          observaciones: `[Transferido desde ${contexto.canal}] ${contexto.observaciones || ''}`,
          estadoAnimo: contexto.estadoAnimo,
          origen: canal,
          resumen: `Continuación de sesión iniciada en ${contexto.canal}`,
          sesionAnteriorId: contexto.sesionId
        }
      );
      
      // Si es WhatsApp, enviar mensaje de contexto
      if (canal === 'whatsapp') {
        await this.enviarNotificacionWhatsApp(
          profesionalId,
          pacienteId,
          'Continuando la conversación desde la web. El historial está disponible.'
        );
      }
      
      return true;
    } catch (error) {
      console.error('Error al guardar contexto de sesión:', error);
      return false;
    }
  }
}

module.exports = new ServicioIntegracionCanales();
