#!/usr/bin/env node

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');

const ROOT_DIR = path.resolve(__dirname, '..');
const SAMPLE_RATE = 8000;
const DEFAULT_COUNT = 40;
const DEFAULT_CONCURRENCY = 5;
const ACK_GATE_MS = 5000;
const COMPLETION_GATE_MS = 120000;
const CLIP_DURATIONS_SECONDS = Object.freeze([
  120, 150, 180, 240, 300, 360, 420, 480, 540, 600,
]);
const SIGNAL_PROFILES = Object.freeze([
  'steady-tone',
  'pause-heavy',
  'low-volume',
  'deterministic-noise',
  'mostly-silence',
]);

function numberArgument(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((argument) => argument.startsWith(prefix));
  if (!raw) return fallback;
  const value = Number(raw.slice(prefix.length));
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function benchmarkOptions() {
  const count = numberArgument('count', DEFAULT_COUNT);
  const concurrency = numberArgument('concurrency', DEFAULT_CONCURRENCY);
  if (count < 30 || count > 50) throw new Error('count must be between 30 and 50');
  if (concurrency < 1 || concurrency > 10) {
    throw new Error('concurrency must be between 1 and 10');
  }
  return { count, concurrency };
}

function makeOneSecondPattern(profile, seed) {
  const pattern = Buffer.alloc(SAMPLE_RATE, 128);
  let noise = (seed + 1) * 2654435761;
  for (let sample = 0; sample < SAMPLE_RATE; sample += 1) {
    const phase = (2 * Math.PI * 220 * sample) / SAMPLE_RATE;
    if (profile === 'steady-tone' || profile === 'pause-heavy' || profile === 'mostly-silence') {
      pattern[sample] = Math.round(128 + (Math.sin(phase) * 32));
    } else if (profile === 'low-volume') {
      pattern[sample] = Math.round(128 + (Math.sin(phase) * 4));
    } else if (profile === 'deterministic-noise') {
      noise = ((noise * 1664525) + 1013904223) >>> 0;
      pattern[sample] = 112 + (noise % 33);
    }
  }
  return pattern;
}

function makeWav(durationSeconds, profile, seed) {
  const dataSize = durationSeconds * SAMPLE_RATE;
  const wav = Buffer.allocUnsafe(44 + dataSize);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(SAMPLE_RATE, 24);
  wav.writeUInt32LE(SAMPLE_RATE, 28);
  wav.writeUInt16LE(1, 32);
  wav.writeUInt16LE(8, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataSize, 40);

  const active = makeOneSecondPattern(profile, seed);
  const silence = Buffer.alloc(SAMPLE_RATE, 128);
  for (let second = 0; second < durationSeconds; second += 1) {
    let source = active;
    if (profile === 'pause-heavy' && second % 3 === 2) source = silence;
    if (profile === 'mostly-silence' && second % 10 !== 0) source = silence;
    source.copy(wav, 44 + (second * SAMPLE_RATE));
  }
  return wav;
}

function createCorpus(count) {
  return Array.from({ length: count }, (_, index) => {
    const durationSeconds = CLIP_DURATIONS_SECONDS[index % CLIP_DURATIONS_SECONDS.length];
    const profile = SIGNAL_PROFILES[index % SIGNAL_PROFILES.length];
    return {
      caseId: `worker-${String(index + 1).padStart(2, '0')}`,
      durationSeconds,
      profile,
      expectedBytes: 44 + (durationSeconds * SAMPLE_RATE),
    };
  });
}

async function reservePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
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
    signal: AbortSignal.timeout(options.timeoutMs || 15000),
  });
  const data = await response.json().catch(() => null);
  return { status: response.status, data };
}

async function waitForHealth(baseUrl, runtime, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (runtime.exitCode != null || runtime.signalCode != null) {
      throw new Error(`runtime exited before health check (${runtime.exitCode ?? runtime.signalCode})`);
    }
    try {
      const response = await request(baseUrl, 'GET', '/health', { timeoutMs: 1000 });
      if (response.status === 200 && response.data?.status === 'ok') return;
    } catch (_) {
      // Runtime is still applying migrations or binding the port.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('runtime did not become healthy');
}

async function mapWithConcurrency(items, concurrency, work) {
  const results = new Array(items.length);
  let cursor = 0;
  async function consume() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await work(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, consume));
  return results;
}

