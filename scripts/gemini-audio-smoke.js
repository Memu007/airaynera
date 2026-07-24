#!/usr/bin/env node

require('dotenv').config({ quiet: true });

const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
const path = require('node:path');
const { performance } = require('node:perf_hooks');
const { spawnSync } = require('node:child_process');
const { generateCorpus, parseWavDuration } = require('./generate-gemini-audio-corpus');
const {
  TRANSCRIPTION_INSTRUCTION,
  createGeminiTranscriber,
} = require('../services/audio/geminiAudioTranscriber');
const { aggregateScores, scoreTranscription } = require('../services/audio/transcriptionMetrics');

function argumentValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function integerArgument(name, fallback) {
  const raw = argumentValue(name);
  const value = raw == null ? fallback : Number(raw);
  if (!Number.isInteger(value)) throw new Error(`${name} must be an integer`);
  return value;
}

function rounded(value) {
  return Math.round(value * 10000) / 10000;
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function percentile(values, ratio) {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.max(0, Math.ceil(sorted.length * ratio) - 1)];
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function loadGeneratedCorpus(manifestPath) {
  const absoluteManifestPath = path.resolve(manifestPath);
  const generated = JSON.parse(fs.readFileSync(absoluteManifestPath, 'utf8'));
  generated.manifestPath = absoluteManifestPath;
  generated.entries = generated.entries.map((entry) => ({
    ...entry,
    path: path.isAbsolute(entry.path)
      ? entry.path
      : path.resolve(path.dirname(absoluteManifestPath), entry.path),
  }));
  return generated;
}

function validateCorpus(generated) {
  if (generated.entries.length < 30 || generated.entries.length > 50) {
    throw new Error('The benchmark corpus must contain between 30 and 50 audios');
  }
  const scores = generated.entries.map((entry) => scoreTranscription(
    entry.reference,
    entry.reference,
    entry.criticalSpans
  ));
  const aggregate = aggregateScores(scores);
  const ids = new Set(generated.entries.map((entry) => entry.id));
  const validFiles = generated.entries.every((entry) => {
    if (!fs.existsSync(entry.path)) return false;
    const stat = fs.statSync(entry.path);
    return stat.size === entry.sizeBytes
      && sha256File(entry.path) === entry.sha256
      && Math.abs(parseWavDuration(entry.path) - entry.durationSeconds) < 0.01;
  });
  const valid = ids.size === generated.entries.length
    && aggregate.wer === 0
    && aggregate.cer === 0
    && aggregate.criticalAccuracy === 1
    && aggregate.negationAccuracy === 1
    && generated.entries.every((entry) => entry.sizeBytes > 4096 && entry.durationSeconds > 0)
    && validFiles;
  if (!valid) throw new Error('Corpus or scoring validation failed');
  return aggregate;
}

function makeProbeWav({ seconds = 3, rate = 16000, freq = 220 } = {}) {
  const samples = seconds * rate;
  const dataBytes = samples * 2;
  const wav = Buffer.alloc(44 + dataBytes);
  wav.write('RIFF', 0, 'ascii');
  wav.writeUInt32LE(36 + dataBytes, 4);
  wav.write('WAVE', 8, 'ascii');
  wav.write('fmt ', 12, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(rate, 24);
  wav.writeUInt32LE(rate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 'ascii');
  wav.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples; i += 1) {
    wav.writeInt16LE(Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 12000), 44 + i * 2);
  }
  return wav;
}

// Single live call that exercises the real adapter end-to-end (Files API upload →
// ACTIVE → Interactions v1 → parse) with a synthetic tone. It does NOT measure
// transcription quality — it confirms the request payload (user_input wrapping,
// system_instruction, response_format, generation_config) is accepted by the live
// API. Runs anywhere (no macOS corpus needed), so it is the fast pre-check before
// the macOS-generated corpus smoke.
async function runProbe(options = {}) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error('Configure GEMINI_API_KEY locally before running the probe');
  const transcriber = createGeminiTranscriber({ apiKey });
  const runtimeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-gemini-probe-'));
  const wavPath = path.join(runtimeDirectory, 'probe.wav');
  fs.writeFileSync(wavPath, makeProbeWav());
  const startedAt = performance.now();
  let outcome;
  try {
    const result = await transcriber.transcribe({
      mediaPath: wavPath,
      mimeType: 'audio/wav',
      durationHintSeconds: 3,
    });
    outcome = {
      probe: 'ok',
      payloadAccepted: true,
      note: 'Live payload accepted; transcript content is not meaningful for a synthetic tone.',
      transcriptChars: result.text.length,
      providerRequestId: result.providerRequestId,
      providerModel: result.providerModel,
      usage: result.usage,
    };
  } catch (error) {
    // EMPTY_TRANSCRIPT still means the interaction returned model_output (payload was
    // accepted); the tone simply had no speech. Any other error means the payload or
    // pipeline was rejected — surface the raw API message so a bad param is obvious.
    if (error.code === 'EMPTY_TRANSCRIPT') {
      outcome = {
        probe: 'ok',
        payloadAccepted: true,
        note: 'Live payload accepted; model returned an empty transcript for the synthetic tone.',
      };
    } else {
      outcome = {
        probe: 'failed',
        payloadAccepted: false,
        errorCode: error.code || 'GEMINI_PROBE_FAILED',
        httpStatus: error.status || null,
        apiMessage: error.message,
        providerPayload: error.providerPayload || null,
      };
    }
  } finally {
    fs.rmSync(runtimeDirectory, { recursive: true, force: true });
  }
  outcome.model = transcriber.model;
  outcome.latencyMs = Math.round(performance.now() - startedAt);
  outcome.commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || null;
  outcome.createdAt = new Date().toISOString();
  if (options.reportPath) {
    const absolute = path.resolve(options.reportPath);
    fs.mkdirSync(path.dirname(absolute), { recursive: true });
    fs.writeFileSync(absolute, `${JSON.stringify(outcome, null, 2)}\n`);
  }
  return outcome;
}

