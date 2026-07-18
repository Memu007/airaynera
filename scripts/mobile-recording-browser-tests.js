#!/usr/bin/env node
/**
 * Real-browser tests for direct mobile-web recording (Chromium via
 * playwright-core, with a fake microphone). They exercise behaviour that only
 * exists in the browser:
 *  - record → stop → listen → use feeds the EXISTING upload pipeline, produces a
 *    fake draft, and the confirmed note persists across a reload;
 *  - the mic is released on stop;
 *  - a denied permission creates no draft/session and keeps file + text options;
 *  - re-recording drops the previous take and re-releases the mic;
 *  - the prepare button disables during upload (no double submit);
 *  - a lost upload response + retry does not create a duplicate session;
 *  - closing the modal with an unsent recording warns.
 *
 * Real iPhone/Android smoke is a SEPARATE validation step (no device access
 * here); this suite uses Chromium's fake device and does not, by itself,
 * certify full mobile support.
 *
 * Not part of `npm test`. Run with: npm run test:mobile-recording:browser
 */

const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

let chromium;
try {
  ({ chromium } = require('playwright-core'));
} catch (_) {
  console.error('playwright-core is not installed; run `npm install` first.');
  process.exit(1);
}

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

function chromiumExecutableCandidates() {
  const candidates = [];
  const explicit = process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.CHROMIUM_PATH;
  if (explicit) candidates.push(explicit);
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  try {
    for (const dir of fs.readdirSync(root)) {
      if (!dir.startsWith('chromium')) continue;
      candidates.push(
        path.join(root, dir, 'chrome-linux', 'chrome'),
        path.join(root, dir, 'chrome-linux', 'headless_shell'),
        path.join(root, dir, 'chrome-mac', 'Chromium.app', 'Contents', 'MacOS', 'Chromium')
      );
    }
  } catch (_) { /* no managed browsers dir */ }
  candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  );
  return candidates;
}

async function launchBrowser() {
  // A fake mic device + auto-granted media UI so getUserMedia resolves headless.
  const args = [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
  ];
  const executablePath = chromiumExecutableCandidates().find((p) => {
    try { return p && fs.existsSync(p); } catch (_) { return false; }
  });
  if (executablePath) {
    console.log(`Using browser binary: ${executablePath}`);
    return chromium.launch({ executablePath, args });
  }
  for (const channel of ['chrome', 'chromium', 'msedge']) {
    try {
      const b = await chromium.launch({ channel, args });
      console.log(`Using installed browser channel: ${channel}`);
      return b;
    } catch (_) { /* try next */ }
  }
  throw new Error('No Chromium/Chrome found. Set PLAYWRIGHT_CHROMIUM_PATH or install Chrome.');
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
    const onExit = (code, signal) => reject(new Error(`Server exited before healthy (${code ?? signal})`));
    serverProcess.once('exit', onExit);
    const check = async () => {
      try {
        const res = await fetch(url);
        if (res.ok) { serverProcess.off('exit', onExit); return resolve(); }
      } catch (_) { /* still starting */ }
      if (Date.now() - startedAt >= 15000) {
        serverProcess.off('exit', onExit);
        return reject(new Error('Server did not become healthy in time'));
      }
      setTimeout(check, 150);
    };
    check();
  });
}

const VENDOR_BY_NAME = {
  'jquery.min.js': 'vendor/jquery@3.6.0/jquery.min.js',
  'bootstrap.bundle.min.js': 'vendor/bootstrap@4.6.2/js/bootstrap.bundle.min.js',
  'intro.min.js': 'vendor/intro.js@7.2.0/intro.min.js',
  'chart.min.js': 'vendor/chart.js@3.9.1/chart.min.js',
  'xlsx.full.min.js': 'vendor/xlsx@0.17.5/xlsx.full.min.js',
};

