/**
 * Servicio de autenticación para AIRA
 * Maneja la autenticación tanto para la web como para WhatsApp
 */
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const baseDatos = require('./baseDatos');
const { secretoJWT, duracionToken, configCifrado } = require('../config/seguridad');

class ServicioAutenticacion {
  /**
   * Autentica a un profesional por DNI y PIN
   * @param {String} dni - DNI del profesional
   * @param {String} pin - PIN del profesional
   * @param {String} origen - Origen de la autenticación ('web' o 'whatsapp')
   * @returns {Promise<Object>} - Token y datos del profesional
   */
  async autenticarProfesional(dni, pin, origen = 'web') {
    try {
      // Buscar profesional por DNI
      const profesional = await baseDatos.obtenerProfesionalPorDni(dni);
      
      if (!profesional) {
        throw new Error('Profesional no encontrado');
      }
      
      // Verificar PIN
      const pinValido = await bcrypt.compare(pin, profesional.pin);
      
      if (!pinValido) {
        // Registrar intento fallido
        await baseDatos.registrarAuditoria(
          'autenticacion_fallida', 
          profesional.id, 
          { dni, origen }
        );
        throw new Error('PIN incorrecto');
      }
      
      // Generar token JWT
      const token = jwt.sign(
        { 
          id: profesional.id, 
          dni: profesional.dni,
          nombre: profesional.nombre,
          origen
        }, 
        secretoJWT, 
        { expiresIn: duracionToken }
      );
      
      // Registrar autenticación exitosa
      await baseDatos.registrarAuditoria(
        'autenticacion_exitosa', 
        profesional.id, 
        { dni, origen }
      );
      
      return {
        token,
        profesional: {
          id: profesional.id,
          dni: profesional.dni,
          nombre: profesional.nombre
        }
      };
    } catch (error) {
      console.error('Error en autenticación:', error);
      throw error;
    }
  }

  /**
   * Verifica un token JWT
   * @param {String} token - Token JWT
   * @returns {Object} - Datos del token decodificado
   */
  verificarToken(token) {
    try {
      return jwt.verify(token, secretoJWT);
    } catch (error) {
      console.error('Error al verificar token:', error);
      throw new Error('Token inválido o expirado');
    }
  }

  /**
   * Genera un hash para un PIN
   * @param {String} pin - PIN a hashear
   * @returns {Promise<String>} - Hash del PIN
   */
  async hashearPin(pin) {
    return bcrypt.hash(pin, configCifrado.saltRounds);
  }

  /**
   * Verifica un PIN con su hash
   * @param {String} pin - PIN a verificar
   * @param {String} hash - Hash del PIN
   * @returns {Promise<Boolean>} - true si el PIN es válido
   */
  async verificarPin(pin, hash) {
    return bcrypt.compare(pin, hash);
  }
}

module.exports = new ServicioAutenticacion();