async function runLiveSmoke(generated, options) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    throw new Error('Configure GEMINI_API_KEY locally before running the live smoke');
  }
  const initialGitStatus = spawnSync('git', ['status', '--porcelain'], {
    encoding: 'utf8',
  }).stdout.trim();
  if (initialGitStatus) {
    throw new Error('Live smoke requires a clean Git worktree so its report identifies exact code');
  }
  const transcriber = createGeminiTranscriber({ apiKey });
  const entries = generated.entries.slice(0, options.count);
  const results = [];
  const runtimeDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'aira-gemini-smoke-runtime-'));
  process.env.DATA_DIR = runtimeDirectory;
  process.env.AUDIO_UPLOAD_DIR = path.join(runtimeDirectory, 'audio-uploads');
  process.env.AUDIO_TRANSCRIBER = 'gemini';
  process.env.NOTE_CLEANER = 'fake';
  process.env.DATA_KEY ||= '0'.repeat(64);

  const sql = require('../services/sqlite');
  const store = require('../services/audio/temporaryAudioStore');
  const pipeline = require('../services/audioDraftPipeline');
  const { fakeNoteCleaner } = require('../services/audio/fakeAudioProviders');
  const { AudioWorker } = require('../workers/audio-worker');
  const userId = 'gemini-synthetic-smoke';
  const patient = sql.addPatient(userId, {
    name: 'Paciente Sintético Gemini',
    dni: 'gemini-synthetic-smoke',
    habilitado: true,
  });
  let providerResult = null;
  const providers = {
    transcriber: {
      name: transcriber.name,
      async transcribe(input) {
        providerResult = await transcriber.transcribe(input);
        return providerResult;
      },
    },
    noteCleaner: fakeNoteCleaner,
  };
  const worker = new AudioWorker({ workerId: 'gemini-synthetic-smoke-worker', providers });

  try {
    for (let index = 0; index < entries.length; index += 1) {
      const entry = entries[index];
      const startedAt = performance.now();
      providerResult = null;
      try {
        const media = await store.storeStream(fs.createReadStream(entry.path), {
          declaredMimeType: entry.mimeType,
          contentLength: entry.sizeBytes,
        });
        const queued = pipeline.ingestUpload(userId, {
          patientId: patient.id,
          audioDurationSeconds: entry.durationSeconds,
        }, media, {
          source: 'benchmark',
          sourceMessageId: `gemini-synthetic-smoke-${entry.id}`,
        });
        const processed = await worker.runOnce();
        if (processed?.draft?.id !== queued.draft.id || processed.draft.status !== 'ready') {
          const error = new Error(processed?.draft?.failure?.message || 'Worker did not produce a ready draft');
          error.code = processed?.draft?.failure?.code || 'GEMINI_SMOKE_PIPELINE_FAILED';
          throw error;
        }
        const hypothesis = processed.draft.rawTranscript;
        const score = scoreTranscription(
          entry.reference,
          hypothesis,
          entry.criticalSpans
        );
        results.push({
          id: entry.id,
          caseId: entry.caseId,
          variantId: entry.variantId,
          voice: entry.voice,
          locale: entry.locale,
          audioSha256: entry.sha256,
          audioDurationSeconds: entry.durationSeconds,
          completed: true,
          latencyMs: Math.round(performance.now() - startedAt),
          reference: entry.reference,
          hypothesis,
          wer: score.wer,
          cer: score.cer,
          criticalSpans: score.criticalSpans,
          providerRequestId: providerResult?.providerRequestId || null,
          providerModel: providerResult?.providerModel || transcriber.model,
          usage: providerResult?.usage || null,
        });
      } catch (error) {
        results.push({
          id: entry.id,
          caseId: entry.caseId,
          variantId: entry.variantId,
          voice: entry.voice,
          locale: entry.locale,
          audioSha256: entry.sha256,
          audioDurationSeconds: entry.durationSeconds,
          completed: false,
          latencyMs: Math.round(performance.now() - startedAt),
          errorCode: error.code || 'GEMINI_SMOKE_FAILED',
          errorMessage: error.message,
        });
      }
      if (options.delayMs && index < entries.length - 1) await sleep(options.delayMs);
    }
  } finally {
    fs.rmSync(runtimeDirectory, { recursive: true, force: true });
  }

  const completed = results.filter((entry) => entry.completed);
  const aggregate = aggregateScores(completed);
  const completionRate = completed.length / entries.length;
  const latencies = results.map((entry) => entry.latencyMs);
  const totalAudioMilliseconds = entries.reduce(
    (total, entry) => total + (entry.durationSeconds * 1000),
    0
  );
  const summary = {
    purpose: 'synthetic-integration-smoke',
    provider: 'gemini',
    model: transcriber.model,
    cases: entries.length,
    completed: completed.length,
    completionRate: rounded(completionRate),
    wer: rounded(aggregate.wer),
    cer: rounded(aggregate.cer),
    criticalSpanRecall: rounded(aggregate.criticalAccuracy),
    negationSpanRecall: rounded(aggregate.negationAccuracy),
    latencyMs: {
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: Math.max(...latencies),
    },
    realTimeFactor: rounded(
      results.reduce((total, entry) => total + entry.latencyMs, 0) / totalAudioMilliseconds
    ),
    gates: {
      completionAbove90Percent: completionRate > 0.9,
      workerProducedReadyDrafts: completed.length === entries.length,
      noDetectedCriticalContradictions: completed.every((entry) => (
        entry.criticalSpans.every((span) => !span.contradictionDetected)
      )),
    },
  };
  const commit = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim() || null;
  return {
    metadata: {
      createdAt: new Date().toISOString(),
      commit,
      corpusManifest: generated.manifestPath,
      corpusManifestSha256: sha256File(generated.manifestPath),
      corpusVersion: generated.corpusVersion,
      workingTreeCleanAtStart: true,
      promptSha256: crypto.createHash('sha256').update(TRANSCRIPTION_INSTRUCTION).digest('hex'),
      note: 'Synthetic smoke only; it does not approve Gemini for clinical audio.',
    },
    summary,
    results,
  };
}