async function routeVendor(target) {
  await target.route('**/cdnjs.cloudflare.com/**', (route) => {
    const baseName = route.request().url().split('/').pop().split('?')[0];
    const local = VENDOR_BY_NAME[baseName];
    if (local && fs.existsSync(path.join(ROOT_DIR, local))) {
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT_DIR, local)) });
    }
    return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
  });
}

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-mobile-rec-browser-'));
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
    AUDIO_TRANSCRIBER: 'fake',
    NOTE_CLEANER: 'fake',
    AUDIO_WORKER_POLL_MS: '100',
    AUDIO_JOB_LEASE_MS: '2000',
  };

  const serverLogs = [];
  const server = spawn(process.execPath, ['server.js'], { cwd: ROOT_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', (c) => serverLogs.push(c.toString()));
  server.stderr.on('data', (c) => serverLogs.push(c.toString()));
  // The audio worker is a separate process (as in start-runtime.js).
  const worker = spawn(process.execPath, ['workers/audio-worker.js'], { cwd: ROOT_DIR, env, stdio: ['ignore', 'pipe', 'pipe'] });
  worker.stdout.on('data', (c) => serverLogs.push(c.toString()));
  worker.stderr.on('data', (c) => serverLogs.push(c.toString()));

  let token = null;
  const api = async (method, pathname, body) => {
    const res = await fetch(base + pathname, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    return { status: res.status, data };
  };
  const sessionCount = async () => ((await api('GET', '/api/sessions')).data.sessions || []).length;

  let browser;
  try {
    await waitForHealth(`${base}/health`, server);
    token = (await api('POST', '/api/auth/register', { dni: '30222333', pin: '1234', name: 'Dra. Móvil' })).data.token;
    const patientId = String((await api('POST', '/api/patients', { name: 'Paco Fake', dni: '41000001' })).data.id);
    const patientB = String((await api('POST', '/api/patients', { name: 'Bruna Fake', dni: '41000002' })).data.id);

    browser = await launchBrowser();
    const context = await browser.newContext({ permissions: ['microphone'] });
    // Instrument getUserMedia so tests can prove the mic is released, and can
    // deterministically simulate a denied permission.
    await context.addInitScript(() => {
      window.__micActive = false;
      window.__micStops = 0;
      window.__micAcquires = 0; // successful getUserMedia() resolutions
      window.__denyMic = false;
      window.__micDelayMs = 0; // simulate a slow permission prompt
      const md = navigator.mediaDevices;
      if (md && md.getUserMedia) {
        const orig = md.getUserMedia.bind(md);
        md.getUserMedia = async (constraints) => {
          if (window.__micDelayMs) await new Promise((r) => setTimeout(r, window.__micDelayMs));
          if (window.__denyMic) {
            const err = new Error('Permission denied'); err.name = 'NotAllowedError'; throw err;
          }
          const stream = await orig(constraints);
          window.__micAcquires += 1;
          window.__micActive = true;
          stream.getTracks().forEach((t) => {
            const stop = t.stop.bind(t);
            t.stop = () => { window.__micStops += 1; window.__micActive = false; stop(); };
          });
          return stream;
        };
      }
    });
    await routeVendor(context);
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const dialogs = [];
    page.on('dialog', (d) => { dialogs.push(d.message()); d.accept().catch(() => {}); });

    await page.addInitScript((t) => localStorage.setItem('authToken', t), token);
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForFunction(() => typeof window.showNewSessionModal === 'function', { timeout: 15000 });
    await page.waitForTimeout(500);

    const openAudioModal = async () => {
      await page.evaluate((pid) => {
        window.showNewSessionModal();
        const r = document.querySelector('#sessionInputAudio');
        r.checked = true;
        window.setSessionInputMode('audio');
        document.querySelector('#sessionPatient').value = pid;
        document.querySelector('#sessionDurationMinutes').value = '30';
        document.querySelector('#sessionCareModality').value = 'inPerson';
      }, patientId);
      await page.waitForSelector('#newSessionModal.show', { timeout: 5000 });
      await page.waitForTimeout(200);
    };
    const record = async (ms) => {
      await page.click('#recordAudioBtn');
      await page.waitForSelector('#stopAudioBtn:not(.d-none)', { timeout: 5000 });
      await page.waitForTimeout(ms);
      await page.click('#stopAudioBtn');
      // A completed take shows the "Regrabar" affordance and the playback element.
      await page.waitForSelector('#rerecordAudioBtn:not(.d-none)', { timeout: 5000 });
    };
    const forceCloseModal = async () => {
      await page.evaluate(() => {
        window.__airaForceCloseNewSession = true;
        window.jQuery('#newSessionModal').modal('hide');
        window.__airaForceCloseNewSession = false;
      });
      await page.waitForTimeout(300);
    };

    // ---- 1. Happy path: record → stop → listen → use → ready note → save → reload ----
    console.log('\n1️⃣  Record → stop → use → prepared note → save → persists after reload');
    await openAudioModal();
    await record(1200);
    const hasPlayback = await page.evaluate(() => {
      const el = document.querySelector('#recordPlayback');
      return !!el && !el.classList.contains('d-none') && !!el.getAttribute('src');
    });
    test('a recorded take can be played back', hasPlayback);
    const [uploadResp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/audio-drafts/upload') && r.request().method() === 'POST', { timeout: 10000 }),
      page.click('#prepareWebAudioBtn'),
    ]);
    test('recording upload is accepted (2xx)', uploadResp.status() >= 200 && uploadResp.status() < 300);
    await page.waitForFunction(() => (document.querySelector('#sessionContent').value || '').length > 0, { timeout: 12000 });
    const preparedNote = await page.evaluate(() => document.querySelector('#sessionContent').value);
    test('a prepared note appears from the fake transcriber', /Transcripción simulada|.+/.test(preparedNote) && preparedNote.length > 0);
    const before = await sessionCount();
    await page.fill('#sessionContent', 'Nota grabada desde el celular (revisada).');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/confirm') && r.request().method() === 'POST', { timeout: 10000 }),
      page.click("#newSessionForm button[type='submit']"),
    ]);
    await page.waitForTimeout(400);
    const after = await sessionCount();
    test('confirming the recorded note creates exactly one session', after === before + 1);
    const persisted = ((await api('GET', '/api/sessions')).data.sessions || []).find((s) => s.cleanNote === 'Nota grabada desde el celular (revisada).');
    test('the recorded session persisted on the server', Boolean(persisted));
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(600);
    const stillThere = ((await api('GET', '/api/sessions')).data.sessions || []).some((s) => s.cleanNote === 'Nota grabada desde el celular (revisada).');
    test('the recorded session is still there after a reload', stillThere);

    // ---- 2. The mic is released when recording stops ----
    console.log('\n2️⃣  Stopping the recording releases the microphone');
    await openAudioModal();
    await record(800);
    const micState = await page.evaluate(() => ({ active: window.__micActive, stops: window.__micStops }));
    test('mic track was stopped on Detener', micState.stops >= 1 && micState.active === false);
    await forceCloseModal();

    // ---- 3. Denied permission creates nothing and keeps file + text options ----
    console.log('\n3️⃣  Denied mic permission creates no draft/session and keeps alternatives');
    const beforeDenied = await sessionCount();
    await openAudioModal();
    await page.evaluate(() => { window.__denyMic = true; });
    await page.click('#recordAudioBtn');
    await page.waitForTimeout(500);
    const deniedView = await page.evaluate(() => ({
      recording: !!(window.webAudioMediaRecorder),
      hint: document.querySelector('#recordHint').textContent || '',
      fileVisible: !document.querySelector('#webAudioUploadSection').classList.contains('d-none') && !!document.querySelector('#webAudioFile'),
      stopHidden: document.querySelector('#stopAudioBtn').classList.contains('d-none'),
    }));
    test('denied permission shows an explanation', /permiso|micrófono/i.test(deniedView.hint));
    test('denied permission does not start recording', deniedView.stopHidden === true);
    test('the file-upload alternative stays available', deniedView.fileVisible === true);
    // Text mode is still reachable.
    await page.evaluate(() => { const r = document.querySelector('#sessionInputText'); r.checked = true; window.setSessionInputMode('text'); });
    const textReachable = await page.evaluate(() => document.querySelector('#webAudioUploadSection').classList.contains('d-none'));
    test('the text-note alternative stays available', textReachable === true);
    test('denied permission created no session', (await sessionCount()) === beforeDenied);
    await page.evaluate(() => { window.__denyMic = false; });
    await forceCloseModal();

    // ---- 4. Re-recording drops the previous take and releases the mic again ----
    console.log('\n4️⃣  Re-recording drops the old take and re-releases the mic');
    await openAudioModal();
    await record(800);
    await page.evaluate(() => { window.__micStops = 0; });
    await page.click('#rerecordAudioBtn');
    await page.waitForSelector('#stopAudioBtn:not(.d-none)', { timeout: 5000 });
    await page.waitForTimeout(700);
    await page.click('#stopAudioBtn');
    await page.waitForSelector('#rerecordAudioBtn:not(.d-none)', { timeout: 5000 });
    const rerec = await page.evaluate(() => ({ active: window.__micActive, stops: window.__micStops }));
    test('re-recording stops the mic again', rerec.stops >= 1 && rerec.active === false);
    await forceCloseModal();

    // ---- 5. Prepare disables during upload (no double submit) ----
    console.log('\n5️⃣  Prepare button disables during upload (guards double taps)');
    await openAudioModal();
    await record(900);
    await page.click('#prepareWebAudioBtn');
    const disabledDuringUpload = await page.evaluate(() => document.querySelector('#prepareWebAudioBtn').disabled === true);
    test('prepare is disabled while uploading', disabledDuringUpload);
    await page.waitForFunction(() => (document.querySelector('#sessionContent').value || '').length > 0, { timeout: 12000 });
    await forceCloseModal();

    // ---- 6. A lost upload response + retry does not create a duplicate ----
    console.log('\n6️⃣  Lost upload response then retry creates no duplicate session');
    const beforeRetry = await sessionCount();
    await openAudioModal();
    await record(900);
    let failNextUpload = true;
    await page.route('**/api/audio-drafts/upload**', (route) => {
      if (failNextUpload) { failNextUpload = false; return route.abort(); }
      return route.continue();
    });
    await page.click('#prepareWebAudioBtn'); // first attempt: aborted
    await page.waitForTimeout(600);
    const noDraftYet = await page.evaluate(() => (document.querySelector('#sessionContent').value || '').length === 0);
    test('a failed upload prepares no note yet', noDraftYet);
    await page.click('#prepareWebAudioBtn'); // retry with the same in-memory take + idempotency key
    await page.waitForFunction(() => (document.querySelector('#sessionContent').value || '').length > 0, { timeout: 12000 });
    await page.unroute('**/api/audio-drafts/upload**');
    await page.fill('#sessionContent', 'Nota tras respuesta perdida.');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/confirm') && r.request().method() === 'POST', { timeout: 10000 }),
      page.click("#newSessionForm button[type='submit']"),
    ]);
    await page.waitForTimeout(400);
    test('retry after a lost response adds exactly one session', (await sessionCount()) === beforeRetry + 1);

    // ---- 7. Closing with an unsent recording warns ----
    console.log('\n7️⃣  Closing the modal with an unsent recording warns');
    await openAudioModal();
    await record(700);
    const dialogsBefore = dialogs.length;
    await page.evaluate(() => window.jQuery('#newSessionModal').modal('hide')); // not forced → guard runs
    await page.waitForTimeout(300);
    test('closing with an unsent recording asks for confirmation', dialogs.length > dialogsBefore);

    // ---- 8. A failed upload keeps patient + clinical data pinned; retry keeps A ----
    console.log('\n8️⃣  Failed upload keeps the patient locked; retry stays on the same patient');
    const before8 = await sessionCount();
    await openAudioModal();
    await record(900);
    let fail8 = true;
    await page.route('**/api/audio-drafts/upload**', (route) => {
      if (fail8) { fail8 = false; return route.abort(); }
      return route.continue();
    });
    await page.click('#prepareWebAudioBtn'); // fails
    await page.waitForTimeout(700);
    const lockedAfterFail = await page.evaluate(() => ({
      patientDisabled: document.querySelector('#sessionPatient').disabled === true,
      dateDisabled: document.querySelector('#sessionClinicalDate').disabled === true,
      patientValue: document.querySelector('#sessionPatient').value,
      stillHasTake: !document.querySelector('#rerecordAudioBtn').classList.contains('d-none'),
    }));
    test('patient stays locked after a failed upload', lockedAfterFail.patientDisabled === true);
    test('clinical date stays locked after a failed upload', lockedAfterFail.dateDisabled === true);
    test('the recording is still available to retry', lockedAfterFail.stillHasTake === true);
    // A locked select cannot be changed by the user (blocks switching to B).
    test('the patient cannot be switched while locked', lockedAfterFail.patientDisabled === true && lockedAfterFail.patientValue === patientId);
    await page.unroute('**/api/audio-drafts/upload**');
    await page.click('#prepareWebAudioBtn'); // retry
    await page.waitForFunction(() => (document.querySelector('#sessionContent').value || '').length > 0, { timeout: 12000 });
    await page.fill('#sessionContent', 'Nota tras subida fallida (paciente A).');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/confirm') && r.request().method() === 'POST', { timeout: 10000 }),
      page.click("#newSessionForm button[type='submit']"),
    ]);
    await page.waitForTimeout(400);
    const retained = ((await api('GET', '/api/sessions')).data.sessions || []).find((s) => s.cleanNote === 'Nota tras subida fallida (paciente A).');
    test('retry adds exactly one session', (await sessionCount()) === before8 + 1);
    test('the retried session kept patient A', retained && String(retained.patientId) === patientId);

    // ---- 9. Double taps during acquisition acquire the mic only once ----
    console.log('\n9️⃣  Double taps during a slow permission prompt acquire the mic once');
    await openAudioModal();
    await page.evaluate(() => { window.__micAcquires = 0; window.__micDelayMs = 400; });
    await page.evaluate(() => { window.startWebAudioRecording(); window.startWebAudioRecording(); }); // two rapid taps
    await page.waitForSelector('#stopAudioBtn:not(.d-none)', { timeout: 5000 });
    const acquires = await page.evaluate(() => window.__micAcquires);
    test('a double tap acquires the mic only once', acquires === 1);
    await page.evaluate(() => { window.__micDelayMs = 0; });
    await page.click('#stopAudioBtn');
    await page.waitForSelector('#rerecordAudioBtn:not(.d-none)', { timeout: 5000 });
    await forceCloseModal();

    // ---- 10. A pending acquisition invalidated (switch to text) stops the late stream ----
    console.log('\n🔟 Switching to text during acquisition stops the late-arriving stream');
    await openAudioModal();
    await page.evaluate(() => { window.__micAcquires = 0; window.__micStops = 0; window.__micDelayMs = 500; });
    await page.evaluate(() => window.startWebAudioRecording()); // acquisition pending
    await page.waitForTimeout(50);
    await page.evaluate(() => { const r = document.querySelector('#sessionInputText'); r.checked = true; window.setSessionInputMode('text'); }); // invalidate
    await page.waitForTimeout(800); // let the delayed getUserMedia resolve
    const lateStream = await page.evaluate(() => ({ acquires: window.__micAcquires, stops: window.__micStops, active: window.__micActive, recording: !document.querySelector('#stopAudioBtn') || document.querySelector('#stopAudioBtn').classList.contains('d-none') }));
    test('a late-resolving stream is stopped, not used', lateStream.acquires === 1 && lateStream.stops >= 1 && lateStream.active === false);
    test('no recording started after the invalidated request', lateStream.recording === true);
    await page.evaluate(() => { window.__micDelayMs = 0; });
    await forceCloseModal();

    // ---- 11. Logout tears down an active recording (recorder/tracks/local audio) ----
    console.log('\n1️⃣1️⃣ Logout stops the recorder, releases the mic and creates no session');
    const before11 = await sessionCount();
    await openAudioModal();
    await record(700); // a recorded take exists (mic already released on stop)
    await page.evaluate(() => { window.__micStops = 0; });
    // Start a fresh recording so the mic is actively open at logout time.
    await page.click('#rerecordAudioBtn');
    await page.waitForSelector('#stopAudioBtn:not(.d-none)', { timeout: 5000 });
    const activeBeforeLogout = await page.evaluate(() => window.__micActive);
    await page.evaluate(() => window.logout());
    await page.waitForFunction(() => !localStorage.getItem('authToken'), { timeout: 6000 });
    await page.waitForTimeout(200);
    const afterLogout = await page.evaluate(() => ({ active: window.__micActive, stops: window.__micStops }));
    test('the mic was open during recording before logout', activeBeforeLogout === true);
    test('logout stops the recorder and releases the mic', afterLogout.active === false && afterLogout.stops >= 1);
    test('logout created no session', (await sessionCount()) === before11);

    test('no uncaught page errors during the run', pageErrors.length === 0);
    if (pageErrors.length) console.log('   page errors:', pageErrors.join(' | '));

    console.log(`\n════════════════════════════════════════`);
    console.log(`📊 Mobile recording browser results: ${passed} passed, ${failed} failed`);
    console.log(`════════════════════════════════════════`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(`Mobile recording browser runner failed: ${error.message}`);
    if (serverLogs.length) console.error('\nServer output:\n' + serverLogs.slice(-40).join(''));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    // Actually wait for the server and worker to exit; force-kill as a bounded
    // fallback so the runner never hangs on a lingering child process.
    await Promise.all([stopProcess(server), stopProcess(worker)]);
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

// Terminate a child process and resolve only once it has actually exited.
// SIGTERM first, then SIGKILL after a bounded wait, then give up after another.
function stopProcess(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.exitCode !== null || proc.signalCode !== null) return resolve();
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    proc.once('exit', finish);
    try { proc.kill('SIGTERM'); } catch (_) { return finish(); }
    setTimeout(() => { if (!done) { try { proc.kill('SIGKILL'); } catch (_) {} } }, 3000);
    setTimeout(finish, 6000); // hard cap so cleanup never blocks forever
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
