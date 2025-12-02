/**
 * Generador de datos de prueba para AIRA Bot
 * Crea 50 pacientes con 3-5 sesiones cada uno
 */
require('dotenv').config();
const { v4: uuidv4 } = require('uuid');
const { Firestore } = require('@google-cloud/firestore');

// Lista de obras sociales válidas
const OBRAS_SOCIALES = ['OSDE', 'SWISS', 'PAMI', 'IOMA', 'GALENO'];

// Conexión a Firestore
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

/**
 * Genera datos de prueba y los guarda en la base de datos
 */
async function generarDatos() {
  console.log("🔥 Generando 50 pacientes con 3-5 sesiones cada uno...");
  const batch = db.batch();
  
  // Profesional de prueba para asociar los pacientes
  const dniProfesional = '20123456';
  
  // Generar pacientes
  for (let i = 1; i <= 50; i++) {
    // DNI aleatorio de 8 dígitos
    const dni = Math.floor(10000000 + Math.random() * 90000000).toString();
    const patientRef = db.collection('patients').doc(`test_${dni}`);
    
    // Datos del paciente
    batch.set(patientRef, {
      nombre: `Paciente Test ${i}`,
      dni,
      obra_social: OBRAS_SOCIALES[Math.floor(Math.random() * OBRAS_SOCIALES.length)],
      telefono: `+54911${Math.floor(10000000 + Math.random() * 90000000)}`,
      estado: 'activo',
      profesional_dni: dniProfesional,
      creado: new Date(),
      test: true // Marca para identificar datos de prueba
    });

    // Generar sesiones para este paciente
    const sesionesTotal = 3 + Math.floor(Math.random() * 3); // Entre 3 y 5 sesiones
    for (let j = 1; j <= sesionesTotal; j++) {
      const sessionRef = db.collection('sessions').doc(uuidv4());
      
      // Datos de la sesión
      batch.set(sessionRef, {
        fecha: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000), // Últimos 30 días
        paciente_dni: dni,
        profesional_dni: dniProfesional,
        observaciones: `Sesión ${j} del paciente ${i}. ${getObservacionAleatoria()}`,
        resumen: `Resumen automático sesión ${j}`,
        estado_animico: Math.floor(1 + Math.random() * 5), // Entre 1 y 5
        test: true // Marca para identificar datos de prueba
      });
    }
  }

  // Ejecutar batch
  try {
    await batch.commit();
    console.log('✅ Datos generados:');
    console.log('- 50 pacientes de prueba');
    console.log(`- ~${50 * 4} sesiones clínicas (aprox.)`);
    console.log('\n💡 Para limpiar: node limpiar-datos-prueba.js');
  } catch (error) {
    console.error('❌ Error al generar datos:', error);
  }
}

/**
 * Genera una observación de sesión aleatoria
 */
function getObservacionAleatoria() {
  const observaciones = [
    "Paciente reporta mejora en síntomas de ansiedad. Continúa aplicando técnicas de relajación.",
    "Se observa estado anímico estable. Refiere buena adherencia al tratamiento.",
    "Persisten dificultades en el ámbito laboral. Se trabaja en estrategias de afrontamiento.",
    "Avance en la identificación de pensamientos negativos automáticos.",
    "Reporta mejora en relaciones familiares. Continúa aplicando comunicación asertiva.",
    "Dificultades para conciliar el sueño. Se refuerzan pautas de higiene del sueño.",
    "Paciente reflexiona sobre patrones de comportamiento recurrentes.",
    "Se observa progreso en manejo de situaciones de estrés.",
    "Reporta episodio de angustia moderada. Se analizan desencadenantes."
  ];
  
  return observaciones[Math.floor(Math.random() * observaciones.length)];
}

// Ejecutar la generación de datos
generarDatos().catch(console.error);
