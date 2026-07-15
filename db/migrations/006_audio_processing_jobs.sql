ALTER TABLE session_drafts ADD COLUMN media_size_bytes INTEGER;
ALTER TABLE session_drafts ADD COLUMN media_sha256 TEXT;
ALTER TABLE session_drafts ADD COLUMN media_expires_at TEXT;
ALTER TABLE session_drafts ADD COLUMN media_deleted_at TEXT;

CREATE TABLE IF NOT EXISTS audio_processing_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  draft_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TEXT NOT NULL,
  lease_owner TEXT,
  lease_token TEXT,
  lease_expires_at TEXT,
  error_code TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  finished_at TEXT,
  FOREIGN KEY(draft_id) REFERENCES session_drafts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_audio_processing_jobs_claim
  ON audio_processing_jobs(status, available_at, lease_expires_at, id);

CREATE INDEX IF NOT EXISTS idx_audio_processing_jobs_user_draft
  ON audio_processing_jobs(user_id, draft_id);
