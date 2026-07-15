const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const { encryptString, decryptString, getKey } = require('../utils/crypto');
const { runMigrations } = require('../db/migrate');

const BCRYPT_ROUNDS = 10;

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
  db.pragma('foreign_keys = ON');
  runMigrations(db);
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

function listPatients(userId) {
  const conn = getDb();
  const rows = conn.prepare('SELECT * FROM patients WHERE userId = ?').all(userId);
  return rows.map(r => ({
    id: String(r.id),
    name: maybeDecrypt(r.name),
    dni: maybeDecrypt(r.dni),
    phone: maybeDecrypt(r.phone),
    email: maybeDecrypt(r.email),
    insurance: r.insurance || '',
    habilitado: r.habilitado === 1,
    created_via: r.created_via || 'web',
    fechaRegistro: r.fechaRegistro || null,
  }));
}

function addPatient(userId, p) {
  const conn = getDb();
  const now = new Date().toISOString().split('T')[0];
  const stmt = conn.prepare('INSERT INTO patients (userId, name, dni, phone, email, insurance, habilitado, created_via, fechaRegistro) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  
  // Encrypt sensitive fields
  const encName = wrapEncrypt(p.name);
  const encDni = wrapEncrypt(p.dni);
  const encPhone = wrapEncrypt(p.phone);
  const encEmail = wrapEncrypt(p.email);

  const info = stmt.run(userId, encName, encDni, encPhone, encEmail, String(p.insurance || ''), (typeof p.habilitado === 'boolean' ? (p.habilitado ? 1 : 0) : 1), String(p.created_via || 'web'), now);
  
  return { 
    id: String(info.lastInsertRowid), 
    name: String(p.name || ''), 
    dni: p.dni || '', 
    phone: p.phone || '', 
    email: String(p.email || ''), 
    insurance: String(p.insurance || ''), 
    habilitado: typeof p.habilitado === 'boolean' ? p.habilitado : true, 
    created_via: p.created_via || 'web', 
    fechaRegistro: now 
  };
}

function updatePatient(userId, id, changes) {
  const conn = getDb();
  const current = conn.prepare('SELECT * FROM patients WHERE id = ? AND userId = ?').get(id, userId);
  if (!current) return null;
  
  const next = { ...current };
  // Encrypt updates if present
  if (changes.name != null) next.name = wrapEncrypt(changes.name);
  if (changes.email != null) next.email = wrapEncrypt(changes.email);
  if (changes.dni != null) next.dni = wrapEncrypt(changes.dni);
  if (changes.phone != null) next.phone = wrapEncrypt(changes.phone);
  
  if (changes.insurance != null) next.insurance = String(changes.insurance);
  if (changes.habilitado != null) next.habilitado = changes.habilitado ? 1 : 0;

  const upd = conn.prepare('UPDATE patients SET name=?, dni=?, phone=?, email=?, insurance=?, habilitado=? WHERE id=? AND userId=?');
  upd.run(next.name, next.dni, next.phone, next.email, next.insurance, next.habilitado, id, userId);
  
  return { 
    id: String(id), 
    name: maybeDecrypt(next.name), 
    dni: maybeDecrypt(next.dni), 
    phone: maybeDecrypt(next.phone), 
    email: maybeDecrypt(next.email), 
    insurance: next.insurance || '', 
    habilitado: next.habilitado === 1 
  };
}

function deletePatient(userId, id) {
  const conn = getDb();
  const old = conn.prepare('SELECT * FROM patients WHERE id = ? AND userId = ?').get(id, userId);
  if (!old) return null;
  conn.prepare('DELETE FROM patients WHERE id = ? AND userId = ?').run(id, userId);
  conn.prepare('DELETE FROM sessions WHERE pacienteId = ? AND userId = ?').run(id, userId);
  return old;
}

function listSessions(userId) {
  const conn = getDb();
  return conn.prepare('SELECT * FROM sessions WHERE userId = ?').all(userId);
}

function addSession(userId, s) {
  const conn = getDb();
  const now = new Date().toISOString().split('T')[0];
  
  // Verify patient belongs to user
  const patient = conn.prepare('SELECT id FROM patients WHERE id = ? AND userId = ?').get(s.pacienteId, userId);
  if (!patient) {
    const error = new Error('Patient not found or access denied');
    error.code = 'PATIENT_NOT_FOUND';
    throw error;
  }

  const stmt = conn.prepare('INSERT INTO sessions (userId, pacienteId, notas, tipo, duracion, medication_notes, mood_assessment, requires_followup, created_via, fecha) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  const info = stmt.run(userId, String(s.pacienteId), String(s.notas || ''), String(s.tipo || 'individual'), Number(s.duracion || 60), String(s.medication_notes || ''), Number(s.mood_assessment || 4), s.requires_followup ? 1 : 0, String(s.created_via || 'web'), now);
  
  return { 
    id: String(info.lastInsertRowid), 
    pacienteId: String(s.pacienteId), 
    notas: String(s.notas || ''), 
    tipo: String(s.tipo || 'individual'), 
    duracion: Number(s.duracion || 60), 
    medication_notes: String(s.medication_notes || ''), 
    mood_assessment: Number(s.mood_assessment || 4), 
    requires_followup: !!s.requires_followup, 
    created_via: String(s.created_via || 'web'), 
    fecha: now 
  };
}

function updateSession(userId, id, changes) {
  const conn = getDb();
  const current = conn.prepare('SELECT * FROM sessions WHERE id = ? AND userId = ?').get(id, userId);
  if (!current) return null;
  
  const next = { ...current, ...changes };
  conn.prepare('UPDATE sessions SET pacienteId=?, notas=?, tipo=?, duracion=?, medication_notes=?, mood_assessment=?, requires_followup=? WHERE id=? AND userId=?')
      .run(String(next.pacienteId), String(next.notas || ''), String(next.tipo || 'individual'), Number(next.duracion || 60), String(next.medication_notes || ''), Number(next.mood_assessment || 4), next.requires_followup ? 1 : 0, id, userId);
  return { ...next, id: String(id), requires_followup: !!next.requires_followup };
}

function deleteSession(userId, id) {
  const conn = getDb();
  const info = conn.prepare('DELETE FROM sessions WHERE id = ? AND userId = ?').run(id, userId);
  return info.changes > 0;
}

// ===== USER FUNCTIONS =====

async function createUser(userData) {
  const conn = getDb();
  const { dni, pin, name, email, specialty } = userData;
  
  if (!dni || !pin || !name) {
    throw new Error('DNI, PIN y nombre son requeridos');
  }

  // Check if user already exists
  const existing = conn.prepare('SELECT id FROM users WHERE dni = ?').get(dni);
  if (existing) {
    throw new Error('USER_EXISTS');
  }

  // Hash the PIN
  const pinHash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
  const now = new Date().toISOString();

  const stmt = conn.prepare(
    'INSERT INTO users (dni, pin_hash, name, email, specialty, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  );
  const info = stmt.run(dni, pinHash, name, email || '', specialty || '', now);

  return {
    id: info.lastInsertRowid,
    dni,
    name,
    email: email || '',
    specialty: specialty || '',
    role: 'doctor'
  };
}

async function verifyUser(dni, pin) {
  const conn = getDb();
  
  const user = conn.prepare('SELECT * FROM users WHERE dni = ?').get(dni);
  if (!user) {
    return null;
  }

  // Verify PIN
  const isValid = await bcrypt.compare(pin, user.pin_hash);
  if (!isValid) {
    return null;
  }

  return {
    id: user.id,
    dni: user.dni,
    name: user.name,
    email: user.email,
    specialty: user.specialty,
    role: 'doctor'
  };
}

module.exports = {
  getDb,
  listPatients,
  addPatient,
  updatePatient,
  deletePatient,
  listSessions,
  addSession,
  updateSession,
  deleteSession,
  createUser,
  verifyUser,
};
