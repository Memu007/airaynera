#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function main() {
  const projectRoot = path.join(__dirname, '..');
  const backupsDir = path.join(projectRoot, 'backups');
  if (!fs.existsSync(backupsDir)) {
    console.error('No backups directory found');
    process.exit(1);
  }
  const files = fs.readdirSync(backupsDir)
    .filter(f => f.endsWith('.tgz') || f.endsWith('.tgz.enc'))
    .sort()
    .reverse();
  if (files.length === 0) {
    console.error('No backup files to verify');
    process.exit(1);
  }
  const latest = path.join(backupsDir, files[0]);
  const tmpDir = fs.mkdtempSync(path.join(projectRoot, '.backup-verify-'));
  try {
    let archiveToUse = latest;
    if (latest.endsWith('.enc')) {
      const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || '';
      if (!encryptionKey) throw new Error('Encrypted backup found but BACKUP_ENCRYPTION_KEY is not set');
      const crypto = require('crypto');
      const key = crypto.createHash('sha256').update(encryptionKey).digest();
      const buf = fs.readFileSync(latest);
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const data = buf.subarray(28);
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const dec = Buffer.concat([decipher.update(data), decipher.final()]);
      const tmpTgz = path.join(tmpDir, 'restore.tgz');
      fs.writeFileSync(tmpTgz, dec);
      archiveToUse = tmpTgz;
    }
    execSync(`tar -tzf ${JSON.stringify(archiveToUse)} > /dev/null`); // list to validate archive
    execSync(`tar -xzf ${JSON.stringify(archiveToUse)} -C ${JSON.stringify(tmpDir)}`);
    const dataPath = path.join(tmpDir, 'data');
    if (!fs.existsSync(dataPath)) throw new Error('Extracted archive missing data/');
    // minimal content check: at least 1 file
    const entries = fs.readdirSync(dataPath);
    if (entries.length === 0) throw new Error('data/ is empty in backup');
    console.log(`Backup OK: ${latest}`);
    process.exit(0);
  } catch (err) {
    console.error('Backup verification failed:', err.message);
    process.exit(2);
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {}
  }
}

main();


