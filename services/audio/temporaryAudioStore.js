const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const MIME_ALIASES = new Map([
  ['audio/ogg', 'audio/ogg'],
  ['application/ogg', 'audio/ogg'],
  ['audio/webm', 'audio/webm'],
  ['video/webm', 'audio/webm'],
  ['audio/mpeg', 'audio/mpeg'],
  ['audio/mp3', 'audio/mpeg'],
  ['audio/mp4', 'audio/mp4'],
  ['audio/m4a', 'audio/mp4'],
  ['audio/x-m4a', 'audio/mp4'],
  ['audio/wav', 'audio/wav'],
  ['audio/wave', 'audio/wav'],
  ['audio/x-wav', 'audio/wav'],
  ['audio/aac', 'audio/aac'],
]);

function storageError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function configuredPositiveNumber(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function uploadDirectory() {
  if (process.env.AUDIO_UPLOAD_DIR) return path.resolve(process.env.AUDIO_UPLOAD_DIR);
  if (process.env.DATA_DIR) return path.join(path.resolve(process.env.DATA_DIR), 'audio-uploads');
  return path.join(__dirname, '..', '..', 'data', 'audio-uploads');
}

function maxUploadBytes() {
  return configuredPositiveNumber('AUDIO_UPLOAD_MAX_BYTES', 25 * 1024 * 1024);
}

function retentionMs() {
  return configuredPositiveNumber('AUDIO_UPLOAD_RETENTION_MS', 24 * 60 * 60 * 1000);
}

function normalizeDeclaredMimeType(value) {
  const mimeType = String(value || '').split(';', 1)[0].trim().toLowerCase();
  if (!mimeType || mimeType === 'application/octet-stream') return null;
  return MIME_ALIASES.get(mimeType) || null;
}

function detectMimeType(header) {
  if (header.length >= 4 && header.subarray(0, 4).toString('ascii') === 'OggS') {
    return 'audio/ogg';
  }
  if (header.length >= 4 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return 'audio/webm';
  }
  if (
    header.length >= 12
    && header.subarray(0, 4).toString('ascii') === 'RIFF'
    && header.subarray(8, 12).toString('ascii') === 'WAVE'
  ) {
    return 'audio/wav';
  }
  if (header.length >= 8 && header.subarray(4, 8).toString('ascii') === 'ftyp') {
    return 'audio/mp4';
  }
  if (header.length >= 3 && header.subarray(0, 3).toString('ascii') === 'ID3') {
    return 'audio/mpeg';
  }
  if (header.length >= 2 && header[0] === 0xff && (header[1] & 0xf6) === 0xf0) {
    return 'audio/aac';
  }
  if (header.length >= 2 && header[0] === 0xff && (header[1] & 0xe0) === 0xe0) {
    return 'audio/mpeg';
  }
  return null;
}

function referenceForId(id) {
  return `upload://${id}`;
}

function idFromReference(reference) {
  const match = /^upload:\/\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i
    .exec(String(reference || ''));
  return match ? match[1].toLowerCase() : null;
}

function isUploadReference(reference) {
  return Boolean(idFromReference(reference));
}

function pathForReference(reference) {
  const id = idFromReference(reference);
  if (!id) throw storageError('INVALID_AUDIO_REFERENCE', 'The audio reference is not a temporary upload');
  return path.join(uploadDirectory(), `${id}.audio`);
}

async function ensureUploadDirectory() {
  const directory = uploadDirectory();
  await fsp.mkdir(directory, { recursive: true, mode: 0o700 });
  await fsp.chmod(directory, 0o700).catch(() => {});
  return directory;
}

async function storeStream(readable, options = {}) {
  const limit = maxUploadBytes();
  const declaredLength = Number(options.contentLength);
  if (Number.isFinite(declaredLength) && declaredLength > limit) {
    throw storageError('AUDIO_FILE_TOO_LARGE', `Audio files cannot exceed ${limit} bytes`);
  }

  const directory = await ensureUploadDirectory();
  const id = crypto.randomUUID();
  const partPath = path.join(directory, `${id}.part`);
  const finalPath = path.join(directory, `${id}.audio`);
  let handle;

  try {
    handle = await fsp.open(partPath, 'wx', 0o600);
    const hash = crypto.createHash('sha256');
    const headerChunks = [];
    let headerLength = 0;
    let sizeBytes = 0;
    let position = 0;

    for await (const value of readable) {
      const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
      sizeBytes += chunk.length;
      if (sizeBytes > limit) {
        throw storageError('AUDIO_FILE_TOO_LARGE', `Audio files cannot exceed ${limit} bytes`);
      }
      if (headerLength < 16) {
        const slice = chunk.subarray(0, Math.min(chunk.length, 16 - headerLength));
        headerChunks.push(slice);
        headerLength += slice.length;
      }
      hash.update(chunk);

      let offset = 0;
      while (offset < chunk.length) {
        const result = await handle.write(chunk, offset, chunk.length - offset, position);
        offset += result.bytesWritten;
        position += result.bytesWritten;
      }
    }

    if (!sizeBytes) throw storageError('EMPTY_AUDIO_FILE', 'The uploaded audio file is empty');

    const detectedMimeType = detectMimeType(Buffer.concat(headerChunks, headerLength));
    if (!detectedMimeType) {
      throw storageError('UNSUPPORTED_AUDIO_TYPE', 'The uploaded file is not a supported audio container');
    }
    const rawDeclaredMimeType = String(options.declaredMimeType || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase();
    const declaredMimeType = normalizeDeclaredMimeType(options.declaredMimeType);
    if (rawDeclaredMimeType && rawDeclaredMimeType !== 'application/octet-stream' && !declaredMimeType) {
      throw storageError('UNSUPPORTED_AUDIO_TYPE', 'The declared audio type is not supported');
    }
    if (declaredMimeType && declaredMimeType !== detectedMimeType) {
      throw storageError('AUDIO_TYPE_MISMATCH', 'The file content does not match its declared audio type');
    }

    await handle.sync();
    await handle.close();
    handle = null;
    await fsp.rename(partPath, finalPath);

    return {
      reference: referenceForId(id),
      mimeType: detectedMimeType,
      sizeBytes,
      sha256: hash.digest('hex'),
      expiresAt: new Date(Date.now() + retentionMs()).toISOString(),
    };
  } catch (error) {
    if (handle) await handle.close().catch(() => {});
    await fsp.rm(partPath, { force: true }).catch(() => {});
    await fsp.rm(finalPath, { force: true }).catch(() => {});
    throw error;
  }
}

function verifyStoredMedia(reference, expected = {}) {
  const filePath = pathForReference(reference);
  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw storageError('AUDIO_FILE_MISSING', 'The temporary audio file is no longer available');
    }
    throw error;
  }
  if (!stat.isFile() || stat.size <= 0) {
    throw storageError('AUDIO_FILE_MISSING', 'The temporary audio file is not valid');
  }
  if (expected.sizeBytes != null && Number(expected.sizeBytes) !== stat.size) {
    throw storageError('AUDIO_FILE_CHANGED', 'The temporary audio file size changed');
  }
  if (expected.sha256) {
    const actualHash = crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    if (actualHash !== expected.sha256) {
      throw storageError('AUDIO_FILE_CHANGED', 'The temporary audio file content changed');
    }
  }
  return { path: filePath, sizeBytes: stat.size };
}

