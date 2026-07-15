const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_MIGRATIONS_DIR = path.join(__dirname, 'migrations');
const MIGRATION_FILE_PATTERN = /^\d{3}_[a-z0-9_-]+\.sql$/i;

function listMigrationFiles(migrationsDir) {
  return fs.readdirSync(migrationsDir)
    .filter((fileName) => MIGRATION_FILE_PATTERN.test(fileName))
    .sort((left, right) => left.localeCompare(right));
}

function runMigrations(connection, options = {}) {
  const migrationsDir = options.migrationsDir || DEFAULT_MIGRATIONS_DIR;

  connection.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);

  const appliedIds = new Set(
    connection.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id)
  );

  const appliedNow = [];

  for (const fileName of listMigrationFiles(migrationsDir)) {
    if (appliedIds.has(fileName)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, fileName), 'utf8');
    const applyMigration = connection.transaction(() => {
      connection.exec(sql);
      connection.prepare(
        'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)'
      ).run(fileName, new Date().toISOString());
    });

    applyMigration();
    appliedNow.push(fileName);
  }

  return appliedNow;
}

module.exports = {
  DEFAULT_MIGRATIONS_DIR,
  listMigrationFiles,
  runMigrations,
};
