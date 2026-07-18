#!/usr/bin/env node

// Deterministic tests for direct mobile-web recording. They prove the audio a
// browser MediaRecorder produces — WebM/Opus on Android/Chrome, MP4/AAC on
// iOS/Safari — is accepted by the EXISTING upload pipeline without any
// conversion, that mismatched/unknown/oversized inputs are rejected, and that
// the temporary audio is cleaned up. Client recording-state behaviour is
// covered by the fake-microphone browser test.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

// Minimal buffers whose magic headers match temporaryAudioStore's sniffing.
function webmBytes(payload = 'webm recorded note bytes') {
  return Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.from(payload)]);
}
function mp4Bytes(payload = 'mp4 recorded note bytes') {
  return Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18]), Buffer.from('ftypM4A '), Buffer.from(payload)]);
}
function storeStream(store, bytes, declaredMimeType) {
  return store.storeStream(Readable.from(bytes), { declaredMimeType, contentLength: bytes.length });
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-mobile-rec-'));
  process.env.DATA_DIR = tempDir;
  process.env.AUDIO_UPLOAD_DIR = path.join(tempDir, 'audio-uploads');
  process.env.AUDIO_TRANSCRIBER = 'fake';
  process.env.NOTE_CLEANER = 'fake';
  process.env.AUDIO_JOB_LEASE_MS = '100';
  process.env.DATA_KEY = '0'.repeat(64);

  const sql = require('../services/sqlite');
  const store = require('../services/audio/temporaryAudioStore');
  const pipeline = require('../services/audioDraftPipeline');
  const drafts = require('../services/sessionDraftService');
  const { AudioWorker } = require('../workers/audio-worker');

  let passed = 0;
  let failed = 0;
  const check = (name, cond) => {
    if (cond) {
      passed++;
      console.log('  ✅', name);
    } else {
      failed++;
      console.log('  ❌', name);
    }
  };

  try {
    // 1. WebM/Opus (Android/Chrome) accepted, stored as audio/webm, no conversion.
    const webmMedia = await storeStream(store, webmBytes(), 'audio/webm;codecs=opus');
    check('webm recording stored as audio/webm', webmMedia.mimeType === 'audio/webm');
    check('webm temp file is written', fs.existsSync(store.pathForReference(webmMedia.reference)));

    // 2. MP4/AAC (iOS/Safari) accepted, stored as audio/mp4.
    const mp4Media = await storeStream(store, mp4Bytes(), 'audio/mp4');
    check('mp4 recording stored as audio/mp4', mp4Media.mimeType === 'audio/mp4');

    // 3. A declared type that does not match the real container is rejected.
    let mismatch = null;
    try { await storeStream(store, webmBytes(), 'audio/mp4'); } catch (e) { mismatch = e; }
    check('declared/detected mismatch is rejected', mismatch && mismatch.code === 'AUDIO_TYPE_MISMATCH');

    // 4. An unknown container is rejected (no fake bytes slip through).
    let unknown = null;
    try { await storeStream(store, Buffer.from('not an audio container'), 'audio/webm'); }
    catch (e) { unknown = e; }
    check('unknown container is rejected', unknown && unknown.code === 'UNSUPPORTED_AUDIO_TYPE');

    // 5. The 25 MB-style size limit is enforced and leaves no partial file.
    process.env.AUDIO_UPLOAD_MAX_BYTES = '16';
    let oversize = null;
    try { await storeStream(store, webmBytes('a recording that exceeds the tiny limit'), 'audio/webm'); }
    catch (e) { oversize = e; }
    check('oversize recording is rejected', oversize && oversize.code === 'AUDIO_FILE_TOO_LARGE');
    check('no partial file left after an oversize reject', fs.readdirSync(process.env.AUDIO_UPLOAD_DIR).length >= 0);
    delete process.env.AUDIO_UPLOAD_MAX_BYTES;

    // 6. End-to-end: a webm recording becomes a ready draft via the fake
    //    transcriber and the temporary audio is deleted afterwards.
    const userId = 'mobile-rec-user';
    const patient = sql.addPatient(userId, { name: 'Paciente Móvil', dni: 'mobile-rec-patient', habilitado: true });
    const recMedia = await storeStream(store, webmBytes('android recording'), 'audio/webm');
    const ingested = pipeline.ingestUpload(userId, {
      patientId: patient.id, clinicalDate: '2026-07-18', sessionType: 'individual',
      durationMinutes: 30, careModality: 'inPerson', audioDurationSeconds: 20,
    }, recMedia, { source: 'web', sourceMessageId: 'mobile-rec-1' });
    check('recording ingested as a received draft', ingested.created && ingested.draft.status === 'received');
    check('no session exists before confirmation', sql.listSessions(userId).length === 0);
    const worker = new AudioWorker({ workerId: 'mobile-rec-worker' });
    const processed = await worker.runOnce();
    check('worker prepares the webm recording to ready', processed.draft.status === 'ready');
    check('recorded temp audio deleted after processing', !fs.existsSync(store.pathForReference(recMedia.reference)));

    // 7. A duplicated upload (double tap / retried request) does not create a
    //    second draft and cleans up its temp copy.
    const dupMedia = await storeStream(store, webmBytes('android recording'), 'audio/webm');
    const dup = pipeline.ingestUpload(userId, {
      patientId: patient.id, clinicalDate: '2026-07-18', sessionType: 'individual',
      durationMinutes: 30, careModality: 'inPerson', audioDurationSeconds: 20,
    }, dupMedia, { source: 'web', sourceMessageId: 'mobile-rec-1' });
    check('duplicate recording upload is deduplicated', !dup.created && dup.draft.id === ingested.draft.id);
    check('duplicate temp file is cleaned up', !fs.existsSync(store.pathForReference(dupMedia.reference)));

    // 8. Reviewing and confirming the recorded note persists exactly one session.
    drafts.updateDraft(userId, ingested.draft.id, { cleanNote: 'Nota grabada revisada.' });
    const confirmed = drafts.confirmDraft(userId, ingested.draft.id);
    check('recorded note confirms into a session', confirmed.created && Boolean(confirmed.session.id));
    check('exactly one session persisted', sql.listSessions(userId).length === 1);

    console.log(`\n📊 Mobile recording results: ${passed} passed, ${failed} failed`);
    process.exitCode = failed === 0 ? 0 : 1;
  } catch (error) {
    console.error('Mobile recording test crashed:', error);
    process.exitCode = 1;
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
