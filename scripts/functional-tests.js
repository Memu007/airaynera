#!/usr/bin/env node
/**
 * Functional Tests - Valida flujos CRUD completos
 */

const http = require('http');

const BASE_URL = process.env.TEST_URL || 'http://localhost:8080';

function makeWav(payloadText = 'functional upload bytes') {
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

class FunctionalTests {
  constructor() {
    this.passed = 0;
    this.failed = 0;
    this.token = null;
    this.token2 = null;
  }

  async request(method, path, body = null, token = null, customHeaders = {}) {
    const url = new URL(path, BASE_URL);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: url.hostname,
        port: url.port || 80,
        path: url.pathname + url.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          ...customHeaders,
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

      if (Buffer.isBuffer(body)) req.write(body);
      else if (body) req.write(JSON.stringify(body));
      req.end();
    });
  }

  async waitForAudioDraft(draftId, token, timeoutMs = 5000) {
    const deadline = Date.now() + timeoutMs;
    let response;
    while (Date.now() < deadline) {
      response = await this.request('GET', `/api/audio-drafts/${draftId}`, null, token);
      const status = response.data?.draft?.status;
      if (['ready', 'failed', 'cancelled'].includes(status)) return response;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return response;
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
      const privateData = await this.request('GET', '/data/aira.db');
      this.test('Temporary and database files are not exposed publicly', privateData.status === 404);
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
    let webAudioSessionId;
    let uploadedAudioSessionId;
    let whatsappAudioSessionId;
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

      const genericAudioDraft = await this.request('POST', '/api/session-drafts', {
        patientId,
        inputType: 'audio'
      }, this.token);
      this.test('Generic draft intake rejects unprocessable audio', genericAudioDraft.status === 400);

      const audioFixtures = await this.request('GET', '/api/audio-drafts/fixtures', null, this.token);
      this.test('Web exposes only synthetic audio fixtures',
        audioFixtures.status === 200 &&
        audioFixtures.data?.fixtures?.some(fixture => fixture.id === 'pause-heavy-es-01'));

      const audioWithoutKey = await this.request('POST', '/api/audio-drafts', {
        patientId,
        fixtureId: 'pause-heavy-es-01'
      }, this.token);
      this.test('Web audio requires an idempotency key', audioWithoutKey.status === 400);

      const audioDraft = await this.request('POST', '/api/audio-drafts', {
        patientId,
        clinicalDate: '2026-07-14',
        fixtureId: 'pause-heavy-es-01'
      }, this.token, { 'Idempotency-Key': 'functional-web-audio-001' });
      const webAudioDraftId = audioDraft.data?.draft?.id;
      this.test('Synthetic web audio becomes a ready draft',
        audioDraft.status === 201 &&
        audioDraft.data?.draft?.status === 'ready' &&
        audioDraft.data?.draft?.inputType === 'audio');
      this.test('Audio keeps raw and cleaned text separate',
        audioDraft.data?.draft?.rawTranscript?.startsWith('Eh...') &&
        audioDraft.data?.draft?.cleanNote === 'Hoy registré una nota de prueba, con varias pausas para revisar el resultado.');

      const repeatedAudioDraft = await this.request('POST', '/api/audio-drafts', {
        patientId,
        clinicalDate: '2026-07-14',
        fixtureId: 'pause-heavy-es-01'
      }, this.token, { 'Idempotency-Key': 'functional-web-audio-001' });
      this.test('Repeated web audio intake returns the same draft',
        repeatedAudioDraft.status === 200 &&
        repeatedAudioDraft.data?.deduplicated === true &&
        repeatedAudioDraft.data?.draft?.id === webAudioDraftId);

      const conflictingAudioDraft = await this.request('POST', '/api/audio-drafts', {
        patientId,
        clinicalDate: '2026-07-14',
        fixtureId: 'clear-es-01'
      }, this.token, { 'Idempotency-Key': 'functional-web-audio-001' });
      this.test('Reusing the web audio key with another input is rejected', conflictingAudioDraft.status === 409);

      const tamperedRaw = await this.request('PATCH', `/api/session-drafts/${webAudioDraftId}`, {
        rawTranscript: 'Payload must not replace the raw transcript',
        audioDurationSeconds: 1,
        cleanNote: 'Nota de audio revisada.'
      }, this.token);
      this.test('Review edits only the clean note, not audio evidence',
        tamperedRaw.data?.draft?.cleanNote === 'Nota de audio revisada.' &&
        tamperedRaw.data?.draft?.rawTranscript === audioDraft.data?.draft?.rawTranscript &&
        tamperedRaw.data?.draft?.audioDurationSeconds === 52);

      const foreignAudioRetry = await this.request(
        'POST',
        `/api/audio-drafts/${webAudioDraftId}/retry`,
        null,
        this.token2
      );
      this.test('Another account cannot process an audio draft', foreignAudioRetry.status === 404);

      const confirmWebAudio = await this.request(
        'POST',
        `/api/session-drafts/${webAudioDraftId}/confirm`,
        null,
        this.token
      );
      webAudioSessionId = confirmWebAudio.data?.session?.id;
      this.test('Reviewed web audio confirms through the canonical service',
        confirmWebAudio.status === 201 &&
        confirmWebAudio.data?.session?.inputType === 'audio' &&
        confirmWebAudio.data?.session?.cleanNote === 'Nota de audio revisada.');

      const tamperedConfirmedAudio = await this.request('PATCH', `/api/sessions/${webAudioSessionId}`, {
        cleanNote: 'Nota confirmada con revisión posterior.',
        rawTranscript: 'Confirmed evidence must stay immutable',
        inputType: 'text',
        audioDurationSeconds: 1
      }, this.token);
      this.test('Confirmed audio keeps raw evidence and media metadata immutable',
        tamperedConfirmedAudio.data?.cleanNote === 'Nota confirmada con revisión posterior.' &&
        tamperedConfirmedAudio.data?.rawTranscript === audioDraft.data?.draft?.rawTranscript &&
        tamperedConfirmedAudio.data?.inputType === 'audio' &&
        tamperedConfirmedAudio.data?.audioDurationSeconds === 52);

      const failedAudio = await this.request('POST', '/api/audio-drafts', {
        patientId,
        fixtureId: 'cleaning-fails-once'
      }, this.token, { 'Idempotency-Key': 'functional-web-audio-failure' });
      this.test('A processing failure remains persisted and visible',
        failedAudio.status === 201 &&
        failedAudio.data?.draft?.status === 'failed' &&
        failedAudio.data?.draft?.failedStage === 'structuring');
      const retriedAudio = await this.request(
        'POST',
        `/api/audio-drafts/${failedAudio.data?.draft?.id}/retry`,
        null,
        this.token
      );
      this.test('Retry resumes the failed stage and reaches ready',
        retriedAudio.status === 200 &&
        retriedAudio.data?.draft?.status === 'ready' &&
        retriedAudio.data?.draft?.processingAttempts === 2);
      await this.request('POST', `/api/session-drafts/${retriedAudio.data?.draft?.id}/cancel`, null, this.token);

      const uploadPath = `/api/audio-drafts/upload?patientId=${encodeURIComponent(patientId)}&clinicalDate=2026-07-14&audioDurationSeconds=12`;
      const uploadedBytes = makeWav();
      const uploadedAudio = await this.request(
        'POST',
        uploadPath,
        uploadedBytes,
        this.token,
        {
          'Content-Type': 'audio/wav',
          'Content-Length': String(uploadedBytes.length),
          'Idempotency-Key': 'functional-real-audio-001',
        }
      );
      const uploadedDraftId = uploadedAudio.data?.draft?.id;
      this.test('Real web audio is stored and queued without waiting for processing',
        uploadedAudio.status === 202 &&
        uploadedAudio.data?.draft?.status === 'received' &&
        uploadedAudio.data?.processing?.status === 'queued');

      const uploadedReady = await this.waitForAudioDraft(uploadedDraftId, this.token);
      this.test('The separate worker prepares the uploaded audio draft',
        uploadedReady.status === 200 &&
        uploadedReady.data?.draft?.status === 'ready' &&
        uploadedReady.data?.processing?.status === 'completed');
      this.test('Uploaded audio keeps a clearly simulated transcript',
        uploadedReady.data?.draft?.rawTranscript?.startsWith('Transcripción simulada') &&
        uploadedReady.data?.draft?.cleanNote === uploadedReady.data?.draft?.rawTranscript);

      const repeatedUpload = await this.request(
        'POST',
        uploadPath,
        uploadedBytes,
        this.token,
        {
          'Content-Type': 'audio/wav',
          'Idempotency-Key': 'functional-real-audio-001',
        }
      );
      this.test('Repeated binary upload returns the same draft and job',
        repeatedUpload.status === 200 &&
        repeatedUpload.data?.deduplicated === true &&
        repeatedUpload.data?.draft?.id === uploadedDraftId);

      const conflictingUpload = await this.request(
        'POST',
        uploadPath,
        makeWav('different functional bytes'),
        this.token,
        {
          'Content-Type': 'audio/wav',
          'Idempotency-Key': 'functional-real-audio-001',
        }
      );
      this.test('Reusing a binary upload key with other bytes is rejected', conflictingUpload.status === 409);

      const foreignUpload = await this.request(
        'POST',
        uploadPath,
        uploadedBytes,
        this.token2,
        {
          'Content-Type': 'audio/wav',
          'Idempotency-Key': 'functional-real-audio-foreign',
        }
      );
      this.test('Another account cannot upload audio for the selected patient', foreignUpload.status === 404);

      const invalidUpload = await this.request(
        'POST',
        uploadPath,
        Buffer.from('not an audio container'),
        this.token,
        {
          'Content-Type': 'audio/wav',
          'Idempotency-Key': 'functional-real-audio-invalid',
        }
      );
      this.test('Invalid audio bytes are rejected before creating a draft', invalidUpload.status === 415);

      const reviewedUpload = await this.request('PATCH', `/api/session-drafts/${uploadedDraftId}`, {
        cleanNote: 'Nota de archivo real revisada.',
        moodAssessment: 3,
      }, this.token);
      const confirmedUpload = await this.request(
        'POST',
        `/api/session-drafts/${reviewedUpload.data?.draft?.id}/confirm`,
        null,
        this.token
      );
      uploadedAudioSessionId = confirmedUpload.data?.session?.id;
      this.test('Uploaded audio confirms through the canonical session service',
        confirmedUpload.status === 201 &&
        confirmedUpload.data?.session?.inputType === 'audio' &&
        confirmedUpload.data?.session?.cleanNote === 'Nota de archivo real revisada.');

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

      const contendedInbound = await Promise.all(
        Array.from({ length: 20 }, (_, index) => this.request('POST', '/api/dev/whatsapp/inbound', {
          messageId: `fake-contention-${index}`,
          from: `+549110000${String(index).padStart(4, '0')}`,
          message: { type: 'text', text: 'MENÚ' },
        }))
      );
      this.test('Worker polling does not make concurrent inbound transactions fail',
        contendedInbound.every((response) => response.status === 409));

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

      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-audio-new-note-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'NUEVA NOTA' }
      });
      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-audio-patient-001',
        from: '+5491122334455',
        message: { type: 'text', text: `PACIENTE ${patientId}` }
      });
      const whatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-audio-message-001',
        from: '+5491122334455',
        selectedPatientId: otherPatient.data?.id,
        message: { type: 'audio', fixtureId: 'pause-heavy-es-01' }
      });
      const whatsappAudioDraftId = whatsappAudio.data?.draft?.id;
      this.test('WhatsApp audio uses the selected patient and shared pipeline',
        whatsappAudio.status === 200 &&
        whatsappAudio.data?.reply?.code === 'DRAFT_READY' &&
        whatsappAudio.data?.draft?.patientId === patientId &&
        whatsappAudio.data?.draft?.inputType === 'audio');

      const repeatedWhatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-audio-message-001',
        from: '+5491122334455',
        message: { type: 'audio', fixtureId: 'pause-heavy-es-01' }
      });
      this.test('Repeated WhatsApp audio does not transcribe twice',
        repeatedWhatsappAudio.data?.deduplicated === true &&
        repeatedWhatsappAudio.data?.draft?.id === whatsappAudioDraftId &&
        repeatedWhatsappAudio.data?.draft?.processingAttempts === 1);

      const conflictingWhatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-audio-message-001',
        from: '+5491122334455',
        message: { type: 'audio', fixtureId: 'clear-es-01' }
      });
      this.test('A WhatsApp message id cannot point to another audio', conflictingWhatsappAudio.status === 409);

      const saveWhatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-audio-save-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'GUARDAR' }
      });
      whatsappAudioSessionId = saveWhatsappAudio.data?.session?.id;
      this.test('WhatsApp audio saves one canonical session',
        saveWhatsappAudio.data?.reply?.code === 'SESSION_SAVED' &&
        saveWhatsappAudio.data?.session?.draftId === whatsappAudioDraftId);

      const sessionsAfterWhatsappAudio = await this.request('GET', '/api/sessions', null, this.token);
      this.test('WhatsApp audio appears in the web account after saving',
        sessionsAfterWhatsappAudio.data?.sessions?.some(session =>
          session.id === whatsappAudioSessionId && session.inputType === 'audio'
        ));

      const reviewedWhatsappSession = await this.request('PATCH', `/api/sessions/${whatsappAudioSessionId}`, {
        cleanNote: 'Nota de WhatsApp revisada desde la web.'
      }, this.token);
      this.test('Editing an unscored WhatsApp note preserves its missing mood',
        reviewedWhatsappSession.data?.cleanNote === 'Nota de WhatsApp revisada desde la web.' &&
        reviewedWhatsappSession.data?.moodAssessment === null);

      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-failed-audio-new-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'NUEVA NOTA' }
      });
      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-failed-audio-patient-001',
        from: '+5491122334455',
        message: { type: 'text', text: `PACIENTE ${patientId}` }
      });
      const failedWhatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-failed-audio-001',
        from: '+5491122334455',
        message: { type: 'audio', fixtureId: 'cleaning-fails-once' }
      });
      this.test('Failed WhatsApp audio stays attached to the conversation',
        failedWhatsappAudio.data?.draft?.status === 'failed' &&
        failedWhatsappAudio.data?.conversation?.state === 'awaitingConfirmation' &&
        failedWhatsappAudio.data?.conversation?.currentDraftId === failedWhatsappAudio.data?.draft?.id);
      const cancelFailedWhatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-failed-audio-cancel-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'CANCELAR' }
      });
      this.test('Failed WhatsApp audio can be cancelled',
        cancelFailedWhatsappAudio.data?.draft?.status === 'cancelled' &&
        cancelFailedWhatsappAudio.data?.conversation?.state === 'menu');

      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-retry-audio-new-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'NUEVA NOTA' }
      });
      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-retry-audio-patient-001',
        from: '+5491122334455',
        message: { type: 'text', text: `PACIENTE ${patientId}` }
      });
      const retryableWhatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-retry-audio-001',
        from: '+5491122334455',
        message: { type: 'audio', fixtureId: 'cleaning-fails-once' }
      });
      const retriedWhatsappAudio = await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-retry-audio-action-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'REINTENTAR' }
      });
      this.test('WhatsApp retries the persisted failed stage',
        retryableWhatsappAudio.data?.draft?.status === 'failed' &&
        retriedWhatsappAudio.data?.draft?.status === 'ready' &&
        retriedWhatsappAudio.data?.draft?.processingAttempts === 2 &&
        retriedWhatsappAudio.data?.reply?.text?.includes(retriedWhatsappAudio.data?.draft?.cleanNote));
      await this.request('POST', '/api/dev/whatsapp/inbound', {
        messageId: 'fake-retry-audio-cancel-001',
        from: '+5491122334455',
        message: { type: 'text', text: 'CANCELAR' }
      });

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
      const delWebAudioSession = await this.request('DELETE', `/api/sessions/${webAudioSessionId}`, null, this.token);
      this.test('Delete web-audio session returns 200', delWebAudioSession.status === 200);
      const delUploadedAudioSession = await this.request('DELETE', `/api/sessions/${uploadedAudioSessionId}`, null, this.token);
      this.test('Delete uploaded-audio session returns 200', delUploadedAudioSession.status === 200);
      const delWhatsappAudioSession = await this.request('DELETE', `/api/sessions/${whatsappAudioSessionId}`, null, this.token);
      this.test('Delete WhatsApp-audio session returns 200', delWhatsappAudioSession.status === 200);

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
