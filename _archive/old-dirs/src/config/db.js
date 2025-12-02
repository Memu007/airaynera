/**
 * Configuración de conexión a la base de datos
 * Firestore para AIRA
 */
const { Firestore } = require('@google-cloud/firestore');
const dotenv = require('dotenv');

dotenv.config();

// Configuración de Firestore
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Nombres de colecciones
const colecciones = {
  profesionales: 'profesionales',
  pacientes: 'pacientes',
  sesiones: 'sesiones',
  mensajes: 'mensajes',
  registroAuditoria: 'registro_auditoria'
};

module.exports = {
  firestore,
  colecciones
};
