const crypto = require('node:crypto');
const sql = require('./sqlite');
const sessionDraftService = require('./sessionDraftService');
const { getAudioProviders, getFixture } = require('./audio/fakeAudioProviders');
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

function recoverInterruptedDraft(userId, draft) {
  const stage = draft.status === 'structuring' ? 'structuring' : 'transcribing';
  return sql.transitionSessionDraft(userId, draft.id, [draft.status], {
    status: 'failed',
    failedStage: stage,
    errorCode: 'PROCESSING_INTERRUPTED',
    errorMessage: 'Audio processing was interrupted and can be resumed',
    processingFinishedAt: new Date().toISOString(),
  });
}

function markFailed(userId, draftId, expectedStatus, stage, error) {
  return sql.transitionSessionDraft(userId, draftId, [expectedStatus], {
    status: 'failed',
    failedStage: stage,
    errorCode: error.code || 'AUDIO_PROCESSING_FAILED',
    errorMessage: error.message || 'Audio processing failed',
    processingFinishedAt: new Date().toISOString(),
  });
}

function processDraft(userId, draftId) {
  let draft = sessionDraftService.getDraft(userId, draftId);
  if (['ready', 'confirmed', 'cancelled'].includes(draft.status)) {
    return { draft, processed: false };
  }
  if (draft.inputType !== 'audio') {
    throw domainError('DRAFT_NOT_PROCESSABLE', 'Only audio drafts use the audio pipeline');
  }
  if (['transcribing', 'structuring'].includes(draft.status)) {
    if (!hasExpiredProcessingLease(draft)) {
      throw domainError('PROCESSING_ALREADY_CLAIMED', 'Audio processing is already in progress');
    }
    draft = recoverInterruptedDraft(userId, draft);
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
  draft = sql.transitionSessionDraft(userId, draftId, [draft.status], {
    status: firstStatus,
    incrementProcessingAttempts: true,
    clearFailure: true,
    processingStartedAt: new Date().toISOString(),
    processingFinishedAt: null,
  });
  if (!draft) throw domainError('PROCESSING_ALREADY_CLAIMED', 'Another process claimed this draft');

  if (!resumeStructuring) {
    try {
      const transcription = providers.transcriber.transcribe({
        mediaReference: draft.mediaReference,
        mimeType: draft.mediaMimeType,
        languageHint: 'es-AR',
        attempt: draft.processingAttempts,
      });
      if (!String(transcription.text || '').trim()) {
        throw domainError('EMPTY_TRANSCRIPT', 'No speech was found in the simulated audio');
      }
      draft = sql.transitionSessionDraft(userId, draftId, ['transcribing'], {
        status: 'structuring',
        rawTranscript: String(transcription.text).trim(),
        audioDurationSeconds: transcription.durationSeconds,
      });
      if (!draft) throw domainError('DRAFT_NOT_PROCESSABLE', 'The draft changed while transcribing');
    } catch (error) {
      draft = markFailed(userId, draftId, 'transcribing', 'transcribing', error);
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
    draft = sql.transitionSessionDraft(userId, draftId, ['structuring'], {
      status: 'ready',
      cleanNote: String(structured.cleanNote).trim(),
      clearFailure: true,
      failedStage: null,
      processingFinishedAt: new Date().toISOString(),
    });
    if (!draft) throw domainError('DRAFT_NOT_PROCESSABLE', 'The draft changed while preparing the note');
    return { draft, processed: true, failed: false };
  } catch (error) {
    draft = markFailed(userId, draftId, 'structuring', 'structuring', error);
    return { draft, processed: true, failed: true };
  }
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
  return processDraft(userId, draftId);
}

module.exports = {
  ingest,
  processDraft,
  retry,
};
