#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const BetterSqlite3 = require('better-sqlite3');
const { runMigrations } = require('../db/migrate');

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-migrations-'));
const dbPath = path.join(tempDir, 'aira.db');
const connection = new BetterSqlite3(dbPath);

try {
  const firstRun = runMigrations(connection);
  const secondRun = runMigrations(connection);

  assert.deepEqual(firstRun, ['001_initial_schema.sql']);
  assert.deepEqual(secondRun, []);

  const tables = new Set(
    connection.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table'"
    ).all().map((row) => row.name)
  );

  for (const tableName of ['users', 'patients', 'sessions', 'schema_migrations']) {
    assert.ok(tables.has(tableName), `Missing table: ${tableName}`);
  }

  const migrationRows = connection.prepare(
    'SELECT id, applied_at FROM schema_migrations ORDER BY id'
  ).all();

  assert.equal(migrationRows.length, 1);
  assert.equal(migrationRows[0].id, '001_initial_schema.sql');
  assert.ok(migrationRows[0].applied_at);

  const legacyConnection = new BetterSqlite3(path.join(tempDir, 'legacy.db'));
  try {
    legacyConnection.exec(`
      CREATE TABLE users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dni TEXT UNIQUE NOT NULL,
        pin_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        email TEXT,
        specialty TEXT,
        created_at TEXT
      );
      INSERT INTO users (dni, pin_hash, name, email, specialty, created_at)
      VALUES ('legacy-user', 'hash', 'Legacy User', '', '', '2025-01-01T00:00:00.000Z');
    `);

    assert.deepEqual(runMigrations(legacyConnection), ['001_initial_schema.sql']);
    const legacyUser = legacyConnection.prepare(
      'SELECT dni, name FROM users WHERE dni = ?'
    ).get('legacy-user');

    assert.deepEqual(legacyUser, { dni: 'legacy-user', name: 'Legacy User' });
  } finally {
    legacyConnection.close();
  }

  console.log('✅ Migrations are idempotent and preserve an existing schema');
} finally {
  connection.close();
  fs.rmSync(tempDir, { recursive: true, force: true });
}
