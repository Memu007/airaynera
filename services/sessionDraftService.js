const sql = require('./sqlite');
const temporaryAudioStore = require('./audio/temporaryAudioStore');
const { clinicalDateKey } = require('../utils/clinicalDate');

const EDITABLE_FIELDS = new Set([
  'patientId',
  'clinicalDate',
  'sessionType',
  'durationMinutes',
  'careModality',
  'cleanNote',
  'medicationNotes',
  'moodAssessment',
  'requiresFollowUp',
]);

const ALLOWED_STATUSES = new Set([
  'received',
  'transcribing',
  'structuring',
  'ready',
  'confirmed',
  'cancelled',
  'failed',
]);

function domainError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function createDraft(userId, payload, options = {}) {
  const source = options.source || 'web';
  const inputType = payload.inputType || 'text';
  const cleanNote = payload.cleanNote ?? payload.rawTranscript ?? '';

  if (!payload.patientId) {
    throw domainError('INVALID_DRAFT', 'patientId is required');
  }
  if (inputType === 'text' && !String(cleanNote).trim()) {
    throw domainError('INVALID_DRAFT', 'cleanNote is required for text drafts');
  }

  return sql.addSessionDraft(userId, {
    patientId: String(payload.patientId),
    clinicalDate: payload.clinicalDate || clinicalDateKey(),
    sessionType: payload.sessionType || 'individual',
    durationMinutes: payload.durationMinutes ?? null,
    careModality: payload.careModality || 'unspecified',
    source,
    inputType,
    status: inputType === 'audio' ? 'received' : 'ready',
    rawTranscript: payload.rawTranscript ?? null,
    cleanNote: String(cleanNote),
    medicationNotes: payload.medicationNotes ?? null,
    moodAssessment: payload.moodAssessment ?? null,
    requiresFollowUp: Boolean(payload.requiresFollowUp),
    audioDurationSeconds: payload.audioDurationSeconds ?? null,
    sourceMessageId: options.sourceMessageId || payload.sourceMessageId || null,
    mediaReference: payload.mediaReference ?? null,
    mediaMimeType: payload.mediaMimeType ?? null,
    inputFingerprint: payload.inputFingerprint ?? null,
    mediaSizeBytes: payload.mediaSizeBytes ?? null,
    mediaSha256: payload.mediaSha256 ?? null,
    mediaExpiresAt: payload.mediaExpiresAt ?? null,
    mediaDeletedAt: payload.mediaDeletedAt ?? null,
  });
}

function createQueuedAudioDraft(userId, payload, options = {}) {
  if (!payload.patientId || !payload.mediaReference || !payload.inputFingerprint) {
    throw domainError('INVALID_AUDIO_INPUT', 'patientId, media reference and fingerprint are required');
  }
  return sql.addSessionDraftWithAudioJob(userId, {
    patientId: String(payload.patientId),
    clinicalDate: payload.clinicalDate || clinicalDateKey(),
    sessionType: payload.sessionType || 'individual',
    durationMinutes: payload.durationMinutes ?? null,
    careModality: payload.careModality || 'unspecified',
    source: options.source || 'web',
    inputType: 'audio',
    status: 'received',
    rawTranscript: null,
    cleanNote: '',
    medicationNotes: null,
    moodAssessment: null,
    requiresFollowUp: false,
    audioDurationSeconds: payload.audioDurationSeconds ?? null,
    sourceMessageId: options.sourceMessageId || null,
    mediaReference: payload.mediaReference,
    mediaMimeType: payload.mediaMimeType,
    inputFingerprint: payload.inputFingerprint,
    mediaSizeBytes: payload.mediaSizeBytes,
    mediaSha256: payload.mediaSha256,
    mediaExpiresAt: payload.mediaExpiresAt,
    mediaDeletedAt: null,
  });
}

function getDraft(userId, draftId) {
  const draft = sql.getSessionDraft(userId, draftId);
  if (!draft) throw domainError('DRAFT_NOT_FOUND', 'Draft not found');
  return draft;
}

function listDrafts(userId, filters = {}) {
  if (filters.status && !ALLOWED_STATUSES.has(filters.status)) {
    throw domainError('INVALID_DRAFT', 'Unknown draft status');
  }
  return sql.listSessionDrafts(userId, filters);
}

function updateDraft(userId, draftId, input) {
  const current = getDraft(userId, draftId);
  if (current.status !== 'ready') {
    throw domainError('DRAFT_NOT_READY', 'Only ready drafts can be edited');
  }

  const changes = {};
  if (
    current.inputType === 'audio'
    && input?.patientId !== undefined
    && String(input.patientId) !== current.patientId
  ) {
    throw domainError('INVALID_DRAFT', 'The patient of an audio draft cannot be changed');
  }
  for (const [key, value] of Object.entries(input || {})) {
    if (EDITABLE_FIELDS.has(key)) changes[key] = value;
  }
  if (changes.cleanNote !== undefined && !String(changes.cleanNote).trim()) {
    throw domainError('INVALID_DRAFT', 'cleanNote cannot be empty');
  }

  const updated = sql.updateSessionDraft(userId, draftId, changes);
  if (!updated) throw domainError('DRAFT_NOT_READY', 'The draft changed before it could be edited');
  return updated;
}

function cleanupAudioResources(userId, draft) {
  if (!draft || draft.inputType !== 'audio') return;
  sql.cancelAudioProcessingJob(userId, draft.id);
  if (temporaryAudioStore.isUploadReference(draft.mediaReference)) {
    const removed = temporaryAudioStore.remove(draft.mediaReference);
    if (removed) sql.markSessionDraftMediaDeleted(userId, draft.id);
  }
}

function cancelDraft(userId, draftId) {
  const current = getDraft(userId, draftId);
  if (current.status === 'cancelled') {
    cleanupAudioResources(userId, current);
    return getDraft(userId, draftId);
  }
  if (current.status === 'confirmed') {
    throw domainError('DRAFT_NOT_READY', 'Confirmed drafts cannot be cancelled');
  }
  const cancelled = sql.cancelSessionDraftAndAudioJob(userId, draftId);
  if (cancelled) {
    cleanupAudioResources(userId, cancelled);
    return getDraft(userId, draftId);
  }
  const latest = getDraft(userId, draftId);
  if (latest.status === 'cancelled') return latest;
  throw domainError('DRAFT_NOT_READY', 'The draft changed before it could be cancelled');
}

function confirmDraft(userId, draftId) {
  const result = sql.confirmSessionDraft(userId, draftId);
  cleanupAudioResources(userId, result.draft);
  result.draft = getDraft(userId, draftId);
  return result;
}

module.exports = {
  createDraft,
  createQueuedAudioDraft,
  getDraft,
  listDrafts,
  updateDraft,
  cancelDraft,
  confirmDraft,
};
