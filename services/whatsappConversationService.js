const crypto = require('node:crypto');
const sql = require('./sqlite');
const sessionDraftService = require('./sessionDraftService');
const audioDraftPipeline = require('./audioDraftPipeline');
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

function normalizeMessage(input) {
  if (input?.message?.type === 'audio') {
    return {
      type: 'audio',
      fixtureId: String(input.message.fixtureId || input.message.audio?.fixtureId || '').trim(),
    };
  }
  return {
    type: 'text',
    text: String(input?.message?.text ?? input?.text ?? '').trim(),
  };
}

function payloadHash(phoneNumber, message) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify({ phoneNumber, message }))
    .digest('hex');
}

function legacyTextPayloadHash(phoneNumber, text) {
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
  if (draft?.status === 'failed') {
    return {
      code: 'AUDIO_FAILED',
      text: `El audio del borrador ${conversation.currentDraftId} no pudo prepararse. Escribí REINTENTAR o CANCELAR.`,
      draftId: conversation.currentDraftId,
    };
  }
  if (['received', 'transcribing', 'structuring'].includes(draft?.status)) {
    return {
      code: 'AUDIO_PROCESSING',
      text: `El audio del borrador ${conversation.currentDraftId} todavía se está procesando.`,
      draftId: conversation.currentDraftId,
    };
  }
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
  return null;
}

function dispatch(userId, phoneNumber, message, messageId, now) {
  const originalText = message.type === 'text' ? message.text : '';
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

    if (command === 'REINTENTAR') {
      if (draft.inputType !== 'audio') {
        return {
          reply: { code: 'DRAFT_NOT_PROCESSABLE', text: 'Este borrador no necesita reprocesarse.' },
          conversation: conversationView(conversation),
          draft,
        };
      }
      if (draft.status === 'ready') {
        return {
          reply: pendingDraftReply(conversation, draft),
          conversation: conversationView(conversation),
          draft,
        };
      }
      const retried = audioDraftPipeline.retry(userId, draft.id);
      if (retried.draft.status === 'ready') {
        return {
          reply: {
            code: 'DRAFT_READY',
            text: `Nota preparada: ${retried.draft.cleanNote}\nEscribí GUARDAR o CANCELAR.`,
            draftId: retried.draft.id,
          },
          conversation: conversationView(conversation),
          draft: retried.draft,
        };
      }
      return {
        reply: pendingDraftReply(conversation, retried.draft),
        conversation: conversationView(conversation),
        draft: retried.draft,
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

    if (draft.status !== 'ready') {
      return {
        reply: pendingDraftReply(conversation, draft),
        conversation: conversationView(conversation),
        draft,
      };
    }

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

    if (message.type === 'audio') {
      let processed;
      try {
        processed = audioDraftPipeline.ingest(userId, {
          patientId: patient.id,
          fixtureId: message.fixtureId,
        }, {
          source: 'whatsapp',
          sourceMessageId: messageId,
        });
      } catch (error) {
        if (error.code !== 'INVALID_AUDIO_INPUT') throw error;
        return {
          reply: { code: 'INVALID_AUDIO', text: 'No pude leer ese audio de prueba. Enviá otro o escribí CANCELAR.' },
          conversation: conversationView(conversation),
        };
      }

      if (processed.draft.status === 'failed') {
        conversation = updateConversation(
          userId,
          'awaitingConfirmation',
          patient.id,
          processed.draft.id,
          now
        );
        return {
          reply: pendingDraftReply(conversation, processed.draft),
          conversation: conversationView(conversation),
          draft: processed.draft,
        };
      }

      conversation = updateConversation(
        userId,
        'awaitingConfirmation',
        patient.id,
        processed.draft.id,
        now
      );
      return {
        reply: {
          code: 'DRAFT_READY',
          text: `Audio preparado para ${patient.name}.\nNota preparada: ${processed.draft.cleanNote}\nEscribí GUARDAR o CANCELAR.`,
          draftId: processed.draft.id,
        },
        conversation: conversationView(conversation),
        draft: processed.draft,
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

function handleInbound(input, options = {}) {
  const { messageId, from } = input;
  const phoneNumber = whatsappLinkService.normalizePhone(from);
  const message = normalizeMessage(input);
  const hash = payloadHash(phoneNumber, message);
  const acceptedHashes = message.type === 'text'
    ? [hash, legacyTextPayloadHash(phoneNumber, message.text)]
    : [hash];
  const now = options.now ? new Date(options.now).toISOString() : new Date().toISOString();

  return sql.withTransaction(() => {
    const previous = sql.getWhatsappInboundEvent(messageId);
    if (previous) {
      if (previous.phoneNumber !== phoneNumber || !acceptedHashes.includes(previous.payloadHash)) {
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
        ...dispatch(userId, phoneNumber, message, messageId, now),
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
  normalizeMessage,
  legacyTextPayloadHash,
};
