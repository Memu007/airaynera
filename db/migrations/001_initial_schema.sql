CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  dni TEXT UNIQUE NOT NULL,
  pin_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  specialty TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS patients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  dni TEXT,
  phone TEXT,
  email TEXT,
  insurance TEXT,
  habilitado INTEGER NOT NULL DEFAULT 1,
  created_via TEXT,
  fechaRegistro TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  userId TEXT NOT NULL,
  pacienteId INTEGER NOT NULL,
  notas TEXT,
  tipo TEXT,
  duracion INTEGER,
  medication_notes TEXT,
  mood_assessment INTEGER,
  requires_followup INTEGER,
  created_via TEXT,
  fecha TEXT,
  FOREIGN KEY(pacienteId) REFERENCES patients(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_dni ON users(dni);
CREATE INDEX IF NOT EXISTS idx_patients_userId ON patients(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_userId ON sessions(userId);
CREATE INDEX IF NOT EXISTS idx_sessions_paciente ON sessions(pacienteId);
CREATE INDEX IF NOT EXISTS idx_sessions_fecha ON sessions(fecha);
