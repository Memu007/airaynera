-- Optimistic-concurrency version counter for sessions.
-- Every successful edit bumps revision; PATCH updates conditionally on the
-- revision the client last read, so a concurrent edit from another tab or
-- client is detected (409) instead of being silently overwritten.
ALTER TABLE sessions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;
