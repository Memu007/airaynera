function maskValue(v) {
  if (v == null) return v;
  const s = String(v);
  if (s.length <= 4) return '****';
  return `${'*'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
}

function scrubBody(body) {
  const clone = { ...(body || {}) };
  const piiKeys = ['dni', 'documento', 'phone', 'telefono', 'email'];
  for (const k of Object.keys(clone)) {
    if (piiKeys.includes(k)) clone[k] = maskValue(clone[k]);
  }
  return clone;
}

const ENABLE_REQUEST_LOGGING = String(process.env.REQUEST_LOGGING || 'true').toLowerCase() === 'true';

function requestLogger(req, _res, next) {
  try {
    if (ENABLE_REQUEST_LOGGING) {
      const payload = scrubBody(req.body);
      const meta = { method: req.method, path: req.path, ip: req.ip, payload };
      // eslint-disable-next-line no-console
      console.log('[REQ]', JSON.stringify(meta));
    }
  } catch (_) {}
  next();
}

module.exports = { requestLogger };


