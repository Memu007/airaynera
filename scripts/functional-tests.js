#!/usr/bin/env node
/**
 * Functional Tests - Valida flujos CRUD completos
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';

class FunctionalTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.token = null;
    this.token2 = null;
  }

  async request(method, path, body = null, token = null) {
    const url = new URL(path, BASE_URL);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, data: JSON.parse(data) });
          } catch {
            resolve({ status: res.statusCode, data });
          }
        });
      });

      req.on('error', reject);
      req.setTimeout(5000, () => {
        req.destroy();
        reject(new Error('Timeout'));
      });

      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  test(name, condition) {
    if (condition) {
      console.log(`   ✅ ${name}`);
      this.passed++;
    } else {
      console.log(`   ❌ ${name}`);
      this.failed++;
    }
    return condition;
  }

  async run() {
    console.log('🧪 AIRA Functional Tests');
    console.log('========================\n');

    // 1. Health Check
    console.log('1️⃣  Health Check');
    try {
      const res = await this.request('GET', '/health');
      this.test('GET /health returns 200', res.status === 200);
      this.test('Response has status field', res.data?.status === 'ok');
    } catch (err) {
      this.test('Server responding', false);
      console.error('   Server not available. Start with: npm run dev');
      return;
    }

    // 2. Login Flow
    console.log('\n2️⃣  Login Flow');
    {
      const registrationDni = `9${Date.now().toString().slice(-10)}`;
      const registration = await this.request('POST', '/api/auth/register', {
        dni: registrationDni,
        pin: '5678',
        name: 'Test Professional',
        specialty: 'psychology'
      });
      this.test('Registration returns 201', registration.status === 201);
      this.test('Registration returns an immediately usable token', !!registration.data?.token);

      const registeredPatients = await this.request(
        'GET',
        '/api/patients',
        null,
        registration.data?.token
      );
      this.test('Registration token can access the API', registeredPatients.status === 200);

      // Login con credenciales de demo
      const res = await this.request('POST', '/api/login', { dni: 'test1', pin: '1234' });
      this.test('Login returns 200', res.status === 200);
      this.test('Login returns token', !!res.data?.token);
      this.test('Login returns user', !!res.data?.user);
      this.token = res.data?.token;

      // Login segundo usuario
      const res2 = await this.request('POST', '/api/login', { dni: 'test2', pin: '1234' });
      this.token2 = res2.data?.token;
      this.test('Second user can login', !!res2.data?.token);

      // Login con PIN incorrecto
      const resBad = await this.request('POST', '/api/login', { dni: 'test1', pin: 'wrongpin' });
      this.test('Wrong PIN returns 401', resBad.status === 401);
    }

    // 3. Token Validation
    console.log('\n3️⃣  Token Validation');
    {
      // Token válido
      const res = await this.request('POST', '/api/auth/verify', null, this.token);
      this.test('Valid token accepted', res.status === 200);

      // Sin token
      const resNoToken = await this.request('GET', '/api/patients');
      this.test('No token returns 401', resNoToken.status === 401);

      // Token inválido
      const resBadToken = await this.request('GET', '/api/patients', null, 'invalid-token');
      this.test('Invalid token returns 401', resBadToken.status === 401);
    }

    // 4. CRUD Patients
    console.log('\n4️⃣  CRUD Patients');
    let patientId;
    {
      // Create
      const createRes = await this.request('POST', '/api/patients', {
        name: 'Test Patient',
        dni: '11111111',
        email: 'test@test.com'
      }, this.token);
      this.test('Create patient returns 201', createRes.status === 201);
      this.test('Created patient has id', !!createRes.data?.id);
      patientId = createRes.data?.id;

      // Read (list)
      const listRes = await this.request('GET', '/api/patients', null, this.token);
      this.test('List patients returns 200', listRes.status === 200);
      this.test('List returns array', Array.isArray(listRes.data?.patients));
      this.test('List contains created patient', listRes.data?.patients?.some(p => p.id === patientId));

      // Update
      const updateRes = await this.request('PATCH', `/api/patients/${patientId}`, {
        name: 'Updated Patient',
        status: 'inactive'
      }, this.token);
      this.test('Update patient returns 200', updateRes.status === 200);
      this.test('Name was updated', updateRes.data?.name === 'Updated Patient');
      this.test('Patient status is persisted canonically', updateRes.data?.status === 'inactive');
      this.test('Patient ids are strings', typeof updateRes.data?.id === 'string');

      // Validation
      const invalidRes = await this.request('POST', '/api/patients', {
        dni: '22222222'  // Missing name
      }, this.token);
      this.test('Missing name returns 400', invalidRes.status === 400);
    }

    // 5. CRUD Sessions
    console.log('\n5️⃣  CRUD Sessions');
    let sessionId;
    let legacySessionId;
    let draftSessionId;
    let whatsappSessionId;
    {
      // Create
      const createRes = await this.request('POST', '/api/sessions', {
        patientId,
        cleanNote: 'Test session notes',
        sessionType: 'individual',
        durationMinutes: 45,
        clinicalDate: '2026-07-14',
        moodAssessment: 3,
        requiresFollowUp: false
      }, this.token);
      this.test('Create session returns 201', createRes.status === 201);
      this.test('Created session has id', !!createRes.data?.id);
      this.test('Created session uses canonical fields', createRes.data?.cleanNote === 'Test session notes');
      this.test('Session includes the patient name', createRes.data?.patientName === 'Updated Patient');
      this.test('Clinical date remains independent from creation time', createRes.data?.clinicalDate === '2026-07-14');
      this.test('Session ids are strings', typeof createRes.data?.id === 'string');
      sessionId = createRes.data?.id;

      // Read (list)
      const listRes = await this.request('GET', '/api/sessions', null, this.token);
      this.test('List sessions returns 200', listRes.status === 200);
      this.test('List returns array', Array.isArray(listRes.data?.sessions));
      this.test('Saved session survives a reload', listRes.data?.sessions?.some(s => s.id === sessionId));

      const filteredRes = await this.request(
        'GET',
        `/api/sessions?patientId=${patientId}&from=2026-07-14&to=2026-07-14`,
        null,
        this.token
      );
      this.test('Session filters use the clinical date', filteredRes.data?.sessions?.length === 1);

      // Update
      const updateRes = await this.request('PATCH', `/api/sessions/${sessionId}`, {
        cleanNote: 'Updated notes'
      }, this.token);
      this.test('Update session returns 200', updateRes.status === 200);
      this.test('Canonical session note was updated', updateRes.data?.cleanNote === 'Updated notes');

      const legacyRes = await this.request('POST', '/api/sessions', {
        pacienteId: patientId,
        notas: 'Legacy compatible note',
        tipo: 'consulta',
        duracion: 30
      }, this.token);
      legacySessionId = legacyRes.data?.id;
      this.test('Legacy input remains temporarily compatible', legacyRes.status === 201);
      this.test('Legacy input returns only canonical session fields',
        legacyRes.data?.cleanNote === 'Legacy compatible note' && legacyRes.data?.notas === undefined);

      // Invalid patient
      const invalidRes = await this.request('POST', '/api/sessions', {
        pacienteId: 999999,
        notas: 'Test'
      }, this.token);
      this.test('Invalid pacienteId returns 404', invalidRes.status === 404);
    }

    // 6. Session Draft vertical
    console.log('\n6️⃣  Session Draft vertical');
    {
      const sessionsBeforeDraft = await this.request('GET', '/api/sessions', null, this.token);

      const createDraft = await this.request('POST', '/api/session-drafts', {
        patientId,
        clinicalDate: '2026-07-15',
        sessionType: 'individual',
        durationMinutes: 50,
        careModality: 'inPerson',
        inputType: 'text',
        cleanNote: 'Draft note before review',
        medicationNotes: null,
        moodAssessment: 2,
        requiresFollowUp: true
      }, this.token);
      const draftId = createDraft.data?.draft?.id;
      this.test('Create draft returns 201', createDraft.status === 201);
      this.test('Text draft starts ready', createDraft.data?.draft?.status === 'ready');
      this.test('Draft uses canonical string ids', typeof draftId === 'string');

      const sessionsWithUnconfirmedDraft = await this.request('GET', '/api/sessions', null, this.token);
      this.test('Creating a draft does not create a session',
        sessionsWithUnconfirmedDraft.data?.sessions?.length === sessionsBeforeDraft.data?.sessions?.length);

      const listDrafts = await this.request('GET', '/api/session-drafts?status=ready', null, this.token);
      this.test('Ready draft can be listed', listDrafts.data?.drafts?.some(d => d.id === draftId));

      const foreignRead = await this.request('GET', `/api/session-drafts/${draftId}`, null, this.token2);
      this.test('Other user cannot read a draft', foreignRead.status === 404);

      const updateDraft = await this.request('PATCH', `/api/session-drafts/${draftId}`, {
        cleanNote: 'Reviewed draft note'
      }, this.token);
      this.test('Ready draft can be edited',
        updateDraft.status === 200 && updateDraft.data?.draft?.cleanNote === 'Reviewed draft note');

      const confirmDraft = await this.request('POST', `/api/session-drafts/${draftId}/confirm`, null, this.token);
      draftSessionId = confirmDraft.data?.session?.id;
      this.test('Confirming a draft returns 201', confirmDraft.status === 201);
      this.test('Confirmation creates a linked session',
        confirmDraft.data?.session?.draftId === draftId && confirmDraft.data?.draft?.sessionId === draftSessionId);
      this.test('Confirmed session keeps reviewed content and source',
        confirmDraft.data?.session?.cleanNote === 'Reviewed draft note' && confirmDraft.data?.session?.source === 'web');

      const confirmAgain = await this.request('POST', `/api/session-drafts/${draftId}/confirm`, null, this.token);
      this.test('Repeated confirmation is idempotent',
        confirmAgain.status === 200 && confirmAgain.data?.session?.id === draftSessionId);

      const sessionsAfterConfirm = await this.request('GET', '/api/sessions', null, this.token);
      const copies = sessionsAfterConfirm.data?.sessions?.filter(s => s.id === draftSessionId).length;
      this.test('Exactly one session exists for the draft', copies === 1);

      const cancelledDraft = await this.request('POST', '/api/session-drafts', {
        patientId,
        inputType: 'text',
        cleanNote: 'This draft will be cancelled'
      }, this.token);
      const cancelledDraftId = cancelledDraft.data?.draft?.id;
      const cancelRes = await this.request(
        'POST',
        `/api/session-drafts/${cancelledDraftId}/cancel`,
        null,
        this.token
      );
      this.test('Ready draft can be cancelled', cancelRes.data?.draft?.status === 'cancelled');
      const confirmCancelled = await this.request(
        'POST',
        `/api/session-drafts/${cancelledDraftId}/confirm`,
        null,
        this.token
      );
      this.test('Cancelled draft cannot be confirmed', confirmCancelled.status === 409);

      const linkWithoutToken = await this.request('POST', '/api/whatsapp/link', {
        phoneNumber: '1122334455'
      });
      this.test('Generating a WhatsApp link requires the web account', linkWithoutToken.status === 401);

      const linkRequest = await this.request('POST', '/api/whatsapp/link', {
        phoneNumber: '1122334455'
      }, this.token);
      const linkCommand = linkRequest.data?.command;
      this.test('Web creates a pending WhatsApp link code',
        linkRequest.status === 201 &&
        linkRequest.data?.link?.status === 'pending' &&
        /^VINCULAR \d{6}$/.test(linkCommand));

      const beforeLink = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-before-link-001',
        from: '+5491122334455',
        selectedPatientId: patientId,
        message: { type: 'text', text: 'Must not be accepted yet' }
      });
      this.test('An unlinked phone cannot create a draft', beforeLink.status === 409);

      const linkEvent = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-link-001',
        from: '+54 9 11 2233-4455',
        message: { type: 'text', text: linkCommand }
      });
      this.test('The simulated phone consumes the web link code',
        linkEvent.status === 201 && linkEvent.data?.link?.status === 'linked');

      const repeatedLink = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-link-001',
        from: '+5491122334455',
        message: { type: 'text', text: linkCommand }
      });
      this.test('The repeated link event is idempotent',
        repeatedLink.status === 200 && repeatedLink.data?.deduplicated === true);

      const linkIdAsConversation = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-link-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'MENÚ' }
      });
      this.test('A link event id cannot be reused as a conversation event',
        linkIdAsConversation.status === 409);

      const ownLink = await this.request('GET', '/api/whatsapp/link', null, this.token);
      const otherLink = await this.request('GET', '/api/whatsapp/link', null, this.token2);
      this.test('The web account sees its persisted phone link',
        ownLink.data?.link?.status === 'linked' && ownLink.data?.link?.phoneNumber === '+5491122334455');
      this.test('Another account does not see the phone link', otherLink.data?.link?.status === 'unlinked');

      const competingLink = await this.request('POST', '/api/whatsapp/link', {
        phoneNumber: '+5491122334455'
      }, this.token2);
      this.test('A linked phone cannot be claimed by another account', competingLink.status === 409);

      const otherPatient = await this.request('POST', '/api/patients', {
        name: 'Other Account Patient',
        dni: '33333333'
      }, this.token2);
      await this.request('PATCH', `/api/patients/${patientId}`, {
        status: 'active'
      }, this.token);

      const foreignWhatsapp = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-foreign-001',
        from: '+5491199999999',
        message: { type: 'text', text: 'MENÚ' }
      });
      this.test('An unknown phone cannot use another account patient', foreignWhatsapp.status === 409);

      const menu = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-menu-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'MENÚ' }
      });
      this.test('A linked phone opens its persistent menu',
        menu.status === 200 && menu.data?.conversation?.state === 'menu');

      const repeatedMenu = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-menu-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'MENÚ' }
      });
      this.test('Every inbound event is deduplicated',
        repeatedMenu.status === 200 && repeatedMenu.data?.deduplicated === true);

      const conflictingMenu = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-menu-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'NUEVA NOTA' }
      });
      this.test('Reusing a message id with another payload is rejected', conflictingMenu.status === 409);

      const conversationIdAsLink = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-menu-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'VINCULAR 000000' }
      });
      this.test('A conversation event id cannot be reused as a link event',
        conversationIdAsLink.status === 409);

      const newNote = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-new-note-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'NUEVA NOTA' }
      });
      this.test('New note lists only patients from the linked account',
        newNote.data?.conversation?.state === 'choosingPatient' &&
        newNote.data?.reply?.patients?.some(p => p.id === patientId) &&
        !newNote.data?.reply?.patients?.some(p => p.id === otherPatient.data?.id));

      const linkedForeignPatient = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-linked-foreign-patient-001',
        from: '+5491122334455',
        selectedPatientId: otherPatient.data?.id,
        message: { type: 'text', text: `PACIENTE ${otherPatient.data?.id}` }
      });
      this.test('A linked phone cannot select another account patient',
        linkedForeignPatient.status === 200 &&
        linkedForeignPatient.data?.reply?.code === 'PATIENT_NOT_FOUND' &&
        linkedForeignPatient.data?.conversation?.state === 'choosingPatient');

      const selectPatient = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-select-patient-001',
        from: '+5491122334455',
        selectedPatientId: otherPatient.data?.id,
        message: { type: 'text', text: `PACIENTE ${patientId}` }
      });
      this.test('Patient selection is explicit and stored in the conversation',
        selectPatient.data?.conversation?.state === 'awaitingNote' &&
        selectPatient.data?.conversation?.selectedPatientId === patientId);

      const whatsappDraft = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-message-001',
        from: '+5491122334455',
        selectedPatientId: otherPatient.data?.id,
        message: { type: 'text', text: 'WhatsApp draft note' }
      });
      const whatsappDraftId = whatsappDraft.data?.draft?.id;
      this.test('Fake WhatsApp creates a draft only',
        whatsappDraft.status === 200 &&
        whatsappDraft.data?.reply?.code === 'DRAFT_READY' &&
        whatsappDraft.data?.draft?.source === 'whatsapp');
      this.test('Webhook selectedPatientId is ignored in favor of conversation state',
        whatsappDraft.data?.draft?.patientId === patientId);

      const whatsappDuplicate = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-message-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'WhatsApp draft note' }
      });
      this.test('Repeated WhatsApp message is deduplicated',
        whatsappDuplicate.status === 200 &&
        whatsappDuplicate.data?.deduplicated === true &&
        whatsappDuplicate.data?.draft?.id === whatsappDraftId);

      const menuWithDraft = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-menu-with-draft-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'MENÚ' }
      });
      this.test('Menu does not discard a pending draft',
        menuWithDraft.data?.reply?.code === 'DRAFT_PENDING' &&
        menuWithDraft.data?.conversation?.state === 'awaitingConfirmation');

      const confirmWhatsapp = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-save-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'GUARDAR' }
      });
      whatsappSessionId = confirmWhatsapp.data?.session?.id;
      this.test('WhatsApp confirms through the canonical draft service',
        confirmWhatsapp.status === 200 &&
        confirmWhatsapp.data?.reply?.code === 'SESSION_SAVED' &&
        confirmWhatsapp.data?.conversation?.state === 'menu');

      const repeatedSave = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-save-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'GUARDAR' }
      });
      this.test('Repeated save returns the same session without duplicating it',
        repeatedSave.data?.deduplicated === true &&
        repeatedSave.data?.session?.id === whatsappSessionId);

      const sessionsAfterWhatsapp = await this.request('GET', '/api/sessions', null, this.token);
      const whatsappCopies = sessionsAfterWhatsapp.data?.sessions?.filter(
        session => session.id === whatsappSessionId
      );
      this.test('The WhatsApp-confirmed session appears once in the web API',
        whatsappCopies?.length === 1 && whatsappCopies[0]?.source === 'whatsapp');

      const cancelStart = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-cancel-start-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'NUEVA NOTA' }
      });
      this.test('A second note can start after saving', cancelStart.data?.conversation?.state === 'choosingPatient');
      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-cancel-patient-001',
        from: '+5491122334455',
        message: { type: 'text', text: `PACIENTE ${patientId}` }
      });
      const cancellable = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-cancel-note-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'Draft to cancel from WhatsApp' }
      });
      const cancelWhatsapp = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-cancel-action-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'CANCELAR' }
      });
      this.test('WhatsApp can cancel a draft without creating a session',
        cancellable.data?.draft?.status === 'ready' &&
        cancelWhatsapp.data?.draft?.status === 'cancelled' &&
        cancelWhatsapp.data?.conversation?.state === 'menu');

      await this.request('DELETE', `/api/patients/${otherPatient.data?.id}`, null, this.token2);

      const unlink = await this.request('DELETE', '/api/whatsapp/link', null, this.token);
      this.test('The web account can unlink its phone', unlink.data?.link?.status === 'unlinked');

      const afterUnlink = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-after-unlink-001',
        from: '+5491122334455',
        selectedPatientId: patientId,
        message: { type: 'text', text: 'Must not be accepted after unlink' }
      });
      this.test('Unlinking stops phone identity resolution', afterUnlink.status === 409);

      const releasedPhone = await this.request('POST', '/api/whatsapp/link', {
        phoneNumber: '+5491122334455'
      }, this.token2);
      this.test('An unlinked phone can be linked by another account', releasedPhone.status === 201);
      await this.request('DELETE', '/api/whatsapp/link', null, this.token2);

      const legacyWhatsappWrite = await this.request('POST', '/api/whatsapp/create-session', {
        patientData: { id: patientId },
        sessionData: { type: 'individual' }
      });
      this.test('Legacy WhatsApp direct session writes are disabled', legacyWhatsappWrite.status === 410);
    }

    // 7. Data Isolation (minimum functional ownership)
    console.log('\n7️⃣  Data Isolation');
    {
      // User 2 should not see User 1's patients
      const listRes = await this.request('GET', '/api/patients', null, this.token2);
      const hasPatient = listRes.data?.patients?.some(p => p.id === patientId);
      this.test('User 2 cannot see User 1 patients', !hasPatient);

      // User 2 cannot update User 1's patient
      const updateRes = await this.request('PATCH', `/api/patients/${patientId}`, {
        name: 'Hacked!'
      }, this.token2);
      this.test('User 2 cannot update User 1 patient', updateRes.status === 404);

      // User 2 cannot delete User 1's patient
      const deleteRes = await this.request('DELETE', `/api/patients/${patientId}`, null, this.token2);
      this.test('User 2 cannot delete User 1 patient', deleteRes.status === 404);
    }

    // 8. Cleanup
    console.log('\n8️⃣  Cleanup');
    {
      // Delete session
      const delSession = await this.request('DELETE', `/api/sessions/${sessionId}`, null, this.token);
      this.test('Delete session returns 200', delSession.status === 200);
      const delLegacySession = await this.request('DELETE', `/api/sessions/${legacySessionId}`, null, this.token);
      this.test('Delete legacy-compatible session returns 200', delLegacySession.status === 200);
      const delDraftSession = await this.request('DELETE', `/api/sessions/${draftSessionId}`, null, this.token);
      this.test('Delete draft-confirmed session returns 200', delDraftSession.status === 200);
      const delWhatsappSession = await this.request('DELETE', `/api/sessions/${whatsappSessionId}`, null, this.token);
      this.test('Delete WhatsApp-confirmed session returns 200', delWhatsappSession.status === 200);

      // Delete patient
      const delPatient = await this.request('DELETE', `/api/patients/${patientId}`, null, this.token);
      this.test('Delete patient returns 200', delPatient.status === 200);

      // Verify deleted
      const listRes = await this.request('GET', '/api/patients', null, this.token);
      const stillExists = listRes.data?.patients?.some(p => p.id === patientId);
      this.test('Patient actually deleted', !stillExists);
    }

    // Results
    console.log('\n' + '═'.repeat(40));
    console.log(`📊 Results: ${this.passed} passed, ${this.failed} failed`);
    console.log('═'.repeat(40));

    if (this.failed > 0) {
      console.log('\n❌ SOME TESTS FAILED');
      process.exit(1);
    } else {
      console.log('\n✅ ALL TESTS PASSED');
      process.exit(0);
    }
  }
}

const tests = new FunctionalTests();
tests.run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});





