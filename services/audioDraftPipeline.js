const crypto = require('node:crypto');
const sql = require('./sqlite');
const sessionDraftService = require('./sessionDraftService');
const { getAudioProviders, getFixture } = require('./audio/fakeAudioProviders');
const temporaryAudioStore = require('./audio/temporaryAudioStore');
const { clinicalDateKey } = require('../utils/clinicalDate');

function domainError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function fingerprint(input) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(input))
    .digest('hex');
}

function processingLeaseMs() {
  const configured = Number(process.env.AUDIO_PROCESSING_LEASE_MS);
  return Number.isFinite(configured) && configured > 0 ? configured : 5 * 60 * 1000;
}

function hasExpiredProcessingLease(draft, now = Date.now()) {
  if (!['transcribing', 'structuring'].includes(draft.status)) return false;
  const startedAt = Date.parse(draft.processingStartedAt || '');
  return !Number.isFinite(startedAt) || now - startedAt >= processingLeaseMs();
}

function transitionDraft(userId, draftId, expectedStatuses, changes, options = {}) {
  return sql.transitionSessionDraft(userId, draftId, expectedStatuses, changes, {
    leaseToken: options.jobLeaseToken,
  });
}

function recoverInterruptedDraft(userId, draft, options) {
  const stage = draft.status === 'structuring' ? 'structuring' : 'transcribing';
  return transitionDraft(userId, draft.id, [draft.status], {
    status: 'failed',
    failedStage: stage,
    errorCode: 'PROCESSING_INTERRUPTED',
    errorMessage: 'Audio processing was interrupted and can be resumed',
    processingFinishedAt: new Date().toISOString(),
  }, options);
}

function markFailed(userId, draftId, expectedStatus, stage, error, options) {
  return transitionDraft(userId, draftId, [expectedStatus], {
    status: 'failed',
    failedStage: stage,
    errorCode: error.code || 'AUDIO_PROCESSING_FAILED',
    errorMessage: error.message || 'Audio processing failed',
    processingFinishedAt: new Date().toISOString(),
  }, options);
}

function processDraft(userId, draftId, options = {}) {
  let draft = sessionDraftService.getDraft(userId, draftId);
  if (['ready', 'confirmed', 'cancelled'].includes(draft.status)) {
    return { draft, processed: false };
  }
  if (draft.inputType !== 'audio') {
    throw domainError('DRAFT_NOT_PROCESSABLE', 'Only audio drafts use the audio pipeline');
  }
  if (['transcribing', 'structuring'].includes(draft.status)) {
    if (!options.jobLeaseToken && !hasExpiredProcessingLease(draft)) {
      throw domainError('PROCESSING_ALREADY_CLAIMED', 'Audio processing is already in progress');
    }
    draft = recoverInterruptedDraft(userId, draft, options);
    if (!draft) throw domainError('PROCESSING_ALREADY_CLAIMED', 'Another process recovered this draft');
  }
  if (!['received', 'failed'].includes(draft.status)) {
    throw domainError('DRAFT_NOT_PROCESSABLE', 'The draft cannot be processed from its current status');
  }

  const providers = getAudioProviders();
  const resumeStructuring = draft.status === 'failed'
    && draft.failedStage === 'structuring'
    && Boolean(draft.rawTranscript);
  const firstStatus = resumeStructuring ? 'structuring' : 'transcribing';
  draft = transitionDraft(userId, draftId, [draft.status], {
    status: firstStatus,
    incrementProcessingAttempts: true,
    clearFailure: true,
    processingStartedAt: new Date().toISOString(),
    processingFinishedAt: null,
  }, options);
  if (!draft) throw domainError('PROCESSING_ALREADY_CLAIMED', 'Another process claimed this draft');

  if (!resumeStructuring) {
    try {
      const storedMedia = temporaryAudioStore.isUploadReference(draft.mediaReference)
        ? temporaryAudioStore.verifyStoredMedia(draft.mediaReference, {
            sizeBytes: draft.mediaSizeBytes,
            sha256: draft.mediaSha256,
          })
        : null;
      const transcription = providers.transcriber.transcribe({
        mediaReference: draft.mediaReference,
        mediaPath: storedMedia?.path || null,
        mimeType: draft.mediaMimeType,
        languageHint: 'es-AR',
        attempt: draft.processingAttempts,
        durationHintSeconds: draft.audioDurationSeconds,
      });
      if (!String(transcription.text || '').trim()) {
        throw domainError('EMPTY_TRANSCRIPT', 'No speech was found in the simulated audio');
      }
      draft = transitionDraft(userId, draftId, ['transcribing'], {
        status: 'structuring',
        rawTranscript: String(transcription.text).trim(),
        audioDurationSeconds: transcription.durationSeconds,
      }, options);
      if (!draft) throw domainError('DRAFT_NOT_PROCESSABLE', 'The draft changed while transcribing');
    } catch (error) {
      draft = markFailed(userId, draftId, 'transcribing', 'transcribing', error, options);
      return { draft, processed: true, failed: true };
    }
  }

  try {
    const structured = providers.noteCleaner.clean({
      rawTranscript: draft.rawTranscript,
      mediaReference: draft.mediaReference,
      language: 'es-AR',
      attempt: draft.processingAttempts,
    });
    if (!String(structured.cleanNote || '').trim()) {
      throw domainError('EMPTY_CLEAN_NOTE', 'The simulated cleaner returned an empty note');
    }
    draft = transitionDraft(userId, draftId, ['structuring'], {
      status: 'ready',
      cleanNote: String(structured.cleanNote).trim(),
      clearFailure: true,
      failedStage: null,
      processingFinishedAt: new Date().toISOString(),
    }, options);
    if (!draft) throw domainError('DRAFT_NOT_PROCESSABLE', 'The draft changed while preparing the note');
    return { draft, processed: true, failed: false };
  } catch (error) {
    draft = markFailed(userId, draftId, 'structuring', 'structuring', error, options);
    return { draft, processed: true, failed: true };
  }
}

