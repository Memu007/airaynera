const fs = require('fs');
const path = require('path');
const crypto = require('node:crypto');
const { clinicalDateKey } = require('../utils/clinicalDate');
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
  db.pragma('busy_timeout = 5000');
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

function timestampFromDate(date) {
  return date ? `${date}T12:00:00.000Z` : null;
}

function mapSessionRow(row) {
  if (!row) return null;
  return {
    ...row,
    id: String(row.id),
    pacienteId: String(row.pacienteId),
    patientName: maybeDecrypt(row.patient_name),
    requires_followup: row.requires_followup === 1,
  };
}

function mapSessionDraftRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    patientId: String(row.patient_id),
    patientName: maybeDecrypt(row.patient_name),
    clinicalDate: row.clinical_date,
    sessionType: row.session_type || 'individual',
    durationMinutes: row.duration_minutes == null ? null : Number(row.duration_minutes),
    careModality: row.care_modality || 'unspecified',
    source: row.source,
    inputType: row.input_type,
    status: row.status,
    rawTranscript: row.raw_transcript || null,
    cleanNote: row.clean_note || '',
    medicationNotes: row.medication_notes || null,
    moodAssessment: row.mood_assessment == null ? null : Number(row.mood_assessment),
    requiresFollowUp: row.requires_follow_up === 1,
    audioDurationSeconds: row.audio_duration_seconds == null ? null : Number(row.audio_duration_seconds),
    sourceMessageId: row.source_message_id || null,
    mediaReference: row.media_reference || null,
    mediaMimeType: row.media_mime_type || null,
    inputFingerprint: row.input_fingerprint || null,
    mediaSizeBytes: row.media_size_bytes == null ? null : Number(row.media_size_bytes),
    mediaSha256: row.media_sha256 || null,
    mediaExpiresAt: row.media_expires_at || null,
    mediaDeletedAt: row.media_deleted_at || null,
    processingAttempts: Number(row.processing_attempts || 0),
    failedStage: row.failed_stage || null,
    processingStartedAt: row.processing_started_at || null,
    processingFinishedAt: row.processing_finished_at || null,
    sessionId: row.session_id == null ? null : String(row.session_id),
    failure: row.error_code || row.error_message
      ? { code: row.error_code || 'PROCESSING_FAILED', message: row.error_message || '' }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    confirmedAt: row.confirmed_at || null,
  };
}

function mapAudioProcessingJobRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    draftId: String(row.draft_id),
    status: row.status,
    attempts: Number(row.attempts || 0),
    availableAt: row.available_at,
    leaseOwner: row.lease_owner || null,
    leaseToken: row.lease_token || null,
    leaseExpiresAt: row.lease_expires_at || null,
    failure: row.error_code || row.error_message
      ? { code: row.error_code || 'AUDIO_JOB_FAILED', message: row.error_message || '' }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    finishedAt: row.finished_at || null,
  };
}

function getSessionDraftRow(connection, userId, id) {
  return connection.prepare(`
    SELECT d.*, p.name AS patient_name
    FROM session_drafts d
    INNER JOIN patients p ON p.id = d.patient_id AND p.userId = d.user_id
    WHERE d.id = ? AND d.user_id = ?
  `).get(id, userId);
}

function listPatients(userId) {
  const conn = getDb();
  const rows = conn.prepare(`
    SELECT p.*, COUNT(s.id) AS total_sessions,
      MAX(COALESCE(s.clinical_date, s.fecha)) AS last_session_date
    FROM patients p
    LEFT JOIN sessions s ON s.pacienteId = p.id AND s.userId = p.userId
    WHERE p.userId = ?
    GROUP BY p.id
    ORDER BY p.id DESC
  `).all(userId);
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
    created_at: r.created_at || timestampFromDate(r.fechaRegistro),
    updated_at: r.updated_at || r.created_at || timestampFromDate(r.fechaRegistro),
    last_session_date: r.last_session_date || null,
    total_sessions: Number(r.total_sessions || 0),
  }));
}

