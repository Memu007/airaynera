const FIXTURES = Object.freeze({
  'clear-es-01': Object.freeze({
    durationSeconds: 38,
    mimeType: 'audio/ogg',
    rawTranscript: 'Hoy registré una nota breve de prueba para revisar el flujo de audio.',
  }),
  'pause-heavy-es-01': Object.freeze({
    durationSeconds: 52,
    mimeType: 'audio/ogg',
    rawTranscript: 'Eh... hoy registré una nota de prueba... con varias pausas [pausa] para revisar el resultado.',
  }),
  'transcription-fails-once': Object.freeze({
    durationSeconds: 31,
    mimeType: 'audio/ogg',
    rawTranscript: 'Nota de prueba recuperada después de reintentar la transcripción.',
    transcriptionFailsOnce: true,
  }),
  'cleaning-fails-once': Object.freeze({
    durationSeconds: 44,
    mimeType: 'audio/ogg',
    rawTranscript: 'Eh... nota de prueba recuperada después de reintentar la preparación.',
    cleaningFailsOnce: true,
  }),
  'empty-audio': Object.freeze({
    durationSeconds: 9,
    mimeType: 'audio/ogg',
    rawTranscript: '',
  }),
});

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function fixtureIdFromReference(mediaReference) {
  const match = /^fixture:\/\/(.+)$/.exec(String(mediaReference || ''));
  return match ? match[1] : null;
}

function getFixture(fixtureId) {
  const fixture = FIXTURES[String(fixtureId || '')];
  if (!fixture) throw providerError('INVALID_AUDIO_INPUT', 'Audio fixture not found');
  return { id: String(fixtureId), ...fixture };
}

function listFixtures() {
  return Object.entries(FIXTURES).map(([id, fixture]) => ({
    id,
    durationSeconds: fixture.durationSeconds,
    mimeType: fixture.mimeType,
  }));
}

function cleanConservatively(rawTranscript) {
  let clean = String(rawTranscript || '')
    .replace(/\[(?:pausa|silencio)\]/gi, ' ')
    .replace(/^\s*(?:eh+|em+|mmm+)\b[\s,.:;-]*/i, '')
    .replace(/\.{2,}/g, ',')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([,.;:!?])(?=\S)/g, '$1 ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return '';
  clean = clean[0].toUpperCase() + clean.slice(1);
  if (!/[.!?]$/.test(clean)) clean += '.';
  return clean;
}

const fakeTranscriber = Object.freeze({
  name: 'fake',
  transcribe({ mediaReference, attempt }) {
    const fixture = getFixture(fixtureIdFromReference(mediaReference));
    if (fixture.transcriptionFailsOnce && Number(attempt) === 1) {
      throw providerError('TRANSCRIPTION_FAILED', 'The simulated transcription failed');
    }
    return {
      text: fixture.rawTranscript,
      durationSeconds: fixture.durationSeconds,
      providerRequestId: `fake-transcription-${fixture.id}-${attempt}`,
    };
  },
});

const fakeNoteCleaner = Object.freeze({
  name: 'fake',
  clean({ rawTranscript, mediaReference, attempt }) {
    const fixture = getFixture(fixtureIdFromReference(mediaReference));
    if (fixture.cleaningFailsOnce && Number(attempt) === 1) {
      throw providerError('CLEANING_FAILED', 'The simulated note preparation failed');
    }
    return { cleanNote: cleanConservatively(rawTranscript) };
  },
});

function getAudioProviders() {
  const transcriberName = process.env.AUDIO_TRANSCRIBER || 'fake';
  const cleanerName = process.env.NOTE_CLEANER || 'fake';
  if (transcriberName !== 'fake' || cleanerName !== 'fake') {
    throw providerError('AUDIO_PROVIDER_NOT_CONFIGURED', 'Only fake audio providers are available in this milestone');
  }
  return { transcriber: fakeTranscriber, noteCleaner: fakeNoteCleaner };
}

module.exports = {
  cleanConservatively,
  getAudioProviders,
  getFixture,
  listFixtures,
};
