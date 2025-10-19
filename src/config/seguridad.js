/**
 * Configuración de seguridad para AIRA
 * Incluye configuración de cifrado y autenticación
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

// Configuración de cifrado
const configCifrado = {
  algoritmo: 'aes-256-gcm',
  longitudClave: 32,
  longitudIv: 16,
  saltRounds: 10
};

// Clave secreta para JWT
const secretoJWT = process.env.JWT_SECRET || 'aira-secreto-desarrollo-temporal';

// Duración del token (en segundos)
const duracionToken = 86400; // 24 horas

// Función para generar una clave derivada
const generarClaveDerivedada = (contexto) => {
  const semilla = process.env.ENCRYPTION_KEY || 'aira-semilla-desarrollo-temporal';
  return crypto.pbkdf2Sync(
    semilla + contexto,
    process.env.ENCRYPTION_SALT || 'sal-aira',
    10000,
    configCifrado.longitudClave,
    'sha256'
  );
};

module.exports = {
  configCifrado,
  secretoJWT,
  duracionToken,
  generarClaveDerivedada
};