async function verifyStoredMediaAsync(reference, expected = {}, options = {}) {
  const filePath = pathForReference(reference);
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      throw storageError('AUDIO_FILE_MISSING', 'The temporary audio file is no longer available');
    }
    throw error;
  }
  if (!stat.isFile() || stat.size <= 0) {
    throw storageError('AUDIO_FILE_MISSING', 'The temporary audio file is not valid');
  }
  if (expected.sizeBytes != null && Number(expected.sizeBytes) !== stat.size) {
    throw storageError('AUDIO_FILE_CHANGED', 'The temporary audio file size changed');
  }
  if (expected.sha256) {
    const hash = crypto.createHash('sha256');
    for await (const chunk of fs.createReadStream(filePath)) {
      if (options.signal?.aborted) {
        throw storageError('AUDIO_PROCESSING_ABORTED', 'Audio processing lost its worker lease');
      }
      hash.update(chunk);
    }
    if (hash.digest('hex') !== expected.sha256) {
      throw storageError('AUDIO_FILE_CHANGED', 'The temporary audio file content changed');
    }
  }
  return { path: filePath, sizeBytes: stat.size };
}

function remove(reference) {
  if (!isUploadReference(reference)) return false;
  try {
    fs.rmSync(pathForReference(reference), { force: true });
    return true;
  } catch (_) {
    return false;
  }
}

async function cleanupOrphans(activeReferences, options = {}) {
  const directory = await ensureUploadDirectory();
  const activeIds = new Set(
    Array.from(activeReferences || []).map(idFromReference).filter(Boolean)
  );
  const olderThanMs = Number.isFinite(options.olderThanMs)
    ? Math.max(0, options.olderThanMs)
    : retentionMs();
  const now = Date.now();
  let removed = 0;

  for (const entry of await fsp.readdir(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const match = /^([0-9a-f-]{36})\.(audio|part)$/i.exec(entry.name);
    if (!match) continue;
    if (entry.name.endsWith('.audio') && activeIds.has(match[1].toLowerCase())) continue;
    const filePath = path.join(directory, entry.name);
    const stat = await fsp.stat(filePath).catch(() => null);
    if (!stat || now - stat.mtimeMs < olderThanMs) continue;
    await fsp.rm(filePath, { force: true });
    removed += 1;
  }
  return removed;
}

module.exports = {
  cleanupOrphans,
  isUploadReference,
  maxUploadBytes,
  normalizeDeclaredMimeType,
  pathForReference,
  remove,
  retentionMs,
  storeStream,
  uploadDirectory,
  verifyStoredMedia,
  verifyStoredMediaAsync,
};
