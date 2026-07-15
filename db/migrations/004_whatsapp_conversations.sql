ALTER TABLE whatsapp_link_events ADD COLUMN payload_hash TEXT;

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  user_id TEXT PRIMARY KEY,
  phone_e164 TEXT NOT NULL UNIQUE,
  state TEXT NOT NULL CHECK (
    state IN ('menu', 'choosingPatient', 'awaitingNote', 'awaitingConfirmation')
  ),
  selected_patient_id INTEGER,
  current_draft_id INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY(selected_patient_id) REFERENCES patients(id) ON DELETE SET NULL,
  FOREIGN KEY(current_draft_id) REFERENCES session_drafts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS whatsapp_inbound_events (
  message_id TEXT PRIMARY KEY,
  phone_e164 TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  user_id TEXT,
  response_status INTEGER NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbound_events_user
  ON whatsapp_inbound_events(user_id, created_at);
