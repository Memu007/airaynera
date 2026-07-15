#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { Readable } = require('node:stream');

function makeWav(payloadText = 'synthetic audio bytes') {
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

async function storeWav(store, bytes) {
  return store.storeStream(Readable.from(bytes), {
    declaredMimeType: 'audio/wav',
    contentLength: bytes.length,
  });
}

async function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-upload-worker-'));
  process.env.DATA_DIR = tempDir;
  process.env.AUDIO_UPLOAD_DIR = path.join(tempDir, 'audio-uploads');
  process.env.AUDIO_TRANSCRIBER = 'fake';
  process.env.NOTE_CLEANER = 'fake';
  process.env.AUDIO_JOB_LEASE_MS = '20';
  process.env.DATA_KEY = '0'.repeat(64);

  const sql = require('../services/sqlite');
  const store = require('../services/audio/temporaryAudioStore');
  const pipeline = require('../services/audioDraftPipeline');
  const drafts = require('../services/sessionDraftService');
  const { AudioWorker } = require('../workers/audio-worker');

  try {
    const userId = 'upload-worker-user';
    const patient = sql.addPatient(userId, {
      name: 'Paciente Upload',
      dni: 'upload-worker-patient',
      habilitado: true,
    });
    const otherPatient = sql.addPatient(userId, {
      name: 'Otro Paciente',
      dni: 'upload-worker-other',
      habilitado: true,
    });
    const bytes = makeWav();
    const firstMedia = await storeWav(store, bytes);
    const first = pipeline.ingestUpload(userId, {
      patientId: patient.id,
      clinicalDate: '2026-07-15',
      audioDurationSeconds: 12,
    }, firstMedia, {
      source: 'web',
      sourceMessageId: 'upload-idempotency-1',
    });

    assert.equal(first.created, true);
    assert.equal(first.draft.status, 'received');
    assert.equal(first.processing.status, 'queued');
    assert.equal(sql.listSessions(userId).length, 0);
    assert.equal(fs.existsSync(store.pathForReference(firstMedia.reference)), true);

    const duplicateMedia = await storeWav(store, bytes);
    const duplicate = pipeline.ingestUpload(userId, {
      patientId: patient.id,
      clinicalDate: '2026-07-15',
      audioDurationSeconds: 12,
    }, duplicateMedia, {
      source: 'web',
      sourceMessageId: 'upload-idempotency-1',
    });
    assert.equal(duplicate.created, false);
    assert.equal(duplicate.draft.id, first.draft.id);
    assert.equal(fs.existsSync(store.pathForReference(duplicateMedia.reference)), false);

    const conflictingMedia = await storeWav(store, makeWav('different bytes'));
    assert.throws(
      () => pipeline.ingestUpload(userId, {
        patientId: patient.id,
        clinicalDate: '2026-07-15',
        audioDurationSeconds: 12,
      }, conflictingMedia, {
        source: 'web',
        sourceMessageId: 'upload-idempotency-1',
      }),
      (error) => error?.code === 'IDEMPOTENCY_CONFLICT'
    );
    assert.equal(fs.existsSync(store.pathForReference(conflictingMedia.reference)), false);

    const worker = new AudioWorker({ workerId: 'test-worker' });
    const processed = await worker.runOnce();
    assert.equal(processed.draft.status, 'ready');
    assert.match(processed.draft.rawTranscript, /Transcripción simulada/);
    assert.equal(processed.draft.cleanNote, processed.draft.rawTranscript);
    assert.equal(sql.getAudioProcessingJob(userId, first.draft.id).status, 'completed');
    assert.equal(fs.existsSync(store.pathForReference(firstMedia.reference)), false);
    assert.ok(drafts.getDraft(userId, first.draft.id).mediaDeletedAt);

    assert.throws(
      () => drafts.updateDraft(userId, first.draft.id, { patientId: otherPatient.id }),
      (error) => error?.code === 'INVALID_DRAFT'
    );
    const reviewed = drafts.updateDraft(userId, first.draft.id, {
      cleanNote: 'Nota revisada después del worker.',
    });
    assert.equal(reviewed.cleanNote, 'Nota revisada después del worker.');
    const confirmed = drafts.confirmDraft(userId, first.draft.id);
    const confirmedAgain = drafts.confirmDraft(userId, first.draft.id);
    assert.equal(confirmed.created, true);
    assert.equal(confirmedAgain.created, false);
    assert.equal(confirmed.session.id, confirmedAgain.session.id);

    const cancelledMedia = await storeWav(store, makeWav('cancel me'));
    const pendingCancel = pipeline.ingestUpload(userId, {
      patientId: patient.id,
    }, cancelledMedia, {
      source: 'web',
      sourceMessageId: 'upload-cancel-1',
    });
    const cancelled = drafts.cancelDraft(userId, pendingCancel.draft.id);
    assert.equal(cancelled.status, 'cancelled');
    assert.equal(sql.getAudioProcessingJob(userId, pendingCancel.draft.id).status, 'cancelled');
    assert.equal(fs.existsSync(store.pathForReference(cancelledMedia.reference)), false);

    const recoveredMedia = await storeWav(store, makeWav('recover lease'));
    const pendingRecovery = pipeline.ingestUpload(userId, {
      patientId: patient.id,
    }, recoveredMedia, {
      source: 'web',
      sourceMessageId: 'upload-recover-1',
    });
    const abandoned = sql.claimNextAudioProcessingJob('dead-worker', 1);
    assert.equal(abandoned.draftId, pendingRecovery.draft.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const recovered = await worker.runOnce();
    assert.equal(recovered.draft.status, 'ready');
    assert.equal(sql.getAudioProcessingJob(userId, pendingRecovery.draft.id).attempts, 2);
    assert.equal(
      sql.transitionSessionDraft(userId, pendingRecovery.draft.id, ['ready'], {
        status: 'failed',
        failedStage: 'transcribing',
        errorCode: 'STALE_WORKER',
        errorMessage: 'A stale worker must not overwrite the recovered result',
      }, { leaseToken: abandoned.leaseToken }),
      null
    );
    assert.equal(
      sql.finishAudioProcessingJob(
        abandoned.id,
        'dead-worker',
        abandoned.leaseToken,
        { status: 'failed', errorCode: 'STALE_WORKER' }
      ),
      false
    );

    const failedMedia = await storeWav(store, makeWav('retry after worker failure'));
    const pendingFailure = pipeline.ingestUpload(userId, {
      patientId: patient.id,
    }, failedMedia, {
      source: 'web',
      sourceMessageId: 'upload-worker-failure-1',
    });
    process.env.AUDIO_TRANSCRIBER = 'not-configured';
    const failedByWorker = await worker.runOnce();
    assert.equal(failedByWorker.draft.status, 'failed');
    assert.equal(failedByWorker.draft.failure.code, 'AUDIO_PROVIDER_NOT_CONFIGURED');
    assert.equal(sql.getAudioProcessingJob(userId, pendingFailure.draft.id).status, 'failed');
    assert.equal(fs.existsSync(store.pathForReference(failedMedia.reference)), true);
    process.env.AUDIO_TRANSCRIBER = 'fake';
    const retried = pipeline.retry(userId, pendingFailure.draft.id);
    assert.equal(retried.queued, true);
    const queuedRetry = pipeline.getProcessing(userId, pendingFailure.draft.id);
    assert.equal(queuedRetry.draft.status, 'failed');
    assert.equal(queuedRetry.processing.status, 'queued');
    const processedRetry = await worker.runOnce();
    assert.equal(processedRetry.draft.status, 'ready');
    assert.equal(fs.existsSync(store.pathForReference(failedMedia.reference)), false);

    const orphan = await storeWav(store, makeWav('orphan'));
    const orphanPath = store.pathForReference(orphan.reference);
    const old = new Date(Date.now() - 1000);
    fs.utimesSync(orphanPath, old, old);
    assert.equal(await store.cleanupOrphans([], { olderThanMs: 0 }), 1);
    assert.equal(fs.existsSync(orphanPath), false);

    await assert.rejects(
      store.storeStream(Readable.from(Buffer.from('not audio')), {
        declaredMimeType: 'audio/wav',
      }),
      (error) => error?.code === 'UNSUPPORTED_AUDIO_TYPE'
    );

    const aac = await store.storeStream(
      Readable.from(Buffer.from([0xff, 0xf0, 0x50, 0x80, 0, 0, 0, 0])),
      { declaredMimeType: 'audio/aac' }
    );
    assert.equal(aac.mimeType, 'audio/aac');
    assert.equal(store.remove(aac.reference), true);

    console.log('✅ Real audio uploads queue once, survive leases and clean temporary media');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
