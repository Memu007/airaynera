/**
 * API de monitoreo para AIRA
 * Proporciona endpoints para obtener datos de monitoreo
 */

const express = require('express');
const router = express.Router();

// Importar servicios
const baseDatos = require('../servicios/baseDatos');
const backupAutomatico = require('../servicios/backupAutomatico');
const retencionDatos = require('../servicios/retencionDatos');
const alertasSeguridad = require('../servicios/alertasSeguridad');

/**
 * GET /api/monitoreo/estado
 * Devuelve el estado general del sistema
 */
router.get('/estado', async (req, res) => {
  try {
    // Verificar autenticación
    const profesionalId = req.profesionalId;
    if (!profesionalId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    // Obtener datos de estado
    const estado = {
      timestamp: new Date(),
      tareas: await obtenerEstadoTareas(),
      alertas: await obtenerEstadoAlertas(profesionalId),
      estadisticas: await obtenerEstadisticas(profesionalId)
    };
    
    res.json(estado);
  } catch (error) {
    console.error('Error al obtener estado del sistema:', error);
    res.status(500).json({ error: 'Error al obtener estado del sistema' });
  }
});

/**
 * GET /api/monitoreo/tareas
 * Devuelve el estado de las tareas programadas
 */
router.get('/tareas', async (req, res) => {
  try {
    // Verificar autenticación
    const profesionalId = req.profesionalId;
    if (!profesionalId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    const tareas = await obtenerEstadoTareas();
    res.json(tareas);
  } catch (error) {
    console.error('Error al obtener estado de tareas:', error);
    res.status(500).json({ error: 'Error al obtener estado de tareas' });
  }
});

/**
 * GET /api/monitoreo/alertas
 * Devuelve el resumen de alertas de seguridad
 */
router.get('/alertas', async (req, res) => {
  try {
    // Verificar autenticación
    const profesionalId = req.profesionalId;
    if (!profesionalId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    const alertas = await obtenerEstadoAlertas(profesionalId);
    res.json(alertas);
  } catch (error) {
    console.error('Error al obtener estado de alertas:', error);
    res.status(500).json({ error: 'Error al obtener estado de alertas' });
  }
});

/**
 * GET /api/monitoreo/estadisticas
 * Devuelve estadísticas generales del sistema
 */
router.get('/estadisticas', async (req, res) => {
  try {
    // Verificar autenticación
    const profesionalId = req.profesionalId;
    if (!profesionalId) {
      return res.status(401).json({ error: 'No autorizado' });
    }
    
    const estadisticas = await obtenerEstadisticas(profesionalId);
    res.json(estadisticas);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

/**
 * Obtiene el estado de las tareas programadas
 * @returns {Promise<Object>} - Estado de tareas
 */
async function obtenerEstadoTareas() {
  try {
    const tareas = {
      backup: { estado: 'pendiente', ultimaEjecucion: null, proximaEjecucion: null },
      retencion: { estado: 'pendiente', ultimaEjecucion: null, proximaEjecucion: null },
      alertas: { estado: 'pendiente', ultimaEjecucion: null, proximaEjecucion: null }
    };
    
    // Obtener estado de backup
    try {
      const configBackup = await backupAutomatico.obtenerConfiguracion();
      if (configBackup) {
        tareas.backup = {
          estado: 'activo',
          ultimaEjecucion: configBackup.ultimoBackup || null,
          proximaEjecucion: calcularProximaEjecucion(configBackup)
        };
      }
    } catch (err) {
      console.error('Error al obtener estado de backup:', err);
    }
    
    // Obtener estado de retención
    try {
      const configRetencion = await retencionDatos.obtenerConfiguracion();
      if (configRetencion) {
        tareas.retencion = {
          estado: 'activo',
          ultimaEjecucion: configRetencion.ultimaVerificacion || null,
          proximaEjecucion: calcularProximaEjecucionRetencion()
        };
      }
    } catch (err) {
      console.error('Error al obtener estado de retención:', err);
    }
    
    // Obtener estado de verificación de alertas
    try {
      const configAlertas = await alertasSeguridad.obtenerConfiguracion();
      if (configAlertas) {
        tareas.alertas = {
          estado: 'activo',
          ultimaEjecucion: configAlertas.ultimaVerificacion || null,
          proximaEjecucion: new Date(Date.now() + 60 * 60 * 1000) // +1 hora
        };
      }
    } catch (err) {
      console.error('Error al obtener estado de alertas:', err);
    }
    
    return tareas;
  } catch (error) {
    console.error('Error al obtener estado de tareas:', error);
    throw error;
  }
}

/**
 * Obtiene el estado de las alertas de seguridad
 * @param {String} profesionalId - ID del profesional
 * @returns {Promise<Object>} - Estado de alertas
 */
async function obtenerEstadoAlertas(profesionalId) {
  try {
    // Valores por defecto
    const alertas = {
      total: 0,
      noLeidas: 0,
      altas: 0,
      medias: 0,
      bajas: 0,
      recientes: []
    };
    
    // Obtener resumen de alertas
    try {
      const resumen = await alertasSeguridad.obtenerResumenAlertas(profesionalId);
      
      if (resumen) {
        alertas.total = resumen.total || 0;
        alertas.noLeidas = resumen.noLeidas || 0;
        alertas.altas = resumen.porNivel?.alto || 0;
        alertas.medias = resumen.porNivel?.medio || 0;
        alertas.bajas = resumen.porNivel?.bajo || 0;
      }
      
      // Obtener alertas recientes
      const alertasRecientes = await alertasSeguridad.obtenerAlertas(
        profesionalId,
        { limite: 5, ordenar: 'fecha', direccion: 'desc' }
      );
      
      if (alertasRecientes && alertasRecientes.length > 0) {
        alertas.recientes = alertasRecientes.map(a => ({
          id: a.id,
          tipo: a.tipo,
          nivel: a.nivel,
          timestamp: a.timestamp,
          leida: a.leida,
          mensaje: generarMensajeAlerta(a)
        }));
      }
    } catch (err) {
      console.error('Error al obtener resumen de alertas:', err);
    }
    
    return alertas;
  } catch (error) {
    console.error('Error al obtener estado de alertas:', error);
    throw error;
  }
}

/**
 * Obtiene estadísticas generales del sistema
 * @param {String} profesionalId - ID del profesional
 * @returns {Promise<Object>} - Estadísticas
 */
async function obtenerEstadisticas(profesionalId) {
  try {
    const estadisticas = {
      pacientes: { total: 0, activos: 0, archivados: 0 },
      sesiones: { total: 0, web: 0, whatsapp: 0, archivadas: 0 },
      backups: { total: 0, ultimoExitoso: null }
    };
    
    // Estadísticas de pacientes
    try {
      const pacientes = await baseDatos.obtenerEstadisticasPacientes(profesionalId);
      if (pacientes) {
        estadisticas.pacientes = pacientes;
      }
    } catch (err) {
      console.error('Error al obtener estadísticas de pacientes:', err);
    }
    
    // Estadísticas de sesiones
    try {
      const sesiones = await baseDatos.obtenerEstadisticasSesiones(profesionalId);
      if (sesiones) {
        estadisticas.sesiones = sesiones;
      }
    } catch (err) {
      console.error('Error al obtener estadísticas de sesiones:', err);
    }
    
    // Estadísticas de backups
    try {
      const backups = await backupAutomatico.obtenerEstadisticasBackup(profesionalId);
      if (backups) {
        estadisticas.backups = backups;
      }
    } catch (err) {
      console.error('Error al obtener estadísticas de backups:', err);
    }
    
    return estadisticas;
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    throw error;
  }
}

/**
 * Calcula la próxima ejecución de backup según configuración
 * @param {Object} config - Configuración de backup
 * @returns {Date} - Fecha de próxima ejecución
 */
function calcularProximaEjecucion(config) {
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
}

/**
 * Calcula la próxima ejecución de verificación de retención
 * @returns {Date} - Fecha de próxima ejecución
 */
function calcularProximaEjecucionRetencion() {
  // La verificación de retención se ejecuta semanalmente
  const proximaEjecucion = new Date();
  proximaEjecucion.setDate(proximaEjecucion.getDate() + 7); // +7 días
  proximaEjecucion.setHours(2, 0, 0, 0); // A las 2 AM
  
  return proximaEjecucion;
}

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

module.exports = router;
