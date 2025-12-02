/**
 * Simulador de datos para el API de monitoreo
 * Permite probar el dashboard sin implementar todos los servicios
 */

// Datos simulados
const datosSimulados = {
  // Estado de tareas programadas
  tareas: {
    backup: {
      estado: 'activo',
      ultimaEjecucion: new Date(Date.now() - 24 * 60 * 60 * 1000), // Ayer
      proximaEjecucion: new Date(Date.now() + 24 * 60 * 60 * 1000) // Mañana
    },
    retencion: {
      estado: 'activo',
      ultimaEjecucion: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // Hace 3 días
      proximaEjecucion: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000) // En 4 días
    },
    alertas: {
      estado: 'activo',
      ultimaEjecucion: new Date(Date.now() - 1 * 60 * 60 * 1000), // Hace 1 hora
      proximaEjecucion: new Date(Date.now() + 1 * 60 * 60 * 1000) // En 1 hora
    }
  },
  
  // Alertas de seguridad
  alertas: {
    total: 12,
    noLeidas: 3,
    altas: 1,
    medias: 4,
    bajas: 7,
    recientes: [
      {
        id: 'alerta1',
        tipo: 'login_fallido',
        nivel: 'alto',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // Hace 2 horas
        leida: false,
        detalles: { intentos: 5, ip: '192.168.1.100' }
      },
      {
        id: 'alerta2',
        tipo: 'acceso_inusual',
        nivel: 'medio',
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // Hace 5 horas
        leida: false,
        detalles: { ubicacion: 'Kiev, Ucrania' }
      },
      {
        id: 'alerta3',
        tipo: 'exportacion_masiva',
        nivel: 'medio',
        timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // Hace 12 horas
        leida: true,
        detalles: { cantidad: 15 }
      },
      {
        id: 'alerta4',
        tipo: 'modificacion_sensible',
        nivel: 'bajo',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // Hace 2 días
        leida: true,
        detalles: { pacienteId: 'PAC123' }
      }
    ]
  },
  
  // Estadísticas
  estadisticas: {
    pacientes: {
      total: 150,
      activos: 120,
      archivados: 30
    },
    sesiones: {
      total: 1250,
      web: 950,
      whatsapp: 300,
      archivadas: 200
    },
    backups: {
      total: 45,
      ultimoExitoso: new Date(Date.now() - 24 * 60 * 60 * 1000) // Ayer
    }
  }
};

/**
 * Genera un mensaje descriptivo para una alerta
 * @param {Object} alerta - Datos de la alerta
 * @returns {String} - Mensaje descriptivo
 */
function generarMensajeAlerta(alerta) {
  try {
    switch (alerta.tipo) {
      case 'login_fallido':
        return `Múltiples intentos de login fallidos (${alerta.detalles?.intentos || '?'}) desde IP ${alerta.detalles?.ip || 'desconocida'}`;
      
      case 'acceso_inusual':
        return `Acceso desde ubicación inusual (${alerta.detalles?.ubicacion || 'desconocida'})`;
      
      case 'exportacion_masiva':
        return `Exportación de datos de ${alerta.detalles?.cantidad || '?'} pacientes`;
      
      case 'modificacion_sensible':
        return `Modificación de datos sensibles de paciente ${alerta.detalles?.pacienteId || '?'}`;
      
      default:
        return `Alerta de seguridad: ${alerta.tipo}`;
    }
  } catch (error) {
    console.error('Error al generar mensaje de alerta:', error);
    return 'Alerta de seguridad';
  }
}

// Procesar alertas para añadir mensajes
datosSimulados.alertas.recientes.forEach(alerta => {
  alerta.mensaje = generarMensajeAlerta(alerta);
});

// Exportar simulador
module.exports = {
  /**
   * Obtiene el estado completo simulado
   * @returns {Object} - Estado simulado
   */
  obtenerEstado() {
    return {
      timestamp: new Date(),
      ...datosSimulados
    };
  },
  
  /**
   * Obtiene el estado de tareas simulado
   * @returns {Object} - Estado de tareas
   */
  obtenerTareas() {
    return datosSimulados.tareas;
  },
  
  /**
   * Obtiene el estado de alertas simulado
   * @returns {Object} - Estado de alertas
   */
  obtenerAlertas() {
    return datosSimulados.alertas;
  },
  
  /**
   * Obtiene estadísticas simuladas
   * @returns {Object} - Estadísticas
   */
  obtenerEstadisticas() {
    return datosSimulados.estadisticas;
  }
};
