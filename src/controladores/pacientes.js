/**
 * Controlador de pacientes para AIRA
 */
const baseDatos = require('../servicios/baseDatos');
const gestorSesiones = require('../servicios/gestorSesiones');

/**
 * Registra un nuevo paciente
 */
const registrar = async (req, res) => {
  try {
    const { id: profesionalId } = req.usuario;
    const { nombre, dni, telefono, email, obraSocial, notas } = req.body;
    
    // Validar datos obligatorios
    if (!nombre || !dni) {
      return res.status(400).json({ 
        error: 'Faltan datos obligatorios (nombre, dni)' 
      });
    }
    
    // Registrar paciente
    const pacienteId = await baseDatos.registrarPaciente(profesionalId, {
      nombre,
      dni,
      telefono: telefono || '',
      email: email || '',
      obraSocial: obraSocial || '',
      notas: notas || '',
      origen: 'web'
    });
    
    // Registrar auditoría
    await baseDatos.registrarAuditoria(
      'paciente_registrado',
      profesionalId,
      { pacienteId, dni, origen: 'web' }
    );
    
    res.status(201).json({ 
      mensaje: 'Paciente registrado correctamente',
      id: pacienteId 
    });
  } catch (error) {
    console.error('Error al registrar paciente:', error);
    res.status(500).json({ 
      error: 'Error al registrar paciente', 
      detalle: error.message 
    });
  }
};

/**
 * Obtiene la lista de pacientes de un profesional
 */
const listar = async (req, res) => {
  try {
    const { id: profesionalId } = req.usuario;
    
    // Obtener pacientes
    const pacientes = await baseDatos.obtenerPacientesPorProfesional(profesionalId);
    
    res.status(200).json(pacientes);
  } catch (error) {
    console.error('Error al listar pacientes:', error);
    res.status(500).json({ 
      error: 'Error al listar pacientes', 
      detalle: error.message 
    });
  }
};

/**
 * Inicia una sesión con un paciente
 */
const iniciarSesion = async (req, res) => {
  try {
    const { id: profesionalId } = req.usuario;
    const { pacienteId } = req.params;
    
    // Iniciar sesión
    const resultado = gestorSesiones.iniciarSesion(
      profesionalId, 
      pacienteId, 
      'web'
    );
    
    if (!resultado) {
      return res.status(400).json({ 
        error: 'No se pudo iniciar la sesión' 
      });
    }
    
    res.status(200).json({ 
      mensaje: 'Sesión iniciada correctamente' 
    });
  } catch (error) {
    console.error('Error al iniciar sesión:', error);
    res.status(500).json({ 
      error: 'Error al iniciar sesión', 
      detalle: error.message 
    });
  }
};

/**
 * Finaliza una sesión con un paciente
 */
const finalizarSesion = async (req, res) => {
  try {
    const { id: profesionalId } = req.usuario;
    const { pacienteId } = req.params;
    
    // Finalizar sesión
    gestorSesiones.finalizarSesion(
      profesionalId, 
      pacienteId, 
      'web'
    );
    
    res.status(200).json({ 
      mensaje: 'Sesión finalizada correctamente' 
    });
  } catch (error) {
    console.error('Error al finalizar sesión:', error);
    res.status(500).json({ 
      error: 'Error al finalizar sesión', 
      detalle: error.message 
    });
  }
};

module.exports = {
  registrar,
  listar,
  iniciarSesion,
  finalizarSesion
};
