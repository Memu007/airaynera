#!/usr/bin/env node
/**
 * Session edit contract tests (headless, no browser).
 *
 * Covers the server side of the "edit a saved session" flow:
 *  - a full edit persists and is still there after a fresh reload;
 *  - clearing medication persists NULL and disappears;
 *  - out-of-contract PATCH bodies are rejected with 400 and never persist;
 *  - rawTranscript / inputType / audioDurationSeconds stay immutable on PATCH.
 *
 * The script owns its runtime: it starts server.js against a temporary SQLite
 * database, runs the assertions over HTTP and cleans everything up.
 */

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const STARTUP_TIMEOUT_MS = 15_000;

let passed = 0;
let failed = 0;
function test(name, condition) {
  if (condition) {
    passed += 1;
    console.log(`   ✅ ${name}`);
  } else {
    failed += 1;
    console.log(`   ❌ ${name}`);
  }
}

function findAvailablePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close((error) => (error ? reject(error) : resolve(port)));
    });
  });
}

function waitForHealth(url, serverProcess) {
  const startedAt = Date.now();
  return new Promise((resolve, reject) => {
    const onExit = (code, signal) =>
      reject(new Error(`Server exited before healthy (${code ?? signal})`));
    serverProcess.once('exit', onExit);
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) {
          serverProcess.off('exit', onExit);
          return resolve();
        }
      } catch (_) {
        // still starting
      }
      if (Date.now() - startedAt >= STARTUP_TIMEOUT_MS) {
        serverProcess.off('exit', onExit);
        return reject(new Error('Server did not become healthy in time'));
      }
      setTimeout(check, 150);
    };
    check();
  });
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-session-edit-'));
  const port = await findAvailablePort();
  const base = `http://127.0.0.1:${port}`;
  const env = {
    ...process.env,
    DATA_DIR: dataDir,
    PORT: String(port),
    NODE_ENV: 'test',
    JWT_SECRET: crypto.randomBytes(32).toString('hex'),
    DATA_KEY: crypto.randomBytes(32).toString('hex'),
    AUDIO_UPLOAD_DIR: path.join(dataDir, 'audio-uploads'),
  };

  const serverLogs = [];
  const server = spawn(process.execPath, ['server.js'], {
    cwd: ROOT_DIR,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', (c) => serverLogs.push(c.toString()));
  server.stderr.on('data', (c) => serverLogs.push(c.toString()));

  let token = null;
  const api = async (method, pathname, body, headers = {}) => {
    const res = await fetch(base + pathname, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      data = null;
    }
    return { status: res.status, data };
  };
  const getSession = async (id) => {
    const res = await api('GET', '/api/sessions');
    return (res.data.sessions || []).find((s) => String(s.id) === String(id));
  };

  try {
    await waitForHealth(`${base}/health`, server);

    const reg = await api('POST', '/api/auth/register', {
      dni: '30111222',
      pin: '1234',
      name: 'Dra. Test',
    });
    token = reg.data.token;
    const patient = await api('POST', '/api/patients', { name: 'Paciente Uno', dni: '40555666' });
    const patientId = String(patient.data.id);

    console.log('\n1️⃣  Full edit persists and survives reload');
    {
      const created = await api('POST', '/api/sessions', {
        patientId,
        cleanNote: 'Nota original.',
        sessionType: 'individual',
        durationMinutes: 45,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
        moodAssessment: 3,
        requiresFollowUp: false,
        medicationNotes: 'Ninguna',
      });
      const id = created.data.id;
      const patch = await api('PATCH', `/api/sessions/${id}`, {
        cleanNote: 'Nota EDITADA.',
        sessionType: 'couple',
        durationMinutes: 60,
        careModality: 'video',
        clinicalDate: '2026-07-12',
        moodAssessment: 5,
        requiresFollowUp: true,
        medicationNotes: 'Sertralina 50mg',
      });
      test('Valid full edit returns 200', patch.status === 200);
      const reloaded = await getSession(id);
      test('cleanNote persisted after reload', reloaded.cleanNote === 'Nota EDITADA.');
      test('sessionType persisted', reloaded.sessionType === 'couple');
      test('durationMinutes persisted', reloaded.durationMinutes === 60);
      test('careModality persisted', reloaded.careModality === 'video');
      test('clinicalDate persisted', reloaded.clinicalDate === '2026-07-12');
      test('moodAssessment persisted', reloaded.moodAssessment === 5);
      test('requiresFollowUp persisted', reloaded.requiresFollowUp === true);
      test('medicationNotes persisted', reloaded.medicationNotes === 'Sertralina 50mg');
    }

    console.log('\n2️⃣  Clearing medication persists null');
    {
      const created = await api('POST', '/api/sessions', {
        patientId,
        cleanNote: 'Con medicación.',
        durationMinutes: 30,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
        medicationNotes: 'Clonazepam 0.5mg',
      });
      const id = created.data.id;
      const before = await getSession(id);
      test('medication present before clearing', before.medicationNotes === 'Clonazepam 0.5mg');
      const patch = await api('PATCH', `/api/sessions/${id}`, { medicationNotes: null });
      test('clearing medication returns 200', patch.status === 200);
      const after = await getSession(id);
      test('medication persists as null after clearing', after.medicationNotes === null);
    }

    console.log('\n3️⃣  Out-of-contract PATCH is rejected (400) and never persists');
    {
      const created = await api('POST', '/api/sessions', {
        patientId,
        cleanNote: 'Base intacta.',
        sessionType: 'individual',
        durationMinutes: 40,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
        moodAssessment: 3,
        requiresFollowUp: false,
      });
      const id = created.data.id;
      const baseline = await getSession(id);

      const invalidBodies = [
        ['invalid sessionType', { sessionType: 'therapy' }],
        ['invalid careModality', { careModality: 'telepathy' }],
        ['mood above range', { moodAssessment: 9 }],
        ['mood below range', { moodAssessment: 0 }],
        ['decimal duration', { durationMinutes: 45.9 }],
        ['exponential duration', { durationMinutes: '4e2' }],
        ['duration above range', { durationMinutes: 500 }],
        ['duration zero', { durationMinutes: 0 }],
        ['malformed date', { clinicalDate: '2026/07/10' }],
        ['non-boolean followup', { requiresFollowUp: 'yes' }],
        ['numeric followup', { requiresFollowUp: 1 }],
        ['oversized note', { cleanNote: 'x'.repeat(10001) }],
      ];

      let all400 = true;
      for (const [label, body] of invalidBodies) {
        const res = await api('PATCH', `/api/sessions/${id}`, body);
        if (res.status !== 400) {
          all400 = false;
          console.log(`      · ${label} returned ${res.status}, expected 400`);
        }
      }
      test('every invalid PATCH returns 400', all400);

      const afterInvalid = await getSession(id);
      test(
        'session unchanged after invalid PATCHes',
        afterInvalid.cleanNote === baseline.cleanNote &&
          afterInvalid.sessionType === baseline.sessionType &&
          afterInvalid.durationMinutes === baseline.durationMinutes &&
          afterInvalid.careModality === baseline.careModality &&
          afterInvalid.moodAssessment === baseline.moodAssessment &&
          afterInvalid.requiresFollowUp === baseline.requiresFollowUp &&
          afterInvalid.clinicalDate === baseline.clinicalDate
      );
    }

    console.log('\n4️⃣  Immutable audio evidence on PATCH');
    {
      const created = await api('POST', '/api/sessions', {
        patientId,
        cleanNote: 'Audio original.',
        durationMinutes: 30,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
        rawTranscript: 'Transcripción original inmutable',
        audioDurationSeconds: 52,
        inputType: 'audio',
      });
      const id = created.data.id;
      const before = await getSession(id);
      test('created session is audio', before.inputType === 'audio');

      const patch = await api('PATCH', `/api/sessions/${id}`, {
        cleanNote: 'Nota revisada.',
        rawTranscript: 'HACK evidence',
        inputType: 'text',
        audioDurationSeconds: 1,
      });
      test('review edit returns 200', patch.status === 200);
      const after = await getSession(id);
      test('cleanNote updated on audio session', after.cleanNote === 'Nota revisada.');
      test('rawTranscript immutable', after.rawTranscript === before.rawTranscript);
      test('inputType immutable', after.inputType === 'audio');
      test('audioDurationSeconds immutable', after.audioDurationSeconds === 52);
    }

    console.log('\n5️⃣  Nullable clinical fields can be cleared with a valid edit');
    {
      const created = await api('POST', '/api/sessions', {
        patientId,
        cleanNote: 'Con duración y ánimo.',
        durationMinutes: 45,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
        moodAssessment: 4,
      });
      const id = created.data.id;
      const patch = await api('PATCH', `/api/sessions/${id}`, {
        durationMinutes: null,
        moodAssessment: null,
      });
      test('clearing duration/mood returns 200', patch.status === 200);
      const after = await getSession(id);
      test('duration cleared to null', after.durationMinutes === null);
      test('mood cleared to null', after.moodAssessment === null);
    }

    console.log(`\n════════════════════════════════════════`);
    console.log(`📊 Session edit results: ${passed} passed, ${failed} failed`);
    console.log(`════════════════════════════════════════`);
    if (failed > 0 && serverLogs.length) {
      console.error('\nServer output:\n' + serverLogs.join(''));
    }
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(`Session edit test runner failed: ${error.message}`);
    if (serverLogs.length) console.error('\nServer output:\n' + serverLogs.join(''));
    process.exitCode = 1;
  } finally {
    if (!server.killed) server.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
