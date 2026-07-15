const crypto = require('node:crypto');
const sql = require('./sqlite');
const sessionDraftService = require('./sessionDraftService');
const whatsappLinkService = require('./whatsappLinkService');

function domainError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function fold(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();
}

function payloadHash(phoneNumber, text) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ phoneNumber, type: 'text', text }))
    .digest('hex');
}

function conversationView(conversation) {
  if (!conversation) return null;
  return {
    state: conversation.state,
    selectedPatientId: conversation.selectedPatientId,
    currentDraftId: conversation.currentDraftId,
    updatedAt: conversation.updatedAt,
  };
}

function activePatients(userId, query = '') {
  const foldedQuery = fold(query);
  return sql.listPatients(userId)
    .filter((patient) => patient.habilitado)
    .filter((patient) => !foldedQuery || fold(patient.name).includes(foldedQuery))
    .sort((left, right) => left.name.localeCompare(right.name, 'es'))
    .slice(0, 8);
}

function activePatientById(userId, patientId) {
  return sql.listPatients(userId).find(
    (patient) => patient.habilitado && patient.id === String(patientId)
  ) || null;
}

function patientOptionsReply(userId, query = '') {
  const patients = activePatients(userId, query);
  if (!patients.length) {
    return {
      code: 'NO_ACTIVE_PATIENTS',
      text: query
        ? 'No encontré pacientes activos con esa búsqueda. Escribí BUSCAR seguido de otro nombre.'
        : 'No hay pacientes activos. Creá o activá uno desde la web.',
      patients: [],
    };
  }

  return {
    code: 'SELECT_PATIENT',
    text: `${patients.map((patient) => `PACIENTE ${patient.id} — ${patient.name}`).join('\n')}\nEscribí PACIENTE seguido del número.`,
    patients: patients.map((patient) => ({ id: patient.id, name: patient.name })),
  };
}

function menuReply() {
  return {
    code: 'MENU',
    text: 'Escribí NUEVA NOTA para registrar una nota de sesión.',
  };
}

function pendingDraftReply(conversation, draft) {
  return {
    code: 'DRAFT_PENDING',
    text: `Tenés el borrador ${conversation.currentDraftId} pendiente${draft?.patientName ? ` para ${draft.patientName}` : ''}. Escribí GUARDAR o CANCELAR.`,
    draftId: conversation.currentDraftId,
  };
}

function updateConversation(userId, state, selectedPatientId, currentDraftId, now) {
  return sql.updateWhatsappConversation(userId, {
    state,
    selectedPatientId,
    currentDraftId,
  }, now);
}

function resetToMenu(userId, now) {
  return updateConversation(userId, 'menu', null, null, now);
}

function reconcileTerminalDraft(userId, conversation, draft, now) {
  if (draft.status === 'cancelled') {
    const reset = resetToMenu(userId, now);
    return {
      reply: { code: 'DRAFT_CANCELLED', text: 'El borrador fue cancelado. Escribí NUEVA NOTA para comenzar otra.' },
      conversation: conversationView(reset),
      draft,
    };
  }
  if (draft.status === 'confirmed') {
    const reset = resetToMenu(userId, now);
    return {
      reply: {
        code: 'SESSION_SAVED',
        text: 'La nota ya fue guardada en la ficha web.',
        sessionId: draft.sessionId,
      },
      conversation: conversationView(reset),
      draft,
      session: draft.sessionId ? { id: draft.sessionId, patientId: draft.patientId, status: 'confirmed' } : null,
    };
  }
  if (draft.status !== 'ready') {
    const reset = resetToMenu(userId, now);
    return {
      reply: { code: 'DRAFT_NOT_READY', text: 'El borrador ya no está disponible para guardar. Iniciá una nueva nota.' },
      conversation: conversationView(reset),
      draft,
    };
  }
  return null;
}

