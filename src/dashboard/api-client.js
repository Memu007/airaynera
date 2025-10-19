/**
 * Cliente API para el dashboard técnico AIRA
 * Maneja las conexiones con el backend para obtener datos reales
 */

const API_BASE_URL = '/api'; // URL base para las peticiones API

// Cliente API principal
const apiClient = {
  /**
   * Obtiene datos de monitoreo en tiempo real
   * @returns {Promise} Promesa con los datos de monitoreo
   */
  obtenerDatosMonitoreo: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/monitoreo`);
      if (!response.ok) throw new Error('Error al obtener datos de monitoreo');
      return await response.json();
    } catch (error) {
      console.error('Error en obtenerDatosMonitoreo:', error);
      throw error;
    }
  },

  /**
   * Obtiene el estado de los servicios
   * @returns {Promise} Promesa con los datos de servicios
   */
  obtenerServicios: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/servicios`);
      if (!response.ok) throw new Error('Error al obtener servicios');
      return await response.json();
    } catch (error) {
      console.error('Error en obtenerServicios:', error);
      throw error;
    }
  },

  /**
   * Reinicia un servicio específico
   * @param {string} servicioId - ID del servicio a reiniciar
   * @returns {Promise} Promesa con el resultado de la operación
   */
  reiniciarServicio: async (servicioId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/servicios/${servicioId}/reiniciar`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error(`Error al reiniciar servicio ${servicioId}`);
      return await response.json();
    } catch (error) {
      console.error('Error en reiniciarServicio:', error);
      throw error;
    }
  },

  /**
   * Obtiene logs del sistema con filtros
   * @param {Object} filtros - Filtros para los logs (nivel, servicio, fecha)
   * @param {number} pagina - Número de página para paginación
   * @returns {Promise} Promesa con los logs filtrados
   */
  obtenerLogs: async (filtros = {}, pagina = 1) => {
    try {
      const params = new URLSearchParams();
      if (filtros.nivel) params.append('nivel', filtros.nivel);
      if (filtros.servicio) params.append('servicio', filtros.servicio);
      if (filtros.fecha) params.append('fecha', filtros.fecha);
      params.append('pagina', pagina);

      const response = await fetch(`${API_BASE_URL}/logs?${params.toString()}`);
      if (!response.ok) throw new Error('Error al obtener logs');
      return await response.json();
    } catch (error) {
      console.error('Error en obtenerLogs:', error);
      throw error;
    }
  },

  /**
   * Guarda la configuración del sistema
   * @param {Object} config - Objeto con la configuración a guardar
   * @returns {Promise} Promesa con el resultado de la operación
   */
  guardarConfiguracion: async (config) => {
    try {
      const response = await fetch(`${API_BASE_URL}/configuracion`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(config)
      });
      if (!response.ok) throw new Error('Error al guardar configuración');
      return await response.json();
    } catch (error) {
      console.error('Error en guardarConfiguracion:', error);
      throw error;
    }
  },

  /**
   * Obtiene información del sistema
   * @returns {Promise} Promesa con la información del sistema
   */
  obtenerInfoSistema: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sistema/info`);
      if (!response.ok) throw new Error('Error al obtener información del sistema');
      return await response.json();
    } catch (error) {
      console.error('Error en obtenerInfoSistema:', error);
      throw error;
    }
  },

  /**
   * Verifica actualizaciones disponibles
   * @returns {Promise} Promesa con las actualizaciones disponibles
   */
  verificarActualizaciones: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sistema/actualizaciones`);
      if (!response.ok) throw new Error('Error al verificar actualizaciones');
      return await response.json();
    } catch (error) {
      console.error('Error en verificarActualizaciones:', error);
      throw error;
    }
  },

  /**
   * Realiza un backup del sistema
   * @returns {Promise} Promesa con el resultado de la operación
   */
  realizarBackup: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sistema/backup`, {
        method: 'POST'
      });
      if (!response.ok) throw new Error('Error al realizar backup');
      return await response.json();
    } catch (error) {
      console.error('Error en realizarBackup:', error);
      throw error;
    }
  }
};

// Exportar el cliente API
window.apiClient = apiClient;
