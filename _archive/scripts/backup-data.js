#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function main() {
  const projectRoot = path.join(__dirname, '..');
  const dataDir = path.join(projectRoot, 'data');
  const backupsDir = path.join(projectRoot, 'backups');
  ensureDir(backupsDir);

  if (!fs.existsSync(dataDir)) {
    console.log('No data/ directory to backup. Skipping.');
    process.exit(0);
  }

  const ts = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace('T', '_')
    .slice(0, 15);
  const outFile = path.join(backupsDir, `data_backup_${ts}.tgz`);

  try {
    // Use tar to compress data directory
    execSync(`tar -czf ${JSON.stringify(outFile)} -C ${JSON.stringify(projectRoot)} data`, {
      stdio: 'inherit',
    });
    const encryptionKey = process.env.BACKUP_ENCRYPTION_KEY || '';
    if (encryptionKey) {
      const key = crypto.createHash('sha256').update(encryptionKey).digest();
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      const input = fs.readFileSync(outFile);
      const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
      const tag = cipher.getAuthTag();
      const encOut = `${outFile}.enc`;
      fs.writeFileSync(encOut, Buffer.concat([iv, tag, encrypted]));
      fs.unlinkSync(outFile);
      console.log(`Encrypted backup created: ${encOut}`);
    } else {
      console.log(`Backup created: ${outFile}`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Backup failed:', err.message);
    process.exit(1);
  }
}

main();


