/**
 * Script para inicializar configuraciones básicas de Firebase
 * 
 * Este script configura las reglas de seguridad básicas y las configuraciones iniciales
 * en Firebase Authentication y Firestore.
 * 
 * Uso:
 * 1. Configura las credenciales de Firebase en .env
 * 2. Ejecuta: node scripts/initialize-firebase.js
 */

require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Validar variables de entorno
const requiredVars = ['FIREBASE_PROJECT_ID'];
const missingVars = requiredVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.error(`Error: Faltan variables de entorno requeridas: ${missingVars.join(', ')}`);
  console.error('Por favor, asegúrate de que el archivo .env esté correctamente configurado.');
  process.exit(1);
}

// Ruta al archivo de credenciales de Firebase Admin
const serviceAccountPath = path.join(__dirname, '../service-account-key.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error(`Error: No se encontró el archivo de credenciales en ${serviceAccountPath}`);
  console.error('Por favor, asegúrate de tener un archivo service-account-key.json válido.');
  process.exit(1);
}

// Cargar credenciales
const serviceAccount = require(serviceAccountPath);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

const db = admin.firestore();
const auth = admin.auth();

// Configuraciones iniciales
const initialConfig = {
  // Configuraciones de la aplicación
  app: {
    name: 'AIRA Bot',
    version: '1.0.0',
    maintenance: false,
    allowedDomains: ['localhost', 'aira-bot.web.app', 'aira-bot.firebaseapp.com']
  },
  
  // Configuraciones de seguridad
  security: {
    passwordMinLength: 8,
    passwordRequiresUppercase: true,
    passwordRequiresLowercase: true,
    passwordRequiresNumbers: true,
    passwordRequiresSpecialChars: true,
    maxLoginAttempts: 5,
    lockoutTime: 15 // minutos
  },
  
  // Configuraciones de la aplicación
  settings: {
    defaultLanguage: 'es',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm',
    timezone: 'America/Argentina/Buenos_Aires'
  }
};

/**
 * Configurar las reglas de seguridad de Firestore
 */
async function setupFirestoreRules() {
  console.log('Configurando reglas de Firestore...');
  
  const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Permisos para la colección de usuarios
    match /users/{userId} {
      // El usuario solo puede leer/escribir su propio documento
      allow read, write: if request.auth != null && request.auth.uid == userId;
      
      // Los administradores pueden leer/escribir cualquier documento de usuario
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
    }
    
    // Permisos para la colección de pacientes
    match /pacientes/{pacienteId} {
      // Los médicos pueden leer/escribir cualquier documento de paciente
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['medico', 'admin'];
    }
    
    // Permisos para la colección de registros clínicos
    match /registros/{registroId} {
      // Los médicos pueden leer/escribir cualquier registro clínico
      allow read, write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['medico', 'admin'];
    }
  }
}`;
  
  try {
    await admin.securityRules().releaseFirestoreRuleset(
      admin.securityRules().createRulesetFromSource(rules)
    );
    console.log('✅ Reglas de Firestore configuradas correctamente');
  } catch (error) {
    console.error('❌ Error al configurar las reglas de Firestore:', error.message);
    throw error;
  }
}

/**
 * Configurar las reglas de Firebase Storage
 */
async function setupStorageRules() {
  console.log('Configurando reglas de Storage...');
  
  const rules = `rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      // Solo usuarios autenticados pueden subir archivos
      allow read, write: if request.auth != null;
    }
  }
}`;
  
  try {
    await admin.securityRules().releaseFirestoreRuleset(
      admin.securityRules().createRulesetFromSource(rules)
    );
    console.log('✅ Reglas de Storage configuradas correctamente');
  } catch (error) {
    console.error('❌ Error al configurar las reglas de Storage:', error.message);
    throw error;
  }
}

/**
 * Configurar la configuración inicial de la aplicación
 */
async function setupInitialConfig() {
  console.log('Configurando configuración inicial...');
  
  try {
    const configRef = db.collection('config').doc('app');
    await configRef.set({
      ...initialConfig,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: 'system'
    }, { merge: true });
    
    console.log('✅ Configuración inicial guardada correctamente');
  } catch (error) {
    console.error('❌ Error al guardar la configuración inicial:', error.message);
    throw error;
  }
}

/**
 * Crear datos demo
 */
async function createInitialData() {
  const db = admin.firestore();
  
  // Usuario demo
  await db.collection('users').doc('demo-prof').set({
    dni: 'demo-prof',
    role: 'medico',
    nombre: 'Profesional Demo'
  });
  
  // Pacientes demo
  const pacientes = [
    { nombre: 'Paciente Uno', dni: '11111111' },
    { nombre: 'Paciente Dos', dni: '22222222' }
  ];
  
  for (const paciente of pacientes) {
    await db.collection('pacientes').add({
      ...paciente,
      profesionalId: 'demo-prof'
    });
  }
}

/**
 * Función principal
 */
async function main() {
  try {
    console.log('🚀 Iniciando configuración de Firebase...');
    
    // Configurar reglas de Firestore
    await setupFirestoreRules();
    
    // Configurar reglas de Storage
    await setupStorageRules();
    
    // Configurar configuración inicial
    await setupInitialConfig();
    
    // Crear datos demo
    await createInitialData();
    
    console.log('✨ Configuración de Firebase completada exitosamente');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante la configuración de Firebase:', error);
    process.exit(1);
  }
}

// Ejecutar el script
if (require.main === module) {
  main();
}

module.exports = {
  setupFirestoreRules,
  setupStorageRules,
  setupInitialConfig,
  createInitialData
};