function addPatient(userId, p) {
  const conn = getDb();
  const now = clinicalDateKey();
  const timestamp = new Date().toISOString();
  const stmt = conn.prepare('INSERT INTO patients (userId, name, dni, phone, email, insurance, habilitado, created_via, fechaRegistro, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
  
  // Encrypt sensitive fields
  const encName = wrapEncrypt(p.name);
  const encDni = wrapEncrypt(p.dni);
  const encPhone = wrapEncrypt(p.phone);
  const encEmail = wrapEncrypt(p.email);

  const info = stmt.run(userId, encName, encDni, encPhone, encEmail, String(p.insurance || ''), (typeof p.habilitado === 'boolean' ? (p.habilitado ? 1 : 0) : 1), String(p.created_via || 'web'), now, timestamp, timestamp);
  
  return { 
    id: String(info.lastInsertRowid), 
    name: String(p.name || ''), 
    dni: p.dni || '', 
    phone: p.phone || '', 
    email: String(p.email || ''), 
    insurance: String(p.insurance || ''), 
    habilitado: typeof p.habilitado === 'boolean' ? p.habilitado : true, 
    created_via: p.created_via || 'web', 
    fechaRegistro: now,
    created_at: timestamp,
    updated_at: timestamp,
    last_session_date: null,
    total_sessions: 0,
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
  next.updated_at = new Date().toISOString();

  const upd = conn.prepare('UPDATE patients SET name=?, dni=?, phone=?, email=?, insurance=?, habilitado=?, updated_at=? WHERE id=? AND userId=?');
  upd.run(next.name, next.dni, next.phone, next.email, next.insurance, next.habilitado, next.updated_at, id, userId);
  
  return { 
    id: String(id), 
    name: maybeDecrypt(next.name), 
    dni: maybeDecrypt(next.dni), 
    phone: maybeDecrypt(next.phone), 
    email: maybeDecrypt(next.email), 
    insurance: next.insurance || '', 
    habilitado: next.habilitado === 1,
    created_via: next.created_via || 'web',
    fechaRegistro: next.fechaRegistro || null,
    created_at: next.created_at || timestampFromDate(next.fechaRegistro),
    updated_at: next.updated_at,
    last_session_date: null,
    total_sessions: 0,
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
  return conn.prepare(`
    SELECT s.*, p.name AS patient_name
    FROM sessions s
    INNER JOIN patients p ON p.id = s.pacienteId AND p.userId = s.userId
    WHERE s.userId = ?
    ORDER BY COALESCE(s.clinical_date, s.fecha) DESC, s.id DESC
  `).all(userId).map(mapSessionRow);
}

function getSessionById(userId, id) {
  const conn = getDb();
  return mapSessionRow(conn.prepare(`
    SELECT s.*, p.name AS patient_name
    FROM sessions s
    INNER JOIN patients p ON p.id = s.pacienteId AND p.userId = s.userId
    WHERE s.id = ? AND s.userId = ?
  `).get(id, userId));
}

function addSession(userId, s) {
  const conn = getDb();
  const timestamp = new Date().toISOString();
  const today = clinicalDateKey();
  
  // New sessions can only be created for active patients owned by the user.
  if (!activePatientExists(userId, s.pacienteId)) {
    const error = new Error('Patient not found or access denied');
    error.code = 'PATIENT_NOT_FOUND';
    throw error;
  }

  const clinicalDate = String(s.clinicalDate || s.fecha || today);
  const cleanNote = String(s.cleanNote ?? s.notas ?? '');
  const sessionType = String(s.sessionType || s.tipo || 'individual');
  const durationValue = s.durationMinutes !== undefined
    ? s.durationMinutes
    : (s.duracion ?? 60);
  const durationMinutes = durationValue == null ? null : Number(durationValue);
  const medicationNotes = String(s.medicationNotes ?? s.medication_notes ?? '');
  const moodValue = s.moodAssessment !== undefined
    ? s.moodAssessment
    : (s.mood_assessment ?? 4);
  const moodAssessment = moodValue == null ? null : Number(moodValue);
  const requiresFollowUp = Boolean(s.requiresFollowUp ?? s.requires_followup ?? false);
  const source = String(s.source || s.created_via || 'web');
  const inputType = String(s.inputType || (s.rawTranscript ? 'audio' : 'text'));
  const rawTranscript = s.rawTranscript == null ? null : String(s.rawTranscript);
  const audioDurationSeconds = s.audioDurationSeconds == null ? null : Number(s.audioDurationSeconds);
  const careModality = String(s.careModality || 'unspecified');
  const draftId = s.draftId == null ? null : Number(s.draftId);

  const stmt = conn.prepare(`
    INSERT INTO sessions (
      userId, pacienteId, notas, tipo, duracion, medication_notes,
      mood_assessment, requires_followup, created_via, fecha,
      clinical_date, clean_note, raw_transcript, input_type,
      audio_duration_seconds, care_modality, draft_id, status,
      created_at, updated_at, confirmed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, ?, ?)
  `);
  const info = stmt.run(
    userId, String(s.pacienteId), cleanNote, sessionType, durationMinutes,
    medicationNotes, moodAssessment, requiresFollowUp ? 1 : 0, source,
    clinicalDate, clinicalDate, cleanNote, rawTranscript, inputType,
    audioDurationSeconds, careModality, draftId, timestamp, timestamp, timestamp
  );

  return getSessionById(userId, info.lastInsertRowid);
}

function updateSession(userId, id, changes) {
  const conn = getDb();
  const current = conn.prepare('SELECT * FROM sessions WHERE id = ? AND userId = ?').get(id, userId);
  if (!current) return null;

  const patientId = String(changes.pacienteId ?? current.pacienteId);
  const patient = conn.prepare('SELECT id FROM patients WHERE id = ? AND userId = ?').get(patientId, userId);
  if (!patient) {
    const error = new Error('Patient not found or access denied');
    error.code = 'PATIENT_NOT_FOUND';
    throw error;
  }

  const cleanNote = String(changes.cleanNote ?? changes.notas ?? current.clean_note ?? current.notas ?? '');
  const sessionType = String(changes.sessionType ?? changes.tipo ?? current.tipo ?? 'individual');
  const clinicalDate = String(changes.clinicalDate ?? current.clinical_date ?? current.fecha);
  const durationValue = changes.durationMinutes !== undefined
    ? changes.durationMinutes
    : (changes.duracion !== undefined ? changes.duracion : current.duracion);
  const durationMinutes = durationValue == null ? null : Number(durationValue);
  // Distinguish "not provided" (keep current) from an explicit clear (persist NULL).
  let medicationValue;
  if (changes.medicationNotes !== undefined) medicationValue = changes.medicationNotes;
  else if (changes.medication_notes !== undefined) medicationValue = changes.medication_notes;
  else medicationValue = current.medication_notes;
  const medicationNotes =
    medicationValue == null || String(medicationValue).trim() === ''
      ? null
      : String(medicationValue);
  const moodValue = changes.moodAssessment !== undefined
    ? changes.moodAssessment
    : (changes.mood_assessment !== undefined ? changes.mood_assessment : current.mood_assessment);
  const moodAssessment = moodValue == null ? null : Number(moodValue);
  const requiresFollowUp = Boolean(changes.requiresFollowUp ?? changes.requires_followup ?? current.requires_followup);
  const rawTranscript = changes.rawTranscript === undefined ? current.raw_transcript : changes.rawTranscript;
  const inputType = String(changes.inputType ?? current.input_type ?? 'text');
  const audioDurationSeconds = changes.audioDurationSeconds === undefined ? current.audio_duration_seconds : changes.audioDurationSeconds;
  const careModality = String(changes.careModality ?? current.care_modality ?? 'unspecified');
  const updatedAt = new Date().toISOString();

  conn.prepare(`
    UPDATE sessions SET
      pacienteId=?, notas=?, clean_note=?, tipo=?, fecha=?, clinical_date=?,
      duracion=?, medication_notes=?, mood_assessment=?, requires_followup=?,
      raw_transcript=?, input_type=?, audio_duration_seconds=?, care_modality=?, updated_at=?
    WHERE id=? AND userId=?
  `).run(
    patientId, cleanNote, cleanNote, sessionType, clinicalDate, clinicalDate,
    durationMinutes, medicationNotes, moodAssessment, requiresFollowUp ? 1 : 0,
    rawTranscript, inputType, audioDurationSeconds, careModality, updatedAt, id, userId
  );
  return getSessionById(userId, id);
}

function deleteSession(userId, id) {
  const conn = getDb();
  const info = conn.prepare('DELETE FROM sessions WHERE id = ? AND userId = ?').run(id, userId);
  return info.changes > 0;
}

// ===== SESSION DRAFT FUNCTIONS =====

function patientExists(userId, patientId) {
  const conn = getDb();
  return Boolean(
    conn.prepare('SELECT id FROM patients WHERE id = ? AND userId = ?').get(patientId, userId)
  );
}

function activePatientExists(userId, patientId) {
  const conn = getDb();
  return Boolean(
    conn.prepare(`
      SELECT id FROM patients
      WHERE id = ? AND userId = ? AND habilitado = 1
    `).get(patientId, userId)
  );
}

function getSessionDraft(userId, id) {
  return mapSessionDraftRow(getSessionDraftRow(getDb(), userId, id));
}

function getSessionDraftBySourceMessage(userId, source, sourceMessageId) {
  if (!sourceMessageId) return null;
  const conn = getDb();
  const row = conn.prepare(`
    SELECT d.*, p.name AS patient_name
    FROM session_drafts d
    INNER JOIN patients p ON p.id = d.patient_id AND p.userId = d.user_id
    WHERE d.user_id = ? AND d.source = ? AND d.source_message_id = ?
  `).get(userId, source, sourceMessageId);
  return mapSessionDraftRow(row);
}

function listSessionDrafts(userId, filters = {}) {
  const conn = getDb();
  const clauses = ['d.user_id = ?'];
  const values = [userId];

  if (filters.status) {
    clauses.push('d.status = ?');
    values.push(filters.status);
  }
  if (filters.patientId) {
    clauses.push('d.patient_id = ?');
    values.push(filters.patientId);
  }

  return conn.prepare(`
    SELECT d.*, p.name AS patient_name
    FROM session_drafts d
    INNER JOIN patients p ON p.id = d.patient_id AND p.userId = d.user_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY d.created_at DESC, d.id DESC
  `).all(...values).map(mapSessionDraftRow);
}

function addSessionDraft(userId, draft) {
  const conn = getDb();
  const existing = getSessionDraftBySourceMessage(
    userId,
    draft.source,
    draft.sourceMessageId
  );
  if (existing) return { draft: existing, created: false };

  if (!activePatientExists(userId, draft.patientId)) {
    const error = new Error('Patient not found or access denied');
    error.code = 'PATIENT_NOT_FOUND';
    throw error;
  }

  const now = new Date().toISOString();
  const info = conn.prepare(`
    INSERT INTO session_drafts (
      user_id, patient_id, clinical_date, session_type, duration_minutes,
      care_modality, source, input_type, status, raw_transcript, clean_note,
      medication_notes, mood_assessment, requires_follow_up,
      audio_duration_seconds, source_message_id, media_reference, media_mime_type,
      input_fingerprint, media_size_bytes, media_sha256, media_expires_at,
      media_deleted_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    userId,
    draft.patientId,
    draft.clinicalDate,
    draft.sessionType,
    draft.durationMinutes,
    draft.careModality,
    draft.source,
    draft.inputType,
    draft.status,
    draft.rawTranscript,
    draft.cleanNote,
    draft.medicationNotes,
    draft.moodAssessment,
    draft.requiresFollowUp ? 1 : 0,
    draft.audioDurationSeconds,
    draft.sourceMessageId,
    draft.mediaReference,
    draft.mediaMimeType,
    draft.inputFingerprint,
    draft.mediaSizeBytes,
    draft.mediaSha256,
    draft.mediaExpiresAt,
    draft.mediaDeletedAt,
    now,
    now
  );

  return {
    draft: getSessionDraft(userId, info.lastInsertRowid),
    created: true,
  };
}

function getAudioProcessingJob(userId, draftId) {
  const row = getDb().prepare(`
    SELECT * FROM audio_processing_jobs
    WHERE user_id = ? AND draft_id = ?
  `).get(userId, draftId);
  return mapAudioProcessingJobRow(row);
}

function addSessionDraftWithAudioJob(userId, draft) {
  const conn = getDb();
  const create = conn.transaction(() => {
    const result = addSessionDraft(userId, draft);
    if (!result.created) {
      return { ...result, job: getAudioProcessingJob(userId, result.draft.id) };
    }

    const now = new Date().toISOString();
    conn.prepare(`
      INSERT INTO audio_processing_jobs (
        user_id, draft_id, status, attempts, available_at, created_at, updated_at
      ) VALUES (?, ?, 'queued', 0, ?, ?, ?)
    `).run(userId, result.draft.id, now, now, now);

    return {
      ...result,
      job: getAudioProcessingJob(userId, result.draft.id),
    };
  });
  return create.immediate();
}

function ensureAudioProcessingJob(userId, draftId) {
  const existing = getAudioProcessingJob(userId, draftId);
  if (existing) return existing;
  const now = new Date().toISOString();
  try {
    getDb().prepare(`
      INSERT INTO audio_processing_jobs (
        user_id, draft_id, status, attempts, available_at, created_at, updated_at
      ) VALUES (?, ?, 'queued', 0, ?, ?, ?)
    `).run(userId, draftId, now, now, now);
  } catch (error) {
    if (!String(error.code || '').startsWith('SQLITE_CONSTRAINT')) throw error;
  }
  return getAudioProcessingJob(userId, draftId);
}

function claimNextAudioProcessingJob(workerId, leaseMs, nowValue = new Date()) {
  const conn = getDb();
  const now = new Date(nowValue).toISOString();
  const leaseExpiresAt = new Date(new Date(nowValue).getTime() + leaseMs).toISOString();
  const hasEligibleJob = conn.prepare(`
    SELECT 1 FROM audio_processing_jobs
    WHERE (status='queued' AND available_at <= ?)
      OR (status='running' AND lease_expires_at <= ?)
    LIMIT 1
  `).get(now, now);
  if (!hasEligibleJob) return null;
  const claim = conn.transaction(() => {
    conn.prepare(`
      UPDATE audio_processing_jobs SET
        status='queued', lease_owner=NULL, lease_token=NULL, lease_expires_at=NULL,
        updated_at=?
      WHERE status='running' AND lease_expires_at <= ?
    `).run(now, now);

    const candidate = conn.prepare(`
      SELECT id FROM audio_processing_jobs
      WHERE status='queued' AND available_at <= ?
      ORDER BY available_at, id
      LIMIT 1
    `).get(now);
    if (!candidate) return null;

    const leaseToken = crypto.randomUUID();
    const info = conn.prepare(`
      UPDATE audio_processing_jobs SET
        status='running', attempts=attempts+1, lease_owner=?, lease_token=?,
        lease_expires_at=?, error_code=NULL, error_message=NULL, updated_at=?
      WHERE id=? AND status='queued'
    `).run(workerId, leaseToken, leaseExpiresAt, now, candidate.id);
    if (!info.changes) return null;
    return mapAudioProcessingJobRow(
      conn.prepare('SELECT * FROM audio_processing_jobs WHERE id = ?').get(candidate.id)
    );
  });
  return claim.immediate();
}

function renewAudioProcessingJob(jobId, workerId, leaseToken, leaseMs, nowValue = new Date()) {
  const now = new Date(nowValue).toISOString();
  const leaseExpiresAt = new Date(new Date(nowValue).getTime() + leaseMs).toISOString();
  const info = getDb().prepare(`
    UPDATE audio_processing_jobs SET lease_expires_at=?, updated_at=?
    WHERE id=? AND status='running' AND lease_owner=? AND lease_token=?
  `).run(leaseExpiresAt, now, jobId, workerId, leaseToken);
  return info.changes === 1;
}

function finishAudioProcessingJob(jobId, workerId, leaseToken, result) {
  const now = new Date().toISOString();
  const status = result.status;
  const info = getDb().prepare(`
    UPDATE audio_processing_jobs SET
      status=?, error_code=?, error_message=?, finished_at=?, updated_at=?,
      lease_owner=NULL, lease_token=NULL, lease_expires_at=NULL
    WHERE id=? AND status='running' AND lease_owner=? AND lease_token=?
  `).run(
    status,
    result.errorCode || null,
    result.errorMessage || null,
    now,
    now,
    jobId,
    workerId,
    leaseToken
  );
  return info.changes === 1;
}

function requeueAudioProcessingJob(userId, draftId, nowValue = new Date()) {
  const now = new Date(nowValue).toISOString();
  const info = getDb().prepare(`
    UPDATE audio_processing_jobs SET
      status='queued', available_at=?, error_code=NULL, error_message=NULL,
      lease_owner=NULL, lease_token=NULL, lease_expires_at=NULL,
      finished_at=NULL, updated_at=?
    WHERE user_id=? AND draft_id=? AND (
      status IN ('queued', 'failed')
      OR (status='running' AND lease_expires_at <= ?)
    )
  `).run(now, now, userId, draftId, now);
  if (!info.changes) return getAudioProcessingJob(userId, draftId);
  return getAudioProcessingJob(userId, draftId);
}

function cancelAudioProcessingJob(userId, draftId) {
  const now = new Date().toISOString();
  getDb().prepare(`
    UPDATE audio_processing_jobs SET
      status='cancelled', finished_at=?, updated_at=?,
      lease_owner=NULL, lease_token=NULL, lease_expires_at=NULL
    WHERE user_id=? AND draft_id=? AND status IN ('queued', 'running', 'failed')
  `).run(now, now, userId, draftId);
  return getAudioProcessingJob(userId, draftId);
}

function cancelSessionDraftAndAudioJob(userId, draftId) {
  const conn = getDb();
  const cancel = conn.transaction(() => {
    const current = getSessionDraft(userId, draftId);
    if (!current || current.status === 'confirmed') return current;
    const now = new Date().toISOString();
    if (current.status !== 'cancelled') {
      const info = conn.prepare(`
        UPDATE session_drafts SET
          status='cancelled', processing_finished_at=?, updated_at=?
        WHERE id=? AND user_id=?
          AND status IN ('received', 'transcribing', 'structuring', 'ready', 'failed')
      `).run(now, now, draftId, userId);
      if (!info.changes) return getSessionDraft(userId, draftId);
    }
    conn.prepare(`
      UPDATE audio_processing_jobs SET
        status='cancelled', finished_at=?, updated_at=?,
        lease_owner=NULL, lease_token=NULL, lease_expires_at=NULL
      WHERE user_id=? AND draft_id=? AND status IN ('queued', 'running', 'failed')
    `).run(now, now, userId, draftId);
    return getSessionDraft(userId, draftId);
  });
  return cancel.immediate();
}

function markSessionDraftMediaDeleted(userId, draftId) {
  const now = new Date().toISOString();
  const info = getDb().prepare(`
    UPDATE session_drafts SET media_deleted_at=?, updated_at=?
    WHERE id=? AND user_id=? AND media_reference LIKE 'upload://%'
  `).run(now, now, draftId, userId);
  return info.changes ? getSessionDraft(userId, draftId) : null;
}

function listRequiredAudioUploadReferences() {
  return getDb().prepare(`
    SELECT media_reference FROM session_drafts
    WHERE media_reference LIKE 'upload://%'
      AND media_deleted_at IS NULL
      AND raw_transcript IS NULL
      AND status IN ('received', 'transcribing', 'failed')
  `).all().map((row) => row.media_reference);
}

function listAudioUploadsPendingCleanup() {
  return getDb().prepare(`
    SELECT user_id, id AS draft_id, media_reference
    FROM session_drafts
    WHERE media_reference LIKE 'upload://%'
      AND media_deleted_at IS NULL
      AND (
        raw_transcript IS NOT NULL
        OR status IN ('ready', 'confirmed', 'cancelled')
      )
  `).all().map((row) => ({
    userId: String(row.user_id),
    draftId: String(row.draft_id),
    mediaReference: row.media_reference,
  }));
}

function listExpiredAudioUploads(nowValue = new Date()) {
  const now = new Date(nowValue).toISOString();
  return getDb().prepare(`
    SELECT user_id, id AS draft_id, media_reference
    FROM session_drafts
    WHERE media_reference LIKE 'upload://%'
      AND media_deleted_at IS NULL
      AND media_expires_at IS NOT NULL
      AND media_expires_at <= ?
      AND raw_transcript IS NULL
      AND status IN ('received', 'transcribing', 'failed')
  `).all(now).map((row) => ({
    userId: String(row.user_id),
    draftId: String(row.draft_id),
    mediaReference: row.media_reference,
  }));
}

function expireAudioUpload(userId, draftId) {
  const conn = getDb();
  const expire = conn.transaction(() => {
    const now = new Date().toISOString();
    const draftExpiration = conn.prepare(`
      UPDATE session_drafts SET
        status='failed', failed_stage='transcribing',
        error_code='AUDIO_UPLOAD_EXPIRED',
        error_message='The temporary audio file expired before transcription completed',
        processing_finished_at=?, updated_at=?
      WHERE id=? AND user_id=?
        AND media_reference LIKE 'upload://%'
        AND media_deleted_at IS NULL
        AND media_expires_at IS NOT NULL
        AND media_expires_at <= ?
        AND raw_transcript IS NULL
        AND status IN ('received', 'transcribing', 'failed')
    `).run(now, now, draftId, userId, now);

    if (draftExpiration.changes !== 1) {
      return {
        expired: false,
        draft: getSessionDraft(userId, draftId),
      };
    }

    conn.prepare(`
      UPDATE audio_processing_jobs SET
        status='cancelled', finished_at=?, updated_at=?,
        lease_owner=NULL, lease_token=NULL, lease_expires_at=NULL
      WHERE user_id=? AND draft_id=? AND status IN ('queued', 'running', 'failed')
    `).run(now, now, userId, draftId);

    return {
      expired: true,
      draft: getSessionDraft(userId, draftId),
    };
  });
  return expire.immediate();
}

function updateSessionDraft(userId, id, changes) {
  const conn = getDb();
  const current = getSessionDraft(userId, id);
  if (!current) return null;

  const patientId = changes.patientId ?? current.patientId;
  if (!patientExists(userId, patientId)) {
    const error = new Error('Patient not found or access denied');
    error.code = 'PATIENT_NOT_FOUND';
    throw error;
  }

  const next = {
    patientId,
    clinicalDate: changes.clinicalDate ?? current.clinicalDate,
    sessionType: changes.sessionType ?? current.sessionType,
    durationMinutes: changes.durationMinutes === undefined
      ? current.durationMinutes
      : changes.durationMinutes,
    careModality: changes.careModality ?? current.careModality,
    rawTranscript: changes.rawTranscript === undefined
      ? current.rawTranscript
      : changes.rawTranscript,
    cleanNote: changes.cleanNote ?? current.cleanNote,
    medicationNotes: changes.medicationNotes === undefined
      ? current.medicationNotes
      : changes.medicationNotes,
    moodAssessment: changes.moodAssessment === undefined
      ? current.moodAssessment
      : changes.moodAssessment,
    requiresFollowUp: changes.requiresFollowUp === undefined
      ? current.requiresFollowUp
      : changes.requiresFollowUp,
    audioDurationSeconds: changes.audioDurationSeconds === undefined
      ? current.audioDurationSeconds
      : changes.audioDurationSeconds,
    updatedAt: new Date().toISOString(),
  };

  const info = conn.prepare(`
    UPDATE session_drafts SET
      patient_id=?, clinical_date=?, session_type=?, duration_minutes=?,
      care_modality=?, raw_transcript=?, clean_note=?, medication_notes=?,
      mood_assessment=?, requires_follow_up=?, audio_duration_seconds=?, updated_at=?
    WHERE id=? AND user_id=? AND status='ready'
  `).run(
    next.patientId,
    next.clinicalDate,
    next.sessionType,
    next.durationMinutes,
    next.careModality,
    next.rawTranscript,
    next.cleanNote,
    next.medicationNotes,
    next.moodAssessment,
    next.requiresFollowUp ? 1 : 0,
    next.audioDurationSeconds,
    next.updatedAt,
    id,
    userId
  );

  return info.changes ? getSessionDraft(userId, id) : null;
}

function setSessionDraftStatus(userId, id, status) {
  const conn = getDb();
  const info = conn.prepare(`
    UPDATE session_drafts SET status = ?, updated_at = ?
    WHERE id = ? AND user_id = ?
  `).run(status, new Date().toISOString(), id, userId);
  return info.changes ? getSessionDraft(userId, id) : null;
}

function transitionSessionDraft(userId, id, expectedStatuses, changes, options = {}) {
  const conn = getDb();
  const statuses = Array.isArray(expectedStatuses) ? expectedStatuses : [expectedStatuses];
  if (!statuses.length) return null;

  const assignments = ['status=?', 'updated_at=?'];
  const values = [changes.status, new Date().toISOString()];
  const fields = [
    ['rawTranscript', 'raw_transcript'],
    ['cleanNote', 'clean_note'],
    ['audioDurationSeconds', 'audio_duration_seconds'],
    ['failedStage', 'failed_stage'],
    ['errorCode', 'error_code'],
    ['errorMessage', 'error_message'],
    ['processingStartedAt', 'processing_started_at'],
    ['processingFinishedAt', 'processing_finished_at'],
  ];
  for (const [property, column] of fields) {
    if (changes[property] !== undefined) {
      assignments.push(`${column}=?`);
      values.push(changes[property]);
    }
  }
  if (changes.incrementProcessingAttempts) {
    assignments.push('processing_attempts=processing_attempts+1');
  }
  if (changes.clearFailure) {
    assignments.push('error_code=NULL', 'error_message=NULL');
  }

  const placeholders = statuses.map(() => '?').join(', ');
  const leaseClause = options.leaseToken
    ? `AND EXISTS (
        SELECT 1 FROM audio_processing_jobs job
        WHERE job.draft_id=session_drafts.id
          AND job.user_id=session_drafts.user_id
          AND job.status='running'
          AND job.lease_token=?
          AND job.lease_expires_at > ?
      )`
    : '';
  const leaseValues = options.leaseToken
    ? [options.leaseToken, options.now || new Date().toISOString()]
    : [];
  const info = conn.prepare(`
    UPDATE session_drafts SET ${assignments.join(', ')}
    WHERE id=? AND user_id=? AND status IN (${placeholders})
      ${leaseClause}
  `).run(...values, id, userId, ...statuses, ...leaseValues);
  return info.changes ? getSessionDraft(userId, id) : null;
}

function confirmSessionDraft(userId, id) {
  const conn = getDb();
  const confirm = conn.transaction(() => {
    const draft = getSessionDraft(userId, id);
    if (!draft) {
      const error = new Error('Draft not found');
      error.code = 'DRAFT_NOT_FOUND';
      throw error;
    }

    if (draft.status === 'confirmed' && draft.sessionId) {
      return {
        draft,
        session: getSessionById(userId, draft.sessionId),
        created: false,
      };
    }

    if (draft.status !== 'ready') {
      const error = new Error('Draft is not ready to confirm');
      error.code = draft.status === 'cancelled' ? 'DRAFT_CANCELLED' : 'DRAFT_NOT_READY';
      throw error;
    }

    if (!activePatientExists(userId, draft.patientId)) {
      const error = new Error('Patient not found or access denied');
      error.code = 'PATIENT_NOT_FOUND';
      throw error;
    }

    const session = addSession(userId, {
      pacienteId: draft.patientId,
      clinicalDate: draft.clinicalDate,
      sessionType: draft.sessionType,
      durationMinutes: draft.durationMinutes,
      careModality: draft.careModality,
      source: draft.source,
      inputType: draft.inputType,
      rawTranscript: draft.rawTranscript,
      cleanNote: draft.cleanNote,
      medicationNotes: draft.medicationNotes,
      moodAssessment: draft.moodAssessment,
      requiresFollowUp: draft.requiresFollowUp,
      audioDurationSeconds: draft.audioDurationSeconds,
      draftId: draft.id,
    });
    const now = new Date().toISOString();

    const confirmation = conn.prepare(`
      UPDATE session_drafts SET
        status='confirmed', session_id=?, confirmed_at=?, updated_at=?
      WHERE id=? AND user_id=? AND status='ready'
    `).run(session.id, now, now, id, userId);
    if (confirmation.changes !== 1) {
      const error = new Error('Draft changed while it was being confirmed');
      error.code = 'DRAFT_NOT_READY';
      throw error;
    }

    return {
      draft: getSessionDraft(userId, id),
      session,
      created: true,
    };
  });

  return confirm.immediate();
}

// ===== WHATSAPP LINK FUNCTIONS =====

function mapWhatsappLinkRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    phoneNumber: row.phone_e164 || null,
    status: row.status,
    linkCode: row.link_code || null,
    codeExpiresAt: row.code_expires_at || null,
    linkedMessageId: row.linked_message_id || null,
    linkedAt: row.linked_at || null,
    unlinkedAt: row.unlinked_at || null,
    lastSeenAt: row.last_seen_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getWhatsappLink(userId) {
  const row = getDb().prepare(
    'SELECT * FROM whatsapp_links WHERE user_id = ?'
  ).get(userId);
  return mapWhatsappLinkRow(row);
}

function getLinkedWhatsappByPhone(phoneNumber) {
  const row = getDb().prepare(`
    SELECT * FROM whatsapp_links
    WHERE phone_e164 = ? AND status = 'linked'
  `).get(phoneNumber);
  return mapWhatsappLinkRow(row);
}

function requestWhatsappLink(userId, phoneNumber, code, expiresAt, now) {
  const conn = getDb();
  conn.prepare(`
    UPDATE whatsapp_links SET
      phone_e164=NULL, status='expired', link_code=NULL,
      code_expires_at=NULL, updated_at=?
    WHERE status='pending' AND code_expires_at <= ?
  `).run(now, now);
  const current = getWhatsappLink(userId);
  if (current?.status === 'linked') {
    const error = new Error('WhatsApp is already linked');
    error.code = 'WHATSAPP_ALREADY_LINKED';
    throw error;
  }

  try {
    conn.prepare(`
      INSERT INTO whatsapp_links (
        user_id, phone_e164, status, link_code, code_expires_at,
        created_at, updated_at
      ) VALUES (?, ?, 'pending', ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        phone_e164=excluded.phone_e164,
        status='pending',
        link_code=excluded.link_code,
        code_expires_at=excluded.code_expires_at,
        linked_message_id=NULL,
        linked_at=NULL,
        unlinked_at=NULL,
        last_seen_at=NULL,
        updated_at=excluded.updated_at
    `).run(userId, phoneNumber, code, expiresAt, now, now);
  } catch (error) {
    if (String(error.message).includes('link_code')) error.code = 'LINK_CODE_CONFLICT';
    else if (String(error.message).includes('phone_e164')) error.code = 'PHONE_ALREADY_IN_USE';
    throw error;
  }

  return getWhatsappLink(userId);
}

function expireWhatsappLink(userId, now) {
  const conn = getDb();
  conn.prepare(`
    UPDATE whatsapp_links SET
      phone_e164=NULL, status='expired', link_code=NULL,
      code_expires_at=NULL, updated_at=?
    WHERE user_id=? AND status='pending'
  `).run(now, userId);
  return getWhatsappLink(userId);
}

function consumeWhatsappLinkCode({ messageId, phoneNumber, code, payloadHash, now }) {
  const conn = getDb();
  const consume = conn.transaction(() => {
    const conflictingInbound = conn.prepare(
      'SELECT message_id FROM whatsapp_inbound_events WHERE message_id = ?'
    ).get(messageId);
    if (conflictingInbound) {
      const error = new Error('messageId was already used by another inbound event');
      error.code = 'MESSAGE_ID_CONFLICT';
      throw error;
    }

    const repeatedEvent = conn.prepare(
      'SELECT * FROM whatsapp_link_events WHERE message_id = ?'
    ).get(messageId);
    if (repeatedEvent) {
      if (repeatedEvent.phone_e164 !== phoneNumber) {
        const error = new Error('The repeated event came from another phone number');
        error.code = 'PHONE_MISMATCH';
        throw error;
      }
      if (repeatedEvent.payload_hash && repeatedEvent.payload_hash !== payloadHash) {
        const error = new Error('messageId was already used by another link payload');
        error.code = 'MESSAGE_ID_CONFLICT';
        throw error;
      }
      return { link: JSON.parse(repeatedEvent.response_json), deduplicated: true };
    }

    const row = conn.prepare(`
      SELECT * FROM whatsapp_links WHERE link_code = ? AND status = 'pending'
    `).get(code);
    if (!row) {
      const error = new Error('Invalid or previously used link code');
      error.code = 'INVALID_LINK_CODE';
      throw error;
    }
    if (row.phone_e164 !== phoneNumber) {
      const error = new Error('The code belongs to another phone number');
      error.code = 'PHONE_MISMATCH';
      throw error;
    }
    if (new Date(row.code_expires_at) <= new Date(now)) {
      conn.prepare(`
        UPDATE whatsapp_links SET
          phone_e164=NULL, status='expired', link_code=NULL,
          code_expires_at=NULL, updated_at=?
        WHERE id=?
      `).run(now, row.id);
      return { errorCode: 'LINK_CODE_EXPIRED' };
    }

    try {
      conn.prepare(`
        UPDATE whatsapp_links SET
          status='linked', link_code=NULL, code_expires_at=NULL,
          linked_message_id=?, linked_at=?, unlinked_at=NULL,
          last_seen_at=?, updated_at=?
        WHERE id=?
      `).run(messageId, now, now, now, row.id);
    } catch (error) {
      if (String(error.message).includes('phone_e164')) error.code = 'PHONE_ALREADY_IN_USE';
      throw error;
    }

    const link = getWhatsappLink(row.user_id);
    conn.prepare(`
      INSERT INTO whatsapp_link_events (
        message_id, user_id, phone_e164, response_json, created_at, payload_hash
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(messageId, row.user_id, phoneNumber, JSON.stringify(link), now, payloadHash);
    return { link, deduplicated: false };
  });

  const result = consume.immediate();
  if (result.errorCode === 'LINK_CODE_EXPIRED') {
    const error = new Error('Link code expired');
    error.code = result.errorCode;
    throw error;
  }
  return result;
}

function unlinkWhatsapp(userId, now) {
  const conn = getDb();
  conn.transaction(() => {
    conn.prepare(`
      UPDATE whatsapp_links SET
        phone_e164=NULL, status='unlinked', link_code=NULL,
        code_expires_at=NULL, linked_message_id=NULL, linked_at=NULL,
        last_seen_at=NULL, unlinked_at=?, updated_at=?
      WHERE user_id=?
    `).run(now, now, userId);
    conn.prepare('DELETE FROM whatsapp_conversations WHERE user_id=?').run(userId);
  })();
  return getWhatsappLink(userId);
}

function touchWhatsappLink(userId, now) {
  getDb().prepare(`
    UPDATE whatsapp_links SET last_seen_at=?, updated_at=?
    WHERE user_id=? AND status='linked'
  `).run(now, now, userId);
}

// ===== WHATSAPP CONVERSATION FUNCTIONS =====

function mapWhatsappConversationRow(row) {
  if (!row) return null;
  return {
    userId: String(row.user_id),
    phoneNumber: row.phone_e164,
    state: row.state,
    selectedPatientId: row.selected_patient_id == null
      ? null
      : String(row.selected_patient_id),
    currentDraftId: row.current_draft_id == null
      ? null
      : String(row.current_draft_id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getWhatsappConversation(userId) {
  return mapWhatsappConversationRow(
    getDb().prepare('SELECT * FROM whatsapp_conversations WHERE user_id=?').get(userId)
  );
}

function ensureWhatsappConversation(userId, phoneNumber, now) {
  const conn = getDb();
  const current = getWhatsappConversation(userId);
  if (!current) {
    conn.prepare(`
      INSERT INTO whatsapp_conversations (
        user_id, phone_e164, state, selected_patient_id,
        current_draft_id, created_at, updated_at
      ) VALUES (?, ?, 'menu', NULL, NULL, ?, ?)
    `).run(userId, phoneNumber, now, now);
  } else if (current.phoneNumber !== phoneNumber) {
    conn.prepare(`
      UPDATE whatsapp_conversations SET
        phone_e164=?, state='menu', selected_patient_id=NULL,
        current_draft_id=NULL, updated_at=?
      WHERE user_id=?
    `).run(phoneNumber, now, userId);
  }
  return getWhatsappConversation(userId);
}

function updateWhatsappConversation(userId, changes, now) {
  const conn = getDb();
  const current = getWhatsappConversation(userId);
  if (!current) return null;
  const state = changes.state ?? current.state;
  const selectedPatientId = changes.selectedPatientId === undefined
    ? current.selectedPatientId
    : changes.selectedPatientId;
  const currentDraftId = changes.currentDraftId === undefined
    ? current.currentDraftId
    : changes.currentDraftId;

  conn.prepare(`
    UPDATE whatsapp_conversations SET
      state=?, selected_patient_id=?, current_draft_id=?, updated_at=?
    WHERE user_id=?
  `).run(state, selectedPatientId, currentDraftId, now, userId);
  return getWhatsappConversation(userId);
}

function deleteWhatsappConversation(userId) {
  const info = getDb().prepare(
    'DELETE FROM whatsapp_conversations WHERE user_id=?'
  ).run(userId);
  return info.changes > 0;
}

function getWhatsappInboundEvent(messageId) {
  const row = getDb().prepare(
    'SELECT * FROM whatsapp_inbound_events WHERE message_id=?'
  ).get(messageId);
  if (!row) return null;
  return {
    messageId: row.message_id,
    phoneNumber: row.phone_e164,
    payloadHash: row.payload_hash,
    userId: row.user_id == null ? null : String(row.user_id),
    responseStatus: Number(row.response_status),
    response: JSON.parse(row.response_json),
    createdAt: row.created_at,
  };
}

function whatsappLinkEventExists(messageId) {
  return Boolean(
    getDb().prepare('SELECT message_id FROM whatsapp_link_events WHERE message_id=?').get(messageId)
  );
}

function addWhatsappInboundEvent(event) {
  getDb().prepare(`
    INSERT INTO whatsapp_inbound_events (
      message_id, phone_e164, payload_hash, user_id,
      response_status, response_json, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    event.messageId,
    event.phoneNumber,
    event.payloadHash,
    event.userId,
    event.responseStatus,
    JSON.stringify(event.response),
    event.createdAt
  );
  return getWhatsappInboundEvent(event.messageId);
}

function withTransaction(work) {
  return getDb().transaction(work).immediate();
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
  patientExists,
  activePatientExists,
  getSessionDraft,
  getSessionDraftBySourceMessage,
  listSessionDrafts,
  addSessionDraft,
  addSessionDraftWithAudioJob,
  updateSessionDraft,
  setSessionDraftStatus,
  transitionSessionDraft,
  confirmSessionDraft,
  getAudioProcessingJob,
  ensureAudioProcessingJob,
  claimNextAudioProcessingJob,
  renewAudioProcessingJob,
  finishAudioProcessingJob,
  requeueAudioProcessingJob,
  cancelAudioProcessingJob,
  cancelSessionDraftAndAudioJob,
  markSessionDraftMediaDeleted,
  listRequiredAudioUploadReferences,
  listAudioUploadsPendingCleanup,
  listExpiredAudioUploads,
  expireAudioUpload,
  getWhatsappLink,
  getLinkedWhatsappByPhone,
  requestWhatsappLink,
  expireWhatsappLink,
  consumeWhatsappLinkCode,
  unlinkWhatsapp,
  touchWhatsappLink,
  getWhatsappConversation,
  ensureWhatsappConversation,
  updateWhatsappConversation,
  deleteWhatsappConversation,
  getWhatsappInboundEvent,
  whatsappLinkEventExists,
  addWhatsappInboundEvent,
  withTransaction,
  createUser,
  verifyUser,
};
