const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Crear directorio si no existe
const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Base de datos con backup automático
const dbPath = path.join(dbDir, 'aira.db');
const db = new sqlite3.Database(dbPath);

// Inicializar tablas
db.serialize(() => {
    // Tabla usuarios
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dni TEXT UNIQUE NOT NULL,
        nombre TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        rol TEXT DEFAULT 'profesional',
        activo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Tabla pacientes
    db.run(`CREATE TABLE IF NOT EXISTS pacientes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        dni TEXT,
        telefono TEXT,
        email TEXT,
        notas TEXT,
        profesional_id INTEGER,
        activo BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (profesional_id) REFERENCES usuarios(id)
    )`);
    
    // Tabla sesiones
    db.run(`CREATE TABLE IF NOT EXISTS sesiones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        paciente_id INTEGER NOT NULL,
        profesional_id INTEGER NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
        notas TEXT,
        medicacion TEXT,
        estado_animo TEXT,
        duracion INTEGER,
        tipo TEXT DEFAULT 'voz',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id),
        FOREIGN KEY (profesional_id) REFERENCES usuarios(id)
    )`);
    
    // Índices para performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_pacientes_profesional 
            ON pacientes(profesional_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sesiones_paciente 
            ON sesiones(paciente_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sesiones_fecha 
            ON sesiones(fecha)`);
});

// Backup automático cada 24h
setInterval(() => {
    const backupPath = path.join(dbDir, `backup-${Date.now()}.db`);
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup creado: ${backupPath}`);
    
    // Limpiar backups > 7 días
    fs.readdirSync(dbDir)
        .filter(f => f.startsWith('backup-'))
        .forEach(f => {
            const fPath = path.join(dbDir, f);
            const stats = fs.statSync(fPath);
            if (Date.now() - stats.mtime > 7 * 24 * 60 * 60 * 1000) {
                fs.unlinkSync(fPath);
            }
        });
}, 24 * 60 * 60 * 1000);

module.exports = db;
