#!/usr/bin/env node

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const phase = process.env.AIRA_CONVERSATION_TEST_PHASE;
const phone = '+5491188887777';
const userId = 'restart-professional';

function inbound(service, messageId, text) {
  return service.handleInbound({ messageId, from: phone, text });
}

function runPhaseOne() {
  const sql = require('../services/sqlite');
  const linkService = require('../services/whatsappLinkService');
  const conversationService = require('../services/whatsappConversationService');

  const patient = sql.addPatient(userId, {
    name: 'Paciente Persistente',
    dni: 'restart-patient',
    habilitado: true,
  });
  const pending = linkService.requestLink(userId, phone);
  linkService.consumeCommand({
    messageId: 'restart-link',
    from: phone,
    text: pending.command,
  });

  inbound(conversationService, 'restart-menu', 'MENÚ');
  inbound(conversationService, 'restart-new-note', 'NUEVA NOTA');
  const selected = inbound(
    conversationService,
    'restart-select-patient',
    `PACIENTE ${patient.id}`
  );

  assert.equal(selected.body.conversation.state, 'awaitingNote');
  assert.equal(selected.body.conversation.selectedPatientId, patient.id);
  assert.equal(sql.listSessions(userId).length, 0);

  const legacyText = 'MENÚ';
  const legacyHash = crypto
    .createHash('sha256')
    .update(JSON.stringify({ phoneNumber: phone, type: 'text', text: legacyText }))
    .digest('hex');
  sql.addWhatsappInboundEvent({
    messageId: 'legacy-text-event',
    phoneNumber: phone,
    payloadHash: legacyHash,
    userId,
    responseStatus: 200,
    response: {
      reply: { code: 'LEGACY_RESPONSE', text: 'Respuesta persistida antes del cambio de formato.' },
      conversation: selected.body.conversation,
      deduplicated: false,
    },
    createdAt: new Date().toISOString(),
  });
}

function runPhaseTwo() {
  const sql = require('../services/sqlite');
  const linkService = require('../services/whatsappLinkService');
  const conversationService = require('../services/whatsappConversationService');
  const draftService = require('../services/sessionDraftService');

  const restored = sql.getWhatsappConversation(userId);
  assert.equal(restored.state, 'awaitingNote');
  assert.ok(restored.selectedPatientId);

  const legacyReplay = inbound(conversationService, 'legacy-text-event', 'MENÚ');
  assert.equal(legacyReplay.body.deduplicated, true);
  assert.equal(legacyReplay.body.reply.code, 'LEGACY_RESPONSE');

  const note = inbound(
    conversationService,
    'restart-note',
    'Nota conservada después de reiniciar el proceso.'
  );
  assert.equal(note.body.reply.code, 'DRAFT_READY');
  assert.equal(sql.listSessions(userId).length, 0);
  assert.equal(sql.listSessionDrafts(userId).length, 1);

  const repeatedNote = inbound(
    conversationService,
    'restart-note',
    'Nota conservada después de reiniciar el proceso.'
  );
  assert.equal(repeatedNote.body.deduplicated, true);
  assert.equal(repeatedNote.body.draft.id, note.body.draft.id);
  assert.equal(sql.listSessionDrafts(userId).length, 1);

  assert.throws(
    () => inbound(conversationService, 'restart-note', 'Otro contenido'),
    (error) => error?.code === 'MESSAGE_ID_CONFLICT'
  );

  const menuWithDraft = inbound(conversationService, 'restart-pending-menu', 'MENÚ');
  assert.equal(menuWithDraft.body.reply.code, 'DRAFT_PENDING');
  assert.equal(menuWithDraft.body.conversation.state, 'awaitingConfirmation');

  const saved = inbound(conversationService, 'restart-save', 'GUARDAR');
  assert.equal(saved.body.reply.code, 'SESSION_SAVED');
  assert.equal(sql.listSessions(userId).length, 1);

  const repeatedSave = inbound(conversationService, 'restart-save', 'GUARDAR');
  assert.equal(repeatedSave.body.deduplicated, true);
  assert.equal(repeatedSave.body.session.id, saved.body.session.id);
  assert.equal(sql.listSessions(userId).length, 1);

  inbound(conversationService, 'external-cancel-new', 'NUEVA NOTA');
  inbound(
    conversationService,
    'external-cancel-patient',
    `PACIENTE ${restored.selectedPatientId}`
  );
  const externallyCancellable = inbound(
    conversationService,
    'external-cancel-note',
    'La web cancelará este borrador.'
  );
  draftService.cancelDraft(userId, externallyCancellable.body.draft.id);
  const reconciledCancel = inbound(conversationService, 'external-cancel-menu', 'MENÚ');
  assert.equal(reconciledCancel.body.reply.code, 'DRAFT_CANCELLED');
  assert.equal(reconciledCancel.body.conversation.state, 'menu');
  assert.equal(sql.listSessions(userId).length, 1);

  inbound(conversationService, 'external-save-new', 'NUEVA NOTA');
  inbound(
    conversationService,
    'external-save-patient',
    `PACIENTE ${restored.selectedPatientId}`
  );
  const externallyConfirmable = inbound(
    conversationService,
    'external-save-note',
    'La web confirmará este borrador.'
  );
  draftService.confirmDraft(userId, externallyConfirmable.body.draft.id);
  const reconciledSave = inbound(conversationService, 'external-save-menu', 'MENÚ');
  assert.equal(reconciledSave.body.reply.code, 'SESSION_SAVED');
  assert.equal(reconciledSave.body.conversation.state, 'menu');
  assert.equal(sql.listSessions(userId).length, 2);

  inbound(conversationService, 'cancel-new-note', 'NUEVA NOTA');
  inbound(
    conversationService,
    'cancel-select-patient',
    `PACIENTE ${restored.selectedPatientId}`
  );
  const cancellable = inbound(conversationService, 'cancel-note', 'Borrador cancelable');
  const cancelled = inbound(conversationService, 'cancel-action', 'CANCELAR');
  assert.equal(cancellable.body.draft.status, 'ready');
  assert.equal(cancelled.body.draft.status, 'cancelled');
  assert.equal(sql.listSessions(userId).length, 2);

  linkService.unlink(userId);
  assert.equal(sql.getWhatsappConversation(userId), null);
  const afterUnlink = inbound(conversationService, 'after-unlink-menu', 'MENÚ');
  assert.equal(afterUnlink.status, 409);
  assert.equal(afterUnlink.body.reply.code, 'NOT_LINKED');
}

if (phase === 'one') {
  runPhaseOne();
} else if (phase === 'two') {
  runPhaseTwo();
} else {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-conversation-'));
  const baseEnv = { ...process.env, DATA_DIR: tempDir };
  try {
    for (const childPhase of ['one', 'two']) {
      const child = spawnSync(process.execPath, [__filename], {
        env: { ...baseEnv, AIRA_CONVERSATION_TEST_PHASE: childPhase },
        encoding: 'utf8',
      });
      if (child.status !== 0) {
        process.stderr.write(child.stdout || '');
        process.stderr.write(child.stderr || '');
        process.exit(child.status || 1);
      }
    }
    console.log('✅ WhatsApp conversation survives restart and keeps effects idempotent');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
