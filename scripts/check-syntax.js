#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT_DIR = path.resolve(__dirname, '..');

function listJavaScriptFiles(relativePath) {
  const absolutePath = path.join(ROOT_DIR, relativePath);
  const stat = fs.statSync(absolutePath);
  if (stat.isFile()) return [absolutePath];
  return fs.readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = path.join(absolutePath, entry.name);
    if (entry.isDirectory()) return listJavaScriptFiles(path.relative(ROOT_DIR, child));
    return entry.isFile() && entry.name.endsWith('.js') ? [child] : [];
  });
}

function checkNodeSyntax(filePath) {
  const result = spawnSync(process.execPath, ['--check', filePath], {
    cwd: ROOT_DIR,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    const relativePath = path.relative(ROOT_DIR, filePath);
    throw new Error(`${relativePath} has invalid JavaScript syntax\n${result.stderr || result.stdout}`);
  }
}

function checkInlineScripts() {
  const htmlPath = path.join(ROOT_DIR, 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
  let match;
  let inlineCount = 0;

  while ((match = scriptPattern.exec(html)) !== null) {
    const attributes = match[1];
    if (/\bsrc\s*=/i.test(attributes)) continue;
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
    if (type && !['text/javascript', 'application/javascript', 'module'].includes(type)) continue;
    inlineCount += 1;
    new vm.Script(match[2], { filename: `index.html:inline-script-${inlineCount}` });
  }

  assert.ok(inlineCount > 0, 'index.html must contain at least one inline JavaScript block');
  return inlineCount;
}

function main() {
  const files = [
    ...listJavaScriptFiles('server.js'),
    ...listJavaScriptFiles('workers'),
    ...listJavaScriptFiles('scripts'),
  ].sort();
  for (const filePath of files) checkNodeSyntax(filePath);
  const inlineCount = checkInlineScripts();
  console.log(`Syntax check passed for ${files.length} Node.js files and ${inlineCount} inline scripts.`);
}

try {
  main();
} catch (error) {
  console.error(`Syntax check failed: ${error.message}`);
  process.exitCode = 1;
}
