#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function usage() {
  console.log('Usage: node scripts/restore-data.js <backup_file.tgz>');
  process.exit(1);
}

function main() {
  const backupArg = process.argv[2];
  if (!backupArg) usage();
  const projectRoot = path.join(__dirname, '..');
  const backupsDir = path.join(projectRoot, 'backups');
  const dataDir = path.join(projectRoot, 'data');

  const backupPath = path.isAbsolute(backupArg)
    ? backupArg
    : path.join(backupsDir, backupArg);

  if (!fs.existsSync(backupPath)) {
    console.error('Backup file not found:', backupPath);
    process.exit(1);
  }

  // Create data dir if missing
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  try {
    // Extract into project root so it recreates data/
    execSync(`tar -xzf ${JSON.stringify(backupPath)} -C ${JSON.stringify(projectRoot)}`, { stdio: 'inherit' });
    console.log('Restore completed from:', backupPath);
    process.exit(0);
  } catch (err) {
    console.error('Restore failed:', err.message);
    process.exit(1);
  }
}

main();


