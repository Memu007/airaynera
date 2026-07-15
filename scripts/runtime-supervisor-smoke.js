#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');

function makeWav(payloadText = 'supervised runtime upload') {
  const payload = Buffer.from(payloadText);
  const wav = Buffer.alloc(44 + payload.length);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + payload.length, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(8000, 24);
  wav.writeUInt32LE(16000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(payload.length, 40);
  payload.copy(wav, 44);
  return wav;
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function request(baseUrl, method, pathname, options = {}) {
  const headers = { ...(options.headers || {}) };
  let body = options.body;
  if (body && !Buffer.isBuffer(body)) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }
  const response = await fetch(new URL(pathname, baseUrl), {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(options.timeoutMs || 5_000),
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, data: payload };
}

async function waitForHealth(baseUrl, runtime, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runtime.exitCode != null || runtime.signalCode != null) {
      throw new Error(`runtime exited before health check (${runtime.exitCode ?? runtime.signalCode})`);
    }
    try {
      const response = await request(baseUrl, 'GET', '/health', { timeoutMs: 1_000 });
      if (response.status === 200 && response.data?.status === 'ok') return;
    } catch (_) {
      // The supervised server is still applying migrations or binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('supervised runtime did not become healthy');
}

async function waitForReady(baseUrl, draftId, token, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let lastResponse;
  while (Date.now() < deadline) {
    lastResponse = await request(baseUrl, 'GET', `/api/audio-drafts/${draftId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (lastResponse.data?.draft?.status === 'ready') return lastResponse;
    if (['failed', 'cancelled'].includes(lastResponse.data?.draft?.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`audio draft did not reach ready: ${JSON.stringify(lastResponse?.data)}`);
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode != null || child.signalCode != null) {
    return { code: child.exitCode, signal: child.signalCode };
  }
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('runtime did not stop on SIGTERM')), timeoutMs);
    child.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
}

async function assertPortClosed(baseUrl) {
  const deadline = Date.now() + 3_000;
  while (Date.now() < deadline) {
    try {
      await request(baseUrl, 'GET', '/health', { timeoutMs: 300 });
    } catch (_) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('web server remained reachable after supervisor shutdown');
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-runtime-smoke-'));
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const output = [];
  const env = {
    ...process.env,
    DATA_DIR: tempDir,
    AUDIO_UPLOAD_DIR: path.join(tempDir, 'audio-uploads'),
    PORT: String(port),
    NODE_ENV: 'test',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    DATA_KEY: crypto.randomBytes(32).toString('hex'),
    AUDIO_TRANSCRIBER: 'fake',
    NOTE_CLEANER: 'fake',
    AUDIO_WORKER_POLL_MS: '10',
  };
  const runtime = spawn(process.execPath, ['scripts/start-runtime.js'], {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const collectOutput = (chunk) => {
    output.push(chunk.toString());
    if (output.length > 200) output.shift();
  };
  runtime.stdout.on('data', collectOutput);
  runtime.stderr.on('data', collectOutput);

  try {
    await waitForHealth(baseUrl, runtime);

    const registration = await request(baseUrl, 'POST', '/api/auth/register', {
      body: {
        dni: `8${Date.now().toString().slice(-10)}`,
        pin: '5678',
        name: 'Runtime Supervisor',
        specialty: 'psychology',
      },
    });
    assert.equal(registration.status, 201, JSON.stringify(registration.data));
    const token = registration.data?.token;
    assert.ok(token, 'registration must return an authentication token');

    const patient = await request(baseUrl, 'POST', '/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
      body: { name: 'Paciente Runtime', dni: '99112233' },
    });
    assert.equal(patient.status, 201, JSON.stringify(patient.data));
    assert.ok(patient.data?.id, 'patient creation must return an id');

    const wav = makeWav();
    const upload = await request(
      baseUrl,
      'POST',
      `/api/audio-drafts/upload?patientId=${encodeURIComponent(patient.data.id)}&clinicalDate=2026-07-15`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'audio/wav',
          'Content-Length': String(wav.length),
          'Idempotency-Key': 'runtime-supervisor-smoke-1',
        },
        body: wav,
      }
    );
    assert.equal(upload.status, 202, JSON.stringify(upload.data));
    assert.equal(upload.data?.draft?.status, 'received');
    assert.equal(upload.data?.processing?.status, 'queued');

    const ready = await waitForReady(baseUrl, upload.data.draft.id, token);
    assert.equal(ready.data?.processing?.status, 'completed');
    assert.match(ready.data?.draft?.rawTranscript || '', /^Transcripción simulada/);

    runtime.kill('SIGTERM');
    const exit = await waitForExit(runtime, 7_000);
    assert.deepEqual(exit, { code: 0, signal: null });
    await assertPortClosed(baseUrl);
    console.log('Runtime supervisor smoke passed: health, upload worker, ready state, clean shutdown.');
  } catch (error) {
    if (output.length) console.error(`Supervised runtime output:\n${output.join('')}`);
    throw error;
  } finally {
    if (runtime.exitCode == null && runtime.signalCode == null) {
      runtime.kill('SIGKILL');
      await waitForExit(runtime, 2_000).catch(() => {});
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Runtime supervisor smoke failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
