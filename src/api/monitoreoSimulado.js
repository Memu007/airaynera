/**
 * API de monitoreo simulado para AIRA
 * Proporciona endpoints para obtener datos de monitoreo simulados
 */

const express = require('express');
const router = express.Router();

// Importar simulador
const simulador = require('./simuladorMonitoreo');

/**
 * GET /api/monitoreo/estado
 * Devuelve el estado general del sistema (simulado)
 */
router.get('/estado', (req, res) => {
  try {
    // Obtener datos simulados
    const estado = simulador.obtenerEstado();
    
    // Simular pequeño retraso para que parezca real
    setTimeout(() => {
      res.json(estado);
    }, 300);
  } catch (error) {
    console.error('Error al obtener estado simulado:', error);
    res.status(500).json({ error: 'Error al obtener estado del sistema' });
  }
});

/**
 * GET /api/monitoreo/tareas
 * Devuelve el estado de las tareas programadas (simulado)
 */
router.get('/tareas', (req, res) => {
  try {
    // Obtener datos simulados
    const tareas = simulador.obtenerTareas();
    
    // Simular pequeño retraso
    setTimeout(() => {
      res.json(tareas);
    }, 200);
  } catch (error) {
    console.error('Error al obtener tareas simuladas:', error);
    res.status(500).json({ error: 'Error al obtener estado de tareas' });
  }
});

/**
 * GET /api/monitoreo/alertas
 * Devuelve el resumen de alertas de seguridad (simulado)
 */
router.get('/alertas', (req, res) => {
  try {
    // Obtener datos simulados
    const alertas = simulador.obtenerAlertas();
    
    // Simular pequeño retraso
    setTimeout(() => {
      res.json(alertas);
    }, 250);
  } catch (error) {
    console.error('Error al obtener alertas simuladas:', error);
    res.status(500).json({ error: 'Error al obtener estado de alertas' });
  }
});

/**
 * GET /api/monitoreo/estadisticas
 * Devuelve estadísticas generales del sistema (simulado)
 */
router.get('/estadisticas', (req, res) => {
  try {
    // Obtener datos simulados
    const estadisticas = simulador.obtenerEstadisticas();
    
    // Simular pequeño retraso
    setTimeout(() => {
      res.json(estadisticas);
    }, 350);
  } catch (error) {
    console.error('Error al obtener estadísticas simuladas:', error);
    res.status(500).json({ error: 'Error al obtener estadísticas' });
  }
});

module.exports = router;
