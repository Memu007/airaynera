/**
 * Dashboard de monitoreo para AIRA
 * Permite visualizar el estado de tareas automáticas, alertas y estadísticas
 */

// Módulo para gestionar el dashboard
const DashboardMonitoreo = {
  // Estado del dashboard
  estado: {
    ultimaActualizacion: null,
    tareas: {
      backup: { estado: 'pendiente', ultimaEjecucion: null, proximaEjecucion: null },
      retencion: { estado: 'pendiente', ultimaEjecucion: null, proximaEjecucion: null },
      alertas: { estado: 'pendiente', ultimaEjecucion: null, proximaEjecucion: null }
    },
    alertas: {
      total: 0,
      noLeidas: 0,
      altas: 0,
      medias: 0,
      bajas: 0
    },
    estadisticas: {
      pacientes: { total: 0, activos: 0, archivados: 0 },
      sesiones: { total: 0, web: 0, whatsapp: 0, archivadas: 0 },
      backups: { total: 0, ultimoExitoso: null }
    }
  },

  /**
   * Inicializa el dashboard
   * @returns {Promise<boolean>} - Resultado de la inicialización
   */
  async inicializar() {
    try {
      console.log('Inicializando dashboard de monitoreo...');
      
      // Cargar servicios
      this.servicios = {
        baseDatos: require('../servicios/baseDatos'),
        backupAutomatico: require('../servicios/backupAutomatico'),
        retencionDatos: require('../servicios/retencionDatos'),
        alertasSeguridad: require('../servicios/alertasSeguridad')
      };
      
      // Actualizar datos iniciales
      await this.actualizarDatos();
      
      // Configurar actualización periódica
      this.intervaloActualizacion = setInterval(() => {
        this.actualizarDatos().catch(error => {
          console.error('Error al actualizar dashboard:', error);
        });
      }, 5 * 60 * 1000); // Actualizar cada 5 minutos
      
      console.log('Dashboard de monitoreo inicializado correctamente');
      return true;
    } catch (error) {
      console.error('Error al inicializar dashboard:', error);
      return false;
    }
  },

  /**
   * Actualiza todos los datos del dashboard
   * @returns {Promise<Object>} - Estado actualizado
   */
  async actualizarDatos() {
    try {
      await Promise.all([
        this.actualizarEstadoTareas(),
        this.actualizarEstadoAlertas(),
        this.actualizarEstadisticas()
      ]);
      
      this.estado.ultimaActualizacion = new Date();
      return this.estado;
    } catch (error) {
      console.error('Error al actualizar datos del dashboard:', error);
      throw error;
    }
  },

  /**
   * Actualiza el estado de las tareas programadas
   * @returns {Promise<Object>} - Estado de tareas
   */
  async actualizarEstadoTareas() {
    try {
      // Obtener estado de backup
      const configBackup = await this.servicios.backupAutomatico.obtenerConfiguracion();
      if (configBackup) {
        this.estado.tareas.backup = {
          estado: 'activo',
          ultimaEjecucion: configBackup.ultimoBackup || null,
          proximaEjecucion: this.calcularProximaEjecucion(configBackup)
        };
      }
      
      // Obtener estado de retención
      const configRetencion = await this.servicios.retencionDatos.obtenerConfiguracion();
      if (configRetencion) {
        this.estado.tareas.retencion = {
          estado: 'activo',
          ultimaEjecucion: configRetencion.ultimaVerificacion || null,
          proximaEjecucion: this.calcularProximaEjecucionRetencion(configRetencion)
        };
      }
      
      // Obtener estado de verificación de alertas
      const configAlertas = await this.servicios.alertasSeguridad.obtenerConfiguracion();
      if (configAlertas) {
        this.estado.tareas.alertas = {
          estado: 'activo',
          ultimaEjecucion: configAlertas.ultimaVerificacion || null,
          proximaEjecucion: new Date(Date.now() + 60 * 60 * 1000) // +1 hora
        };
      }
      
      return this.estado.tareas;
    } catch (error) {
      console.error('Error al actualizar estado de tareas:', error);
      return this.estado.tareas;
    }
  },

  /**
   * Actualiza el estado de las alertas de seguridad
   * @returns {Promise<Object>} - Estado de alertas
   */
  async actualizarEstadoAlertas() {
    try {
      // Obtener resumen de alertas
      const resumen = await this.servicios.alertasSeguridad.obtenerResumenAlertas();
      
      if (resumen) {
        this.estado.alertas = {
          total: resumen.total || 0,
          noLeidas: resumen.noLeidas || 0,
          altas: resumen.porNivel?.alto || 0,
          medias: resumen.porNivel?.medio || 0,
          bajas: resumen.porNivel?.bajo || 0
        };
      }
      
      return this.estado.alertas;
    } catch (error) {
      console.error('Error al actualizar estado de alertas:', error);
      return this.estado.alertas;
    }
  },

  /**
   * Actualiza las estadísticas generales
   * @returns {Promise<Object>} - Estadísticas
   */
  async actualizarEstadisticas() {
    try {
      // Estadísticas de pacientes
      const pacientes = await this.servicios.baseDatos.obtenerEstadisticasPacientes();
      if (pacientes) {
        this.estado.estadisticas.pacientes = pacientes;
      }
      
      // Estadísticas de sesiones
      const sesiones = await this.servicios.baseDatos.obtenerEstadisticasSesiones();
      if (sesiones) {
        this.estado.estadisticas.sesiones = sesiones;
      }
      
      // Estadísticas de backups
      const backups = await this.servicios.backupAutomatico.obtenerEstadisticasBackup();
      if (backups) {
        this.estado.estadisticas.backups = backups;
      }
      
      return this.estado.estadisticas;
    } catch (error) {
      console.error('Error al actualizar estadísticas:', error);
      return this.estado.estadisticas;
    }
  },

  /**
   * Calcula la próxima ejecución de backup según configuración
   * @param {Object} config - Configuración de backup
   * @returns {Date} - Fecha de próxima ejecución
   */
  calcularProximaEjecucion(config) {
    try {
      const ahora = new Date();
      const proximaEjecucion = new Date();
      
      if (config.frecuenciaDiaria) {
        // Configurar para mañana a la hora especificada
        proximaEjecucion.setDate(ahora.getDate() + 1);
        proximaEjecucion.setHours(config.hora || 1, 0, 0, 0);
      } else if (config.frecuenciaSemanal) {
        // Configurar para el próximo día de la semana especificado
        const diaSemanaActual = ahora.getDay(); // 0 = domingo, 1 = lunes, etc.
        const diaSemanaConfig = config.diaSemana || 0;
        let diasHastaProximo = diaSemanaConfig - diaSemanaActual;
        
        if (diasHastaProximo <= 0) {
          diasHastaProximo += 7; // Avanzar a la próxima semana
        }
        
        proximaEjecucion.setDate(ahora.getDate() + diasHastaProximo);
        proximaEjecucion.setHours(config.hora || 1, 0, 0, 0);
      } else {
        // Por defecto, mañana a la 1 AM
        proximaEjecucion.setDate(ahora.getDate() + 1);
        proximaEjecucion.setHours(1, 0, 0, 0);
      }
      
      return proximaEjecucion;
    } catch (error) {
      console.error('Error al calcular próxima ejecución:', error);
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // +24 horas por defecto
    }
  },

  /**
   * Calcula la próxima ejecución de verificación de retención
   * @param {Object} config - Configuración de retención
   * @returns {Date} - Fecha de próxima ejecución
   */
  calcularProximaEjecucionRetencion() {
    // La verificación de retención se ejecuta semanalmente
    const proximaEjecucion = new Date();
    proximaEjecucion.setDate(proximaEjecucion.getDate() + 7); // +7 días
    proximaEjecucion.setHours(2, 0, 0, 0); // A las 2 AM
    
    return proximaEjecucion;
  },

  /**
   * Obtiene el estado actual del dashboard
   * @returns {Object} - Estado completo
   */
  obtenerEstado() {
    return {
      ...this.estado,
      timestamp: new Date()
    };
  },

  /**
   * Detiene el dashboard y libera recursos
   */
  detener() {
    if (this.intervaloActualizacion) {
      clearInterval(this.intervaloActualizacion);
      this.intervaloActualizacion = null;
    }
    console.log('Dashboard de monitoreo detenido');
  }
};

module.exports = DashboardMonitoreo;
