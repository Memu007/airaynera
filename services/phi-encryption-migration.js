/**
 * HIPAA COMPLIANCE - PHI ENCRYPTION MIGRATION SERVICE
 *
 * CRITICAL: Migrates all existing Protected Health Information (PHI)
 * from plain text to AES-256-GCM field-level encryption.
 *
 * This is a ONE-TIME migration tool that ensures HIPAA compliance
 * by encrypting all existing patient and session data.
 *
 * BEFORE RUNNING: Ensure you have a complete backup of all data files
 */

const fs = require('fs');
const path = require('path');
const { encryptString, decryptString, getKey } = require('../utils/crypto');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
const PATIENTS_FILE = path.join(DATA_DIR, 'patients.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

// PHI fields that MUST be encrypted for HIPAA compliance
const PHI_FIELDS_PATIENTS = ['dni', 'phone', 'email', 'insurance', 'emergency_contact'];
const PHI_FIELDS_SESSIONS = ['notas', 'medication_notes', 'clinical_observations', 'treatment_plan'];

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
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

function encryptFieldValue(value) {
  if (!value || value === '') return value;

  // Check if already encrypted (has ct, iv, tag structure)
  if (value && typeof value === 'object' && value.ct && value.iv && value.tag) {
    return value; // Already encrypted
  }

  return encryptString(String(value));
}

function isFieldEncrypted(value) {
  return value && typeof value === 'object' && value.ct && value.iv && value.tag;
}

function migratePatientData() {
  console.log('🔐 Starting PHI migration for PATIENTS...');

  ensureDir();
  const patients = readJson(PATIENTS_FILE, []);

  if (patients.length === 0) {
    console.log('✅ No patients found - migration complete');
    return { migrated: 0, alreadyEncrypted: 0, total: 0 };
  }

  let migratedCount = 0;
  let alreadyEncryptedCount = 0;
  const updatedPatients = patients.map(patient => {
    const updatedPatient = { ...patient };
    let hasChanges = false;

    PHI_FIELDS_PATIENTS.forEach(field => {
      if (patient[field]) {
        if (isFieldEncrypted(patient[field])) {
          alreadyEncryptedCount++;
          console.log(`🔒 Patient ${patient.id} - ${field} already encrypted`);
        } else {
          updatedPatient[field] = encryptFieldValue(patient[field]);
          hasChanges = true;
          migratedCount++;
          console.log(`🔐 Patient ${patient.id} - encrypted ${field}`);
        }
      }
    });

    return hasChanges ? updatedPatient : patient;
  });

  if (migratedCount > 0) {
    writeJson(PATIENTS_FILE, updatedPatients);
    console.log(`✅ PATIENT migration complete: ${migratedCount} fields encrypted`);
  } else {
    console.log(`✅ PATIENT migration complete: ${alreadyEncryptedCount} fields already encrypted`);
  }

  return {
    migrated: migratedCount,
    alreadyEncrypted: alreadyEncryptedCount,
    total: patients.length
  };
}

function migrateSessionData() {
  console.log('🔐 Starting PHI migration for SESSIONS...');

  ensureDir();
  const sessions = readJson(SESSIONS_FILE, []);

  if (sessions.length === 0) {
    console.log('✅ No sessions found - migration complete');
    return { migrated: 0, alreadyEncrypted: 0, total: 0 };
  }

  let migratedCount = 0;
  let alreadyEncryptedCount = 0;
  const updatedSessions = sessions.map(session => {
    const updatedSession = { ...session };
    let hasChanges = false;

    PHI_FIELDS_SESSIONS.forEach(field => {
      if (session[field]) {
        if (isFieldEncrypted(session[field])) {
          alreadyEncryptedCount++;
          console.log(`🔒 Session ${session.id} - ${field} already encrypted`);
        } else {
          updatedSession[field] = encryptFieldValue(session[field]);
          hasChanges = true;
          migratedCount++;
          console.log(`🔐 Session ${session.id} - encrypted ${field}`);
        }
      }
    });

    return hasChanges ? updatedSession : session;
  });

  if (migratedCount > 0) {
    writeJson(SESSIONS_FILE, updatedSessions);
    console.log(`✅ SESSION migration complete: ${migratedCount} fields encrypted`);
  } else {
    console.log(`✅ SESSION migration complete: ${alreadyEncryptedCount} fields already encrypted`);
  }

  return {
    migrated: migratedCount,
    alreadyEncrypted: alreadyEncryptedCount,
    total: sessions.length
  };
}

function validateEncryption() {
  console.log('🔍 Validating encryption compliance...');

  ensureDir();
  const patients = readJson(PATIENTS_FILE, []);
  const sessions = readJson(SESSIONS_FILE, []);

  let issues = [];

  // Validate patient encryption
  patients.forEach(patient => {
    PHI_FIELDS_PATIENTS.forEach(field => {
      if (patient[field] && !isFieldEncrypted(patient[field])) {
        issues.push(`Patient ${patient.id} - ${field} NOT ENCRYPTED`);
      }
    });
  });

  // Validate session encryption
  sessions.forEach(session => {
    PHI_FIELDS_SESSIONS.forEach(field => {
      if (session[field] && !isFieldEncrypted(session[field])) {
        issues.push(`Session ${session.id} - ${field} NOT ENCRYPTED`);
      }
    });
  });

  if (issues.length > 0) {
    console.log('❌ ENCRYPTION VALIDATION FAILED:');
    issues.forEach(issue => console.log(`  - ${issue}`));
    return false;
  } else {
    console.log('✅ All PHI fields properly encrypted - HIPAA compliant');
    return true;
  }
}

function runFullMigration() {
  console.log('🚨 STARTING HIPAA PHI ENCRYPTION MIGRATION 🚨');
  console.log('This will encrypt all Protected Health Information with AES-256-GCM');
  console.log('');

  // Check encryption key availability
  const key = getKey();
  if (!key) {
    console.log('❌ ERROR: No encryption key found. Set DATA_KEY environment variable.');
    console.log('Run: export DATA_KEY=$(openssl rand -hex 32)');
    return false;
  }

  console.log(`✅ Encryption key found (${key.length} bytes)`);
  console.log('');

  // Create backup before migration
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(DATA_DIR, `backups`, `pre-migration-${timestamp}`);

  if (!fs.existsSync(path.join(DATA_DIR, 'backups'))) {
    fs.mkdirSync(path.join(DATA_DIR, 'backups'), { recursive: true });
  }
  fs.mkdirSync(backupDir, { recursive: true });

  if (fs.existsSync(PATIENTS_FILE)) {
    fs.copyFileSync(PATIENTS_FILE, path.join(backupDir, 'patients.json'));
    console.log(`📋 Backup created: patients.json`);
  }

  if (fs.existsSync(SESSIONS_FILE)) {
    fs.copyFileSync(SESSIONS_FILE, path.join(backupDir, 'sessions.json'));
    console.log(`📋 Backup created: sessions.json`);
  }

  console.log(`📁 Backup directory: ${backupDir}`);
  console.log('');

  // Run migrations
  const patientResults = migratePatientData();
  console.log('');

  const sessionResults = migrateSessionData();
  console.log('');

  // Validate encryption
  const isValid = validateEncryption();
  console.log('');

  // Summary report
  console.log('📊 MIGRATION SUMMARY:');
  console.log(`  Patients: ${patientResults.migrated} migrated, ${patientResults.alreadyEncrypted} already encrypted, ${patientResults.total} total`);
  console.log(`  Sessions: ${sessionResults.migrated} migrated, ${sessionResults.alreadyEncrypted} already encrypted, ${sessionResults.total} total`);
  console.log(`  Status: ${isValid ? '✅ HIPAA COMPLIANT' : '❌ COMPLIANCE ISSUES'}`);
  console.log(`  Backup: ${backupDir}`);

  return isValid;
}

// Command line interface
if (require.main === module) {
  const command = process.argv[2];

  switch (command) {
    case 'validate':
      validateEncryption();
      break;
    case 'patients':
      migratePatientData();
      break;
    case 'sessions':
      migrateSessionData();
      break;
    case 'all':
    default:
      runFullMigration();
      break;
  }
}

module.exports = {
  runFullMigration,
  migratePatientData,
  migrateSessionData,
  validateEncryption,
  PHI_FIELDS_PATIENTS,
  PHI_FIELDS_SESSIONS
};