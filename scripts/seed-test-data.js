#!/usr/bin/env node
/**
 * Seed Test Data - Genera datos de prueba para testing de carga
 * 
 * Escala: 100 profesionales x 400 pacientes = 40,000 pacientes
 *         40,000 pacientes x 25 sesiones = 1,000,000 sesiones
 */

const path = require('path');
const fs = require('fs');

// Configuración
const CONFIG = {
  users: 100,           // Profesionales
  patientsPerUser: 400, // Pacientes por profesional
  sessionsPerPatient: 25, // Sesiones por paciente
  batchSize: 1000       // Insertar en lotes
};

// Nombres aleatorios
const FIRST_NAMES = ['Juan', 'María', 'Carlos', 'Ana', 'Pedro', 'Laura', 'Miguel', 'Sofía', 'Diego', 'Valentina', 'Andrés', 'Camila', 'Lucas', 'Isabella', 'Mateo', 'Emma', 'Santiago', 'Mía', 'Sebastián', 'Victoria'];
const LAST_NAMES = ['García', 'Rodríguez', 'Martínez', 'López', 'González', 'Hernández', 'Pérez', 'Sánchez', 'Ramírez', 'Torres', 'Flores', 'Rivera', 'Gómez', 'Díaz', 'Reyes', 'Morales', 'Cruz', 'Ortiz', 'Gutiérrez', 'Chávez'];
const SPECIALTIES = ['Psicología', 'Psiquiatría', 'Neuropsicología', 'Terapia Familiar', 'Terapia Cognitiva'];
const SESSION_TYPES = ['individual', 'grupal', 'familiar', 'pareja'];
const INSURANCES = ['OSDE', 'Swiss Medical', 'Galeno', 'Medicus', 'Particular', 'IOMA', 'PAMI'];

