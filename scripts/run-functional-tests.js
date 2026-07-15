#!/usr/bin/env node

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const STARTUP_TIMEOUT_MS = 15_000;

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();

    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      const port = typeof address === 'object' && address ? address.port : null;

      probe.close((error) => {
        if (error) return reject(error);
        if (!port) return reject(new Error('Could not allocate a test port'));
        resolve(port);
      });
    });
  });
}

function waitForHealth(url, serverProcess) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    let timer;

    const onServerExit = (code, signal) => {
      clearTimeout(timer);
      reject(new Error(`Server exited before becoming healthy (${code ?? signal})`));
    };

    serverProcess.once('exit', onServerExit);

    const check = async () => {
      try {
        const response = await fetch(url);
        if (response.ok) {
          serverProcess.off('exit', onServerExit);
          return resolve();
        }
      } catch (_) {
        // The server may still be starting.
      }

      if (Date.now() - startedAt >= STARTUP_TIMEOUT_MS) {
        serverProcess.off('exit', onServerExit);
        return reject(new Error(`Server did not become healthy within ${STARTUP_TIMEOUT_MS}ms`));
      }

      timer = setTimeout(check, 200);
    };

    check();
  });
}

function runTestProcess(env) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['scripts/functional-tests.js'], {
      cwd: ROOT_DIR,
      env,
      stdio: 'inherit',
    });

    child.once('exit', (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
  });
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-functional-'));
  const port = await findAvailablePort();
  const testUrl = `http://127.0.0.1:${port}`;
  const serverLogs = [];

  const env = {
    ...process.env,
    DATA_DIR: dataDir,
    PORT: String(port),
    NODE_ENV: 'test',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    DATA_KEY: crypto.randomBytes(32).toString('hex'),
    TEST_URL: testUrl,
  };

  const serverProcess = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const collectServerLog = (chunk) => {
    serverLogs.push(chunk.toString());
    if (serverLogs.length > 200) serverLogs.shift();
  };

  serverProcess.stdout.on('data', collectServerLog);
  serverProcess.stderr.on('data', collectServerLog);

  try {
    await waitForHealth(`${testUrl}/health`, serverProcess);
    const exitCode = await runTestProcess(env);
    process.exitCode = exitCode;
  } catch (error) {
    console.error(`Functional test runner failed: ${error.message}`);
    if (serverLogs.length) {
      console.error('\nServer output:\n' + serverLogs.join(''));
    }
    process.exitCode = 1;
  } finally {
    if (!serverProcess.killed) serverProcess.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
