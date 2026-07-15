const sql = require('./sqlite');

const EDITABLE_FIELDS = new Set([
  'patientId',
  'clinicalDate',
  'sessionType',
  'durationMinutes',
  'careModality',
  'rawTranscript',
  'cleanNote',
  'medicationNotes',
  'moodAssessment',
  'requiresFollowUp',
  'audioDurationSeconds',
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

function today() {
  return new Date().toISOString().split('T')[0];
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
    clinicalDate: payload.clinicalDate || today(),
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
  for (const [key, value] of Object.entries(input || {})) {
    if (EDITABLE_FIELDS.has(key)) changes[key] = value;
  }
  if (changes.cleanNote !== undefined && !String(changes.cleanNote).trim()) {
    throw domainError('INVALID_DRAFT', 'cleanNote cannot be empty');
  }

  return sql.updateSessionDraft(userId, draftId, changes);
}

function cancelDraft(userId, draftId) {
  const current = getDraft(userId, draftId);
  if (current.status === 'cancelled') return current;
  if (current.status === 'confirmed') {
    throw domainError('DRAFT_NOT_READY', 'Confirmed drafts cannot be cancelled');
  }
  return sql.setSessionDraftStatus(userId, draftId, 'cancelled');
}

function confirmDraft(userId, draftId) {
  return sql.confirmSessionDraft(userId, draftId);
}

module.exports = {
  createDraft,
  getDraft,
  listDrafts,
  updateDraft,
  cancelDraft,
  confirmDraft,
};