function dispatch(userId, phoneNumber, originalText, messageId, now) {
  const command = fold(originalText);
  let conversation = sql.ensureWhatsappConversation(userId, phoneNumber, now);

  if (command === 'MENU') {
    if (conversation.state === 'awaitingConfirmation' && conversation.currentDraftId) {
      let draft = null;
      try {
        draft = sessionDraftService.getDraft(userId, conversation.currentDraftId);
      } catch (error) {
        if (error.code !== 'DRAFT_NOT_FOUND') throw error;
        conversation = resetToMenu(userId, now);
        return { reply: menuReply(), conversation: conversationView(conversation) };
      }
      const reconciled = reconcileTerminalDraft(userId, conversation, draft, now);
      if (reconciled) return reconciled;
      return {
        reply: pendingDraftReply(conversation, draft),
        conversation: conversationView(conversation),
        draft,
      };
    }
    conversation = resetToMenu(userId, now);
    return { reply: menuReply(), conversation: conversationView(conversation) };
  }

  if (conversation.state === 'awaitingConfirmation') {
    let draft;
    try {
      draft = sessionDraftService.getDraft(userId, conversation.currentDraftId);
    } catch (error) {
      if (error.code !== 'DRAFT_NOT_FOUND') throw error;
      conversation = resetToMenu(userId, now);
      return {
        reply: { code: 'DRAFT_NOT_FOUND', text: 'El borrador ya no está disponible. Volvé a iniciar con NUEVA NOTA.' },
        conversation: conversationView(conversation),
      };
    }
    const reconciled = reconcileTerminalDraft(userId, conversation, draft, now);
    if (reconciled) return reconciled;

    const save = /^GUARDAR(?:\s+(\d+))?$/.exec(command);
    if (save) {
      if (save[1] && save[1] !== conversation.currentDraftId) {
        return {
          reply: { code: 'INVALID_DRAFT_REFERENCE', text: `El borrador pendiente es ${conversation.currentDraftId}. Escribí GUARDAR.` },
          conversation: conversationView(conversation),
          draft,
        };
      }
      const confirmed = sessionDraftService.confirmDraft(userId, conversation.currentDraftId);
      conversation = resetToMenu(userId, now);
      return {
        reply: {
          code: 'SESSION_SAVED',
          text: `Nota guardada en la ficha de ${draft.patientName}.`,
          sessionId: String(confirmed.session.id),
        },
        conversation: conversationView(conversation),
        draft: confirmed.draft,
        session: {
          id: String(confirmed.session.id),
          patientId: String(confirmed.session.pacienteId),
          draftId: String(confirmed.draft.id),
          status: 'confirmed',
        },
      };
    }

    const cancel = /^CANCELAR(?:\s+(\d+))?$/.exec(command);
    if (cancel) {
      if (cancel[1] && cancel[1] !== conversation.currentDraftId) {
        return {
          reply: { code: 'INVALID_DRAFT_REFERENCE', text: `El borrador pendiente es ${conversation.currentDraftId}. Escribí CANCELAR.` },
          conversation: conversationView(conversation),
          draft,
        };
      }
      const cancelledDraft = sessionDraftService.cancelDraft(userId, conversation.currentDraftId);
      conversation = resetToMenu(userId, now);
      return {
        reply: { code: 'DRAFT_CANCELLED', text: 'Borrador cancelado.' },
        conversation: conversationView(conversation),
        draft: cancelledDraft,
      };
    }

    return {
      reply: pendingDraftReply(conversation, draft),
      conversation: conversationView(conversation),
      draft,
    };
  }

  if (command === 'CANCELAR') {
    conversation = resetToMenu(userId, now);
    return {
      reply: { code: 'FLOW_CANCELLED', text: 'Operación cancelada. Escribí NUEVA NOTA para comenzar otra.' },
      conversation: conversationView(conversation),
    };
  }

  if (command === 'NUEVA NOTA' || command === '1') {
    conversation = updateConversation(userId, 'choosingPatient', null, null, now);
    return {
      reply: patientOptionsReply(userId),
      conversation: conversationView(conversation),
    };
  }

  if (conversation.state === 'menu') {
    return { reply: menuReply(), conversation: conversationView(conversation) };
  }

  if (conversation.state === 'choosingPatient') {
    const search = /^BUSCAR\s+(.+)$/.exec(command);
    if (search) {
      return {
        reply: patientOptionsReply(userId, search[1]),
        conversation: conversationView(conversation),
      };
    }

    const selection = /^PACIENTE\s+(\d+)$/.exec(command);
    if (!selection) {
      return {
        reply: patientOptionsReply(userId),
        conversation: conversationView(conversation),
      };
    }

    const patient = activePatientById(userId, selection[1]);
    if (!patient) {
      return {
        reply: { code: 'PATIENT_NOT_FOUND', text: 'Ese paciente no está activo en tu cuenta.' },
        conversation: conversationView(conversation),
      };
    }

    conversation = updateConversation(userId, 'awaitingNote', patient.id, null, now);
    return {
      reply: { code: 'SEND_NOTE', text: `Paciente seleccionado: ${patient.name}. Enviá ahora la nota escrita.` },
      conversation: conversationView(conversation),
      patient: { id: patient.id, name: patient.name },
    };
  }

  if (conversation.state === 'awaitingNote') {
    if (command === 'GUARDAR') {
      return {
        reply: { code: 'SEND_NOTE', text: 'Primero enviá el texto de la nota.' },
        conversation: conversationView(conversation),
      };
    }

    const patient = activePatientById(userId, conversation.selectedPatientId);
    if (!patient) {
      conversation = updateConversation(userId, 'choosingPatient', null, null, now);
      return {
        reply: { code: 'PATIENT_NOT_FOUND', text: 'El paciente ya no está activo. Elegí otro.' },
        conversation: conversationView(conversation),
      };
    }

    const created = sessionDraftService.createDraft(userId, {
      patientId: patient.id,
      inputType: 'text',
      cleanNote: originalText,
    }, {
      source: 'whatsapp',
      sourceMessageId: messageId,
    });
    conversation = updateConversation(
      userId,
      'awaitingConfirmation',
      patient.id,
      created.draft.id,
      now
    );
    return {
      reply: {
        code: 'DRAFT_READY',
        text: `Borrador listo para ${patient.name}. Escribí GUARDAR o CANCELAR.`,
        draftId: created.draft.id,
      },
      conversation: conversationView(conversation),
      draft: created.draft,
    };
  }

  return { reply: menuReply(), conversation: conversationView(conversation) };
}

