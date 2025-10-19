/**
 * Controlador de sesiones para AIRA
 */
const baseDatos = require('../servicios/baseDatos');
const gestorSesiones = require('../servicios/gestorSesiones');

/**
 * Registra una nueva sesión
 */
const registrar = async (req, res) => {
  try {
    const { id: profesionalId } = req.usuario;
    const { pacienteId, fecha, duracion, estadoAnimo, observaciones } = req.body;
    
    // Validar datos obligatorios
    if (!pacienteId || !observaciones) {
      return res.status(400).json({ 
        error: 'Faltan datos obligatorios (pacienteId, observaciones)' 
      });
    }
    
    // Registrar sesión
    const sesionId = await baseDatos.registrarSesion(
      profesionalId, 
      pacienteId, 
      {
        fecha: fecha || new Date(),
        duracion: duracion || 0,
        estadoAnimo: estadoAnimo || '',
        observaciones,
        origen: 'web'
      }
    );
    
    // Registrar auditoría
    await baseDatos.registrarAuditoria(
      'sesion_registrada',
      profesionalId,
      { pacienteId, sesionId, origen: 'web' }
    );
    
    res.status(201).json({ 
      mensaje: 'Sesión registrada correctamente',
      id: sesionId 
    });
  } catch (error) {
    console.error('Error al registrar sesión:', error);
    res.status(500).json({ 
      error: 'Error al registrar sesión', 
      detalle: error.message 
    });
  }
};

/**
 * Obtiene las sesiones de un paciente
 */
const listarPorPaciente = async (req, res) => {
  try {
    const { id: profesionalId } = req.usuario;
    const { pacienteId } = req.params;
    const { fechaInicio, fechaFin } = req.query;
    
    // Obtener sesiones
    const sesiones = await baseDatos.obtenerSesionesPorPaciente(
      profesionalId, 
      pacienteId,
      { fechaInicio, fechaFin }
    );
    
    res.status(200).json(sesiones);
  } catch (error) {
    console.error('Error al listar sesiones:', error);
    res.status(500).json({ 
      error: 'Error al listar sesiones', 
      detalle: error.message 
    });
  }
};

/**
 * Obtiene las sesiones activas de un profesional
 */
const obtenerSesionesActivas = async (req, res) => {
  try {
    const { id: profesionalId } = req.usuario;
    
    // Obtener sesiones activas
    const pacientesIds = gestorSesiones.obtenerSesionesActivas(
      profesionalId, 
      'web'
    );
    
    res.status(200).json({ 
      sesionesActivas: pacientesIds 
    });
  } catch (error) {
    console.error('Error al obtener sesiones activas:', error);
    res.status(500).json({ 
      error: 'Error al obtener sesiones activas', 
      detalle: error.message 
    });
  }
};

module.exports = {
  registrar,
  listarPorPaciente,
  obtenerSesionesActivas
};