function ingestUpload(userId, payload, storedMedia, options = {}) {
  const source = options.source || 'web';
  const sourceMessageId = String(options.sourceMessageId || '').trim();
  if (!payload.patientId || !sourceMessageId || !storedMedia?.reference) {
    throw domainError('INVALID_AUDIO_INPUT', 'patientId, uploaded audio and idempotency key are required');
  }

  const clinicalDate = payload.clinicalDate || clinicalDateKey();
  const sessionType = payload.sessionType || 'individual';
  const durationMinutes = payload.durationMinutes ?? null;
  const careModality = payload.careModality || 'unspecified';
  const audioDurationSeconds = payload.audioDurationSeconds ?? null;
  const inputFingerprint = fingerprint({
    patientId: String(payload.patientId),
    source,
    clinicalDate,
    sessionType,
    durationMinutes,
    careModality,
    audioDurationSeconds,
    mediaMimeType: storedMedia.mimeType,
    mediaSizeBytes: storedMedia.sizeBytes,
    mediaSha256: storedMedia.sha256,
  });

  const created = sessionDraftService.createQueuedAudioDraft(userId, {
    patientId: String(payload.patientId),
    clinicalDate,
    sessionType,
    durationMinutes,
    careModality,
    audioDurationSeconds,
    mediaReference: storedMedia.reference,
    mediaMimeType: storedMedia.mimeType,
    mediaSizeBytes: storedMedia.sizeBytes,
    mediaSha256: storedMedia.sha256,
    mediaExpiresAt: storedMedia.expiresAt,
    inputFingerprint,
  }, { source, sourceMessageId });

  if (!created.created) {
    temporaryAudioStore.remove(storedMedia.reference);
    if (created.draft.inputFingerprint !== inputFingerprint) {
      throw domainError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used with another audio input');
    }
    const job = created.job || (
      ['received', 'transcribing'].includes(created.draft.status)
        ? sql.ensureAudioProcessingJob(userId, created.draft.id)
        : null
    );
    return {
      draft: created.draft,
      processing: job,
      created: false,
      deduplicated: true,
      queued: ['queued', 'running'].includes(job?.status),
    };
  }

  return {
    draft: created.draft,
    processing: created.job,
    created: true,
    deduplicated: false,
    queued: true,
  };
}