async function main() {
  if (process.argv.includes('--probe')) {
    const outcome = await runProbe({ reportPath: argumentValue('report') });
    console.log(JSON.stringify(outcome, null, 2));
    if (!outcome.payloadAccepted) process.exitCode = 1;
    return;
  }

  const validateOnly = process.argv.includes('--validate-only');
  const count = integerArgument('count', 40);
  const delayMs = integerArgument('delay-ms', 4000);
  if (count < 30 || count > 40) throw new Error('count must be between 30 and 40');
  if (delayMs < 0) throw new Error('delay-ms cannot be negative');
  if (validateOnly) {
    const requestedManifest = argumentValue('corpus-manifest');
    const requestedOutput = argumentValue('corpus-output');
    const generated = requestedManifest
      ? loadGeneratedCorpus(requestedManifest)
      : generateCorpus({ outputDirectory: requestedOutput });
    try {
      validateCorpus(generated);
      console.log(JSON.stringify({
        mode: 'validate-only',
        purpose: 'synthetic-integration-smoke',
        corpusValid: true,
        cases: generated.entries.length,
        outputDirectory: generated.outputDirectory,
        retained: Boolean(requestedManifest || requestedOutput),
      }, null, 2));
    } finally {
      if (!requestedManifest && !requestedOutput) {
        fs.rmSync(generated.outputDirectory, { recursive: true, force: true });
      }
    }
    return;
  }

  const corpusManifest = argumentValue('corpus-manifest');
  const reportPath = argumentValue('report');
  if (!corpusManifest) throw new Error('Live smoke requires --corpus-manifest with fixed audio hashes');
  if (!reportPath) throw new Error('Live smoke requires --report so evidence is not discarded');
  const generated = loadGeneratedCorpus(corpusManifest);
  validateCorpus(generated);
  const report = await runLiveSmoke(generated, { count, delayMs });
  const absoluteReportPath = path.resolve(reportPath);
  fs.mkdirSync(path.dirname(absoluteReportPath), { recursive: true });
  fs.writeFileSync(absoluteReportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.summary, null, 2));
  if (!Object.values(report.summary.gates).every(Boolean)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(`Gemini smoke failed: ${error.message}`);
  process.exitCode = 1;
});
