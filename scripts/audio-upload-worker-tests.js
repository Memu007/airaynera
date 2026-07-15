#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
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
    process.env.AUDIO_UPLOAD_MAX_BYTES = '48';
    await assert.rejects(
      store.storeStream(Readable.from(makeWav('streamed upload over the configured limit')), {
        declaredMimeType: 'audio/wav',
      }),
      (error) => error?.code === 'AUDIO_FILE_TOO_LARGE'
    );
    assert.deepEqual(fs.readdirSync(process.env.AUDIO_UPLOAD_DIR), []);
    delete process.env.AUDIO_UPLOAD_MAX_BYTES;

    const inactiveUserId = 'inactive-patient-user';
    const inactivePatient = sql.addPatient(inactiveUserId, {
      name: 'Paciente Inactivo',
      dni: 'inactive-patient',
      habilitado: false,
    });
    assert.throws(
      () => drafts.createDraft(inactiveUserId, {
        patientId: inactivePatient.id,
        cleanNote: 'No debe crearse.',
        inputType: 'text',
      }),
      (error) => error?.code === 'PATIENT_NOT_FOUND'
    );
    assert.throws(
      () => drafts.createQueuedAudioDraft(inactiveUserId, {
        patientId: inactivePatient.id,
        mediaReference: 'upload://00000000-0000-4000-8000-000000000001',
        mediaMimeType: 'audio/wav',
        inputFingerprint: 'inactive-audio',
      }, { sourceMessageId: 'inactive-audio-1' }),
      (error) => error?.code === 'PATIENT_NOT_FOUND'
    );
    assert.throws(
      () => sql.addSession(inactiveUserId, {
        pacienteId: inactivePatient.id,
        cleanNote: 'No debe crearse.',
      }),
      (error) => error?.code === 'PATIENT_NOT_FOUND'
    );

    const historicalPatient = sql.addPatient(inactiveUserId, {
      name: 'Paciente Histórico',
      dni: 'historical-patient',
      habilitado: true,
    });
    const historicalSession = sql.addSession(inactiveUserId, {
      pacienteId: historicalPatient.id,
      cleanNote: 'Sesión histórica.',
    });
    const historicalDraft = drafts.createDraft(inactiveUserId, {
      patientId: historicalPatient.id,
      cleanNote: 'Borrador creado mientras estaba activo.',
      inputType: 'text',
    }).draft;
    sql.updatePatient(inactiveUserId, historicalPatient.id, { habilitado: false });
    assert.equal(
      sql.listSessions(inactiveUserId).some((session) => session.id === historicalSession.id),
      true
    );
    assert.equal(drafts.getDraft(inactiveUserId, historicalDraft.id).id, historicalDraft.id);
    assert.throws(
      () => drafts.confirmDraft(inactiveUserId, historicalDraft.id),
      (error) => error?.code === 'PATIENT_NOT_FOUND'
    );
    assert.equal(sql.listSessions(inactiveUserId).length, 1);

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

    const expiredMedia = await storeWav(store, makeWav('expire completely'));
    const pendingExpiration = pipeline.ingestUpload(userId, {
      patientId: patient.id,
    }, expiredMedia, {
      source: 'web',
      sourceMessageId: 'upload-expire-1',
    });
    sql.getDb().prepare(`
      UPDATE session_drafts SET media_expires_at=? WHERE id=? AND user_id=?
    `).run('2020-01-01T00:00:00.000Z', pendingExpiration.draft.id, userId);
    await worker.sweepOrphans(true);
    const expiredDraft = drafts.getDraft(userId, pendingExpiration.draft.id);
    assert.equal(expiredDraft.status, 'failed');
    assert.equal(expiredDraft.failure.code, 'AUDIO_UPLOAD_EXPIRED');
    assert.equal(
      sql.getAudioProcessingJob(userId, pendingExpiration.draft.id).status,
      'cancelled'
    );
    assert.equal(fs.existsSync(store.pathForReference(expiredMedia.reference)), false);
    assert.ok(expiredDraft.mediaDeletedAt);

    const raceMedia = await storeWav(store, makeWav('expiration race'));
    const pendingRace = pipeline.ingestUpload(userId, {
      patientId: patient.id,
    }, raceMedia, {
      source: 'web',
      sourceMessageId: 'upload-expire-race-1',
    });
    sql.getDb().prepare(`
      UPDATE session_drafts SET media_expires_at=? WHERE id=? AND user_id=?
    `).run('2020-01-01T00:00:00.000Z', pendingRace.draft.id, userId);
    const racingJob = sql.claimNextAudioProcessingJob('racing-worker', 10_000);
    assert.equal(racingJob.draftId, pendingRace.draft.id);
    assert.ok(sql.transitionSessionDraft(
      userId,
      pendingRace.draft.id,
      ['received'],
      { status: 'transcribing', processingStartedAt: new Date().toISOString() },
      { leaseToken: racingJob.leaseToken }
    ));
    assert.equal(
      sql.listExpiredAudioUploads().some((candidate) => candidate.draftId === pendingRace.draft.id),
      true
    );
    assert.ok(sql.transitionSessionDraft(
      userId,
      pendingRace.draft.id,
      ['transcribing'],
      { status: 'structuring', rawTranscript: 'Transcripción terminada a tiempo.' },
      { leaseToken: racingJob.leaseToken }
    ));
    const lostExpirationRace = sql.expireAudioUpload(userId, pendingRace.draft.id);
    assert.equal(lostExpirationRace.expired, false);
    assert.equal(lostExpirationRace.draft.status, 'structuring');
    assert.equal(lostExpirationRace.draft.rawTranscript, 'Transcripción terminada a tiempo.');
    assert.equal(sql.getAudioProcessingJob(userId, pendingRace.draft.id).status, 'running');
    assert.equal(fs.existsSync(store.pathForReference(raceMedia.reference)), true);
    assert.equal(lostExpirationRace.draft.mediaDeletedAt, null);
    drafts.cancelDraft(userId, pendingRace.draft.id);
    assert.equal(fs.existsSync(store.pathForReference(raceMedia.reference)), false);

    const crossProcessMedia = await storeWav(store, makeWav('cross process recovery'));
    const pendingCrossProcess = pipeline.ingestUpload(userId, {
      patientId: patient.id,
    }, crossProcessMedia, {
      source: 'web',
      sourceMessageId: 'upload-cross-process-recovery-1',
    });
    const abandonedCrossProcess = sql.claimNextAudioProcessingJob('dead-cross-process-worker', 1);
    assert.equal(abandonedCrossProcess.draftId, pendingCrossProcess.draft.id);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const child = spawnSync(process.execPath, ['workers/audio-worker.js', '--once'], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env },
      encoding: 'utf8',
    });
    assert.equal(child.status, 0, child.stderr || child.stdout);
    assert.equal(drafts.getDraft(userId, pendingCrossProcess.draft.id).status, 'ready');
    assert.equal(
      sql.getAudioProcessingJob(userId, pendingCrossProcess.draft.id).status,
      'completed'
    );
    assert.equal(sql.getAudioProcessingJob(userId, pendingCrossProcess.draft.id).attempts, 2);
    assert.equal(fs.existsSync(store.pathForReference(crossProcessMedia.reference)), false);

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

    console.log('✅ Real audio uploads enforce limits, recover leases and expire media safely');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
