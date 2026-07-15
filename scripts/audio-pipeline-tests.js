#!/usr/bin/env node

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const phase = process.env.AIRA_AUDIO_TEST_PHASE;
const userId = 'audio-professional';

function expectCode(work, code) {
  assert.throws(work, (error) => error?.code === code);
}

function runPhaseOne() {
  const sql = require('../services/sqlite');
  const pipeline = require('../services/audioDraftPipeline');
  const draftService = require('../services/sessionDraftService');

  const patient = sql.addPatient(userId, {
    name: 'Paciente Audio Sintético',
    dni: 'audio-synthetic-patient',
    habilitado: true,
  });
  const failed = pipeline.ingest(userId, {
    patientId: patient.id,
    fixtureId: 'transcription-fails-once',
  }, {
    source: 'web',
    sourceMessageId: 'restart-audio-failure',
  });

  assert.equal(failed.created, true);
  assert.equal(failed.draft.status, 'failed');
  assert.equal(failed.draft.failedStage, 'transcribing');
  assert.equal(failed.draft.rawTranscript, null);
  assert.equal(failed.draft.processingAttempts, 1);
  assert.equal(sql.listSessions(userId).length, 0);

  const interruptedReceived = draftService.createDraft(userId, {
    patientId: patient.id,
    inputType: 'audio',
    mediaReference: 'fixture://clear-es-01',
    mediaMimeType: 'audio/ogg',
    audioDurationSeconds: 38,
  }, {
    source: 'web',
    sourceMessageId: 'restart-audio-received',
  });
  assert.equal(interruptedReceived.draft.status, 'received');

  const interruptedStructuring = draftService.createDraft(userId, {
    patientId: patient.id,
    inputType: 'audio',
    mediaReference: 'fixture://pause-heavy-es-01',
    mediaMimeType: 'audio/ogg',
    audioDurationSeconds: 52,
  }, {
    source: 'web',
    sourceMessageId: 'restart-audio-structuring',
  });
  const claimed = sql.transitionSessionDraft(userId, interruptedStructuring.draft.id, ['received'], {
    status: 'structuring',
    rawTranscript: 'Transcripción literal que ya había sido persistida.',
    processingStartedAt: '2020-01-01T00:00:00.000Z',
  });
  assert.equal(claimed.status, 'structuring');
}

