#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const https = require('https');

const targets = [
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.6.2/css/bootstrap.min.css', out: 'vendor/bootstrap@4.6.2/css/bootstrap.min.css' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/bootstrap/4.6.2/js/bootstrap.bundle.min.js', out: 'vendor/bootstrap@4.6.2/js/bootstrap.bundle.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/jquery/3.6.0/jquery.min.js', out: 'vendor/jquery@3.6.0/jquery.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/intro.js/7.2.0/introjs.min.css', out: 'vendor/intro.js@7.2.0/introjs.min.css' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/intro.js/7.2.0/intro.min.js', out: 'vendor/intro.js@7.2.0/intro.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js', out: 'vendor/chart.js@3.9.1/chart.min.js' },
  { url: 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.17.5/xlsx.full.min.js', out: 'vendor/xlsx@0.17.5/xlsx.full.min.js' },
];

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function fetchTo(url, outPath) {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(outPath);
    ensureDir(dir);
    const file = fs.createWriteStream(outPath);
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          file.close();
          fs.unlinkSync(outPath);
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        }
        res.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (err) => {
        try { file.close(); fs.unlinkSync(outPath); } catch (_) {}
        reject(err);
      });
  });
}

async function main() {
  const root = path.join(__dirname, '..');
  for (const t of targets) {
    const outPath = path.join(root, t.out);
    console.log('Downloading', t.url);
    await fetchTo(t.url, outPath);
  }
  console.log('Vendor assets downloaded into vendor/');
}

main().catch((e) => { console.error('fetch-vendor failed:', e.message); process.exit(1); });


