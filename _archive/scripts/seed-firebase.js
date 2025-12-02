/**
 * Script para inicializar datos de prueba en Firestore
 * 
 * Uso:
 * 1. Configura las credenciales de Firebase en .env
 * 2. Ejecuta: node scripts/seed-firebase.js
 */

require('dotenv').config();
const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcrypt');

// Configuración de Firebase Admin
const serviceAccount = require('../service-account-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});

const db = admin.firestore();
const auth = admin.auth();

// Datos de prueba
const testUsers = [
  {
    email: 'medico@aira.com',
    password: 'Password123!',
    displayName: 'Médico Demo',
    role: 'medico',
    especialidad: 'Cardiología',
    matricula: 'MP12345',
    telefono: '+5491123456789',
    habilitado: true
  },
  {
    email: 'enfermero@aira.com',
    password: 'Password123!',
    displayName: 'Enfermero Demo',
    role: 'enfermero',
    especialidad: 'Enfermería General',
    matricula: 'EN12345',
    telefono: '+5491123456790',
    habilitado: true
  },
  {
    email: 'admin@aira.com',
    password: 'Admin123!',
    displayName: 'Administrador',
    role: 'admin',
    especialidad: 'Administración',
    telefono: '+5491123456791',
    habilitado: true
  }
];

// Función para crear usuarios de prueba
async function seedUsers() {
  console.log('Iniciando creación de usuarios de prueba...');
  
  for (const userData of testUsers) {
    try {
      // Crear usuario en Firebase Auth
      const userRecord = await auth.createUser({
        email: userData.email,
        password: userData.password,
        displayName: userData.displayName,
        disabled: false
      });
      
      console.log(`Usuario creado: ${userRecord.uid} (${userRecord.email})`);
      
      // Crear documento en Firestore
      const userDoc = {
        uid: userRecord.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        especialidad: userData.especialidad,
        telefono: userData.telefono,
        habilitado: userData.habilitado,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (userData.matricula) {
        userDoc.matricula = userData.matricula;
      }
      
      await db.collection('users').doc(userRecord.uid).set(userDoc);
      console.log(`Perfil creado para: ${userData.email}`);
      
    } catch (error) {
      console.error(`Error al crear usuario ${userData.email}:`, error.message);
    }
  }
  
  console.log('Proceso de creación de usuarios completado.');
}

// Función principal
async function main() {
  try {
    await seedUsers();
    console.log('¡Datos de prueba creados exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('Error al crear datos de prueba:', error);
    process.exit(1);
  }
}

// Ejecutar el script
main();
