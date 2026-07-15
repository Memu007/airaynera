#!/usr/bin/env node

const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(
  ROOT_DIR,
  'benchmarks',
  'audio',
  'synthetic-smoke-v1',
  'manifest.json'
);

function argumentValue(name) {
  const prefix = `--${name}=`;
  const inline = process.argv.find((argument) => argument.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : null;
}

function parseWavDuration(filePath) {
  const buffer = fs.readFileSync(filePath);
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    throw new Error(`${filePath} is not a RIFF WAV file`);
  }
  let offset = 12;
  let bytesPerSecond = 0;
  let dataBytes = 0;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const contentOffset = offset + 8;
    if (chunkId === 'fmt ' && chunkSize >= 16) bytesPerSecond = buffer.readUInt32LE(contentOffset + 8);
    if (chunkId === 'data') dataBytes += Math.min(chunkSize, buffer.length - contentOffset);
    offset = contentOffset + chunkSize + (chunkSize % 2);
  }
  if (!bytesPerSecond || !dataBytes) throw new Error(`${filePath} has no usable audio data`);
  return dataBytes / bytesPerSecond;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${path.basename(command)} failed: ${result.stderr || result.stdout || result.error}`);
  }
}

function prepareOutputDirectory(requestedOutput) {
  if (!requestedOutput) return fs.mkdtempSync(path.join(os.tmpdir(), 'aira-gemini-smoke-v1-'));
  const outputDirectory = path.resolve(requestedOutput);
  if (fs.existsSync(outputDirectory) && fs.readdirSync(outputDirectory).length) {
    throw new Error(`Output directory must be empty: ${outputDirectory}`);
  }
  fs.mkdirSync(outputDirectory, { recursive: true });
  return outputDirectory;
}

function generateCorpus(options = {}) {
  if (process.platform !== 'darwin') {
    throw new Error('Synthetic speech generation currently requires macOS voices (`say`)');
  }
  const manifest = JSON.parse(fs.readFileSync(options.manifestPath || MANIFEST_PATH, 'utf8'));
  const outputDirectory = prepareOutputDirectory(options.outputDirectory);
  const audioDirectory = path.join(outputDirectory, 'audio');
  fs.mkdirSync(audioDirectory, { recursive: true });
  const entries = [];

  for (const testCase of manifest.cases) {
    for (const variant of manifest.variants) {
      const baseName = `${testCase.id}--${variant.id}`;
      const aiffPath = path.join(outputDirectory, `${baseName}.aiff`);
      const wavPath = path.join(audioDirectory, `${baseName}.wav`);
      try {
        run('/usr/bin/say', [
          '-v', variant.voice,
          '-r', String(variant.rate),
          '-o', aiffPath,
          testCase.reference,
        ]);
        const aiffSize = fs.statSync(aiffPath).size;
        if (aiffSize <= 4096) {
          throw new Error(
            `${baseName} has no speech samples; run the command from a macOS host session with voices available`
          );
        }
        run('/usr/bin/afconvert', [
          '-f', 'WAVE',
          '-d', 'LEI16@16000',
          '-c', '1',
          aiffPath,
          wavPath,
        ]);
      } finally {
        fs.rmSync(aiffPath, { force: true });
      }
      const bytes = fs.readFileSync(wavPath);
      if (bytes.length <= 4096) throw new Error(`${baseName} generated an unexpectedly small WAV`);
      entries.push({
        id: baseName,
        caseId: testCase.id,
        variantId: variant.id,
        voice: variant.voice,
        locale: variant.locale,
        rate: variant.rate,
        path: wavPath,
        mimeType: 'audio/wav',
        durationSeconds: Math.round(parseWavDuration(wavPath) * 1000) / 1000,
        sizeBytes: bytes.length,
        sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
        reference: testCase.reference,
        criticalSpans: testCase.criticalSpans,
      });
    }
  }

  const generated = {
    corpusVersion: manifest.version,
    language: manifest.language,
    synthetic: true,
    generatedAt: new Date().toISOString(),
    outputDirectory,
    entries,
  };
  const portableManifest = {
    ...generated,
    entries: entries.map((entry) => ({
      ...entry,
      path: path.relative(outputDirectory, entry.path),
    })),
  };
  fs.writeFileSync(
    path.join(outputDirectory, 'generated-manifest.json'),
    `${JSON.stringify(portableManifest, null, 2)}\n`
  );
  return generated;
}

function main() {
  const generated = generateCorpus({ outputDirectory: argumentValue('output') });
  console.log(JSON.stringify({
    generated: generated.entries.length,
    outputDirectory: generated.outputDirectory,
    totalDurationSeconds: Math.round(
      generated.entries.reduce((total, entry) => total + entry.durationSeconds, 0) * 10
    ) / 10,
  }, null, 2));
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Corpus generation failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { generateCorpus, parseWavDuration };