function runPhaseTwo() {
  const sql = require('../services/sqlite');
  const pipeline = require('../services/audioDraftPipeline');
  const draftService = require('../services/sessionDraftService');
  const { cleanConservatively } = require('../services/audio/fakeAudioProviders');
  const { clinicalDateKey } = require('../utils/clinicalDate');

  const patient = sql.listPatients(userId)[0];
  const restartDraft = sql.listSessionDrafts(userId).find(
    (draft) => draft.sourceMessageId === 'restart-audio-failure'
  );
  const recovered = pipeline.retry(userId, restartDraft.id);
  assert.equal(recovered.draft.status, 'ready');
  assert.equal(recovered.draft.processingAttempts, 2);
  assert.match(recovered.draft.cleanNote, /recuperada después de reintentar/i);

  const receivedAfterRestart = sql.listSessionDrafts(userId).find(
    (draft) => draft.sourceMessageId === 'restart-audio-received'
  );
  const recoveredReceived = pipeline.retry(userId, receivedAfterRestart.id);
  assert.equal(recoveredReceived.draft.status, 'ready');
  assert.equal(recoveredReceived.draft.processingAttempts, 1);

  const structuringAfterRestart = sql.listSessionDrafts(userId).find(
    (draft) => draft.sourceMessageId === 'restart-audio-structuring'
  );
  const rawBeforeRecovery = structuringAfterRestart.rawTranscript;
  const recoveredStructuring = pipeline.retry(userId, structuringAfterRestart.id);
  assert.equal(recoveredStructuring.draft.status, 'ready');
  assert.equal(recoveredStructuring.draft.rawTranscript, rawBeforeRecovery);
  assert.equal(recoveredStructuring.draft.processingAttempts, 1);

  assert.equal(
    clinicalDateKey(new Date('2026-07-15T00:01:00.000Z'), 'America/Argentina/Buenos_Aires'),
    '2026-07-14'
  );

  const success = pipeline.ingest(userId, {
    patientId: patient.id,
    clinicalDate: '2026-07-14',
    fixtureId: 'pause-heavy-es-01',
  }, {
    source: 'web',
    sourceMessageId: 'web-audio-success',
  });
  assert.equal(success.created, true);
  assert.equal(success.draft.status, 'ready');
  assert.equal(success.draft.inputType, 'audio');
  assert.equal(success.draft.audioDurationSeconds, 52);
  assert.equal(success.draft.processingAttempts, 1);
  assert.equal(
    success.draft.cleanNote,
    'Hoy registré una nota de prueba, con varias pausas para revisar el resultado.'
  );
  assert.equal(cleanConservatively('No cambiar 50 mg ni la palabra no.'), 'No cambiar 50 mg ni la palabra no.');
  assert.equal(sql.listSessions(userId).length, 0);

  const repeated = pipeline.ingest(userId, {
    patientId: patient.id,
    clinicalDate: '2026-07-14',
    fixtureId: 'pause-heavy-es-01',
  }, {
    source: 'web',
    sourceMessageId: 'web-audio-success',
  });
  assert.equal(repeated.created, false);
  assert.equal(repeated.deduplicated, true);
  assert.equal(repeated.draft.id, success.draft.id);
  assert.equal(repeated.draft.processingAttempts, 1);

  expectCode(() => pipeline.ingest(userId, {
    patientId: patient.id,
    clinicalDate: '2026-07-14',
    fixtureId: 'clear-es-01',
  }, {
    source: 'web',
    sourceMessageId: 'web-audio-success',
  }), 'IDEMPOTENCY_CONFLICT');

  expectCode(() => pipeline.ingest(userId, {
    patientId: patient.id,
    clinicalDate: '2026-07-14',
    careModality: 'video',
    fixtureId: 'pause-heavy-es-01',
  }, {
    source: 'web',
    sourceMessageId: 'web-audio-success',
  }), 'IDEMPOTENCY_CONFLICT');

  const originalRaw = success.draft.rawTranscript;
  const reviewed = draftService.updateDraft(userId, success.draft.id, {
    rawTranscript: 'This must be ignored',
    audioDurationSeconds: 1,
    cleanNote: 'Nota sintética revisada por una persona.',
  });
  assert.equal(reviewed.rawTranscript, originalRaw);
  assert.equal(reviewed.audioDurationSeconds, 52);
  assert.equal(reviewed.cleanNote, 'Nota sintética revisada por una persona.');

  const confirmed = draftService.confirmDraft(userId, success.draft.id);
  const repeatedConfirmation = draftService.confirmDraft(userId, success.draft.id);
  assert.equal(confirmed.created, true);
  assert.equal(repeatedConfirmation.created, false);
  assert.equal(repeatedConfirmation.session.id, confirmed.session.id);
  assert.equal(confirmed.session.raw_transcript, originalRaw);
  assert.equal(confirmed.session.clean_note, reviewed.cleanNote);
  assert.equal(sql.listSessions(userId).length, 1);

  const cleaningFailure = pipeline.ingest(userId, {
    patientId: patient.id,
    fixtureId: 'cleaning-fails-once',
  }, {
    source: 'web',
    sourceMessageId: 'cleaning-failure',
  });
  assert.equal(cleaningFailure.draft.status, 'failed');
  assert.equal(cleaningFailure.draft.failedStage, 'structuring');
  assert.match(cleaningFailure.draft.rawTranscript, /reintentar la preparación/i);
  const rawBeforeRetry = cleaningFailure.draft.rawTranscript;
  const cleanedOnRetry = pipeline.retry(userId, cleaningFailure.draft.id);
  assert.equal(cleanedOnRetry.draft.status, 'ready');
  assert.equal(cleanedOnRetry.draft.processingAttempts, 2);
  assert.equal(cleanedOnRetry.draft.rawTranscript, rawBeforeRetry);

  const empty = pipeline.ingest(userId, {
    patientId: patient.id,
    fixtureId: 'empty-audio',
  }, {
    source: 'web',
    sourceMessageId: 'empty-audio',
  });
  assert.equal(empty.draft.status, 'failed');
  assert.equal(empty.draft.failure.code, 'EMPTY_TRANSCRIPT');

  const cancelled = draftService.cancelDraft(userId, cleanedOnRetry.draft.id);
  assert.equal(cancelled.status, 'cancelled');
  expectCode(() => pipeline.retry(userId, cancelled.id), 'DRAFT_NOT_PROCESSABLE');
  expectCode(() => pipeline.retry('another-user', empty.draft.id), 'DRAFT_NOT_FOUND');
  expectCode(() => pipeline.ingest(userId, {
    patientId: patient.id,
    fixtureId: 'unknown-fixture',
  }, {
    source: 'web',
    sourceMessageId: 'unknown-fixture',
  }), 'INVALID_AUDIO_INPUT');
}

if (phase === 'one') {
  runPhaseOne();
} else if (phase === 'two') {
  runPhaseTwo();
} else {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-audio-'));
  const baseEnv = {
    ...process.env,
    DATA_DIR: tempDir,
    AUDIO_TRANSCRIBER: 'fake',
    NOTE_CLEANER: 'fake',
  };
  try {
    for (const childPhase of ['one', 'two']) {
      const child = spawnSync(process.execPath, [__filename], {
        env: { ...baseEnv, AIRA_AUDIO_TEST_PHASE: childPhase },
        encoding: 'utf8',
      });
      if (child.status !== 0) {
        process.stderr.write(child.stdout || '');
        process.stderr.write(child.stderr || '');
        process.exit(child.status || 1);
      }
    }
    console.log('✅ Audio pipeline preserves raw text, retries by stage and survives restart');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
