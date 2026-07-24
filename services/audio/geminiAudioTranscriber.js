const fs = require('node:fs/promises');
const path = require('node:path');

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com';
const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_TIMEOUT_MS = 180_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_FILE_READY_TIMEOUT_MS = 60_000;
const TRANSIENT_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const MIME_TYPE_MAP = new Map([
  ['audio/wav', 'audio/wav'],
  ['audio/mpeg', 'audio/mpeg'],
  ['audio/mp3', 'audio/mp3'],
  ['audio/aac', 'audio/aac'],
  ['audio/ogg', 'audio/ogg'],
  ['audio/mp4', 'audio/m4a'],
  ['audio/m4a', 'audio/m4a'],
]);

const TRANSCRIPTION_INSTRUCTION = [
  'Transcribí literalmente el habla en español rioplatense.',
  'No resumas, no traduzcas, no prepares una nota clínica y no agregues información.',
  'Conservá negaciones, números, nombres, unidades, dosis, repeticiones, muletillas y fragmentos dudosos.',
  'Si una parte no se entiende, marcala como [inaudible].',
  'Devolvé únicamente el objeto JSON solicitado.',
].join(' ');

function providerError(code, message, details = {}) {
  const error = new Error(message);
  error.code = code;
  Object.assign(error, details);
  return error;
}

function configuredInteger(name, fallback, minimum = 0) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= minimum ? value : fallback;
}

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function normalizedGeminiMimeType(value) {
  return MIME_TYPE_MAP.get(String(value || '').toLowerCase()) || null;
}

function sleep(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    let abortListener;
    const timer = setTimeout(() => {
      if (abortListener) signal?.removeEventListener('abort', abortListener);
      resolve();
    }, milliseconds);
    if (signal) {
      abortListener = () => {
        clearTimeout(timer);
        reject(providerError('AUDIO_PROCESSING_ABORTED', 'Audio processing lost its worker lease', {
          retryable: false,
        }));
      };
      signal.addEventListener('abort', abortListener, { once: true });
    }
  });
}

async function sleepWithSignal(sleepFn, milliseconds, signal) {
  if (!signal) return sleepFn(milliseconds);
  if (signal.aborted) {
    throw providerError('AUDIO_PROCESSING_ABORTED', 'Audio processing lost its worker lease', {
      retryable: false,
    });
  }
  if (sleepFn === sleep) return sleep(milliseconds, signal);
  let abortListener;
  try {
    await Promise.race([
      sleepFn(milliseconds),
      new Promise((_resolve, reject) => {
        abortListener = () => reject(providerError(
          'AUDIO_PROCESSING_ABORTED',
          'Audio processing lost its worker lease',
          { retryable: false }
        ));
        signal.addEventListener('abort', abortListener, { once: true });
      }),
    ]);
  } finally {
    if (abortListener) signal.removeEventListener('abort', abortListener);
  }
}

async function parseResponsePayload(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch (_) {
    return { raw: text.slice(0, 1000) };
  }
}

function publicApiMessage(payload, fallback) {
  return payload?.error?.message || payload?.message || fallback;
}

function retryDelayMs(response, attempt, randomFn) {
  const retryAfter = Number(response?.headers?.get('retry-after'));
  if (Number.isFinite(retryAfter) && retryAfter >= 0) {
    return Math.min(30_000, retryAfter * 1000);
  }
  const base = Math.min(8000, 1000 * (2 ** attempt));
  return Math.round(base * (0.8 + (randomFn() * 0.4)));
}

function errorCodeForLabel(label) {
  if (label === 'upload initialization' || label === 'file upload') {
    return 'GEMINI_UPLOAD_FAILED';
  }
  if (label === 'remote file cleanup') return 'GEMINI_CLEANUP_FAILED';
  return 'GEMINI_TRANSCRIPTION_FAILED';
}

