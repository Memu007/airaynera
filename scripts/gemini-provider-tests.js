#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createGeminiTranscriber } = require('../services/audio/geminiAudioTranscriber');
const {
  aggregateScores,
  normalizeTranscript,
  scoreTranscription,
} = require('../services/audio/transcriptionMetrics');

function makeWav(payloadText = 'synthetic provider contract audio') {
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

function jsonResponse(value, options = {}) {
  return new Response(JSON.stringify(value), {
    status: options.status || 200,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
}

function createMockGemini(options = {}) {
  const calls = [];
  let starts = 0;
  async function fetchFn(url, init) {
    calls.push({ url: String(url), init });
    if (String(url).endsWith('/upload/v1beta/files')) {
      starts += 1;
      if (options.retryFirstStart && starts === 1) {
        return jsonResponse({ error: { message: 'rate limited' } }, {
          status: 429,
          headers: { 'retry-after': '0' },
        });
      }
      return new Response(null, {
        status: 200,
        headers: { 'x-goog-upload-url': 'https://upload.test/session' },
      });
    }
    if (String(url) === 'https://upload.test/session') {
      return jsonResponse({
        file: {
          name: 'files/aira-test',
          uri: 'https://file.test/aira-test',
          state: 'PROCESSING',
        },
      });
    }
    if (String(url).endsWith('/v1/interactions')) {
      return jsonResponse({
        id: 'interaction-test-1',
        model: 'gemini-3.1-flash-lite',
        status: options.interactionStatus || 'completed',
        steps: options.interactionStatus && options.interactionStatus !== 'completed'
          ? []
          : [{
              type: 'model_output',
              content: [{ type: 'text', text: '{"transcript":"Niega ideación suicida."}' }],
            }],
        usage: { total_tokens: 42 },
      });
    }
    if (String(url).endsWith('/v1beta/files/aira-test') && init.method === 'GET') {
      return jsonResponse({
        name: 'files/aira-test',
        uri: 'https://file.test/aira-test',
        state: 'ACTIVE',
      });
    }
    if (String(url).endsWith('/v1beta/files/aira-test') && init.method === 'DELETE') {
      return new Response(null, { status: 204 });
    }
    throw new Error(`Unexpected mock URL ${url}`);
  }
  return { calls, fetchFn };
}

async function testProviderContract(tempWav) {
  const mock = createMockGemini();
  const transcriber = createGeminiTranscriber({
    apiKey: 'test-only-key',
    fetchFn: mock.fetchFn,
    timeoutMs: 1000,
    maxRetries: 0,
  });
  const result = await transcriber.transcribe({
    mediaPath: tempWav,
    mimeType: 'audio/wav',
    durationHintSeconds: 12,
  });
  assert.equal(result.text, 'Niega ideación suicida.');
  assert.equal(result.durationSeconds, 12);
  assert.equal(result.providerRequestId, 'interaction-test-1');
  assert.equal(mock.calls.length, 5);

  const interactionCall = mock.calls.find((call) => call.url.endsWith('/v1/interactions'));
  const body = JSON.parse(interactionCall.init.body);
  assert.equal(body.model, 'gemini-3.1-flash-lite');
  assert.equal(body.store, false);
  assert.equal(body.response_format.schema.required[0], 'transcript');
  assert.equal(body.input[0].type, 'user_input');
  assert.equal(body.input[0].content[1].mime_type, 'audio/wav');
  assert.equal(interactionCall.init.headers['x-goog-api-key'], 'test-only-key');
  assert.ok(mock.calls.some((call) => call.init.method === 'DELETE'));
}

async function testRetryAndCleanup(tempWav) {
  const sleeps = [];
  const retryMock = createMockGemini({ retryFirstStart: true });
  const retrying = createGeminiTranscriber({
    apiKey: 'test-only-key',
    fetchFn: retryMock.fetchFn,
    sleepFn: async (milliseconds) => sleeps.push(milliseconds),
    randomFn: () => 0.5,
    timeoutMs: 1000,
    maxRetries: 1,
  });
  const retried = await retrying.transcribe({ mediaPath: tempWav, mimeType: 'audio/wav' });
  assert.equal(retried.text, 'Niega ideación suicida.');
  assert.deepEqual(sleeps, [0, 500]);
  assert.equal(retryMock.calls.filter((call) => call.url.endsWith('/upload/v1beta/files')).length, 2);

  const failedMock = createMockGemini({ interactionStatus: 'failed' });
  const failing = createGeminiTranscriber({
    apiKey: 'test-only-key',
    fetchFn: failedMock.fetchFn,
    timeoutMs: 1000,
    maxRetries: 0,
  });
  await assert.rejects(
    failing.transcribe({ mediaPath: tempWav, mimeType: 'audio/wav' }),
    (error) => error?.code === 'GEMINI_TRANSCRIPTION_FAILED'
  );
  assert.ok(failedMock.calls.some((call) => call.init.method === 'DELETE'));
}

async function testValidationAndAbort(tempWav) {
  let fetchCount = 0;
  const missingKey = createGeminiTranscriber({ apiKey: '', fetchFn: async () => { fetchCount += 1; } });
  await assert.rejects(
    missingKey.transcribe({ mediaPath: tempWav, mimeType: 'audio/wav' }),
    (error) => error?.code === 'GEMINI_API_KEY_MISSING'
  );
  assert.equal(fetchCount, 0);

  const unsupported = createGeminiTranscriber({
    apiKey: 'test-only-key',
    fetchFn: async () => { fetchCount += 1; },
  });
  await assert.rejects(
    unsupported.transcribe({ mediaPath: tempWav, mimeType: 'audio/webm' }),
    (error) => error?.code === 'GEMINI_UNSUPPORTED_AUDIO_TYPE'
  );
  assert.equal(fetchCount, 0);

  const controller = new AbortController();
  const aborting = createGeminiTranscriber({
    apiKey: 'test-only-key',
    timeoutMs: 1000,
    maxRetries: 0,
    fetchFn: async (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    }),
  });
  const pending = aborting.transcribe({
    mediaPath: tempWav,
    mimeType: 'audio/wav',
    signal: controller.signal,
  });
  setTimeout(() => controller.abort(), 5);
  await assert.rejects(pending, (error) => error?.code === 'AUDIO_PROCESSING_ABORTED');
}

async function testWorkerHeartbeat(tempDir) {
  process.env.DATA_DIR = tempDir;
  process.env.AUDIO_UPLOAD_DIR = path.join(tempDir, 'audio-uploads');
  process.env.AUDIO_TRANSCRIBER = 'gemini';
  process.env.NOTE_CLEANER = 'fake';
  process.env.AUDIO_JOB_LEASE_MS = '30';
  process.env.DATA_KEY = '0'.repeat(64);
  delete process.env.GEMINI_API_KEY;
  delete process.env.GOOGLE_API_KEY;

  const sql = require('../services/sqlite');
  const store = require('../services/audio/temporaryAudioStore');
  const pipeline = require('../services/audioDraftPipeline');
  const { AudioWorker } = require('../workers/audio-worker');

  const userId = 'gemini-provider-worker-user';
  const patient = sql.addPatient(userId, {
    name: 'Paciente Artificial',
    dni: 'gemini-provider-worker-patient',
    habilitado: true,
  });
  const wav = makeWav('async heartbeat contract');
  const media = await store.storeStream(Readable.from(wav), {
    declaredMimeType: 'audio/wav',
    contentLength: wav.length,
  });
  const queued = pipeline.ingestUpload(userId, { patientId: patient.id }, media, {
    source: 'web',
    sourceMessageId: 'gemini-provider-worker-upload',
  });
  const providers = {
    transcriber: {
      name: 'delayed-test-transcriber',
      async transcribe(input) {
        assert.ok(input.mediaPath);
        await new Promise((resolve) => setTimeout(resolve, 90));
        assert.equal(input.signal.aborted, false);
        return { text: 'Niega ideación suicida.', durationSeconds: 3 };
      },
    },
    noteCleaner: {
      name: 'test-cleaner',
      async clean({ rawTranscript }) {
        return { cleanNote: rawTranscript };
      },
    },
  };
  const worker = new AudioWorker({ workerId: 'gemini-provider-test-worker', providers });
  const processed = await worker.runOnce();
  assert.equal(processed.leaseLost, false);
  assert.equal(processed.draft.status, 'ready');
  assert.equal(processed.draft.rawTranscript, 'Niega ideación suicida.');
  assert.equal(sql.getAudioProcessingJob(userId, queued.draft.id).status, 'completed');
  assert.equal(fs.existsSync(store.pathForReference(media.reference)), false);

  const fixture = pipeline.ingest(userId, {
    patientId: patient.id,
    fixtureId: 'clear-es-01',
  }, {
    source: 'web',
    sourceMessageId: 'gemini-provider-fixture-stays-fake',
  });
  assert.equal(fixture.draft.status, 'ready');
  assert.match(fixture.draft.rawTranscript, /nota breve de prueba/);

  const stoppedMedia = await store.storeStream(Readable.from(makeWav('stop cancellation')), {
    declaredMimeType: 'audio/wav',
  });
  const stoppedQueued = pipeline.ingestUpload(userId, { patientId: patient.id }, stoppedMedia, {
    source: 'web',
    sourceMessageId: 'gemini-provider-worker-stop',
  });
  const stoppableWorker = new AudioWorker({
    workerId: 'gemini-provider-stoppable-worker',
    providers: {
      transcriber: {
        name: 'abort-aware-test-transcriber',
        transcribe({ signal }) {
          return new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => {
              const error = new Error('Audio processing lost its worker lease');
              error.code = 'AUDIO_PROCESSING_ABORTED';
              reject(error);
            }, { once: true });
          });
        },
      },
      noteCleaner: providers.noteCleaner,
    },
  });
  const stopping = stoppableWorker.runOnce();
  setTimeout(() => stoppableWorker.stop(), 10);
  const stopped = await stopping;
  assert.equal(stopped.draft.status, 'failed');
  assert.equal(stopped.draft.failure.code, 'AUDIO_PROCESSING_ABORTED');
  assert.equal(sql.getAudioProcessingJob(userId, stoppedQueued.draft.id).status, 'failed');

  const staleMedia = await store.storeStream(Readable.from(makeWav('stale async result')), {
    declaredMimeType: 'audio/wav',
  });
  const staleQueued = pipeline.ingestUpload(userId, { patientId: patient.id }, staleMedia, {
    source: 'web',
    sourceMessageId: 'gemini-provider-stale-result',
  });
  const staleWorker = new AudioWorker({
    workerId: 'gemini-provider-stale-worker',
    providers: {
      transcriber: {
        name: 'abort-ignoring-test-transcriber',
        async transcribe() {
          await new Promise((resolve) => setTimeout(resolve, 70));
          return { text: 'Este resultado obsoleto no debe persistirse.' };
        },
      },
      noteCleaner: providers.noteCleaner,
    },
  });
  const staleRun = staleWorker.runOnce();
  setTimeout(() => {
    sql.getDb().prepare(`
      UPDATE audio_processing_jobs SET
        lease_owner='replacement-worker', lease_token='replacement-token',
        lease_expires_at=?
      WHERE draft_id=?
    `).run(new Date(Date.now() + 1000).toISOString(), staleQueued.draft.id);
  }, 10);
  const stale = await staleRun;
  assert.equal(stale.leaseLost, true);
  const unchangedDraft = require('../services/sessionDraftService').getDraft(
    userId,
    staleQueued.draft.id
  );
  assert.equal(unchangedDraft.rawTranscript, null);
  assert.equal(unchangedDraft.status, 'transcribing');
  sql.cancelAudioProcessingJob(userId, staleQueued.draft.id);
  store.remove(staleMedia.reference);
}

