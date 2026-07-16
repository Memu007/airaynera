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
  // Valid edits must carry the current revision (If-Match is mandatory).
  const patchSession = async (id, body, extraHeaders = {}) => {
    const current = await getSession(id);
    return api('PATCH', `/api/sessions/${id}`, body, {
      'If-Match': String(current.revision),
      ...extraHeaders,
    });
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
    const otherPatient = await api('POST', '/api/patients', { name: 'Paciente Dos', dni: '40777888' });
    const otherPatientId = String(otherPatient.data.id);

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
      const patch = await patchSession(id, {
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
      const patch = await patchSession(id, { medicationNotes: null });
      test('clearing medication returns 200', patch.status === 200);
      const after = await getSession(id);
      test('medication persists as null after clearing', after.medicationNotes === null);
    }

    // Shared adversarial matrix: wrong values, wrong types, arrays and objects.
    // Each is a body fragment applied over a valid session on both POST and PATCH.
    const ADVERSARIAL_CASES = [
      ['sessionType: invalid string', { sessionType: 'therapy' }],
      ['sessionType: null', { sessionType: null }],
      ['sessionType: object', { sessionType: {} }],
      ['sessionType: array', { sessionType: ['individual'] }],
      ['careModality: invalid', { careModality: 'telepathy' }],
      ['careModality: array', { careModality: [] }],
      ['moodAssessment: above range', { moodAssessment: 9 }],
      ['moodAssessment: below range', { moodAssessment: 0 }],
      ['moodAssessment: string', { moodAssessment: '3' }],
      ['moodAssessment: float', { moodAssessment: 3.5 }],
      ['moodAssessment: array', { moodAssessment: [3] }],
      ['durationMinutes: decimal', { durationMinutes: 45.9 }],
      ['durationMinutes: exponential string', { durationMinutes: '4e2' }],
      ['durationMinutes: above range', { durationMinutes: 500 }],
      ['durationMinutes: zero', { durationMinutes: 0 }],
      ['durationMinutes: numeric string', { durationMinutes: '45' }],
      ['durationMinutes: array', { durationMinutes: [45] }],
      ['durationMinutes: object', { durationMinutes: {} }],
      ['clinicalDate: slashes', { clinicalDate: '2026/07/10' }],
      ['clinicalDate: not-a-date', { clinicalDate: 'not-a-date' }],
      ['clinicalDate: impossible', { clinicalDate: '2026-02-31' }],
      ['clinicalDate: number', { clinicalDate: 20260710 }],
      ['clinicalDate: array', { clinicalDate: [] }],
      ['requiresFollowUp: "yes"', { requiresFollowUp: 'yes' }],
      ['requiresFollowUp: "false"', { requiresFollowUp: 'false' }],
      ['requiresFollowUp: 1', { requiresFollowUp: 1 }],
      ['requiresFollowUp: array', { requiresFollowUp: [true] }],
      ['cleanNote: false', { cleanNote: false }],
      ['cleanNote: number', { cleanNote: 123 }],
      ['cleanNote: array', { cleanNote: [] }],
      ['cleanNote: oversized', { cleanNote: 'x'.repeat(10001) }],
      ['medicationNotes: oversized', { medicationNotes: 'x'.repeat(5001) }],
      ['medicationNotes: number', { medicationNotes: 123 }],
      ['medicationNotes: array', { medicationNotes: [] }],
    ];

    const sameFields = (a, b) =>
      a.cleanNote === b.cleanNote &&
      a.sessionType === b.sessionType &&
      a.durationMinutes === b.durationMinutes &&
      a.careModality === b.careModality &&
      a.moodAssessment === b.moodAssessment &&
      a.requiresFollowUp === b.requiresFollowUp &&
      a.clinicalDate === b.clinicalDate &&
      a.medicationNotes === b.medicationNotes &&
      a.patientId === b.patientId &&
      a.revision === b.revision;

    console.log('\n3️⃣  Out-of-contract PATCH: each case is 400 and never persists');
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
        medicationNotes: 'MedBase',
      });
      const id = created.data.id;
      const baseline = await getSession(id);

      // Send a valid revision so each case is judged on the contract (400),
      // not on the precondition (428); invalid bodies never bump the revision.
      const ifMatch = { 'If-Match': String(baseline.revision) };
      for (const [label, body] of ADVERSARIAL_CASES) {
        const res = await api('PATCH', `/api/sessions/${id}`, body, ifMatch);
        test(`PATCH ${label} → 400`, res.status === 400);
      }
      // Also: an object patientId must be 400 (reassignment guard), never 500.
      const objPatient = await api('PATCH', `/api/sessions/${id}`, { patientId: {} }, ifMatch);
      test('PATCH patientId object → 400 (not 500)', objPatient.status === 400);

      const afterInvalid = await getSession(id);
      test('no field (incl. medication/revision) changed after invalid PATCHes', sameFields(afterInvalid, baseline));
    }

    console.log('\n3️⃣b Out-of-contract POST: each case is 400 and creates nothing');
    {
      const validBase = {
        patientId,
        cleanNote: 'Alta válida.',
        sessionType: 'individual',
        durationMinutes: 40,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
        moodAssessment: 3,
        requiresFollowUp: false,
      };
      const before = (await api('GET', '/api/sessions')).data.sessions.length;

      for (const [label, body] of ADVERSARIAL_CASES) {
        const res = await api('POST', '/api/sessions', { ...validBase, ...body });
        test(`POST ${label} → 400`, res.status === 400);
      }
      for (const [label, value] of [['object', {}], ['array', []]]) {
        const res = await api('POST', '/api/sessions', { ...validBase, patientId: value });
        test(`POST patientId ${label} → 400 (not 500)`, res.status === 400);
      }

      // Audio-evidence fields are validated on create.
      const audioCases = [
        ['inputType: invalid enum', { inputType: 'video' }],
        ['inputType: array', { inputType: ['audio'] }],
        ['rawTranscript: number', { rawTranscript: 123 }],
        ['rawTranscript: object', { rawTranscript: {} }],
        ['rawTranscript: oversized', { rawTranscript: 'x'.repeat(20001) }],
        ['audioDurationSeconds: string', { audioDurationSeconds: 'x' }],
        ['audioDurationSeconds: negative', { audioDurationSeconds: -5 }],
        ['audioDurationSeconds: zero', { audioDurationSeconds: 0 }],
        ['audioDurationSeconds: too long', { audioDurationSeconds: 99999 }],
        ['audioDurationSeconds: array', { audioDurationSeconds: [10] }],
      ];
      for (const [label, body] of audioCases) {
        const res = await api('POST', '/api/sessions', { ...validBase, ...body });
        test(`POST ${label} → 400`, res.status === 400);
      }

      const after = (await api('GET', '/api/sessions')).data.sessions.length;
      test('no session was created by any invalid POST', after === before);
    }

    console.log('\n3️⃣c Optimistic concurrency (revision + If-Match)');
    {
      const created = await api('POST', '/api/sessions', {
        patientId,
        cleanNote: 'v-uno',
        durationMinutes: 30,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
      });
      const id = created.data.id;
      const r0 = created.data.revision;
      test('new session starts at revision 1', r0 === 1);

      const ok = await api('PATCH', `/api/sessions/${id}`, { cleanNote: 'v-dos' }, { 'If-Match': String(r0) });
      test('matching If-Match updates (200)', ok.status === 200);
      test('revision increments after a successful edit', ok.data.revision === r0 + 1);

      const stale = await api('PATCH', `/api/sessions/${id}`, { cleanNote: 'v-tres' }, { 'If-Match': String(r0) });
      test('stale If-Match is rejected with 409', stale.status === 409);
      test('409 returns the current session', stale.data?.session?.cleanNote === 'v-dos');
      const afterConflict = await getSession(id);
      test('conflicting edit did not persist', afterConflict.cleanNote === 'v-dos');
      test('conflicting edit did not bump revision', afterConflict.revision === r0 + 1);

      // Precondition is mandatory: a client that omits the revision cannot
      // overwrite blindly.
      const r1 = afterConflict.revision;
      const noHeader = await api('PATCH', `/api/sessions/${id}`, { cleanNote: 'v-cuatro' });
      test('PATCH without If-Match → 428', noHeader.status === 428);
      const afterNoHeader = await getSession(id);
      test('428 changed nothing', afterNoHeader.cleanNote === 'v-dos' && afterNoHeader.revision === r1);

      for (const [label, value] of [
        ['non-integer', 'not-a-number'],
        ['decimal', '1.5'],
        ['negative', '-1'],
        ['zero', '0'],
        ['huge/unsafe', '99999999999999999999'],
        ['blank', '   '],
      ]) {
        const bad = await api('PATCH', `/api/sessions/${id}`, { cleanNote: 'x' }, { 'If-Match': value });
        // A blank header is treated as absent → 428; a present-but-malformed one → 400.
        const expected = value.trim() === '' ? 428 : 400;
        test(`If-Match ${label} → ${expected}`, bad.status === expected);
      }
      const afterBadHeaders = await getSession(id);
      test('malformed revisions changed nothing', afterBadHeaders.revision === r1);

      // Empty / ignored-only patches: 400 and no revision bump.
      for (const [label, body] of [
        ['empty object', {}],
        ['array body', []],
        ['ignored fields only', { rawTranscript: 'x', inputType: 'audio', foo: 1 }],
      ]) {
        const res = await api('PATCH', `/api/sessions/${id}`, body, { 'If-Match': String(r1) });
        test(`empty/ignored PATCH (${label}) → 400`, res.status === 400);
      }
      const afterEmpty = await getSession(id);
      test('empty/ignored patches did not bump revision', afterEmpty.revision === r1);

      // A correct edit with the fresh revision still works and increments.
      const ok2 = await api('PATCH', `/api/sessions/${id}`, { cleanNote: 'v-final' }, { 'If-Match': String(r1) });
      test('valid edit with fresh revision → 200', ok2.status === 200);
      test('revision increments again', ok2.data.revision === r1 + 1);
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

      const patch = await patchSession(id, {
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
      const patch = await patchSession(id, {
        durationMinutes: null,
        moodAssessment: null,
      });
      test('clearing duration/mood returns 200', patch.status === 200);
      const after = await getSession(id);
      test('duration cleared to null', after.durationMinutes === null);
      test('mood cleared to null', after.moodAssessment === null);
    }

    console.log('\n6️⃣  Patient cannot be reassigned through PATCH');
    {
      const created = await api('POST', '/api/sessions', {
        patientId,
        cleanNote: 'Pertenece al paciente uno.',
        durationMinutes: 30,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
      });
      const id = created.data.id;

      const byCamel = await api('PATCH', `/api/sessions/${id}`, {
        patientId: otherPatientId,
        cleanNote: 'Intento de robo camelCase.',
      });
      test('reassign via patientId is rejected (400)', byCamel.status === 400);

      const bySnake = await api('PATCH', `/api/sessions/${id}`, {
        pacienteId: otherPatientId,
        cleanNote: 'Intento de robo snake.',
      });
      test('reassign via pacienteId is rejected (400)', bySnake.status === 400);

      const after = await getSession(id);
      test('session still belongs to the original patient', after.patientId === patientId);
      test('rejected reassign did not change the note', after.cleanNote === 'Pertenece al paciente uno.');
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
