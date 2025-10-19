const crypto = require('crypto');

function getKey() {
  const raw = process.env.DATA_KEY || process.env.ENCRYPTION_KEY || '';
  if (!raw) return null;
  // Accept base64 or hex
  try {
    const buf = raw.includes('=') || raw.includes('/') || raw.includes('+')
      ? Buffer.from(raw, 'base64')
      : Buffer.from(raw, 'hex');
    if (buf.length !== 32) return null; // AES-256
    return buf;
  } catch (_) {
    return null;
  }
}

function encryptString(plain) {
  const key = getKey();
  if (!key) return { ct: null, iv: null, tag: null };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ct: enc.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

function decryptString(obj) {
  const key = getKey();
  if (!key) return '';
  if (!obj || !obj.ct || !obj.iv || !obj.tag) return '';
  const iv = Buffer.from(obj.iv, 'base64');
  const ct = Buffer.from(obj.ct, 'base64');
  const tag = Buffer.from(obj.tag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(ct), decipher.final()]);
  return dec.toString('utf8');
}

module.exports = { encryptString, decryptString, getKey };