function testMetrics() {
  assert.equal(normalizeTranscript('Ideación, SUICIDA.'), 'ideacion suicida');
  const perfect = scoreTranscription(
    'Niega ideación suicida y toma cinco miligramos.',
    'Niega ideación suicida y toma 5 miligramos.',
    [{ id: 'negation', kind: 'negation', accepted: ['niega ideación suicida'] }]
  );
  assert.equal(perfect.criticalSpans[0].matched, true);
  const contradiction = scoreTranscription(
    'No presenta alucinaciones.',
    'Presenta alucinaciones. No presenta alucinaciones según el texto original.',
    [{
      id: 'no-alucinaciones',
      kind: 'negation',
      accepted: ['no presenta alucinaciones'],
      forbidden: ['presenta alucinaciones'],
    }]
  );
  assert.equal(contradiction.criticalSpans[0].matched, false);
  assert.equal(contradiction.criticalSpans[0].contradictionDetected, true);
  const aggregate = aggregateScores([perfect]);
  assert.equal(aggregate.criticalAccuracy, 1);
  assert.equal(aggregate.negationAccuracy, 1);
  assert.ok(aggregate.wer > 0);
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-gemini-provider-'));
  const tempWav = path.join(tempDir, 'contract.wav');
  fs.writeFileSync(tempWav, makeWav());
  try {
    await testProviderContract(tempWav);
    await testRetryAndCleanup(tempWav);
    await testValidationAndAbort(tempWav);
    testMetrics();
    await testWorkerHeartbeat(path.join(tempDir, 'runtime'));
    console.log('✅ Gemini contract, retries, cancellation, scoring and worker heartbeat passed');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
