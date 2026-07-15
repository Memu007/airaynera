CREATE TABLE IF NOT EXISTS whatsapp_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL UNIQUE,
  phone_e164 TEXT UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('unlinked', 'pending', 'linked', 'expired')),
  link_code TEXT UNIQUE,
  code_expires_at TEXT,
  linked_message_id TEXT UNIQUE,
  linked_at TEXT,
  unlinked_at TEXT,
  last_seen_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_phone_status
  ON whatsapp_links(phone_e164, status);

CREATE INDEX IF NOT EXISTS idx_whatsapp_links_code_status
  ON whatsapp_links(link_code, status);

CREATE TABLE IF NOT EXISTS whatsapp_link_events (
  message_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  phone_e164 TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_link_events_user
  ON whatsapp_link_events(user_id, created_at);
