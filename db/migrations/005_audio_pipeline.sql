ALTER TABLE session_drafts ADD COLUMN media_reference TEXT;
ALTER TABLE session_drafts ADD COLUMN media_mime_type TEXT;
ALTER TABLE session_drafts ADD COLUMN input_fingerprint TEXT;
ALTER TABLE session_drafts ADD COLUMN processing_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE session_drafts ADD COLUMN failed_stage TEXT;
ALTER TABLE session_drafts ADD COLUMN processing_started_at TEXT;
ALTER TABLE session_drafts ADD COLUMN processing_finished_at TEXT;

CREATE INDEX IF NOT EXISTS idx_session_drafts_audio_processing
  ON session_drafts(user_id, input_type, status, updated_at);
