#!/usr/bin/env node
/**
 * Benchmark DB - Mide rendimiento de queries críticas
 */

const path = require('path');
const fs = require('fs');

const ITERATIONS = 100;

async function main() {
  console.log('⏱️  AIRA Database Benchmark');
  console.log('===========================\n');

  const dataDir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const dbPath = path.join(dataDir, 'aira-test.db');
  
  if (!fs.existsSync(dbPath)) {
    console.error('❌ BD de prueba no encontrada. Ejecuta primero: node scripts/seed-test-data.js');
    process.exit(1);
  }

  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true });

  // Obtener estadísticas
  const stats = {
    users: db.prepare('SELECT COUNT(*) as c FROM users').get().c,
    patients: db.prepare('SELECT COUNT(*) as c FROM patients').get().c,
    sessions: db.prepare('SELECT COUNT(*) as c FROM sessions').get().c
  };
  
  console.log(`📊 Datos en BD:`);
  console.log(`   Usuarios: ${stats.users}`);
  console.log(`   Pacientes: ${stats.patients.toLocaleString()}`);
  console.log(`   Sesiones: ${stats.sessions.toLocaleString()}\n`);

  const results = [];

  // Helper para benchmark
  function benchmark(name, fn) {
    const times = [];
    
    // Warmup
    for (let i = 0; i < 5; i++) fn();
    
    // Measure
    for (let i = 0; i < ITERATIONS; i++) {
      const start = process.hrtime.bigint();
      fn();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1e6); // ms
    }
    
    times.sort((a, b) => a - b);
    const result = {
      name,
      min: times[0].toFixed(2),
      avg: (times.reduce((a, b) => a + b) / times.length).toFixed(2),
      p50: times[Math.floor(times.length * 0.5)].toFixed(2),
      p95: times[Math.floor(times.length * 0.95)].toFixed(2),
      p99: times[Math.floor(times.length * 0.99)].toFixed(2),
      max: times[times.length - 1].toFixed(2)
    };
    results.push(result);
    return result;
  }

  console.log(`🔬 Ejecutando benchmarks (${ITERATIONS} iteraciones cada uno)...\n`);

  // 1. Listar pacientes (paginado)
  const listPatients = db.prepare('SELECT * FROM patients WHERE userId = ? AND habilitado = 1 ORDER BY fechaRegistro DESC LIMIT 50 OFFSET 0');
  benchmark('Listar pacientes (50)', () => listPatients.all('50'));

  // 2. Listar pacientes con offset alto
  const listPatientsOffset = db.prepare('SELECT * FROM patients WHERE userId = ? AND habilitado = 1 ORDER BY fechaRegistro DESC LIMIT 50 OFFSET 300');
  benchmark('Listar pacientes (offset 300)', () => listPatientsOffset.all('50'));

  // 3. Contar pacientes
  const countPatients = db.prepare('SELECT COUNT(*) as c FROM patients WHERE userId = ? AND habilitado = 1');
  benchmark('Contar pacientes', () => countPatients.get('50'));

  // 4. Listar sesiones
  const listSessions = db.prepare('SELECT * FROM sessions WHERE userId = ? ORDER BY fecha DESC LIMIT 50 OFFSET 0');
  benchmark('Listar sesiones (50)', () => listSessions.all('50'));

  // 5. Listar sesiones por paciente
  const listSessionsByPatient = db.prepare('SELECT * FROM sessions WHERE userId = ? AND pacienteId = ? ORDER BY fecha DESC LIMIT 50');
  benchmark('Sesiones por paciente', () => listSessionsByPatient.all('50', 1000));

  // 6. Contar sesiones
  const countSessions = db.prepare('SELECT COUNT(*) as c FROM sessions WHERE userId = ?');
  benchmark('Contar sesiones', () => countSessions.get('50'));

  // 7. Buscar usuario por DNI
  const findUser = db.prepare('SELECT * FROM users WHERE dni = ?');
  benchmark('Buscar usuario (DNI)', () => findUser.get('user50'));

  // 8. Buscar paciente por ID
  const findPatient = db.prepare('SELECT * FROM patients WHERE id = ? AND userId = ?');
  benchmark('Buscar paciente (ID)', () => findPatient.get(10000, '50'));

  // Mostrar resultados
  console.log('📋 Resultados (tiempos en ms):');
  console.log('─'.repeat(85));
  console.log('Query'.padEnd(30) + 'Min'.padStart(8) + 'Avg'.padStart(8) + 'P50'.padStart(8) + 'P95'.padStart(8) + 'P99'.padStart(8) + 'Max'.padStart(8));
  console.log('─'.repeat(85));
  
  for (const r of results) {
    const status = parseFloat(r.p95) < 100 ? '✅' : parseFloat(r.p95) < 200 ? '⚠️' : '❌';
    console.log(
      `${status} ${r.name}`.padEnd(30) +
      r.min.padStart(8) +
      r.avg.padStart(8) +
      r.p50.padStart(8) +
      r.p95.padStart(8) +
      r.p99.padStart(8) +
      r.max.padStart(8)
    );
  }
  console.log('─'.repeat(85));

  // Resumen
  const passed = results.filter(r => parseFloat(r.p95) < 100).length;
  const warned = results.filter(r => parseFloat(r.p95) >= 100 && parseFloat(r.p95) < 200).length;
  const failed = results.filter(r => parseFloat(r.p95) >= 200).length;

  console.log(`\n📊 Resumen: ${passed} ✅ OK | ${warned} ⚠️ Lento | ${failed} ❌ Muy lento`);
  
  if (failed > 0) {
    console.log('\n⚠️  Hay queries que superan el límite de 200ms. Revisar índices.');
    process.exit(1);
  } else {
    console.log('\n✅ Todas las queries dentro de límites aceptables.');
  }

  db.close();
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});












