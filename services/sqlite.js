const fs = require('fs');
const path = require('path');
const { encryptString, decryptString, getKey } = require('../utils/crypto');

let db; // lazy

function optionalRequire(moduleName) {
  try {
    // Prefer better-sqlite3 for simplicity
    // eslint-disable-next-line import/no-dynamic-require, global-require
    return require(moduleName);
  } catch (_) {
    return null;
  }
}

function getDb() {
  if (db) return db;
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbFile = path.join(DATA_DIR, 'aira.db');

  const BetterSqlite3 = optionalRequire('better-sqlite3');
  if (!BetterSqlite3) {
    throw new Error('SQLITE_DRIVER_NOT_INSTALLED');
  }
  db = new BetterSqlite3(dbFile);
  db.pragma('journal_mode = WAL');
  // Init schema
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
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
      pacienteId INTEGER NOT NULL,
      notas TEXT,
      tipo TEXT,
      duracion INTEGER,
      medication_notes TEXT,
      mood_assessment INTEGER,
      requires_followup INTEGER,
      created_via TEXT,
      fecha TEXT,
      FOREIGN KEY(pacienteId) REFERENCES patients(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(name);
    CREATE INDEX IF NOT EXISTS idx_patients_dni ON patients(dni);
    CREATE INDEX IF NOT EXISTS idx_sessions_paciente ON sessions(pacienteId);
    CREATE INDEX IF NOT EXISTS idx_sessions_fecha ON sessions(fecha);
  `);
  return db;
}

function wrapEncrypt(value) {
  const key = getKey();
  if (!key) return JSON.stringify({ ct: null, iv: null, tag: null, raw: String(value || '') });
  const enc = encryptString(value || '');
  return JSON.stringify(enc);
}

function maybeDecrypt(jsonStr) {
  if (!jsonStr) return '';
  try {
    const obj = JSON.parse(jsonStr);
    if (obj && obj.ct && obj.iv) return decryptString(obj);
    if (obj && typeof obj.raw === 'string') return obj.raw;
    return '';
  } catch (_) { return ''; }
}

function listPatients() {
  const conn = getDb();
  const rows = conn.prepare('SELECT * FROM patients').all();
  return rows.map(r => ({
    id: String(r.id),
    name: r.name,
    dni: maybeDecrypt(r.dni),
    phone: maybeDecrypt(r.phone),
    email: r.email || '',
    insurance: r.insurance || '',
    habilitado: r.habilitado === 1,
    created_via: r.created_via || 'web',
    fechaRegistro: r.fechaRegistro || null,
  }));
}

function addPatient(p) {
  const conn = getDb();
  const now = new Date().toISOString().split('T')[0];
  const stmt = conn.prepare('INSERT INTO patients (name, dni, phone, email, insurance, habilitado, created_via, fechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(String(p.name || ''), wrapEncrypt(p.dni), wrapEncrypt(p.phone), String(p.email || ''), String(p.insurance || ''), (typeof p.habilitado === 'boolean' ? (p.habilitado ? 1 : 0) : 1), String(p.created_via || 'web'), now);
  return { id: String(info.lastInsertRowid), name: String(p.name || ''), dni: p.dni || '', phone: p.phone || '', email: String(p.email || ''), insurance: String(p.insurance || ''), habilitado: typeof p.habilitado === 'boolean' ? p.habilitado : true, created_via: p.created_via || 'web', fechaRegistro: now };
}

function updatePatient(id, changes) {
  const conn = getDb();
  const current = conn.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!current) return null;
  const next = { ...current };
  if (changes.name != null) next.name = String(changes.name);
  if (changes.email != null) next.email = String(changes.email);
  if (changes.insurance != null) next.insurance = String(changes.insurance);
  if (changes.habilitado != null) next.habilitado = changes.habilitado ? 1 : 0;
  if (changes.dni != null) next.dni = wrapEncrypt(changes.dni);
  if (changes.phone != null) next.phone = wrapEncrypt(changes.phone);
  const upd = conn.prepare('UPDATE patients SET name=?, dni=?, phone=?, email=?, insurance=?, habilitado=? WHERE id=?');
  upd.run(next.name, next.dni, next.phone, next.email, next.insurance, next.habilitado, id);
  return { id: String(id), name: next.name, dni: maybeDecrypt(next.dni), phone: maybeDecrypt(next.phone), email: next.email || '', insurance: next.insurance || '', habilitado: next.habilitado === 1 };
}

function deletePatient(id) {
  const conn = getDb();
  const old = conn.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!old) return null;
  conn.prepare('DELETE FROM patients WHERE id = ?').run(id);
  conn.prepare('DELETE FROM sessions WHERE pacienteId = ?').run(id);
  return old;
}

function listSessions() {
  const conn = getDb();
  return conn.prepare('SELECT * FROM sessions').all();
}

function addSession(s) {
  const conn = getDb();
  const now = new Date().toISOString().split('T')[0];
  const stmt = conn.prepare('INSERT INTO sessions (pacienteId, notas, tipo, duracion, medication_notes, mood_assessment, requires_followup, created_via, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(String(s.pacienteId), String(s.notas || ''), String(s.tipo || 'individual'), Number(s.duracion || 60), String(s.medication_notes || ''), Number(s.mood_assessment || 4), s.requires_followup ? 1 : 0, String(s.created_via || 'web'), now);
  return { id: String(info.lastInsertRowid), pacienteId: String(s.pacienteId), notas: String(s.notas || ''), tipo: String(s.tipo || 'individual'), duracion: Number(s.duracion || 60), medication_notes: String(s.medication_notes || ''), mood_assessment: Number(s.mood_assessment || 4), requires_followup: !!s.requires_followup, created_via: String(s.created_via || 'web'), fecha: now };
}

function updateSession(id, changes) {
  const conn = getDb();
  const current = conn.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
  if (!current) return null;
  const next = { ...current, ...changes };
  conn.prepare('UPDATE sessions SET pacienteId=?, notas=?, tipo=?, duracion=?, medication_notes=?, mood_assessment=?, requires_followup=? WHERE id=?')
      .run(String(next.pacienteId), String(next.notas || ''), String(next.tipo || 'individual'), Number(next.duracion || 60), String(next.medication_notes || ''), Number(next.mood_assessment || 4), next.requires_followup ? 1 : 0, id);
  return { ...next, id: String(id), requires_followup: !!next.requires_followup };
}

function deleteSession(id) {
  const conn = getDb();
  const info = conn.prepare('DELETE FROM sessions WHERE id = ?').run(id);
  return info.changes > 0;
}

module.exports = {
  listPatients,
  addPatient,
  updatePatient,
  deletePatient,
  listSessions,
  addSession,
  updateSession,
  deleteSession,
};


