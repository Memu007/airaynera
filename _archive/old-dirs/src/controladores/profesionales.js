/**
 * Controlador de profesionales para AIRA
 */
const baseDatos = require('../servicios/baseDatos');
const autenticacion = require('../servicios/autenticacion');

/**
 * Registra un nuevo profesional
 */
const registrar = async (req, res) => {
  try {
    const { dni, nombre, email, pin } = req.body;
    
    // Validar datos
    if (!dni || !nombre || !email || !pin) {
      return res.status(400).json({ 
        error: 'Faltan datos obligatorios (dni, nombre, email, pin)' 
      });
    }
    
    // Hashear PIN
    const pinHash = await autenticacion.hashearPin(pin);
    
    // Registrar profesional
    const profesionalId = await baseDatos.registrarProfesional({
      dni,
      nombre,
      email,
      pin: pinHash
    });
    
    res.status(201).json({ 
      mensaje: 'Profesional registrado correctamente',
      id: profesionalId 
    });
  } catch (error) {
    console.error('Error al registrar profesional:', error);
    res.status(500).json({ 
      error: 'Error al registrar profesional', 
      detalle: error.message 
    });
  }
};

/**
 * Autentica a un profesional
 */
const autenticar = async (req, res) => {
  try {
    const { dni, pin } = req.body;
    
    // Validar datos
    if (!dni || !pin) {
      return res.status(400).json({ 
        error: 'Faltan datos obligatorios (dni, pin)' 
      });
    }
    
    // Autenticar profesional
    const resultado = await autenticacion.autenticarProfesional(
      dni, 
      pin, 
      'web'
    );
    
    res.status(200).json(resultado);
  } catch (error) {
    console.error('Error al autenticar profesional:', error);
    res.status(401).json({ 
      error: 'Error de autenticación', 
      detalle: error.message 
    });
  }
};

/**
 * Obtiene el perfil de un profesional
 */
const obtenerPerfil = async (req, res) => {
  try {
    const { id } = req.usuario;
    
    // Obtener profesional
    const profesional = await baseDatos.obtenerProfesionalPorDni(id);
    
    if (!profesional) {
      return res.status(404).json({ 
        error: 'Profesional no encontrado' 
      });
    }
    
    // No devolver datos sensibles
    delete profesional.pin;
    
    res.status(200).json(profesional);
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({ 
      error: 'Error al obtener perfil', 
      detalle: error.message 
    });
  }
};

module.exports = {
  registrar,
  autenticar,
  obtenerPerfil
};