async function uploadCase(baseUrl, token, patientId, benchmarkCase, index) {
  const wav = makeWav(
    benchmarkCase.durationSeconds,
    benchmarkCase.profile,
    index
  );
  assert.equal(wav.length, benchmarkCase.expectedBytes);
  const startedAt = performance.now();
  const query = new URLSearchParams({
    patientId,
    clinicalDate: '2026-07-15',
    sessionType: 'individual',
    durationMinutes: '45',
    careModality: 'video',
    audioDurationSeconds: String(benchmarkCase.durationSeconds),
  });
  const response = await request(
    baseUrl,
    'POST',
    `/api/audio-drafts/upload?${query}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'audio/wav',
        'Content-Length': String(wav.length),
        'Idempotency-Key': `audio-worker-benchmark-${benchmarkCase.caseId}`,
      },
      body: wav,
    }
  );
  const acknowledgedAt = performance.now();
  if (response.status !== 202) {
    throw new Error(`${benchmarkCase.caseId} upload failed: ${response.status} ${JSON.stringify(response.data)}`);
  }
  assert.equal(response.data?.created, true, `${benchmarkCase.caseId} must create a draft`);
  assert.equal(response.data?.draft?.status, 'received');
  assert.equal(response.data?.processing?.status, 'queued');
  return {
    ...benchmarkCase,
    draftId: response.data.draft.id,
    startedAt,
    ackLatencyMs: acknowledgedAt - startedAt,
  };
}

async function waitForTerminalDrafts(baseUrl, token, uploads, timeoutMs = 125000) {
  const pending = new Map(uploads.map((upload) => [upload.draftId, upload]));
  const completed = [];
  const deadline = performance.now() + timeoutMs;
  while (pending.size && performance.now() < deadline) {
    const current = [...pending.values()];
    const responses = await Promise.all(current.map(async (upload) => ({
      upload,
      response: await request(baseUrl, 'GET', `/api/audio-drafts/${upload.draftId}`, {
        headers: { Authorization: `Bearer ${token}` },
        timeoutMs: 5000,
      }),
    })));
    for (const { upload, response } of responses) {
      const status = response.data?.draft?.status;
      if (!['ready', 'failed', 'cancelled'].includes(status)) continue;
      completed.push({
        ...upload,
        finalStatus: status,
        processingStatus: response.data?.processing?.status || null,
        finalDurationSeconds: response.data?.draft?.audioDurationSeconds ?? null,
        hasRawTranscript: Boolean(response.data?.draft?.rawTranscript),
        hasCleanNote: Boolean(response.data?.draft?.cleanNote),
        completionLatencyMs: performance.now() - upload.startedAt,
      });
      pending.delete(upload.draftId);
    }
    if (pending.size) await new Promise((resolve) => setTimeout(resolve, 25));
  }
  for (const upload of pending.values()) {
    completed.push({
      ...upload,
      finalStatus: 'timeout',
      processingStatus: null,
      finalDurationSeconds: null,
      hasRawTranscript: false,
      hasCleanNote: false,
      completionLatencyMs: performance.now() - upload.startedAt,
    });
  }
  return completed;
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.max(0, Math.ceil(sorted.length * ratio) - 1);
  return sorted[index];
}

function rounded(value) {
  return value == null ? null : Math.round(value * 10) / 10;
}

function latencySummary(values) {
  return {
    minMs: rounded(Math.min(...values)),
    p50Ms: rounded(percentile(values, 0.5)),
    p95Ms: rounded(percentile(values, 0.95)),
    maxMs: rounded(Math.max(...values)),
  };
}

async function waitForMediaCleanup(uploadDir, timeoutMs = 5000) {
  const deadline = Date.now() + timeoutMs;
  let leftovers = [];
  while (Date.now() < deadline) {
    leftovers = fs.existsSync(uploadDir)
      ? fs.readdirSync(uploadDir).filter((name) => /\.(?:audio|part)$/.test(name))
      : [];
    if (!leftovers.length) return leftovers;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  return leftovers;
}

async function stopRuntime(runtime, timeoutMs = 7000) {
  if (runtime.exitCode != null || runtime.signalCode != null) return;
  runtime.kill('SIGTERM');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('runtime did not stop cleanly')), timeoutMs);
    runtime.once('exit', (code, signal) => {
      clearTimeout(timeout);
      if (code === 0 && signal == null) resolve();
      else reject(new Error(`runtime stopped with ${code ?? signal}`));
    });
  });
}

function createReport(options, cases, completed, elapsedMs, leftovers, runtimeChecks) {
  const ready = completed.filter((entry) => entry.finalStatus === 'ready');
  const totalAudioSeconds = cases.reduce((total, item) => total + item.durationSeconds, 0);
  const totalBytes = cases.reduce((total, item) => total + item.expectedBytes, 0);
  const ack = latencySummary(completed.map((entry) => entry.ackLatencyMs));
  const completion = latencySummary(completed.map((entry) => entry.completionLatencyMs));
  const uniqueDrafts = new Set(completed.map((entry) => entry.draftId)).size;
  const exactDurations = ready.every(
    (entry) => entry.finalDurationSeconds === entry.durationSeconds
  );
  const completeOutputs = ready.every(
    (entry) => entry.processingStatus === 'completed'
      && entry.hasRawTranscript
      && entry.hasCleanNote
  );
  const successRate = ready.length / options.count;
  const gates = {
    acceptedAll: completed.length === options.count,
    readyRateAbove90Percent: successRate > 0.9,
    readyAll: ready.length === options.count,
    uniqueDraftPerUpload: uniqueDrafts === options.count,
    acknowledgedUnderFiveSeconds: ack.maxMs < ACK_GATE_MS,
    p95CompletedUnderTwoMinutes: completion.p95Ms < COMPLETION_GATE_MS,
    durationMetadataPreserved: exactDurations,
    transcriptAndCleanNotePresent: completeOutputs,
    temporaryMediaCleaned: leftovers.length === 0,
    noSessionCreatedBeforeConfirmation: runtimeChecks.sessionsCount === 0,
    runtimeHealthyAfterDrain: runtimeChecks.healthy,
    noRuntimeDatabaseErrors: runtimeChecks.databaseErrors.length === 0,
  };
  return {
    benchmark: 'audio-worker-controlled-corpus',
    measuredAt: new Date().toISOString(),
    providerMode: { transcriber: 'fake', noteCleaner: 'fake' },
    runtime: { node: process.version, platform: `${process.platform}-${process.arch}` },
    corpus: {
      count: options.count,
      concurrency: options.concurrency,
      durationRangeSeconds: [
        Math.min(...cases.map((item) => item.durationSeconds)),
        Math.max(...cases.map((item) => item.durationSeconds)),
      ],
      totalAudioMinutes: rounded(totalAudioSeconds / 60),
      totalMegabytes: rounded(totalBytes / (1024 * 1024)),
      signalProfiles: SIGNAL_PROFILES,
      format: 'PCM WAV, mono, 8-bit, 8 kHz',
    },
    result: {
      accepted: completed.length,
      ready: ready.length,
      failed: completed.filter((entry) => entry.finalStatus === 'failed').length,
      timedOut: completed.filter((entry) => entry.finalStatus === 'timeout').length,
      successRate: rounded(successRate),
      wallTimeMs: rounded(elapsedMs),
      representedAudioMinutesPerWallMinute: rounded(
        (totalAudioSeconds / 60) / (elapsedMs / 60000)
      ),
      uploadAckLatency: ack,
      endToEndLatency: completion,
      temporaryMediaLeftovers: leftovers,
      sessionsCreated: runtimeChecks.sessionsCount,
      runtimeDatabaseErrors: runtimeChecks.databaseErrors,
    },
    gates,
    passed: Object.values(gates).every(Boolean),
    cases: completed.map((entry) => ({
      caseId: entry.caseId,
      profile: entry.profile,
      durationSeconds: entry.durationSeconds,
      sizeBytes: entry.expectedBytes,
      draftId: entry.draftId,
      finalStatus: entry.finalStatus,
      ackLatencyMs: rounded(entry.ackLatencyMs),
      completionLatencyMs: rounded(entry.completionLatencyMs),
    })),
  };
}

function printReport(report) {
  console.log(`Audio worker benchmark: ${report.result.ready}/${report.corpus.count} ready`);
  console.log(`Corpus: ${report.corpus.totalAudioMinutes} represented minutes, ${report.corpus.totalMegabytes} MB`);
  console.log(`Upload acknowledgement p95/max: ${report.result.uploadAckLatency.p95Ms}/${report.result.uploadAckLatency.maxMs} ms`);
  console.log(`End-to-end p95/max: ${report.result.endToEndLatency.p95Ms}/${report.result.endToEndLatency.maxMs} ms`);
  console.log(`Temporary media leftovers: ${report.result.temporaryMediaLeftovers.length}`);
  console.log(`Gates: ${report.passed ? 'PASSED' : 'FAILED'}`);
  console.log(`AIRA_AUDIO_WORKER_BENCHMARK_JSON=${JSON.stringify(report)}`);
}

async function main() {
  const options = benchmarkOptions();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-audio-benchmark-'));
  const uploadDir = path.join(tempDir, 'audio-uploads');
  const port = await reservePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const runtimeOutput = [];
  const runtime = spawn(process.execPath, ['scripts/start-runtime.js'], {
    cwd: ROOT_DIR,
    env: {
      ...process.env,
      DATA_DIR: tempDir,
      AUDIO_UPLOAD_DIR: uploadDir,
      PORT: String(port),
      NODE_ENV: 'test',
      JWT_SECRET: crypto.randomBytes(32).toString('hex'),
      DATA_KEY: crypto.randomBytes(32).toString('hex'),
      AUDIO_TRANSCRIBER: 'fake',
      NOTE_CLEANER: 'fake',
      AUDIO_WORKER_POLL_MS: '5',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const collectOutput = (chunk) => {
    runtimeOutput.push(chunk.toString());
    if (runtimeOutput.length > 200) runtimeOutput.shift();
  };
  runtime.stdout.on('data', collectOutput);
  runtime.stderr.on('data', collectOutput);

  try {
    await waitForHealth(baseUrl, runtime);
    const registration = await request(baseUrl, 'POST', '/api/auth/register', {
      body: {
        dni: `7${Date.now().toString().slice(-10)}`,
        pin: '5678',
        name: 'Audio Worker Benchmark',
        specialty: 'psychology',
      },
    });
    assert.equal(registration.status, 201, JSON.stringify(registration.data));
    const token = registration.data?.token;
    assert.ok(token, 'registration must return a token');

    const patient = await request(baseUrl, 'POST', '/api/patients', {
      headers: { Authorization: `Bearer ${token}` },
      body: { name: 'Paciente Benchmark', dni: '99000001' },
    });
    assert.equal(patient.status, 201, JSON.stringify(patient.data));

    const cases = createCorpus(options.count);
    const benchmarkStartedAt = performance.now();
    const uploads = await mapWithConcurrency(
      cases,
      options.concurrency,
      (benchmarkCase, index) => uploadCase(
        baseUrl,
        token,
        patient.data.id,
        benchmarkCase,
        index
      )
    );
    const completed = await waitForTerminalDrafts(baseUrl, token, uploads);
    const elapsedMs = performance.now() - benchmarkStartedAt;
    const readyDrafts = await request(baseUrl, 'GET', '/api/session-drafts?status=ready', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(readyDrafts.status, 200, JSON.stringify(readyDrafts.data));
    assert.equal(readyDrafts.data?.drafts?.length, options.count);
    const sessions = await request(baseUrl, 'GET', '/api/sessions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(sessions.status, 200, JSON.stringify(sessions.data));
    const health = await request(baseUrl, 'GET', '/health');
    const leftovers = await waitForMediaCleanup(uploadDir);
    const runtimeText = runtimeOutput.join('');
    const databaseErrors = runtimeText
      .split(/\r?\n/)
      .filter((line) => /SQLITE_BUSY|database is locked|Audio worker stopped/i.test(line));
    const report = createReport(options, cases, completed, elapsedMs, leftovers, {
      sessionsCount: sessions.data?.sessions?.length ?? -1,
      healthy: health.status === 200 && health.data?.status === 'ok',
      databaseErrors,
    });
    printReport(report);
    assert.equal(report.passed, true, JSON.stringify(report.gates));
    await stopRuntime(runtime);
  } catch (error) {
    if (runtimeOutput.length) {
      console.error(`Benchmark runtime output:\n${runtimeOutput.join('')}`);
    }
    throw error;
  } finally {
    if (runtime.exitCode == null && runtime.signalCode == null) {
      runtime.kill('SIGKILL');
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`Audio worker benchmark failed: ${error.stack || error.message}`);
  process.exitCode = 1;
});