function handleInbound({ messageId, from, text }, options = {}) {
  const phoneNumber = whatsappLinkService.normalizePhone(from);
  const originalText = String(text || '').trim();
  const hash = payloadHash(phoneNumber, originalText);
  const now = options.now ? new Date(options.now).toISOString() : new Date().toISOString();

  return sql.withTransaction(() => {
    const previous = sql.getWhatsappInboundEvent(messageId);
    if (previous) {
      if (previous.phoneNumber !== phoneNumber || previous.payloadHash !== hash) {
        throw domainError('MESSAGE_ID_CONFLICT', 'messageId was already used by another event');
      }
      return {
        status: previous.responseStatus,
        body: { ...previous.response, deduplicated: true },
      };
    }
    if (sql.whatsappLinkEventExists(messageId)) {
      throw domainError('MESSAGE_ID_CONFLICT', 'messageId was already used by a link event');
    }

    const userId = whatsappLinkService.resolveUserId(phoneNumber, { now });
    let status;
    let body;
    if (!userId) {
      status = 409;
      body = {
        reply: { code: 'NOT_LINKED', text: 'Vinculá este teléfono desde la web de AIRA.' },
        conversation: null,
        deduplicated: false,
      };
    } else {
      status = 200;
      body = {
        ...dispatch(userId, phoneNumber, originalText, messageId, now),
        deduplicated: false,
      };
    }

    sql.addWhatsappInboundEvent({
      messageId,
      phoneNumber,
      payloadHash: hash,
      userId,
      responseStatus: status,
      response: body,
      createdAt: now,
    });
    return { status, body };
  });
}

module.exports = {
  fold,
  handleInbound,
};
