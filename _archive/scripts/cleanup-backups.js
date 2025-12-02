#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const DAYS = parseInt(process.env.BACKUP_RETENTION_DAYS || '7', 10);

function main() {
  const root = path.join(__dirname, '..');
  const dir = path.join(root, 'backups');
  if (!fs.existsSync(dir)) {
    console.log('No backups/ directory. Skipping.');
    process.exit(0);
  }

  const now = Date.now();
  const ms = DAYS * 24 * 60 * 60 * 1000;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tgz'));
  let removed = 0;
  for (const f of files) {
    const p = path.join(dir, f);
    try {
      const st = fs.statSync(p);
      if (now - st.mtimeMs > ms) {
        fs.unlinkSync(p);
        removed += 1;
      }
    } catch (_) {}
  }
  console.log(`Backups cleanup done. Removed: ${removed}`);
}

main();


