#!/usr/bin/env node
/**
 * Real-browser tests for the session edit flow (Chromium via playwright-core).
 *
 * These exercise behaviours that only exist in the browser:
 *  - a full edit through the UI persists across a real page reload;
 *  - clearing medication in the UI removes it from the ficha;
 *  - decimal / exponential duration and an empty date are rejected client-side
 *    (no PATCH is sent);
 *  - a late response for session A cannot overwrite an open session B;
 *  - patient and date filters survive saving an edit;
 *  - session cards open with Enter and Space;
 *  - a patient name is rendered as text, never parsed as HTML, in the form.
 *
 * Not part of `npm test` (needs a browser binary + the vendored CDN assets).
 * Run with: npm run test:session-edit:browser
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

// Resolve a browser across environments (Linux CI, macOS dev, custom paths)
// so the suite is reproducible on a clean checkout, not just this container.
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
  } catch (_) {
    // no managed browsers dir
  }

  candidates.push(
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  );
  return candidates;
}

async function launchBrowser() {
  const executablePath = chromiumExecutableCandidates().find((p) => {
    try {
      return p && fs.existsSync(p);
    } catch (_) {
      return false;
    }
  });
  if (executablePath) {
    console.log(`Using browser binary: ${executablePath}`);
    return chromium.launch({ executablePath });
  }
  // Fall back to an installed browser via channel (e.g. Chrome on CI/macOS).
  for (const channel of ['chrome', 'chromium', 'msedge']) {
    try {
      const b = await chromium.launch({ channel });
      console.log(`Using installed browser channel: ${channel}`);
      return b;
    } catch (_) {
      // try next channel
    }
  }
  throw new Error(
    'No Chromium/Chrome found. Set PLAYWRIGHT_CHROMIUM_PATH to a browser binary, ' +
      'install Google Chrome, or provide a Playwright browser under PLAYWRIGHT_BROWSERS_PATH.'
  );
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

async function main() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-session-edit-browser-'));
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
  const api = async (method, pathname, body) => {
    const res = await fetch(base + pathname, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
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

  let browser;
  try {
    await waitForHealth(`${base}/health`, server);

    // ---- Seed data through the real API ----
    token = (await api('POST', '/api/auth/register', { dni: '30111222', pin: '1234', name: 'Dra. Test' }))
      .data.token;
    const pAna = String((await api('POST', '/api/patients', { name: 'Ana Alfa', dni: '40000001' })).data.id);
    const pBruno = String((await api('POST', '/api/patients', { name: 'Bruno Beta', dni: '40000002' })).data.id);
    const htmlName = 'Paciente <Equipo>';
    const pHtml = String((await api('POST', '/api/patients', { name: htmlName, dni: '40000003' })).data.id);
    const pDate = String((await api('POST', '/api/patients', { name: 'Delia Delta', dni: '40000004' })).data.id);

    const mkSession = async (patientId, extra) =>
      String((await api('POST', '/api/sessions', {
        patientId,
        careModality: 'inPerson',
        clinicalDate: '2026-07-10',
        sessionType: 'individual',
        durationMinutes: 45,
        ...extra,
      })).data.id);

    const htmlNote = 'Nota <script>peligrosa</script> clínica';
    const a1 = await mkSession(pAna, { cleanNote: 'Nota A uno', moodAssessment: 3, medicationNotes: 'Clonazepam 0.5mg' });
    const a2 = await mkSession(pAna, { cleanNote: 'Nota A dos', moodAssessment: 4, durationMinutes: 30 });
    const b1 = await mkSession(pBruno, { cleanNote: 'Nota de Bruno', moodAssessment: 5, durationMinutes: 60 });
    const h1 = await mkSession(pHtml, { cleanNote: htmlNote });
    const dOld = await mkSession(pDate, { cleanNote: 'Sesión vieja de Delia', clinicalDate: '2026-01-05' });
    const dNew = await mkSession(pDate, { cleanNote: 'Sesión nueva de Delia', clinicalDate: '2026-07-10' });

    // ---- Launch the browser ----
    browser = await launchBrowser();
    const page = await browser.newPage();

    // Serve CDN scripts from local vendor copies (sandboxed browser, no egress).
    await page.route('**/cdnjs.cloudflare.com/**', (route) => {
      const baseName = route.request().url().split('/').pop().split('?')[0];
      const local = VENDOR_BY_NAME[baseName];
      if (local && fs.existsSync(path.join(ROOT_DIR, local))) {
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          body: fs.readFileSync(path.join(ROOT_DIR, local)),
        });
      }
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });

    // Track PATCH requests and optionally delay one, for the concurrency tests.
    let patchCount = 0;
    let delayResponseForId = null; // server persists now; response held
    let holdRequestForId = null; // request reaches the server late
    let abortResponseForId = null; // server persists now; response is dropped
    let failPatchesForId = null; // every PATCH to this id fails before reaching the server
    await page.route('**/api/sessions/*', async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        patchCount += 1;
        const url = req.url();
        if (failPatchesForId && url.endsWith(`/api/sessions/${failPatchesForId}`)) {
          return route.abort(); // never reaches the server (network down)
        }
        if (abortResponseForId && url.endsWith(`/api/sessions/${abortResponseForId}`)) {
          abortResponseForId = null;
          // Let the server apply the edit, hold long enough for a v2 to queue,
          // then drop the response so the client sees a network failure without
          // knowing whether it was applied.
          await route.fetch();
          await new Promise((r) => setTimeout(r, 1500));
          return route.abort();
        }
        if (holdRequestForId && url.endsWith(`/api/sessions/${holdRequestForId}`)) {
          holdRequestForId = null;
          // Hold the request so a later save can be queued before this one
          // even reaches the server (serialization under a slow first request).
          await new Promise((r) => setTimeout(r, 1500));
          return route.continue();
        }
        if (delayResponseForId && url.endsWith(`/api/sessions/${delayResponseForId}`)) {
          delayResponseForId = null;
          // Server persists immediately; only the response is held.
          const response = await route.fetch();
          await new Promise((r) => setTimeout(r, 1500));
          return route.fulfill({ response });
        }
      }
      return route.continue();
    });

    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));
    // Auto-accept confirm() dialogs (e.g. the dirty-close guard); track the last.
    const dialogs = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      d.accept().catch(() => {});
    });

    await page.addInitScript((t) => localStorage.setItem('authToken', t), token);
    await page.goto(base + '/', { waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });

    const settle = () => page.waitForTimeout(400); // let Bootstrap's fade finish
    const openDetail = async (id) => {
      await page.evaluate((sid) => window.showSessionDetail(sid), id);
      await page.waitForSelector('#sessionDetailModal.show', { timeout: 5000 });
      await settle();
    };
    const closeModal = async () => {
      await settle();
      await page.evaluate(() => window.jQuery('#sessionDetailModal').modal('hide'));
      await page.waitForFunction(
        () => !document.querySelector('#sessionDetailModal.show'),
        { timeout: 5000 }
      );
      await settle();
    };
    const enterEdit = async () => {
      await page.click('#sessionDetailFooter .btn-outline-primary');
      await page.waitForSelector('#sessionEditForm', { timeout: 5000 });
    };
    const bodyText = () => page.evaluate(() => document.querySelector('#sessionDetailBody').textContent);
    const titleText = () => page.evaluate(() => document.querySelector('#sessionDetailTitle').textContent);
    // Click save and wait for the resulting PATCH to complete (the UI closes the
    // form optimistically, so server state must be awaited separately).
    const saveEdit = async (id) => {
      const [resp] = await Promise.all([
        page.waitForResponse(
          (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/sessions/${id}`),
          { timeout: 8000 }
        ),
        page.click('#saveSessionEditBtn'),
      ]);
      return resp;
    };
    // Simulate a different client editing the session (fresh revision).
    const otherClient = async (id, body) => {
      const s = await getSession(id);
      return fetch(`${base}/api/sessions/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'If-Match': String(s.revision),
        },
        body: JSON.stringify(body),
      });
    };
    const waitPatch = (id) =>
      page.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/sessions/${id}`),
        { timeout: 8000 }
      );
    const getSessionEventually = async (id, predicate, timeoutMs = 6000) => {
      const start = Date.now();
      let last = null;
      while (Date.now() - start < timeoutMs) {
        last = await getSession(id);
        if (last && predicate(last)) return last;
        await page.waitForTimeout(150);
      }
      return last;
    };

    // ---- 1. Full edit through the UI persists across a reload ----
    console.log('\n1️⃣  Full edit persists across a real reload');
    await openDetail(a1);
    await enterEdit();
    await page.fill('#editSessionContent', 'A1 EDITADA');
    await page.fill('#editSessionDurationMinutes', '60');
    await page.selectOption('#editSessionType', 'couple');
    await page.selectOption('#editSessionCareModality', 'video');
    await page.selectOption('#editSessionMood', '5');
    await page.check('#editSessionRequiresFollowUp');
    await page.fill('#editSessionMedication', 'Sertralina 50mg');
    await saveEdit(a1);
    const persisted = await getSessionEventually(a1, (s) => s.cleanNote === 'A1 EDITADA');
    test('server has edited note', persisted.cleanNote === 'A1 EDITADA');
    test('server has edited duration', persisted.durationMinutes === 60);
    test('server has edited type', persisted.sessionType === 'couple');
    test('server has follow-up', persisted.requiresFollowUp === true);
    await closeModal();
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    await openDetail(a1);
    const afterReload = await bodyText();
    test('edited note is present after reload', /A1 EDITADA/.test(afterReload));
    test('edited medication present after reload', /Sertralina 50mg/.test(afterReload));
    await closeModal();

    // ---- 2. Clearing medication removes it from the ficha ----
    console.log('\n2️⃣  Clearing medication in the UI removes it');
    await openDetail(a1);
    await enterEdit();
    await page.fill('#editSessionMedication', '');
    await saveEdit(a1);
    const clearedServer = await getSessionEventually(a1, (s) => s.medicationNotes === null);
    test('medication cleared to null on server', clearedServer.medicationNotes === null);
    const afterClear = await bodyText();
    test('medication no longer shown in ficha', !/Sertralina/.test(afterClear));
    await closeModal();

    // ---- 3. Decimal / exponential duration is rejected (no PATCH) ----
    console.log('\n3️⃣  Decimal and exponential duration rejected client-side');
    for (const badDuration of ['45.9', '4e2']) {
      await openDetail(a2);
      await enterEdit();
      await page.fill('#editSessionDurationMinutes', badDuration);
      patchCount = 0;
      await page.click('#saveSessionEditBtn');
      await page.waitForTimeout(500);
      test(`"${badDuration}" sends no PATCH`, patchCount === 0);
      test(`"${badDuration}" keeps the edit form open`, await page.locator('#sessionEditForm').count() === 1);
      await closeModal();
    }
    const a2Untouched = await getSession(a2);
    test('a2 duration unchanged by rejected edits', a2Untouched.durationMinutes === 30);

    // ---- 4. Empty date is rejected (no PATCH, no silent fallback) ----
    console.log('\n4️⃣  Empty clinical date rejected');
    await openDetail(a2);
    await enterEdit();
    await page.fill('#editSessionClinicalDate', '');
    patchCount = 0;
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(500);
    test('empty date sends no PATCH', patchCount === 0);
    test('empty date keeps the edit form open', await page.locator('#sessionEditForm').count() === 1);
    await closeModal();

    // ---- 5. Late response for A does not overwrite open B ----
    console.log('\n5️⃣  Late response for A does not overwrite open B');
    await openDetail(a2);
    await enterEdit();
    await page.fill('#editSessionContent', 'A2-LATE');
    delayResponseForId = a2; // the next PATCH to a2 will have its response held ~1.5s
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(200); // let the request start and be delayed
    await openDetail(b1); // navigate to B while A is still in flight
    await page.waitForTimeout(1800); // let A's delayed response resolve
    const raceTitle = await titleText();
    const raceBody = await bodyText();
    test('modal still shows session B title', /Bruno Beta/.test(raceTitle));
    test('modal still shows session B body', /Nota de Bruno/.test(raceBody));
    test('late A response did not leak into B body', !/A2-LATE/.test(raceBody));
    const a2Saved = await getSessionEventually(a2, (s) => s.cleanNote === 'A2-LATE');
    test('A save still persisted on the server', a2Saved.cleanNote === 'A2-LATE');
    await closeModal();

    // ---- 5b. A newer save (v2) wins over a delayed older save (v1) ----
    console.log('\n5️⃣b Newer save on the same session wins over a delayed older one');
    await openDetail(a1);
    await enterEdit();
    await page.fill('#editSessionContent', 'A1-v1');
    delayResponseForId = a1; // v1 persists now; its response is held ~1.5s
    await page.click('#saveSessionEditBtn'); // form stays open, v1 in flight
    await page.waitForTimeout(300);
    await page.fill('#editSessionContent', 'A1-v2'); // edit in place, same form
    await page.click('#saveSessionEditBtn'); // v2 queued behind v1 (serialized)
    const aaDb = await getSessionEventually(a1, (s) => s.cleanNote === 'A1-v2', 8000);
    test('DB keeps v2 after the late v1 response', aaDb.cleanNote === 'A1-v2');
    await page.waitForTimeout(500);
    const aaBody = await bodyText();
    test('UI shows v2 after the late v1 response', /A1-v2/.test(aaBody) && !/A1-v1/.test(aaBody));
    await closeModal();

    // ---- 5d. Serialization under a slow first request (v1 reaches server late) ----
    console.log('\n5️⃣d Serialization: a slow first request still ends at v2');
    await openDetail(a1);
    await enterEdit();
    await page.fill('#editSessionContent', 'REQ-v1');
    holdRequestForId = a1; // v1's request is held before it reaches the server
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(300);
    await page.fill('#editSessionContent', 'REQ-v2'); // queued while v1 is still held
    await page.click('#saveSessionEditBtn');
    const reqDb = await getSessionEventually(a1, (s) => s.cleanNote === 'REQ-v2', 8000);
    test('DB ends at v2 when the first request is slow', reqDb.cleanNote === 'REQ-v2');
    await page.waitForTimeout(500);
    const reqBody = await bodyText();
    test('UI ends at v2 when the first request is slow', /REQ-v2/.test(reqBody) && !/REQ-v1/.test(reqBody));
    await closeModal();

    // ---- 5e. Concurrent edit from another client → 409, conflict UI, no overwrite ----
    console.log('\n5️⃣e Concurrent edit from another client → 409 conflict, my text kept');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    const beforeConflict = await getSession(a1);
    await openDetail(a1);
    await enterEdit();
    await page.fill('#editSessionContent', 'MI TEXTO LOCAL');
    // Another client edits a1 first, bumping its revision.
    const otherPatch = await fetch(`${base}/api/sessions/${a1}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'If-Match': String(beforeConflict.revision),
      },
      body: JSON.stringify({ cleanNote: 'CAMBIO AJENO' }),
    });
    test('other client edit succeeds (200)', otherPatch.status === 200);
    const [conflictResp] = await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/sessions/${a1}`),
        { timeout: 8000 }
      ),
      page.click('#saveSessionEditBtn'),
    ]);
    test('stale save is rejected with 409', conflictResp.status() === 409);
    const conflictDb = await getSession(a1);
    test('conflict did not overwrite the other client', conflictDb.cleanNote === 'CAMBIO AJENO');
    await page.waitForTimeout(400);
    const conflictBody = await bodyText();
    test('conflict UI shows the server version', /CAMBIO AJENO/.test(conflictBody));
    test('conflict UI keeps my local text (not lost)', /MI TEXTO LOCAL/.test(conflictBody));
    // Retry with my version overwrites, based on the server's fresh revision.
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/sessions/${a1}`),
        { timeout: 8000 }
      ),
      page.click('#conflictRetryBtn'),
    ]);
    const resolved = await getSessionEventually(a1, (s) => s.cleanNote === 'MI TEXTO LOCAL', 8000);
    test('retry with my version now persists', resolved.cleanNote === 'MI TEXTO LOCAL');
    await closeModal();

    // ---- 5f. A late response must not discard an unsaved edit in the form ----
    console.log('\n5️⃣f Late response does not discard unsaved changes still in the form');
    await openDetail(a2);
    await enterEdit();
    await page.fill('#editSessionContent', 'DIRTY-SAVED');
    delayResponseForId = a2; // hold the save response
    await page.click('#saveSessionEditBtn'); // form stays open, response held
    await page.waitForTimeout(300);
    await page.fill('#editSessionContent', 'DIRTY-UNSAVED'); // keep typing, do not save
    await page.waitForTimeout(1600); // let the held response arrive
    const dirtyStillOpen = await page.locator('#sessionEditForm').count();
    const dirtyValue = await page.evaluate(
      () => document.querySelector('#editSessionContent')?.value
    );
    test('edit form is still open after the late response', dirtyStillOpen === 1);
    test('unsaved changes are preserved in the form', dirtyValue === 'DIRTY-UNSAVED');
    await page.click('#sessionDetailFooter .btn-secondary'); // cancel
    await closeModal();

    // ---- 5g. Lost response: v1 applied but response dropped, v2 queued → v2 wins ----
    console.log('\n5️⃣g Lost response is recovered and the queued v2 still wins');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    await openDetail(a2);
    await enterEdit();
    await page.fill('#editSessionContent', 'LOST-v1');
    abortResponseForId = a2; // server applies v1, but the response is dropped
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(300);
    await page.fill('#editSessionContent', 'LOST-v2'); // queued while v1 recovers
    await page.click('#saveSessionEditBtn');
    const lostDb = await getSessionEventually(a2, (s) => s.cleanNote === 'LOST-v2', 10000);
    test('DB ends at v2 after a lost v1 response', lostDb.cleanNote === 'LOST-v2');
    await page.waitForTimeout(500);
    const lostBody = await bodyText();
    test('UI ends at v2 after a lost v1 response', /LOST-v2/.test(lostBody) && !/LOST-v1/.test(lostBody));
    await closeModal();

    // ---- 5h. v1 gets 409 while v2 is pending → v2 stays recoverable/visible ----
    console.log('\n5️⃣h A 409 on v1 while v2 is pending keeps v2 recoverable');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    const beforePending = await getSession(b1);
    await openDetail(b1);
    await enterEdit();
    await page.fill('#editSessionContent', 'PEND-v1');
    delayResponseForId = b1; // hold v1's response (it will be a 409)
    // Make v1 stale: another client edits b1 before v1 is sent.
    await fetch(`${base}/api/sessions/${b1}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'If-Match': String(beforePending.revision),
      },
      body: JSON.stringify({ cleanNote: 'AJENO-PEND' }),
    });
    await page.click('#saveSessionEditBtn'); // v1 in flight (will 409, response held)
    await page.waitForTimeout(300);
    await page.fill('#editSessionContent', 'PEND-v2'); // queue v2 while v1 is held
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(1800); // let v1's held 409 resolve
    const pendConflictBody = await bodyText();
    test('v2 (not v1) is preserved as my version after the 409', /PEND-v2/.test(pendConflictBody));
    test('the other client change is shown and not overwritten', /AJENO-PEND/.test(pendConflictBody));
    const pendDb = await getSession(b1);
    test('server still holds the other client change', pendDb.cleanNote === 'AJENO-PEND');
    await closeModal();

    // ---- 5i. Exhausted recovery must not let an older payload win over v3 ----
    console.log('\n5️⃣i After 5 failed retries + a new save, the newest (v3) wins');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    await openDetail(a2);
    await enterEdit();
    await page.fill('#editSessionContent', 'EXH-v1');
    failPatchesForId = a2; // every PATCH to a2 fails (network down) → recovery exhausts
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(200);
    await page.fill('#editSessionContent', 'EXH-v2'); // queued, then abandoned on exhaustion
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(1500); // let the retries exhaust (>4 attempts)
    failPatchesForId = null; // "connection back"
    await page.fill('#editSessionContent', 'EXH-v3'); // newest save after recovery gave up
    await page.click('#saveSessionEditBtn');
    const exhDb = await getSessionEventually(a2, (s) => s.cleanNote === 'EXH-v3', 10000);
    test('DB ends at v3 after exhausted recovery', exhDb.cleanNote === 'EXH-v3');
    await page.waitForTimeout(500);
    const exhBody = await bodyText();
    test('UI ends at v3 (not the older v2) after exhausted recovery',
      /EXH-v3/.test(exhBody) && !/EXH-v2/.test(exhBody) && !/EXH-v1/.test(exhBody));
    await closeModal();

    // ---- 5j. Multi-field conflict: full diff, persistence, and actions ----
    console.log('\n5️⃣j Conflict shows every field, survives reopen/reload, and its actions work');
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    const beforeMulti = await getSession(a1);
    await openDetail(a1);
    await enterEdit();
    // My multi-field edit.
    await page.fill('#editSessionContent', 'NOTA MIA');
    await page.fill('#editSessionDurationMinutes', '77');
    await page.selectOption('#editSessionType', 'family');
    await page.selectOption('#editSessionMood', '2');
    // Another client changes a DIFFERENT field (modality) first.
    await fetch(`${base}/api/sessions/${a1}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'If-Match': String(beforeMulti.revision),
      },
      body: JSON.stringify({ careModality: 'video' }),
    });
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/sessions/${a1}`),
        { timeout: 8000 }
      ),
      page.click('#saveSessionEditBtn'),
    ]);
    await page.waitForTimeout(300);
    const multiProbe = await page.evaluate(() => ({
      rows: document.querySelectorAll('#sessionDetailBody table tbody tr').length,
      text: document.querySelector('#sessionDetailBody').textContent,
      hasRetry: !!document.querySelector('#conflictRetryBtn'),
    }));
    test('conflict shows all 8 editable fields', multiProbe.rows === 8);
    test('conflict shows my note and duration', /NOTA MIA/.test(multiProbe.text) && /77 min/.test(multiProbe.text));
    test('conflict shows the other client field (modality video)', /Videollamada/.test(multiProbe.text));

    // Close and reopen → the conflict is shown again.
    await closeModal();
    await openDetail(a1);
    await page.waitForTimeout(200);
    const reopenText = await bodyText();
    test('reopening the ficha re-shows the conflict', /NOTA MIA/.test(reopenText) && !!(await page.locator('#conflictRetryBtn').count()));

    // Reload the page → the conflict is restored from persistence.
    await closeModal();
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    await openDetail(a1);
    await page.waitForTimeout(200);
    const afterReloadConflict = await page.locator('#conflictRetryBtn').count();
    test('conflict survives a full page reload', afterReloadConflict === 1);

    // Retry with my version: a slow response lets us see the actions disabled,
    // and the 3-way merge keeps the other client's modality change.
    delayResponseForId = a1;
    await page.click('#conflictRetryBtn');
    await page.waitForTimeout(250);
    const disabledDuringRetry = await page.evaluate(
      () => document.querySelector('#conflictRetryBtn')?.disabled === true
    );
    test('conflict actions are disabled during an in-flight retry', disabledDuringRetry === true);
    const merged = await getSessionEventually(
      a1,
      (s) => s.cleanNote === 'NOTA MIA' && s.durationMinutes === 77,
      8000
    );
    test('retry persists my changed fields', merged.cleanNote === 'NOTA MIA' && merged.durationMinutes === 77);
    test('retry did not clobber the other client field (3-way merge)', merged.careModality === 'video');
    await closeModal();

    // "Usar la del servidor" discards my version and shows the server one.
    await openDetail(a2);
    const a2Before = await getSession(a2);
    await enterEdit();
    await page.fill('#editSessionContent', 'DESCARTAR');
    await fetch(`${base}/api/sessions/${a2}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'If-Match': String(a2Before.revision),
      },
      body: JSON.stringify({ cleanNote: 'GANA SERVIDOR' }),
    });
    await Promise.all([
      page.waitForResponse(
        (r) => r.request().method() === 'PATCH' && r.url().includes(`/api/sessions/${a2}`),
        { timeout: 8000 }
      ),
      page.click('#saveSessionEditBtn'),
    ]);
    await page.waitForTimeout(300);
    await page.click('#conflictUseServerBtn');
    await page.waitForTimeout(300);
    const useServerText = await bodyText();
    test('"usar la del servidor" shows the server version', /GANA SERVIDOR/.test(useServerText) && !/DESCARTAR/.test(useServerText));
    await closeModal();

    // ==== Mandatory concurrency acceptance tests (fresh sessions) ====
    // Use a dedicated patient so they don't change pAna's session count (§6).
    const pMand = String((await api('POST', '/api/patients', { name: 'Marta Mand', dni: '40000005' })).data.id);
    const mk = (extra) =>
      mkSession(pMand, { cleanNote: 'base', durationMinutes: 45, careModality: 'inPerson', moodAssessment: 3, ...extra });
    const tRev = await mk({ cleanNote: 'REV-N0' });
    const tEdit = await mk({ cleanNote: 'EDIT-BASE' });
    const tRec = await mk({ cleanNote: 'rec-base' });
    const tLost = await mk({ cleanNote: 'lost-base' });
    const t2c = await mk({ cleanNote: '2c-base' });
    const tDirty = await mk({ cleanNote: 'dirty-base' });
    const tCancel = await mk({ cleanNote: 'cancel-base' });
    const tTrayDraft = await mk({ cleanNote: 'tray-draft-base' });
    const tTrayConflict = await mk({ cleanNote: 'tray-conf-base' });
    const tOrphan = await mk({ cleanNote: 'orphan-base' });
    const tRetrySync = await mk({ cleanNote: 'retry-base' });
    const tIso = await mk({ cleanNote: 'iso-base' });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });

    // ---- 5k. v1 changes A, v2 reverts A, third changes B, 409+retry → v2 & third's B ----
    console.log('\n5️⃣k Revert + third-party change: retry keeps my revert and their field');
    await openDetail(tRev);
    await enterEdit();
    await page.fill('#editSessionContent', 'REV-N1'); // v1 changes the note
    await saveEdit(tRev);
    await getSessionEventually(tRev, (s) => s.cleanNote === 'REV-N1');
    await openDetail(tRev);
    await enterEdit();
    await page.fill('#editSessionContent', 'REV-N0'); // v2 reverts the note
    await otherClient(tRev, { careModality: 'video' }); // third changes a different field
    await Promise.all([waitPatch(tRev), page.click('#saveSessionEditBtn')]); // 409
    await page.waitForTimeout(300);
    await Promise.all([waitPatch(tRev), page.click('#conflictRetryBtn')]);
    const revDone = await getSessionEventually(
      tRev,
      (s) => s.cleanNote === 'REV-N0' && s.careModality === 'video',
      8000
    );
    test('revert wins and third-party field is kept', revDone.cleanNote === 'REV-N0' && revDone.careModality === 'video');
    await closeModal();

    // ---- 5l. "Editar mi versión" merges (does not clobber the remote field) ----
    console.log('\n5️⃣l Editar mi versión merges without clobbering the remote field');
    await openDetail(tEdit);
    await enterEdit();
    await page.fill('#editSessionContent', 'EDIT-MINE'); // I change only the note
    await otherClient(tEdit, { careModality: 'phone' }); // other changes only modality
    await Promise.all([waitPatch(tEdit), page.click('#saveSessionEditBtn')]); // 409
    await page.waitForTimeout(300);
    await page.click('#conflictEditBtn'); // "Editar mi versión"
    await page.waitForSelector('#sessionEditForm', { timeout: 5000 });
    const prefilledMine = await page.evaluate(() => document.querySelector('#editSessionContent').value);
    test('edit-my-version prefills my text', prefilledMine === 'EDIT-MINE');
    await Promise.all([waitPatch(tEdit), page.click('#saveSessionEditBtn')]);
    const editDone = await getSessionEventually(
      tEdit,
      (s) => s.cleanNote === 'EDIT-MINE' && s.careModality === 'phone',
      8000
    );
    test('edit-my-version keeps my note and the remote modality', editDone.cleanNote === 'EDIT-MINE' && editDone.careModality === 'phone');
    await closeModal();

    // ---- 5m. Counted 5 aborted PATCH, reload, recover the FULL version ----
    console.log('\n5️⃣m Five aborted PATCH, reload, and recover the full version');
    await openDetail(tRec);
    await enterEdit();
    await page.fill('#editSessionContent', 'RECOVER-ME');
    await page.fill('#editSessionDurationMinutes', '99');
    patchCount = 0;
    failPatchesForId = tRec;
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(2000); // let recovery exhaust
    test('at least 5 PATCH attempts were made', patchCount >= 5);
    failPatchesForId = null;
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    await openDetail(tRec);
    await page.waitForTimeout(200);
    const recBody = await bodyText();
    const hasRecoveryBtn = (await page.locator('#recoveryRetryBtn').count()) === 1;
    test('recovery panel appears after reload with my note', /RECOVER-ME/.test(recBody) && hasRecoveryBtn);
    await Promise.all([waitPatch(tRec), page.click('#recoveryRetryBtn')]);
    const recDone = await getSessionEventually(
      tRec,
      (s) => s.cleanNote === 'RECOVER-ME' && s.durationMinutes === 99,
      8000
    );
    test('recovered full version persists (note + duration)', recDone.cleanNote === 'RECOVER-ME' && recDone.durationMinutes === 99);
    await closeModal();

    // ---- 5n. Conflict → retry → lost response is recovered ----
    console.log('\n5️⃣n Conflict → retry → lost response recovers');
    await openDetail(tLost);
    await enterEdit();
    await page.fill('#editSessionContent', 'LOST-RETRY');
    await otherClient(tLost, { careModality: 'video' });
    await Promise.all([waitPatch(tLost), page.click('#saveSessionEditBtn')]); // 409
    await page.waitForTimeout(300);
    abortResponseForId = tLost; // the retry applies but its response is dropped
    await page.click('#conflictRetryBtn');
    const lostRetry = await getSessionEventually(
      tLost,
      (s) => s.cleanNote === 'LOST-RETRY' && s.careModality === 'video',
      10000
    );
    test('retry after a lost response ends correctly merged', lostRetry.cleanNote === 'LOST-RETRY' && lostRetry.careModality === 'video');
    await closeModal();

    // ---- 5o. Conflict → retry → second 409 re-shows the conflict, enabled ----
    console.log('\n5️⃣o Conflict → retry → a second 409 re-shows the conflict enabled');
    await openDetail(t2c);
    await enterEdit();
    await page.fill('#editSessionContent', '2C-MINE');
    await otherClient(t2c, { careModality: 'video' });
    await Promise.all([waitPatch(t2c), page.click('#saveSessionEditBtn')]); // 1st 409
    await page.waitForTimeout(300);
    await otherClient(t2c, { moodAssessment: 5 }); // other client moves again → retry will 409
    await Promise.all([waitPatch(t2c), page.click('#conflictRetryBtn')]); // 2nd 409
    await page.waitForTimeout(300);
    const secondConflict = await page.evaluate(() => ({
      hasTable: document.querySelectorAll('#sessionDetailBody table tbody tr').length === 8,
      retryEnabled: document.querySelector('#conflictRetryBtn') && !document.querySelector('#conflictRetryBtn').disabled,
      text: document.querySelector('#sessionDetailBody').textContent,
    }));
    test('second 409 re-shows all 8 fields', secondConflict.hasTable);
    test('second 409 leaves actions enabled', secondConflict.retryEnabled === true);
    test('second 409 keeps my text', /2C-MINE/.test(secondConflict.text));
    await page.click('#conflictUseServerBtn');
    await closeModal();

    // ---- 5p. Closing a dirty, INVALID form warns ----
    console.log('\n5️⃣p Closing a dirty (invalid) form warns');
    await openDetail(tDirty);
    await enterEdit();
    await page.fill('#editSessionContent', ''); // invalid + dirty
    const dialogsBefore = dialogs.length;
    await page.click('#sessionDetailModal .modal-header .close'); // the X
    await page.waitForTimeout(300);
    test('closing a dirty invalid form asks for confirmation', dialogs.length > dialogsBefore);
    // dialog auto-accepted → modal closed
    await page.waitForFunction(() => !document.querySelector('#sessionDetailModal.show'), { timeout: 5000 });

    // ---- 5q. Two tabs keep separate recovery records ----
    console.log('\n5️⃣q Two tabs do not erase each other\'s recovery');
    // This tab: leave a recovery record for tCancel via exhausted aborts.
    await openDetail(tCancel);
    await enterEdit();
    await page.fill('#editSessionContent', 'TAB1-REC');
    failPatchesForId = tCancel;
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(2000);
    failPatchesForId = null;
    const tab1Keys = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('aira:pending:'))
    );
    test('this tab persisted a recovery record', tab1Keys.some((k) => k.includes(`:${tCancel}:`)));
    // A second tab (its own sessionStorage → own tabId) must not see/erase it.
    const page2 = await browser.newPage();
    await page2.route('**/cdnjs.cloudflare.com/**', (route) => {
      const baseName = route.request().url().split('/').pop().split('?')[0];
      const local = VENDOR_BY_NAME[baseName];
      if (local && fs.existsSync(path.join(ROOT_DIR, local))) {
        return route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(ROOT_DIR, local)) });
      }
      return route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });
    await page2.addInitScript((t) => localStorage.setItem('authToken', t), token);
    await page2.goto(base + '/', { waitUntil: 'load' });
    await page2.waitForSelector('.session-card', { timeout: 15000 });
    await page2.evaluate((id) => window.showSessionDetail(id), tCancel);
    await page2.waitForSelector('#sessionDetailModal.show', { timeout: 5000 });
    await page2.waitForTimeout(200);
    const tab2SeesRecovery = (await page2.locator('#recoveryRetryBtn').count()) > 0;
    test('a second tab does not show this tab\'s recovery', tab2SeesRecovery === false);
    const tab1KeysAfter = await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith('aira:pending:'))
    );
    test('the second tab did not erase this tab\'s record', tab1KeysAfter.some((k) => k.includes(`:${tCancel}:`)));
    await page2.close();
    // Clean up this tab's recovery so it doesn't affect later sections.
    await page.evaluate((id) => {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('aira:pending:') && k.includes(`:${id}:`))
        .forEach((k) => localStorage.removeItem(k));
    }, tCancel);
    await closeModal();

    // ---- 5r. Cancel during an in-flight save leaves a consistent state ----
    console.log('\n5️⃣r Cancel during an in-flight save is handled gracefully');
    await openDetail(tRev);
    await enterEdit();
    await page.fill('#editSessionContent', 'CANCEL-INFLIGHT');
    delayResponseForId = tRev; // hold the response
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(200);
    await page.click('#sessionDetailFooter .btn-secondary'); // Cancelar while in flight
    await page.waitForTimeout(1800); // let the held response arrive
    const cancelDb = await getSessionEventually(tRev, (s) => s.cleanNote === 'CANCEL-INFLIGHT', 8000);
    test('the in-flight save still completed on the server', cancelDb.cleanNote === 'CANCEL-INFLIGHT');
    const cancelState = await page.evaluate(() => ({
      hasForm: !!document.querySelector('#sessionEditForm'),
      hasConflict: !!document.querySelector('#conflictRetryBtn'),
    }));
    test('after cancel + response the modal is not stuck in a form/conflict', !cancelState.hasForm && !cancelState.hasConflict);
    await closeModal();

    // ---- 5s. Drafts & conflicts tray surfaces unsaved work outside the modal ----
    console.log('\n5️⃣s Drafts & conflicts tray surfaces unsaved work on the dashboard');
    const showDashboard = async () => {
      await page.evaluate(() => window.showSection && window.showSection('dashboard'));
      await page.waitForTimeout(200);
    };
    const trayState = () =>
      page.evaluate(() => {
        const row = document.querySelector('#draftsTrayRow');
        const items = Array.from(document.querySelectorAll('#draftsTrayList .drafts-tray-item'));
        return {
          visible: !!row && row.style.display !== 'none',
          ids: items.map((el) => el.getAttribute('data-session-id')),
          text: document.querySelector('#draftsTrayList')?.textContent || '',
        };
      });
    // Earlier sections may legitimately leave unsaved records for their own
    // sessions; clear the tab's tray storage so this section is self-contained.
    const clearTrayStorage = () =>
      page.evaluate(() => {
        Object.keys(localStorage)
          .filter((k) => k.startsWith('aira:conflict:') || k.startsWith('aira:pending:'))
          .forEach((k) => localStorage.removeItem(k));
      });

    // Tray starts empty when there is no unsaved work.
    await clearTrayStorage();
    await showDashboard();
    const trayEmpty = await trayState();
    test('tray is hidden when there is no unsaved work', trayEmpty.visible === false);

    // (a) An exhausted/aborted save leaves a draft the tray shows.
    await openDetail(tTrayDraft);
    await enterEdit();
    await page.fill('#editSessionContent', 'TRAY-DRAFT <img src=x> <b>x</b>'); // note carries HTML
    failPatchesForId = tTrayDraft;
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(2000); // let recovery exhaust → persisted draft
    failPatchesForId = null;
    await closeModal();
    await showDashboard();
    const trayWithDraft = await trayState();
    test('tray becomes visible after an exhausted save', trayWithDraft.visible === true);
    test('tray lists the drafted session', trayWithDraft.ids.includes(String(tTrayDraft)));
    test('tray labels it as an unsaved draft', /Borrador sin confirmar/.test(trayWithDraft.text));
    const trayInjected = await page.evaluate(
      () => !!document.querySelector('#draftsTrayList img, #draftsTrayList b, #draftsTrayList script')
    );
    test('tray renders the note as text, not HTML', trayInjected === false);
    test('tray shows the note preview literally', /TRAY-DRAFT <img src=x>/.test(trayWithDraft.text));

    // (b) The tray survives a full page reload (reads from localStorage).
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    await showDashboard();
    const trayAfterReload = await trayState();
    test('tray still lists the draft after a reload', trayAfterReload.ids.includes(String(tTrayDraft)));

    // (c) Clicking a tray entry opens that session's recovery view.
    await page.click(`#draftsTrayList .drafts-tray-item[data-session-id="${tTrayDraft}"]`);
    await page.waitForSelector('#sessionDetailModal.show', { timeout: 5000 });
    await page.waitForTimeout(200);
    const draftOpensRecovery = (await page.locator('#recoveryRetryBtn').count()) === 1;
    test('clicking a draft entry opens its recovery view', draftOpensRecovery);
    // Discarding the draft removes it from the tray.
    await page.click('#recoveryDiscardBtn');
    await closeModal();
    await showDashboard();
    const trayAfterDiscard = await trayState();
    test('tray drops the draft after it is discarded', trayAfterDiscard.ids.includes(String(tTrayDraft)) === false);

    // (d) A pending edit conflict also appears in the tray and routes to the conflict view.
    await openDetail(tTrayConflict);
    await enterEdit();
    await page.fill('#editSessionContent', 'TRAY-CONFLICT');
    await otherClient(tTrayConflict, { careModality: 'video' });
    await Promise.all([waitPatch(tTrayConflict), page.click('#saveSessionEditBtn')]); // 409
    await page.waitForTimeout(300);
    await closeModal();
    await showDashboard();
    const trayWithConflict = await trayState();
    test('tray shows a pending edit conflict', trayWithConflict.ids.includes(String(tTrayConflict)));
    test('tray labels the conflict entry', /Conflicto de edición/.test(trayWithConflict.text));
    await page.click(`#draftsTrayList .drafts-tray-item[data-session-id="${tTrayConflict}"]`);
    await page.waitForSelector('#sessionDetailModal.show', { timeout: 5000 });
    await page.waitForTimeout(200);
    const conflictRows = await page.evaluate(
      () => document.querySelectorAll('#sessionDetailBody table tbody tr').length
    );
    test('clicking a conflict entry opens the 8-field conflict view', conflictRows === 8);
    // Resolving with the server version clears it from the tray.
    await page.click('#conflictUseServerBtn');
    await closeModal();
    await showDashboard();
    const trayResolved = await trayState();
    test('tray hides again once all unsaved work is resolved', trayResolved.visible === false);

    // Helper: leave a persisted draft for a session via an exhausted save.
    const leaveDraft = async (id, note) => {
      await openDetail(id);
      await enterEdit();
      await page.fill('#editSessionContent', note);
      failPatchesForId = id;
      await page.click('#saveSessionEditBtn');
      await page.waitForTimeout(2000); // recovery exhausts → persisted draft
      failPatchesForId = null;
      await closeModal();
    };

    // ---- 5t. A record for a deleted/inaccessible session is discardable, never a dead card ----
    console.log('\n5️⃣t Orphaned record (deleted session) is discardable, not a dead card');
    await clearTrayStorage();
    await leaveDraft(tOrphan, 'ORPHAN-NOTE');
    // Delete the session server-side so it becomes inaccessible.
    const delResp = await fetch(`${base}/api/sessions/${tOrphan}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    test('session delete succeeded (200)', delResp.status === 200);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });
    await showDashboard();
    const orphanView = await page.evaluate((id) => {
      const list = document.querySelector('#draftsTrayList');
      const rows = Array.from(list.querySelectorAll('.drafts-tray-row'));
      const openable = list.querySelector(`.drafts-tray-item[data-session-id="${id}"]`);
      const discardBtn = list.querySelector(`.drafts-tray-discard[data-session-id="${id}"]`);
      return {
        visible: document.querySelector('#draftsTrayRow').style.display !== 'none',
        rowCount: rows.length,
        isOpenable: !!openable,
        hasDiscard: !!discardBtn,
        text: list.textContent,
      };
    }, String(tOrphan));
    test('orphan record still appears in the tray', orphanView.visible && orphanView.rowCount >= 1);
    test('orphan entry is not openable (no dead card)', orphanView.isOpenable === false);
    test('orphan entry offers a discard action', orphanView.hasDiscard === true);
    test('orphan entry is labelled unavailable', /Sesión no disponible/.test(orphanView.text));
    // Clicking the orphan row body (not the discard button) must not open a modal.
    await page.click('#draftsTrayList .drafts-tray-patient');
    await page.waitForTimeout(300);
    test('clicking an orphan row opens no modal', (await page.locator('#sessionDetailModal.show').count()) === 0);
    // Discard clears it from the tray.
    await page.click(`#draftsTrayList .drafts-tray-discard[data-session-id="${tOrphan}"]`);
    await page.waitForTimeout(200);
    const afterOrphanDiscard = await trayState();
    test('discarding an orphan clears it from the tray', afterOrphanDiscard.ids.includes(String(tOrphan)) === false);

    // ---- 5u. A successful recovery retry clears the entry and tray immediately (no reload) ----
    console.log('\n5️⃣u Successful recovery retry clears the tray entry immediately');
    await clearTrayStorage();
    await leaveDraft(tRetrySync, 'RETRY-SYNC');
    await showDashboard();
    const beforeRetry = await trayState();
    test('draft is present before the retry', beforeRetry.ids.includes(String(tRetrySync)));
    await page.click(`#draftsTrayList .drafts-tray-item[data-session-id="${tRetrySync}"]`);
    await page.waitForSelector('#recoveryRetryBtn', { timeout: 5000 });
    await Promise.all([waitPatch(tRetrySync), page.click('#recoveryRetryBtn')]);
    await getSessionEventually(tRetrySync, (s) => s.cleanNote === 'RETRY-SYNC', 8000);
    await closeModal();
    // No reload here: the tray must already reflect the resolution.
    const afterRetry = await trayState();
    test('retry removes the entry without a reload', afterRetry.ids.includes(String(tRetrySync)) === false);
    test('tray hides after the only draft is retried', afterRetry.visible === false);

    // ---- 5v. Account isolation: A's local work is invisible to B in the same tab ----
    console.log('\n5️⃣v Account isolation: user B never sees user A\'s pending work');
    await api('POST', '/api/auth/register', { dni: '30999888', pin: '1234', name: 'Dr Bravo' });
    await clearTrayStorage();
    await leaveDraft(tIso, 'SECRETO-DE-A');
    await showDashboard();
    const aSees = await trayState();
    test('user A sees their own pending note', /SECRETO-DE-A/.test(aSees.text));
    // Log out (real UI flow clears the token + in-memory state), then log in as B.
    await page.evaluate(() => window.logout());
    await page.waitForFunction(() => !localStorage.getItem('authToken'), { timeout: 6000 });
    await page.evaluate(() => window.showLoginFromLanding());
    await page.fill('#dni', '30999888');
    await page.fill('#pin', '1234');
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/api/login') && r.request().method() === 'POST', { timeout: 8000 }),
      page.click("#loginForm button[type='submit']"),
    ]);
    await page.waitForSelector('#dashboardScreen:not(.d-none)', { timeout: 8000 });
    await page.waitForTimeout(400);
    const bView = await page.evaluate(() => ({
      trayVisible: document.querySelector('#draftsTrayRow').style.display !== 'none',
      trayText: document.querySelector('#draftsTrayList').textContent,
      bodyHasSecret: document.body.textContent.includes('SECRETO-DE-A'),
    }));
    test('B does not see the tray populated by A', bView.trayVisible === false);
    test('B does not see A\'s entry', /SECRETO-DE-A/.test(bView.trayText) === false);
    test('B does not see A\'s note text anywhere on the page', bView.bodyHasSecret === false);
    const aRecordSurvives = await page.evaluate(() =>
      Object.keys(localStorage).some(
        (k) => k.startsWith('aira:pending:') && (localStorage.getItem(k) || '').includes('SECRETO-DE-A')
      )
    );
    test('A\'s record still exists in storage (scoped out, not destroyed)', aRecordSurvives === true);
    // Restore user A for the remaining sections (clear leftovers, reload → auto-login A).
    await clearTrayStorage();
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.session-card', { timeout: 15000 });

    // ---- 5c. Names and notes render literally in the session list ----
    console.log('\n5️⃣c Session cards render names and notes as text, not HTML');
    await page.evaluate(() => window.showSection && window.showSection('sessions'));
    await page.waitForTimeout(200);
    await page.selectOption('#sessionPatientFilter', pHtml);
    await page.waitForTimeout(300);
    const cardProbe = await page.evaluate(() => {
      const list = document.querySelector('#sessionsList');
      return {
        text: list.textContent,
        injectedTag: !!list.querySelector('script, b, img'),
      };
    });
    test('card shows patient name literally', cardProbe.text.includes('Paciente <Equipo>'));
    test('card shows clinical note literally', cardProbe.text.includes('Nota <script>peligrosa</script> clínica'));
    test('no tag injected from name/note in the list', cardProbe.injectedTag === false);
    // And the dashboard recent list must escape too.
    await page.evaluate(() => window.showSection && window.showSection('dashboard'));
    await page.waitForTimeout(300);
    const dashInjected = await page.evaluate(
      () => !!document.querySelector('#recentSessionsList script, #recentSessionsList b, #recentSessionsList img')
    );
    test('no tag injected from name/note on the dashboard', dashInjected === false);

    // ---- 6. Filters survive saving an edit ----
    console.log('\n6️⃣  Patient filter survives an edit save');
    await page.evaluate(() => window.showSection && window.showSection('sessions'));
    await page.waitForTimeout(200);
    await page.selectOption('#sessionPatientFilter', pAna);
    await page.waitForTimeout(200);
    const cardsBefore = await page.locator('#sessionsList .session-card').count();
    test('filter shows only Ana\'s sessions', cardsBefore === 2);
    await openDetail(a1);
    await enterEdit();
    await page.fill('#editSessionContent', 'A1 con filtro');
    await saveEdit(a1);
    await getSessionEventually(a1, (s) => s.cleanNote === 'A1 con filtro');
    await closeModal();
    const filterStillSet = await page.evaluate(() => document.querySelector('#sessionPatientFilter').value);
    const cardsAfter = await page.locator('#sessionsList .session-card').count();
    test('patient filter still selected after save', filterStillSet === pAna);
    test('list still filtered to Ana after save', cardsAfter === 2);

    // ---- 6b. Date filter survives saving an edit ----
    console.log('\n6️⃣b Date filter survives an edit save');
    await page.selectOption('#sessionPatientFilter', pDate);
    await page.fill('#startDate', '2026-07-01');
    await page.evaluate(() => window.applySessionFilters && window.applySessionFilters());
    await page.waitForTimeout(200);
    const dateCardsBefore = await page.locator('#sessionsList .session-card').count();
    test('date filter shows only the recent Delia session', dateCardsBefore === 1);
    await openDetail(dNew);
    await enterEdit();
    await page.fill('#editSessionContent', 'Delia nueva editada');
    await saveEdit(dNew);
    await getSessionEventually(dNew, (s) => s.cleanNote === 'Delia nueva editada');
    await closeModal();
    const dateFilterKept = await page.evaluate(() => ({
      patient: document.querySelector('#sessionPatientFilter').value,
      start: document.querySelector('#startDate').value,
    }));
    const dateCardsAfter = await page.locator('#sessionsList .session-card').count();
    test('patient filter kept after date-filtered save', dateFilterKept.patient === pDate);
    test('start-date filter kept after save', dateFilterKept.start === '2026-07-01');
    test('date-filtered list still shows one card after save', dateCardsAfter === 1);
    await page.fill('#startDate', '');
    await page.evaluate(() => window.applySessionFilters && window.applySessionFilters());

    // ---- 7. Session cards open with Enter and Space ----
    console.log('\n7️⃣  Keyboard opens session cards (Enter and Space)');
    const opensWithKey = async (key) => {
      await page.locator('#sessionsList .session-card').first().focus();
      await page.keyboard.press(key);
      const opened = await page
        .waitForSelector('#sessionDetailModal.show', { timeout: 4000 })
        .then(() => true)
        .catch(() => false);
      if (opened) await closeModal();
      return opened;
    };
    test('Enter opens the detail modal', await opensWithKey('Enter'));
    test('Space opens the detail modal', await opensWithKey('Space'));

    // ---- 8. Patient name is rendered as text, not HTML, in the form ----
    console.log('\n8️⃣  Patient name is not interpolated as HTML in the form');
    await openDetail(h1);
    await enterEdit();
    const nameProbe = await page.evaluate(() => {
      const el = document.querySelector('#editSessionPatientName');
      return {
        text: el ? el.textContent : null,
        childElements: el ? el.childElementCount : -1,
        formHasInjectedTag: !!document.querySelector('#sessionEditForm b, #sessionEditForm img'),
      };
    });
    test('patient name rendered verbatim as text', nameProbe.text === htmlName);
    test('no HTML element created from patient name', nameProbe.childElements === 0);
    test('no injected tag inside the edit form', nameProbe.formHasInjectedTag === false);
    await closeModal();

    test('no uncaught page errors during the run', pageErrors.length === 0);
    if (pageErrors.length) console.log('   page errors:', pageErrors.join(' | '));

    console.log(`\n════════════════════════════════════════`);
    console.log(`📊 Browser results: ${passed} passed, ${failed} failed`);
    console.log(`════════════════════════════════════════`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (error) {
    console.error(`Browser test runner failed: ${error.message}`);
    if (serverLogs.length) console.error('\nServer output:\n' + serverLogs.slice(-40).join(''));
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (!server.killed) server.kill('SIGTERM');
    fs.rmSync(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
