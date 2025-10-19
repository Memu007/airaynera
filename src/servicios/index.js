/**
 * Índice de servicios para AIRA
 * Exporta todos los servicios disponibles
 */

// Servicios existentes
const baseDatos = require('./baseDatos');
const autenticacion = require('./autenticacion');
const gestorSesiones = require('./gestorSesiones');

// Nuevos servicios
const retencionDatos = require('./retencionDatos');
const historialCambios = require('./historialCambios');
const integracionCanales = require('./integracionCanales');
const exportacionDatos = require('./exportacionDatos');
const alertasSeguridad = require('./alertasSeguridad');
const backupAutomatico = require('./backupAutomatico');

// Exportar todos los servicios
module.exports = {
  baseDatos,
  autenticacion,
  gestorSesiones,
  retencionDatos,
  historialCambios,
  integracionCanales,
  exportacionDatos,
  alertasSeguridad,
  backupAutomatico
};
