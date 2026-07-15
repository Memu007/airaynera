const {
  fakeNoteCleaner,
  fakeTranscriber,
} = require('./fakeAudioProviders');
const { createGeminiTranscriber } = require('./geminiAudioTranscriber');

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function getAudioProviders(options = {}) {
  if (options.providers) return options.providers;
  const transcriberName = options.forceFake
    ? 'fake'
    : (process.env.AUDIO_TRANSCRIBER || 'fake');
  const cleanerName = options.forceFake
    ? 'fake'
    : (process.env.NOTE_CLEANER || 'fake');

  let transcriber;
  if (transcriberName === 'fake') transcriber = fakeTranscriber;
  else if (transcriberName === 'gemini') transcriber = createGeminiTranscriber();
  else {
    throw providerError(
      'AUDIO_PROVIDER_NOT_CONFIGURED',
      `Audio transcriber ${transcriberName} is not configured`
    );
  }

  if (cleanerName !== 'fake') {
    throw providerError(
      'AUDIO_PROVIDER_NOT_CONFIGURED',
      `Note cleaner ${cleanerName} is not configured`
    );
  }
  return { transcriber, noteCleaner: fakeNoteCleaner };
}

module.exports = { getAudioProviders };
