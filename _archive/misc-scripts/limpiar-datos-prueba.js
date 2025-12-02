/**
 * Limpiador de datos de prueba para AIRA Bot
 * Elimina todos los registros marcados como "test"
 */
require('dotenv').config();
const { Firestore } = require('@google-cloud/firestore');

// Conexión a Firestore
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

/**
 * Elimina todos los datos de prueba de la base de datos
 */
async function limpiarDatos() {
  console.log("🗑️ Buscando datos de prueba para eliminar...");
  
  try {
    // 1. Eliminar pacientes de prueba
    const pacientes = await db.collection('patients')
      .where('test', '==', true)
      .get();
      
    console.log(`Encontrados ${pacientes.size} pacientes de prueba`);
    
    let contador = 0;
    const batchesPacientes = [];
    let batchActual = db.batch();
    
    pacientes.forEach(doc => {
      batchActual.delete(doc.ref);
      contador++;
      
      // Firestore tiene límite de 500 operaciones por batch
      if (contador >= 450) {
        batchesPacientes.push(batchActual);
        batchActual = db.batch();
        contador = 0;
      }
    });
    
    // Agregar el último batch si tiene operaciones
    if (contador > 0) {
      batchesPacientes.push(batchActual);
    }
    
    // 2. Eliminar sesiones de prueba
    const sesiones = await db.collection('sessions')
      .where('test', '==', true)
      .get();
      
    console.log(`Encontradas ${sesiones.size} sesiones de prueba`);
    
    contador = 0;
    const batchesSesiones = [];
    batchActual = db.batch();
    
    sesiones.forEach(doc => {
      batchActual.delete(doc.ref);
      contador++;
      
      // Firestore tiene límite de 500 operaciones por batch
      if (contador >= 450) {
        batchesSesiones.push(batchActual);
        batchActual = db.batch();
        contador = 0;
      }
    });
    
    // Agregar el último batch si tiene operaciones
    if (contador > 0) {
      batchesSesiones.push(batchActual);
    }
    
    // Ejecutar todos los batches
    for (const batch of batchesPacientes) {
      await batch.commit();
    }
    
    for (const batch of batchesSesiones) {
      await batch.commit();
    }
    
    console.log(`✅ Eliminados ${pacientes.size} pacientes y ${sesiones.size} sesiones de prueba`);
    
  } catch (error) {
    console.error('❌ Error al limpiar datos:', error);
  }
}

// Ejecutar la limpieza de datos
limpiarDatos().catch(console.error);
