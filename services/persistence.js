const fs = require('fs');
const path = require('path');
const { encryptString, decryptString, getKey } = require('../utils/crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function wrapEncrypt(value) {
  const key = getKey();
  if (!key) return value; // no encryption configured
  return encryptString(value);
}

function wrapDecrypt(value) {
  const key = getKey();
  if (!key) return value;
  // if field is encrypted object, decrypt; otherwise return as is
  try {
    if (value && typeof value === 'object' && value.ct && value.iv) {
      return decryptString(value);
    }
  } catch (_) {}
  return value;
}

function readJson(file, fallback) {
  try {
    const buf = fs.readFileSync(file, 'utf8');
    const data = JSON.parse(buf);
    return Array.isArray(data) ? data : fallback;
  } catch (_) {
    return fallback;
  }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
}

function listPatients() {
  ensureDir();
  const arr = readJson(PATIENTS_FILE, []);
  return arr.map(p => ({
    ...p,
    dni: wrapDecrypt(p.dni),
    phone: wrapDecrypt(p.phone),
    email: wrapDecrypt(p.email),
    insurance: wrapDecrypt(p.insurance),
    emergency_contact: wrapDecrypt(p.emergency_contact),
  }));
}

function addPatient(p) {
  ensureDir();
  const arr = readJson(PATIENTS_FILE, []);
  const nextId = String(arr.length + 1);
  const toStore = {
    id: nextId,
    name: String(p.name || ''),
    dni: wrapEncrypt(p.dni || ''),
    phone: wrapEncrypt(p.phone || ''),
    email: wrapEncrypt(p.email || ''),
    insurance: wrapEncrypt(p.insurance || ''),
    emergency_contact: wrapEncrypt(p.emergency_contact || ''),
    habilitado: typeof p.habilitado === 'boolean' ? p.habilitado : true,
    created_via: p.created_via || 'web',
    fechaRegistro: new Date().toISOString().split('T')[0],
  };
  arr.push(toStore);
  writeJson(PATIENTS_FILE, arr);
  return {
    ...toStore,
    dni: p.dni || '',
    phone: p.phone || '',
    email: p.email || '',
    insurance: p.insurance || '',
    emergency_contact: p.emergency_contact || ''
  };
}

function updatePatient(id, changes) {
  ensureDir();
  const arr = readJson(PATIENTS_FILE, []);
  const idx = arr.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return null;
  const curr = arr[idx];
  const updated = { ...curr };
  if (changes.name != null) updated.name = String(changes.name);
  if (changes.email != null) updated.email = wrapEncrypt(changes.email);
  if (changes.insurance != null) updated.insurance = wrapEncrypt(changes.insurance);
  if (changes.emergency_contact != null) updated.emergency_contact = wrapEncrypt(changes.emergency_contact);
  if (changes.habilitado != null) updated.habilitado = Boolean(changes.habilitado);
  if (changes.dni != null) updated.dni = wrapEncrypt(changes.dni);
  if (changes.phone != null) updated.phone = wrapEncrypt(changes.phone);
  arr[idx] = updated;
  writeJson(PATIENTS_FILE, arr);
  return {
    ...updated,
    dni: wrapDecrypt(updated.dni),
    phone: wrapDecrypt(updated.phone),
    email: wrapDecrypt(updated.email),
    insurance: wrapDecrypt(updated.insurance),
    emergency_contact: wrapDecrypt(updated.emergency_contact)
  };
}

function deletePatient(id) {
  ensureDir();
  const arr = readJson(PATIENTS_FILE, []);
  const idx = arr.findIndex(p => String(p.id) === String(id));
  if (idx === -1) return null;
  const removed = arr.splice(idx, 1)[0];
  writeJson(PATIENTS_FILE, arr);
  // Cascade delete sessions for this patient
  const sessions = readJson(SESSIONS_FILE, []);
  const filtered = sessions.filter(s => String(s.pacienteId || s.patient_id) !== String(id));
  writeJson(SESSIONS_FILE, filtered);
  return removed;
}

function listSessions() {
  ensureDir();
  const arr = readJson(SESSIONS_FILE, []);
  return arr.map(s => ({
    ...s,
    notas: wrapDecrypt(s.notas),
    medication_notes: wrapDecrypt(s.medication_notes),
    clinical_observations: wrapDecrypt(s.clinical_observations),
    treatment_plan: wrapDecrypt(s.treatment_plan),
  }));
}

function addSession(s) {
  ensureDir();
  const arr = readJson(SESSIONS_FILE, []);
  const nextId = String(arr.length + 1);
  const toStore = {
    id: nextId,
    pacienteId: String(s.pacienteId),
    notas: wrapEncrypt(s.notas || ''),
    tipo: s.tipo || 'individual',
    duracion: Number(s.duracion || 60),
    medication_notes: wrapEncrypt(s.medication_notes || ''),
    clinical_observations: wrapEncrypt(s.clinical_observations || ''),
    treatment_plan: wrapEncrypt(s.treatment_plan || ''),
    mood_assessment: s.mood_assessment || 4,
    requires_followup: Boolean(s.requires_followup) || false,
    created_via: s.created_via || 'web',
    fecha: new Date().toISOString().split('T')[0]
  };
  arr.push(toStore);
  writeJson(SESSIONS_FILE, arr);
  return {
    ...toStore,
    notas: s.notas || '',
    medication_notes: s.medication_notes || '',
    clinical_observations: s.clinical_observations || '',
    treatment_plan: s.treatment_plan || ''
  };
}

function updateSession(id, changes) {
  ensureDir();
  const arr = readJson(SESSIONS_FILE, []);
  const idx = arr.findIndex(s => String(s.id) === String(id));
  if (idx === -1) return null;
  const curr = arr[idx];
  const allowed = ['pacienteId', 'notas', 'tipo', 'duracion', 'mood_assessment', 'requires_followup', 'medication_notes', 'clinical_observations', 'treatment_plan'];
  const updated = { ...curr };
  for (const k of Object.keys(changes || {})) {
    if (allowed.includes(k)) {
      // PHI fields must be encrypted
      if (['notas', 'medication_notes', 'clinical_observations', 'treatment_plan'].includes(k)) {
        updated[k] = wrapEncrypt(changes[k]);
      } else {
        updated[k] = changes[k];
      }
    }
  }
  arr[idx] = updated;
  writeJson(SESSIONS_FILE, arr);
  return {
    ...updated,
    notas: wrapDecrypt(updated.notas),
    medication_notes: wrapDecrypt(updated.medication_notes),
    clinical_observations: wrapDecrypt(updated.clinical_observations),
    treatment_plan: wrapDecrypt(updated.treatment_plan),
  };
}

function deleteSession(id) {
  ensureDir();
  const arr = readJson(SESSIONS_FILE, []);
  const before = arr.length;
  const filtered = arr.filter(s => String(s.id) !== String(id));
  if (filtered.length === before) return false;
  writeJson(SESSIONS_FILE, filtered);
  return true;
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