function ingest(userId, payload, options = {}) {
  const fixture = getFixture(payload.fixtureId);
  const source = options.source || 'web';
  const sourceMessageId = String(options.sourceMessageId || '').trim();
  if (!payload.patientId || !sourceMessageId) {
    throw domainError('INVALID_AUDIO_INPUT', 'patientId and source message id are required');
  }

  const clinicalDate = payload.clinicalDate || clinicalDateKey();
  const sessionType = payload.sessionType || 'individual';
  const durationMinutes = payload.durationMinutes ?? null;
  const careModality = payload.careModality || 'unspecified';
  const inputFingerprint = fingerprint({
    patientId: String(payload.patientId),
    source,
    clinicalDate,
    sessionType,
    durationMinutes,
    careModality,
    fixtureId: fixture.id,
    mimeType: fixture.mimeType,
    durationSeconds: fixture.durationSeconds,
  });
  const created = sessionDraftService.createDraft(userId, {
    patientId: String(payload.patientId),
    clinicalDate,
    sessionType,
    durationMinutes,
    careModality,
    inputType: 'audio',
    audioDurationSeconds: fixture.durationSeconds,
    mediaReference: `fixture://${fixture.id}`,
    mediaMimeType: fixture.mimeType,
    inputFingerprint,
  }, { source, sourceMessageId });

  if (!created.created) {
    if (created.draft.inputFingerprint !== inputFingerprint) {
      throw domainError('IDEMPOTENCY_CONFLICT', 'The idempotency key was already used with another audio input');
    }
    if (created.draft.status === 'received' || hasExpiredProcessingLease(created.draft)) {
      return {
        ...processDraft(userId, created.draft.id),
        created: false,
        deduplicated: true,
      };
    }
    return { draft: created.draft, created: false, deduplicated: true, processed: false };
  }

  return {
    ...processDraft(userId, created.draft.id),
    created: true,
    deduplicated: false,
  };
}

function retry(userId, draftId) {
  const current = sessionDraftService.getDraft(userId, draftId);
  const recoverable = ['received', 'failed'].includes(current.status)
    || hasExpiredProcessingLease(current);
  if (current.inputType !== 'audio' || !recoverable) {
    throw domainError('DRAFT_NOT_PROCESSABLE', 'Only interrupted or failed audio drafts can be retried');
  }
  if (temporaryAudioStore.isUploadReference(current.mediaReference)) {
    if (!current.rawTranscript) {
      temporaryAudioStore.verifyStoredMedia(current.mediaReference, {
        sizeBytes: current.mediaSizeBytes,
        sha256: current.mediaSha256,
      });
    }
    const job = sql.ensureAudioProcessingJob(userId, current.id);
    const queued = sql.requeueAudioProcessingJob(userId, current.id);
    if (!queued || !['queued', 'running'].includes(queued.status)) {
      throw domainError('DRAFT_NOT_PROCESSABLE', 'The uploaded audio job cannot be retried');
    }
    return { draft: current, processing: queued || job, queued: true, processed: false };
  }
  return processDraft(userId, draftId);
}

function getProcessing(userId, draftId) {
  const draft = sessionDraftService.getDraft(userId, draftId);
  return { draft, processing: sql.getAudioProcessingJob(userId, draftId) };
}

function failDraftFromWorker(userId, draftId, error, options = {}) {
  const current = sessionDraftService.getDraft(userId, draftId);
  if (['ready', 'confirmed', 'cancelled', 'failed'].includes(current.status)) return current;
  const stage = current.rawTranscript ? 'structuring' : 'transcribing';
  return markFailed(userId, draftId, current.status, stage, error, options)
    || sessionDraftService.getDraft(userId, draftId);
}

module.exports = {
  failDraftFromWorker,
  ingest,
  ingestUpload,
  getProcessing,
  processDraft,
  retry,
};
