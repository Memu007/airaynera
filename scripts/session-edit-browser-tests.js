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

    // Track PATCH requests and optionally delay one, for the race test.
    let patchCount = 0;
    let delayPatchForId = null;
    await page.route('**/api/sessions/*', async (route) => {
      const req = route.request();
      if (req.method() === 'PATCH') {
        patchCount += 1;
        if (delayPatchForId && req.url().endsWith(`/api/sessions/${delayPatchForId}`)) {
          delayPatchForId = null;
          // Let the server persist immediately (preserving write order), then
          // hold only the *response* so a later save can land in between.
          const response = await route.fetch();
          await new Promise((r) => setTimeout(r, 1500));
          return route.fulfill({ response });
        }
      }
      return route.continue();
    });

    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(String(e)));

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
    await page.click('#saveSessionEditBtn');
    await page.waitForFunction(
      () => document.querySelector('#sessionEditForm') === null &&
            /A1 EDITADA/.test(document.querySelector('#sessionDetailBody')?.textContent || ''),
      { timeout: 8000 }
    );
    const persisted = await getSession(a1);
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
    await page.click('#saveSessionEditBtn');
    await page.waitForFunction(
      () => document.querySelector('#sessionEditForm') === null,
      { timeout: 8000 }
    );
    const clearedServer = await getSession(a1);
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
    delayPatchForId = a2; // the next PATCH to a2 will be held ~1.5s
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(200); // let the request start and be delayed
    await openDetail(b1); // navigate to B while A is still in flight
    await page.waitForTimeout(1800); // let A's delayed response resolve
    const raceTitle = await titleText();
    const raceBody = await bodyText();
    test('modal still shows session B title', /Bruno Beta/.test(raceTitle));
    test('modal still shows session B body', /Nota de Bruno/.test(raceBody));
    test('late A response did not leak into B body', !/A2-LATE/.test(raceBody));
    const a2Saved = await getSession(a2);
    test('A save still persisted on the server', a2Saved.cleanNote === 'A2-LATE');
    await closeModal();

    // ---- 5b. A newer save (A-v2) wins over a delayed older save (A-v1) ----
    console.log('\n5️⃣b Newer save on the same session wins over a delayed older one');
    await openDetail(a1);
    await enterEdit();
    await page.fill('#editSessionContent', 'A1-v1');
    delayPatchForId = a1; // server persists v1 now, but its response is held ~1.5s
    await page.click('#saveSessionEditBtn');
    await page.waitForTimeout(300); // let v1 reach and persist on the server
    await openDetail(a1); // reopen the SAME session while v1's response is held
    await enterEdit();
    await page.fill('#editSessionContent', 'A1-v2');
    await page.click('#saveSessionEditBtn');
    await page.waitForFunction(
      () => document.querySelector('#sessionEditForm') === null,
      { timeout: 8000 }
    );
    await page.waitForTimeout(1800); // let v1's delayed response arrive and be ignored
    const aaBody = await bodyText();
    test('UI shows A-v2 after the late A-v1 response', /A1-v2/.test(aaBody) && !/A1-v1/.test(aaBody));
    const aaDb = await getSession(a1);
    test('DB keeps A-v2 after the late A-v1 response', aaDb.cleanNote === 'A1-v2');
    await closeModal();

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
    await page.click('#saveSessionEditBtn');
    await page.waitForFunction(
      () => document.querySelector('#sessionEditForm') === null,
      { timeout: 8000 }
    );
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
    await page.click('#saveSessionEditBtn');
    await page.waitForFunction(
      () => document.querySelector('#sessionEditForm') === null,
      { timeout: 8000 }
    );
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