function randomItem(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomName() {
  return `${randomItem(FIRST_NAMES)} ${randomItem(LAST_NAMES)}`;
}

function randomDni() {
  return String(10000000 + Math.floor(Math.random() * 40000000));
}

function randomDate(startYear, endYear) {
  const start = new Date(startYear, 0, 1);
  const end = new Date(endYear, 11, 31);
  const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
  return date.toISOString().split('T')[0];
}

async function main() {
  console.log('🚀 AIRA Test Data Seeder');
  console.log('========================');
  console.log(`Config: ${CONFIG.users} users × ${CONFIG.patientsPerUser} patients × ${CONFIG.sessionsPerPatient} sessions`);
  console.log(`Total: ${CONFIG.users * CONFIG.patientsPerUser} patients, ${CONFIG.users * CONFIG.patientsPerUser * CONFIG.sessionsPerPatient} sessions`);
  console.log('');

  // Cargar SQLite
  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  
  const dbPath = path.join(dataDir, 'aira-test.db');
  
  // Eliminar BD de prueba anterior
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('🗑️  BD de prueba anterior eliminada');
  }

  const Database = require('better-sqlite3');
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = OFF'); // Más rápido para seeding
  
  // Crear esquema
  console.log('📦 Creando esquema...');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      dni TEXT UNIQUE NOT NULL,
      pin_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      specialty TEXT
    );
    
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      name TEXT NOT NULL,
      dni TEXT,
      phone TEXT,
      email TEXT,
      insurance TEXT,
      habilitado INTEGER NOT NULL DEFAULT 1,
      created_via TEXT,
      fechaRegistro TEXT
    );
    
    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId TEXT NOT NULL,
      pacienteId INTEGER NOT NULL,
      notas TEXT,
      tipo TEXT,
      duracion INTEGER,
      medication_notes TEXT,
      mood_assessment INTEGER,
      requires_followup INTEGER,
      created_via TEXT,
      fecha TEXT
    );
    
    CREATE INDEX idx_patients_userId ON patients(userId);
    CREATE INDEX idx_patients_userId_habilitado ON patients(userId, habilitado);
    CREATE INDEX idx_sessions_userId ON sessions(userId);
    CREATE INDEX idx_sessions_paciente ON sessions(pacienteId);
    CREATE INDEX idx_sessions_fecha ON sessions(fecha);
    CREATE INDEX idx_sessions_userId_fecha ON sessions(userId, fecha DESC);
  `);

  // Preparar statements
  const insertUser = db.prepare('INSERT INTO users (dni, pin_hash, name, email, specialty) VALUES (?, ?, ?, ?, ?)');
  const insertPatient = db.prepare('INSERT INTO patients (userId, name, dni, phone, email, insurance, habilitado, created_via, fechaRegistro) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)');
  const insertSession = db.prepare('INSERT INTO sessions (userId, pacienteId, notas, tipo, duracion, medication_notes, mood_assessment, requires_followup, created_via, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');

  const startTime = Date.now();

  // 1. Crear usuarios
  console.log(`\n👤 Creando ${CONFIG.users} usuarios...`);
  const insertUsers = db.transaction((count) => {
    for (let i = 1; i <= count; i++) {
      insertUser.run(
        `user${i}`,
        '$2b$10$placeholder', // PIN hasheado placeholder
        `Dr. ${randomName()}`,
        `doctor${i}@aira.com`,
        randomItem(SPECIALTIES)
      );
    }
  });
  insertUsers(CONFIG.users);
  console.log(`   ✅ ${CONFIG.users} usuarios creados`);

  // 2. Crear pacientes
  const totalPatients = CONFIG.users * CONFIG.patientsPerUser;
  console.log(`\n🏥 Creando ${totalPatients.toLocaleString()} pacientes...`);
  
  let patientCount = 0;
  const insertPatientsBatch = db.transaction((userId, count) => {
    for (let i = 0; i < count; i++) {
      insertPatient.run(
        String(userId),
        randomName(),
        randomDni(),
        `+54911${Math.floor(Math.random() * 90000000 + 10000000)}`,
        `patient${patientCount + i}@email.com`,
        randomItem(INSURANCES),
        'seed',
        randomDate(2022, 2024)
      );
    }
  });

  for (let userId = 1; userId <= CONFIG.users; userId++) {
    insertPatientsBatch(userId, CONFIG.patientsPerUser);
    patientCount += CONFIG.patientsPerUser;
    
    if (userId % 10 === 0) {
      const pct = Math.round((userId / CONFIG.users) * 100);
      process.stdout.write(`\r   ${pct}% - ${patientCount.toLocaleString()} pacientes...`);
    }
  }
  console.log(`\n   ✅ ${totalPatients.toLocaleString()} pacientes creados`);

  // 3. Crear sesiones
  const totalSessions = totalPatients * CONFIG.sessionsPerPatient;
  console.log(`\n📋 Creando ${totalSessions.toLocaleString()} sesiones...`);
  
  let sessionCount = 0;
  const insertSessionsBatch = db.transaction((userId, patientIds) => {
    for (const patientId of patientIds) {
      for (let s = 0; s < CONFIG.sessionsPerPatient; s++) {
        insertSession.run(
          String(userId),
          patientId,
          `Sesión de seguimiento. Paciente muestra progreso.`,
          randomItem(SESSION_TYPES),
          30 + Math.floor(Math.random() * 60), // 30-90 min
          Math.random() > 0.7 ? 'Medicación ajustada' : '',
          Math.floor(Math.random() * 5) + 1, // 1-5
          Math.random() > 0.8 ? 1 : 0,
          'seed',
          randomDate(2023, 2025)
        );
        sessionCount++;
      }
    }
  });

  // Obtener IDs de pacientes por usuario
  const getPatientIds = db.prepare('SELECT id FROM patients WHERE userId = ?');
  
  for (let userId = 1; userId <= CONFIG.users; userId++) {
    const patientIds = getPatientIds.all(String(userId)).map(r => r.id);
    insertSessionsBatch(userId, patientIds);
    
    if (userId % 10 === 0) {
      const pct = Math.round((userId / CONFIG.users) * 100);
      process.stdout.write(`\r   ${pct}% - ${sessionCount.toLocaleString()} sesiones...`);
    }
  }
  console.log(`\n   ✅ ${totalSessions.toLocaleString()} sesiones creadas`);

  // Estadísticas finales
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const dbSize = (fs.statSync(dbPath).size / 1024 / 1024).toFixed(2);
  
  console.log('\n📊 Estadísticas:');
  console.log(`   Tiempo: ${elapsed}s`);
  console.log(`   Tamaño BD: ${dbSize} MB`);
  console.log(`   Usuarios: ${db.prepare('SELECT COUNT(*) as c FROM users').get().c}`);
  console.log(`   Pacientes: ${db.prepare('SELECT COUNT(*) as c FROM patients').get().c.toLocaleString()}`);
  console.log(`   Sesiones: ${db.prepare('SELECT COUNT(*) as c FROM sessions').get().c.toLocaleString()}`);
  
  db.close();
  console.log(`\n✅ BD de prueba creada: ${dbPath}`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});












