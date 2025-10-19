const jwt = require('jsonwebtoken');

function getSecret() {
  const s = process.env.JWT_SECRET || '';
  return s.length > 0 ? s : null;
}

function getPreviousSecret() {
  const s = process.env.JWT_PREVIOUS_SECRET || '';
  return s.length > 0 ? s : null;
}

function optionalAuth(req, _res, next) {
  try {
    const auth = req.headers.authorization || '';
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const secret = getSecret();
      if (secret) {
        req.user = jwt.verify(token, secret);
      }
    }
  } catch (_) {
    // ignore invalid token in optional mode
  }
  next();
}

function requireAuth(req, res, next) {
  const secret = getSecret();
  const enforce = String(process.env.REQUIRE_AUTH || 'true').toLowerCase() === 'true';
  if (!enforce) return next();
  if (!secret) return res.status(500).json({ error: 'SERVER_AUTH_MISCONFIGURED' });
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return res.status(401).json({ error: 'UNAUTHORIZED' });
  try {
    const token = auth.slice(7);
    try {
      req.user = jwt.verify(token, secret);
    } catch (err) {
      const prev = getPreviousSecret();
      if (!prev) throw err;
      req.user = jwt.verify(token, prev);
    }
    return next();
  } catch (_) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }
}

function issueDemoToken(payload = { sub: 'demo', role: 'admin' }, expiresIn = process.env.JWT_EXPIRES_IN || '2h') {
  const secret = getSecret();
  if (!secret) return null;
  return jwt.sign(payload, secret, { expiresIn });
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    const enforce = String(process.env.REQUIRE_AUTH || 'true').toLowerCase() === 'true';
    if (!enforce) return next();
    const user = req.user || {};
    if (allowed.includes(user.role)) return next();
    return res.status(403).json({ error: 'FORBIDDEN' });
  };
}

module.exports = { optionalAuth, requireAuth, issueDemoToken, requireRole, getSecret, getPreviousSecret };