function createRequester(options) {
  const fetchFn = options.fetchFn || globalThis.fetch;
  const sleepFn = options.sleepFn || sleep;
  const randomFn = options.randomFn || Math.random;
  const timeoutMs = options.timeoutMs ?? configuredInteger(
    'GEMINI_REQUEST_TIMEOUT_MS',
    DEFAULT_TIMEOUT_MS,
    1
  );
  const maxRetries = options.maxRetries ?? configuredInteger(
    'GEMINI_MAX_RETRIES',
    DEFAULT_MAX_RETRIES,
    0
  );

  if (typeof fetchFn !== 'function') {
    throw providerError('GEMINI_FETCH_UNAVAILABLE', 'Gemini requires a fetch implementation');
  }

  return async function request(url, init, label, requestOptions = {}) {
    const allowedRetries = requestOptions.retry === false
      ? 0
      : (requestOptions.maxRetries ?? maxRetries);
    const requestTimeoutMs = requestOptions.timeoutMs ?? timeoutMs;
    const externalSignal = requestOptions.signal;
    let lastError;
    for (let attempt = 0; attempt <= allowedRetries; attempt += 1) {
      if (externalSignal?.aborted) {
        throw providerError(
          'AUDIO_PROCESSING_ABORTED',
          'Audio processing lost its worker lease',
          { retryable: false }
        );
      }
      const controller = new AbortController();
      const abortFromLease = () => controller.abort();
      externalSignal?.addEventListener('abort', abortFromLease, { once: true });
      const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
      try {
        const response = await fetchFn(url, { ...init, signal: controller.signal });
        if (response.ok) return response;
        const payload = await parseResponsePayload(response);
        const retryable = TRANSIENT_STATUS_CODES.has(response.status);
        lastError = providerError(
          errorCodeForLabel(label),
          publicApiMessage(payload, `Gemini ${label} failed with HTTP ${response.status}`),
          { status: response.status, retryable, providerPayload: payload }
        );
        if (!retryable || attempt === allowedRetries) throw lastError;
        await sleepWithSignal(
          sleepFn,
          retryDelayMs(response, attempt, randomFn),
          externalSignal
        );
      } catch (error) {
        if (externalSignal?.aborted) {
          throw providerError(
            'AUDIO_PROCESSING_ABORTED',
            'Audio processing lost its worker lease',
            { retryable: false, cause: error }
          );
        }
        if (error?.code?.startsWith('GEMINI_')) {
          if (!error.retryable || attempt === allowedRetries) throw error;
          lastError = error;
        } else {
          const timedOut = error?.name === 'AbortError';
          lastError = providerError(
            timedOut ? 'GEMINI_TIMEOUT' : 'GEMINI_NETWORK_ERROR',
            timedOut ? `Gemini ${label} timed out` : `Gemini ${label} could not reach the API`,
            { retryable: true, cause: error }
          );
          if (attempt === allowedRetries) throw lastError;
          await sleepWithSignal(
            sleepFn,
            retryDelayMs(null, attempt, randomFn),
            externalSignal
          );
        }
      } finally {
        clearTimeout(timeout);
        externalSignal?.removeEventListener('abort', abortFromLease);
      }
    }
    throw lastError;
  };
}

function modelText(interaction) {
  return (interaction?.steps || [])
    .filter((step) => step?.type === 'model_output')
    .flatMap((step) => step.content || [])
    .filter((content) => content?.type === 'text' && typeof content.text === 'string')
    .map((content) => content.text)
    .join('\n')
    .trim();
}

function extractTranscriptText(modelOutput) {
  // The structured `response_format` asks for {"transcript": "..."}, but Gemini can
  // still answer with a fenced code block or plain literal text. Accept all three so
  // a single formatting quirk never discards a valid transcription.
  let candidate = modelOutput.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(candidate);
  if (fenced) candidate = fenced[1].trim();
  if (candidate.startsWith('{') || candidate.startsWith('[')) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed?.transcript === 'string') return parsed.transcript.trim();
    } catch (_) {
      // Not valid JSON despite the leading brace; fall back to the literal text.
    }
  }
  return candidate.trim();
}

function transcriptFromInteraction(interaction) {
  if (interaction?.status !== 'completed') {
    throw providerError(
      'GEMINI_TRANSCRIPTION_FAILED',
      `Gemini interaction ended with status ${interaction?.status || 'unknown'}`,
      { retryable: false, interactionStatus: interaction?.status || null }
    );
  }
  const text = modelText(interaction);
  if (!text) {
    throw providerError('GEMINI_EMPTY_RESPONSE', 'Gemini returned no transcription', {
      retryable: false,
    });
  }
  const transcript = extractTranscriptText(text);
  if (!transcript) {
    throw providerError('EMPTY_TRANSCRIPT', 'No speech was found in the audio', {
      retryable: false,
    });
  }
  return transcript;
}

