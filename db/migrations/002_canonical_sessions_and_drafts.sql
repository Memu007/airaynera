ALTER TABLE patients ADD COLUMN created_at TEXT;
ALTER TABLE patients ADD COLUMN updated_at TEXT;

UPDATE patients
SET created_at = COALESCE(created_at, fechaRegistro || 'T12:00:00.000Z'),
    updated_at = COALESCE(updated_at, fechaRegistro || 'T12:00:00.000Z');

ALTER TABLE sessions ADD COLUMN clinical_date TEXT;
ALTER TABLE sessions ADD COLUMN clean_note TEXT;
ALTER TABLE sessions ADD COLUMN raw_transcript TEXT;
ALTER TABLE sessions ADD COLUMN input_type TEXT;
ALTER TABLE sessions ADD COLUMN audio_duration_seconds INTEGER;
ALTER TABLE sessions ADD COLUMN care_modality TEXT;
ALTER TABLE sessions ADD COLUMN draft_id INTEGER;
ALTER TABLE sessions ADD COLUMN status TEXT;
ALTER TABLE sessions ADD COLUMN created_at TEXT;
ALTER TABLE sessions ADD COLUMN updated_at TEXT;
ALTER TABLE sessions ADD COLUMN confirmed_at TEXT;

UPDATE sessions
SET clinical_date = COALESCE(clinical_date, fecha),
    clean_note = COALESCE(clean_note, notas, ''),
    input_type = COALESCE(input_type, 'text'),
    care_modality = COALESCE(care_modality, 'unspecified'),
    status = COALESCE(status, 'confirmed'),
    created_at = COALESCE(created_at, fecha || 'T12:00:00.000Z'),
    updated_at = COALESCE(updated_at, fecha || 'T12:00:00.000Z'),
    confirmed_at = COALESCE(confirmed_at, fecha || 'T12:00:00.000Z');

CREATE TABLE IF NOT EXISTS session_drafts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  patient_id INTEGER NOT NULL,
  clinical_date TEXT NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'individual',
  duration_minutes INTEGER,
  care_modality TEXT NOT NULL DEFAULT 'unspecified',
  source TEXT NOT NULL,
  input_type TEXT NOT NULL,
  status TEXT NOT NULL,
  raw_transcript TEXT,
  clean_note TEXT NOT NULL DEFAULT '',
  medication_notes TEXT,
  mood_assessment INTEGER,
  requires_follow_up INTEGER NOT NULL DEFAULT 0,
  audio_duration_seconds INTEGER,
  source_message_id TEXT,
  session_id INTEGER,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  confirmed_at TEXT,
  FOREIGN KEY(patient_id) REFERENCES patients(id) ON DELETE CASCADE,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_session_drafts_user_status
  ON session_drafts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_session_drafts_user_patient
  ON session_drafts(user_id, patient_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_session_drafts_source_message
  ON session_drafts(user_id, source, source_message_id)
  WHERE source_message_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_draft
  ON sessions(draft_id)
  WHERE draft_id IS NOT NULL;
