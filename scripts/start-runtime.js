#!/usr/bin/env node

const { spawn } = require('node:child_process');

const root = require('node:path').resolve(__dirname, '..');
const port = process.env.PORT || '8080';
let shuttingDown = false;
let serverProcess;
let workerProcess;

function spawnNode(file, args = []) {
  return spawn(process.execPath, [file, ...args], {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
  });
}

async function waitForServer() {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (serverProcess.exitCode != null) {
      throw new Error(`Web server exited with code ${serverProcess.exitCode}`);
    }
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch (_) {
      // The server is still applying migrations or binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('Web server did not become healthy before starting the audio worker');
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  const running = [workerProcess, serverProcess].filter(
    (child) => child && child.exitCode == null && child.signalCode == null
  );
  if (!running.length) {
    process.exitCode = exitCode;
    return;
  }
  let remaining = running.length;
  const finish = () => {
    remaining -= 1;
    if (remaining === 0) process.exit(exitCode);
  };
  for (const child of running) {
    child.once('exit', finish);
    child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(exitCode), 5_000);
}

function supervise(child) {
  child.once('exit', (code, signal) => {
    if (!shuttingDown) shutdown(code ?? (signal ? 1 : 0));
  });
}

async function main() {
  serverProcess = spawnNode('server.js');
  supervise(serverProcess);
  await waitForServer();
  if (shuttingDown) return;
  workerProcess = spawnNode('workers/audio-worker.js');
  supervise(workerProcess);
}

process.once('SIGTERM', () => shutdown(0));
process.once('SIGINT', () => shutdown(0));
main().catch((error) => {
  console.error('AIRA runtime failed:', error.message);
  shutdown(1);
});