function createGeminiTranscriber(options = {}) {
  const apiKey = options.apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const model = options.model || process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const baseUrl = normalizeBaseUrl(options.baseUrl || process.env.GEMINI_API_BASE_URL);
  const cleanupWarningFn = options.cleanupWarningFn || console.warn;
  const fileReadyTimeoutMs = options.fileReadyTimeoutMs ?? configuredInteger(
    'GEMINI_FILE_READY_TIMEOUT_MS',
    DEFAULT_FILE_READY_TIMEOUT_MS,
    1
  );
  const request = createRequester(options);

  async function uploadFile(mediaPath, mimeType, signal) {
    const bytes = await fs.readFile(mediaPath);
    const startResponse = await request(
      `${baseUrl}/upload/v1beta/files`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': String(bytes.length),
          'X-Goog-Upload-Header-Content-Type': mimeType,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: { display_name: `aira-${path.basename(mediaPath)}` },
        }),
      },
      'upload initialization',
      { signal }
    );
    const uploadUrl = startResponse.headers.get('x-goog-upload-url');
    if (!uploadUrl) {
      throw providerError('GEMINI_UPLOAD_FAILED', 'Gemini did not return an upload URL', {
        retryable: false,
      });
    }
    const uploadResponse = await request(
      uploadUrl,
      {
        method: 'POST',
        headers: {
          'Content-Length': String(bytes.length),
          'X-Goog-Upload-Offset': '0',
          'X-Goog-Upload-Command': 'upload, finalize',
        },
        body: bytes,
      },
      'file upload',
      // Replaying `upload, finalize` from offset zero is not safe when the response was lost.
      // A later durable job retry starts a fresh upload session instead.
      { signal, retry: false }
    );
    const payload = await parseResponsePayload(uploadResponse);
    const file = payload?.file;
    if (!file?.name || !file?.uri) {
      throw providerError('GEMINI_UPLOAD_FAILED', 'Gemini returned incomplete file metadata', {
        retryable: false,
      });
    }
    return file;
  }

  async function deleteFile(fileName) {
    try {
      await request(
        `${baseUrl}/v1beta/${String(fileName).replace(/^\/+/, '')}`,
        {
          method: 'DELETE',
          headers: { 'x-goog-api-key': apiKey },
        },
        'remote file cleanup',
        // Cleanup gets one short independent attempt even when worker shutdown aborted inference.
        { retry: false, timeoutMs: 1000 }
      );
    } catch (error) {
      if (error?.status !== 404) throw error;
    }
  }

  async function waitForActiveFile(file, signal) {
    const deadline = Date.now() + fileReadyTimeoutMs;
    let current = file;
    while (current?.state !== 'ACTIVE') {
      if (current?.state === 'FAILED') {
        throw providerError('GEMINI_FILE_PROCESSING_FAILED', 'Gemini could not process the audio file', {
          retryable: false,
        });
      }
      if (Date.now() >= deadline) {
        throw providerError('GEMINI_FILE_READY_TIMEOUT', 'Gemini did not prepare the audio file in time', {
          retryable: true,
        });
      }
      await sleepWithSignal(options.sleepFn || sleep, 500, signal);
      const response = await request(
        `${baseUrl}/v1beta/${String(file.name).replace(/^\/+/, '')}`,
        {
          method: 'GET',
          headers: { 'x-goog-api-key': apiKey },
        },
        'file readiness',
        { signal }
      );
      current = await parseResponsePayload(response);
    }
    return current;
  }

  async function createInteraction(file, mimeType, signal) {
    const response = await request(
      `${baseUrl}/v1/interactions`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          store: false,
          system_instruction: TRANSCRIPTION_INSTRUCTION,
          // Interactions API v1 events are typed; the caller's text and audio must be
          // wrapped in a single `user_input` event with a `content` array. A flat
          // `input: [{type:'text'}, {type:'audio'}]` is rejected with HTTP 400
          // ("The value 'text' is not supported for 'type' at 'input[0]'").
          input: [
            {
              type: 'user_input',
              content: [
                { type: 'text', text: 'Transcribí todo el audio.' },
                { type: 'audio', uri: file.uri, mime_type: mimeType },
              ],
            },
          ],
          response_format: {
            type: 'text',
            mime_type: 'application/json',
            schema: {
              type: 'object',
              properties: { transcript: { type: 'string' } },
              required: ['transcript'],
              additionalProperties: false,
            },
          },
          generation_config: {
            thinking_level: 'minimal',
            max_output_tokens: 8192,
          },
        }),
      },
      'transcription',
      // Creating an interaction has no idempotency key. A durable job retry creates a fresh one.
      { signal, retry: false }
    );
    return parseResponsePayload(response);
  }

  return Object.freeze({
    name: 'gemini',
    model,
    async transcribe({ mediaPath, mimeType, durationHintSeconds, signal }) {
      if (!apiKey) {
        throw providerError(
          'GEMINI_API_KEY_MISSING',
          'GEMINI_API_KEY is required when AUDIO_TRANSCRIBER=gemini',
          { retryable: false }
        );
      }
      if (!mediaPath) {
        throw providerError('INVALID_AUDIO_INPUT', 'Gemini requires a stored audio file', {
          retryable: false,
        });
      }
      const geminiMimeType = normalizedGeminiMimeType(mimeType);
      if (!geminiMimeType) {
        throw providerError(
          'GEMINI_UNSUPPORTED_AUDIO_TYPE',
          `Gemini does not support ${mimeType || 'the uploaded audio type'} in this adapter`,
          { retryable: false }
        );
      }

      let remoteFile;
      try {
        remoteFile = await uploadFile(mediaPath, geminiMimeType, signal);
        remoteFile = await waitForActiveFile(remoteFile, signal);
        const interaction = await createInteraction(remoteFile, geminiMimeType, signal);
        return {
          text: transcriptFromInteraction(interaction),
          durationSeconds: durationHintSeconds ?? null,
          providerRequestId: interaction.id || null,
          providerModel: interaction.model || model,
          usage: interaction.usage || null,
        };
      } finally {
        if (remoteFile?.name) {
          await deleteFile(remoteFile.name).catch((error) => {
            cleanupWarningFn('Gemini remote file cleanup failed; automatic expiry remains active', {
              code: error?.code || 'GEMINI_CLEANUP_FAILED',
              status: error?.status || null,
            });
          });
        }
      }
    },
  });
}

module.exports = {
  DEFAULT_MODEL,
  TRANSCRIPTION_INSTRUCTION,
  createGeminiTranscriber,
  extractTranscriptText,
  normalizedGeminiMimeType,
  transcriptFromInteraction,
};
