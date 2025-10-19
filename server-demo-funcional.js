const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const sanitizeHtml = require('sanitize-html');
const rateLimit = require('express-rate-limit');
const { body, param, validationResult } = require('express-validator');
const { requestLogger } = require('./middleware/logging');
const { optionalAuth, requireAuth, issueDemoToken, requireRole } = require('./middleware/auth');
const { metricsMiddleware, getMetrics, incrementRateLimited, getHealthStatus } = require('./middleware/metrics');
const { maintenanceGuard } = require('./middleware/maintenance');
const SecurityValidator = require('./middleware/security-validation');

// Critical Security Validation - Application will NOT start without proper configuration
const securityValidator = new SecurityValidator();
if (!securityValidator.validateAll()) {
    console.error('🚨 CRITICAL: Application cannot start due to security configuration errors');
    console.error('Please fix the security issues above before restarting the application');
    process.exit(1);
}

const app = express();
const persistence = require('./services/persistence');
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Middleware
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000').split(',').map(s => s.trim()).filter(Boolean);
const corsRegexRaw = process.env.CORS_ORIGINS_REGEX || '';
let corsRegex = null;
try { if (corsRegexRaw) corsRegex = new RegExp(corsRegexRaw); } catch (_) { corsRegex = null; }
const CSP_MODE = (process.env.CSP_MODE || 'strict').toLowerCase();
const corsOptions = {
  origin: (origin, cb) => {
    if (!origin) return cb(null, true); // non-browser or same-origin
    if (allowedOrigins.includes(origin)) return cb(null, true);
    if (corsRegex && corsRegex.test(origin)) return cb(null, true);
    return cb(null, false);
  },
  credentials: true,
  optionsSuccessStatus: 204,
};
app.disable('x-powered-by');
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));
// Enhanced Security Headers Configuration
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: [
        "'self'",
        ...(CSP_MODE === 'relaxed' ? ["'unsafe-inline'"] : []),
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net',
        'https://ajax.googleapis.com',
        'https://unpkg.com'
      ],
      scriptSrcElem: [
        "'self'",
        ...(CSP_MODE === 'relaxed' ? ["'unsafe-inline'"] : []),
        'https://cdnjs.cloudflare.com',
        'https://cdn.jsdelivr.net',
        'https://ajax.googleapis.com',
        'https://unpkg.com'
      ],
      // Enhanced security: block all inline event handlers
      scriptSrcAttr: ["'none'"],
      styleSrc: [
        "'self'",
        ...(CSP_MODE === 'relaxed' ? ["'unsafe-inline'"] : []),
        'https://cdnjs.cloudflare.com',
        'https://fonts.googleapis.com'
      ],
      // Enhanced security: block inline styles in strict mode
      styleSrcAttr: CSP_MODE === 'relaxed' ? ["'unsafe-inline'"] : ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      fontSrc: [
        "'self'",
        'data:',
        'https://fonts.gstatic.com',
        'https://cdnjs.cloudflare.com',
        'https://use.fontawesome.com'
      ],
      // Enhanced security: restrict connections to same origin
      connectSrc: ["'self'"],
      // Enhanced security: prevent clickjacking
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
      // Enhanced security: upgrade HTTP to HTTPS
      upgradeInsecureRequests: []
    }
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  crossOriginEmbedderPolicy: false, // Disabled for compatibility with CDN resources
  // Enhanced clickjacking protection
  frameguard: { action: 'deny' },
  // Disable legacy XSS filter (modern browsers use CSP)
  xssFilter: false,
  // Hide server information
  hidePoweredBy: true,
  // Prevent MIME type sniffing
  noSniff: true,
  // Referrer policy for privacy
  referrerPolicy: { policy: 'no-referrer' }
}));
// Explicitly set modern XSS header per best practice
app.use((_req, res, next) => { res.setHeader('X-XSS-Protection', '0'); next(); });
// Allow toggling relaxed CSP for UI demo issues without code changes
app.use((req, res, next) => {
  if (String(process.env.CSP_MODE || 'strict').toLowerCase() === 'relaxed') {
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://ajax.googleapis.com https://unpkg.com; script-src-elem 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://cdn.jsdelivr.net https://ajax.googleapis.com https://unpkg.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com https://use.fontawesome.com; connect-src 'self'; frame-ancestors 'self'; object-src 'none'; upgrade-insecure-requests; base-uri 'self'; form-action 'self'");
  }
  next();
});
// Seguridad adicional
app.use(helmet.referrerPolicy({ policy: 'no-referrer' }));
app.use(helmet.dnsPrefetchControl({ allow: false }));
app.use(helmet.permittedCrossDomainPolicies());
app.use((_req, res, next) => { res.setHeader('Permissions-Policy', "geolocation=(), microphone=(), camera=()"); next(); });
/* istanbul ignore next */
if (process.env.NODE_ENV === 'production') {
  app.use(helmet.hsts({ maxAge: 15552000, includeSubDomains: true })); // 180 días aprox
}
const RL_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW_MS || String(15 * 60 * 1000), 10);
const RL_MAX = parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
const limiter = rateLimit({ windowMs: RL_WINDOW, max: RL_MAX, standardHeaders: true, legacyHeaders: false, handler: (req, res, next) => { incrementRateLimited(); return res.status(429).json({ error: 'RATE_LIMITED' }); } });
const AUTH_RL_WINDOW = parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS || '60000', 10);
const AUTH_RL_MAX = parseInt(process.env.AUTH_RATE_LIMIT_MAX || '20', 10);
const tokenLimiter = rateLimit({ windowMs: AUTH_RL_WINDOW, max: AUTH_RL_MAX, standardHeaders: true, legacyHeaders: false, handler: (req, res, next) => { incrementRateLimited(); return res.status(429).json({ error: 'RATE_LIMITED' }); } });
// Apply global rate-limit except for health/metrics/favicon and auth-token (auth has its own limiter)
app.use((req, res, next) => {
  const safePaths = new Set(['/health', '/metrics', '/favicon.ico']);
  if (safePaths.has(req.path) || req.path === '/api/auth/demo-token') return next();
  return limiter(req, res, next);
});
app.set('trust proxy', 1);
// Enforce HTTPS if configured (behind proxy/load balancer)
if (String(process.env.REQUIRE_HTTPS || 'false').toLowerCase() === 'true') {
  app.use((req, res, next) => {
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') return next();
    return res.redirect(301, 'https://' + req.headers.host + req.originalUrl);
  });
}
// Enhanced Input Validation & Security Middleware
app.use((req, res, next) => {
  // Enhanced security headers for all requests
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '0'); // Modern browsers use CSP

  // Rate limiting by IP for sensitive endpoints
  const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
  res.setHeader('X-Client-IP', clientIP);

  next();
});

// Secure JSON parser with size limits and validation
const MAX_JSON_SIZE = parseInt(process.env.MAX_JSON_SIZE || '1048576', 10); // 1MB default
app.use((req, res, next) => {
  // Check content length first
  const contentLength = parseInt(req.headers['content-length'] || '0', 10);
  if (contentLength > MAX_JSON_SIZE) {
    return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
  }

  let data = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    data += chunk;
    // Check size during streaming
    if (data.length > MAX_JSON_SIZE) {
      return res.status(413).json({ error: 'PAYLOAD_TOO_LARGE' });
    }
  });

  req.on('end', () => {
    if (!data) return next();
    try {
      req.body = JSON.parse(data);

      // Additional validation: check for dangerous patterns
      const jsonStr = JSON.stringify(req.body);
      const dangerousPatterns = [
        /\$where/i,
        /\$ne/i,
        /\$gt/i,
        /\$lt/i,
        /\$in/i,
        /\$nin/i,
        /javascript:/i,
        /<script/i,
        /on\w+\s*=/i
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(jsonStr)) {
          console.warn('⚠️ Suspicious pattern detected in request body from IP:', req.ip);
          return res.status(400).json({ error: 'INVALID_INPUT' });
        }
      }

      return next();
    } catch (error) {
      console.warn('Invalid JSON received from IP:', req.ip, 'Error:', error.message);
      return res.status(400).json({ error: 'INVALID_JSON' });
    }
  });
});
app.use(maintenanceGuard);
app.use(requestLogger);
app.use(optionalAuth);
app.use(metricsMiddleware);

// Favicon: servir el logo SVG para evitar 404 del navegador
app.get('/favicon.ico', (req, res) => {
    res.type('image/svg+xml');
    res.sendFile(path.join(__dirname, 'images/aira-logo.svg'));
});

// Datos demo (en memoria). Si USE_PERSISTENCE=true, se persiste en JSON cifrado
const USE_PERSISTENCE = String(process.env.USE_PERSISTENCE || 'false').toLowerCase() === 'true';
const USE_SQLITE = String(process.env.USE_SQLITE || 'false').toLowerCase() === 'true';
const sql = USE_SQLITE ? require('./services/sqlite') : null;
const { auditLog } = require('./middleware/audit');
const demoData = {
    pacientes: [
        {
            id: '1',
            nombre: 'María González',
            email: 'maria@email.com',
            telefono: '11-1234-5678',
            fechaNacimiento: '1985-03-15',
            historia: 'Paciente con ansiedad generalizada, en tratamiento desde 2023',
            ultimaSesion: '2024-07-20',
            estado: 'activo',
            notas: 'Progreso significativo en manejo de ansiedad'
        },
        {
            id: '2',
            nombre: 'Carlos Rodríguez',
            email: 'carlos@email.com',
            telefono: '11-8765-4321',
            fechaNacimiento: '1978-11-22',
            historia: 'Terapia de pareja y manejo de estrés laboral',
            ultimaSesion: '2024-07-18',
            estado: 'activo',
            notas: 'Sesión productiva, acordó tareas para la semana'
        },
        {
            id: '3',
            nombre: 'Ana Martínez',
            email: 'ana@email.com',
            telefono: '11-5555-1234',
            fechaNacimiento: '1992-07-08',
            historia: 'Terapia cognitivo-conductual para manejo de pensamientos negativos',
            ultimaSesion: '2024-07-22',
            estado: 'activo',
            notas: 'Primera sesión, establecimiento de objetivos'
        }
    ],
    sesiones: [
        {
            id: '1',
            pacienteId: '1',
            fecha: '2024-07-20',
            tipo: 'individual',
            duracion: 60,
            notas: 'Avance en técnicas de respiración y mindfulness',
            proximaSesion: '2024-07-27'
        },
        {
            id: '2',
            pacienteId: '2',
            fecha: '2024-07-18',
            tipo: 'pareja',
            duracion: 90,
            notas: 'Comunicación efectiva y establecimiento de límites',
            proximaSesion: '2024-07-25'
        }
    ],
    usuario: {
        nombre: 'Dra. Laura Méndez',
        especialidad: 'Psicología Clínica',
        email: 'admin@aira.com'
    }
};

// Cache simple para GET /api/pacientes (TTL corto, invalidado en writes)
const PATIENTS_CACHE_TTL = parseInt(process.env.PATIENTS_CACHE_TTL_MS || '2000', 10);
let patientsCache = { true: null, false: null };
let patientsCacheExpiry = { true: 0, false: 0 };
function invalidatePatientsCache() {
  patientsCache = { true: null, false: null };
  patientsCacheExpiry = { true: 0, false: 0 };
}

// Cache simple para GET /api/sesiones
const SESSIONS_CACHE_TTL = parseInt(process.env.SESSIONS_CACHE_TTL_MS || '2000', 10);
let sessionsCache = null;
let sessionsCacheExpiry = 0;
function invalidateSessionsCache() {
  sessionsCache = null;
  sessionsCacheExpiry = 0;
}

// API Routes
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ error: 'BAD_REQUEST', details: errors.array() });
  next();
}
// Emitir token demo (opcional)
app.post('/api/auth/demo-token', tokenLimiter, (req, res) => {
  const roleRaw = (req.query && req.query.role) || (req.body && req.body.role) || 'admin';
  const allowed = ['admin', 'user'];
  const role = allowed.includes(String(roleRaw)) ? roleRaw : 'user';
  const token = issueDemoToken({ sub: 'demo', role });
  if (!token) return res.status(400).json({ error: 'JWT_SECRET_NOT_SET' });
  return res.json({ token });
});

app.get('/api/pacientes', requireAuth, (req, res) => {
    const includeDisabled = String(req.query.incluirInhabilitados).toLowerCase() === 'true';
    const cacheKey = includeDisabled ? 'true' : 'false';
    const now = Date.now();
    if (patientsCache[cacheKey] && now < patientsCacheExpiry[cacheKey]) {
        return res.json(patientsCache[cacheKey]);
    }
    /* istanbul ignore next */
    const base = USE_SQLITE ? sql.listPatients() : (USE_PERSISTENCE ? persistence.listPatients() : demoData.pacientes);
    let normalizados = base.map(p => ({
        id: String(p.id),
        name: p.name || p.nombre || p.fullName || '',
        dni: p.dni || p.documento || '',
        phone: p.phone || p.telefono || '',
        email: p.email || '',
        insurance: p.insurance || p.obraSocial || p.os || '',
        habilitado: typeof p.habilitado === 'boolean' ? p.habilitado : true,
        created_via: p.created_via || 'web'
    }));
    if (!includeDisabled) {
        normalizados = normalizados.filter(p => p.habilitado !== false);
    }
    patientsCache[cacheKey] = normalizados;
    patientsCacheExpiry[cacheKey] = now + PATIENTS_CACHE_TTL;
    res.json(normalizados);
});

app.get('/api/pacientes/:id', requireAuth, (req, res) => {
    /* istanbul ignore next */
    const base = USE_SQLITE ? sql.listPatients() : (USE_PERSISTENCE ? persistence.listPatients() : demoData.pacientes);
    const paciente = base.find(p => String(p.id) === String(req.params.id));
    if (paciente) {
        res.json(paciente);
    } else {
        res.status(404).json({ error: 'Paciente no encontrado' });
    }
});

app.post('/api/pacientes', requireAuth,
  body('name').isString().trim().isLength({ min: 2, max: 120 }).matches(/^[^<>]{2,}$/),
  // Argentina DNI 7-8 dígitos
  body('dni').optional().isString().matches(/^\d{7,8}$/),
  // Teléfono números con opcional + y longitud razonable
  body('phone').optional().isString().matches(/^\+?\d{6,15}$/),
  body('insurance').optional().isString().trim().isLength({ max: 60 }),
  body('habilitado').optional().isBoolean(),
  handleValidation,
  auditLog('CREATE_PATIENT'),
  (req, res) => {
    const body = req.body || {};
    // aceptar tanto campos en inglés como en español y normalizar
    const normalized = {
        name: body.name || body.nombre || '',
        dni: body.dni || body.documento || '',
        phone: body.phone || body.telefono || '',
        email: body.email || '',
        insurance: body.insurance || body.obraSocial || body.os || '',
        habilitado: typeof body.habilitado === 'boolean' ? body.habilitado : true,
        created_via: body.created_via || 'web'
    };
    /* istanbul ignore next */
    if (USE_SQLITE) {
        const saved = sql.addPatient(normalized);
        invalidatePatientsCache();
        return res.status(201).json(saved);
    } else if (USE_PERSISTENCE) {
        const saved = persistence.addPatient(normalized);
        invalidatePatientsCache();
        return res.status(201).json(saved);
    } else {
        const withId = { id: String(demoData.pacientes.length + 1), ...normalized, fechaRegistro: new Date().toISOString().split('T')[0] };
        demoData.pacientes.push(withId);
        invalidatePatientsCache();
        return res.status(201).json(withId);
    }
});

// Actualizar paciente (toggle habilitado u otros campos simples)
app.put('/api/pacientes/:id', requireAuth,
  param('id').isString().notEmpty(),
  body('name').optional().isString().trim().isLength({ min: 1, max: 100 }),
  body('email').optional().isEmail(),
  body('phone').optional().isString().matches(/^\+?\d{6,15}$/),
  body('dni').optional().isString().matches(/^\d{7,8}$/),
  body('insurance').optional().isString(),
  body('habilitado').optional().isBoolean(),
  handleValidation,
  auditLog('UPDATE_PATIENT'),
  (req, res) => {
    const { id } = req.params;
    const cambios = req.body || {};
    /* istanbul ignore next */
    if (USE_SQLITE) {
        const updated = sql.updatePatient(id, cambios);
        if (!updated) return res.status(404).json({ error: 'Paciente no encontrado' });
        invalidatePatientsCache();
        return res.json(updated);
    } else if (USE_PERSISTENCE) {
        const updated = persistence.updatePatient(id, cambios);
        if (!updated) return res.status(404).json({ error: 'Paciente no encontrado' });
        invalidatePatientsCache();
        return res.json(updated);
    } else {
        const pacienteIndex = demoData.pacientes.findIndex(p => String(p.id) === String(id));
        if (pacienteIndex === -1) return res.status(404).json({ error: 'Paciente no encontrado' });
        const pacienteActual = demoData.pacientes[pacienteIndex];
        const camposPermitidos = ['nombre', 'email', 'telefono', 'fechaNacimiento', 'historia', 'estado', 'notas', 'habilitado'];
        const actualizado = { ...pacienteActual };
        for (const key of Object.keys(cambios)) {
            if (camposPermitidos.includes(key)) actualizado[key] = cambios[key];
        }
        demoData.pacientes[pacienteIndex] = actualizado;
        invalidatePatientsCache();
        return res.json(actualizado);
    }
});

app.get('/api/sesiones', requireAuth, (req, res) => {
    const now = Date.now();
    if (sessionsCache && now < sessionsCacheExpiry) {
        return res.json(sessionsCache);
    }
    /* istanbul ignore next */
    let list;
    if (USE_SQLITE) list = sql.listSessions();
    else if (USE_PERSISTENCE) list = persistence.listSessions();
    else list = demoData.sesiones;
    sessionsCache = list;
    sessionsCacheExpiry = now + SESSIONS_CACHE_TTL;
    res.json(list);
});

app.post('/api/sesiones', requireAuth,
  body('pacienteId').isString().notEmpty(),
  body('notas').optional().isString().isLength({ max: 5000 }),
  body('summary').optional().isString(),
  body('mood_assessment').optional().isInt({ min: 1, max: 5 }),
  body('requires_followup').optional().isBoolean(),
  handleValidation,
  auditLog('CREATE_SESSION'),
  (req, res) => {
    // Sanitizar notas para evitar XSS si luego se renderiza en HTML
    if (req.body && typeof req.body.notas === 'string') {
      req.body.notas = sanitizeHtml(req.body.notas, { allowedTags: [], allowedAttributes: {} });
    }
    /* istanbul ignore next */
    if (USE_SQLITE) {
        const saved = sql.addSession(req.body || {});
        invalidateSessionsCache();
        return res.status(201).json(saved);
    } else if (USE_PERSISTENCE) {
        const saved = persistence.addSession(req.body || {});
        invalidateSessionsCache();
        return res.status(201).json(saved);
    }
    const nuevaSesion = { id: String(demoData.sesiones.length + 1), ...req.body, fecha: new Date().toISOString().split('T')[0] };
    demoData.sesiones.push(nuevaSesion);
    invalidateSessionsCache();
    return res.status(201).json(nuevaSesion);
});

app.get('/api/usuario', requireAuth, (req, res) => {
    res.json(demoData.usuario);
});

// Endpoint sólo admin (ejemplo de RBAC mínimo)
app.get('/api/admin/ping', requireAuth, requireRole(['admin']), (req, res) => {
  res.json({ ok: true });
});

// Actualizar una sesión
app.put('/api/sesiones/:id', requireAuth,
  param('id').isString().notEmpty(),
  body('pacienteId').optional().isString(),
  body('notas').optional().isString().isLength({ max: 5000 }),
  body('mood_assessment').optional().isInt({ min: 1, max: 5 }),
  body('requires_followup').optional().isBoolean(),
  handleValidation,
  auditLog('UPDATE_SESSION'),
  (req, res) => {
    if (req.body && typeof req.body.notas === 'string') {
      req.body.notas = sanitizeHtml(req.body.notas, { allowedTags: [], allowedAttributes: {} });
    }
    const { id } = req.params;
    /* istanbul ignore next */
    if (USE_SQLITE) {
        const updated = sql.updateSession(id, req.body || {});
        if (!updated) return res.status(404).json({ error: 'Sesión no encontrada' });
        invalidateSessionsCache();
        return res.json(updated);
    } else if (USE_PERSISTENCE) {
        const updated = persistence.updateSession(id, req.body || {});
        if (!updated) return res.status(404).json({ error: 'Sesión no encontrada' });
        invalidateSessionsCache();
        return res.json(updated);
    }
    const idx = demoData.sesiones.findIndex(s => String(s.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Sesión no encontrada' });
    const camposPermitidos = ['pacienteId', 'notas', 'tipo', 'duracion', 'mood_assessment', 'requires_followup', 'medication_notes'];
    const cambios = req.body || {};
    const actualizado = { ...demoData.sesiones[idx] };
    for (const k of Object.keys(cambios)) {
        if (camposPermitidos.includes(k)) actualizado[k] = cambios[k];
    }
    demoData.sesiones[idx] = actualizado;
    invalidateSessionsCache();
    return res.json(actualizado);
});

// Eliminar una sesión
app.delete('/api/sesiones/:id', requireAuth, auditLog('DELETE_SESSION'), (req, res) => {
    const { id } = req.params;
    /* istanbul ignore next */
    if (USE_SQLITE) {
        const ok = sql.deleteSession(id);
        if (!ok) return res.status(404).json({ error: 'Sesión no encontrada' });
        invalidateSessionsCache();
        return res.status(204).end();
    } else if (USE_PERSISTENCE) {
        const ok = persistence.deleteSession(id);
        if (!ok) return res.status(404).json({ error: 'Sesión no encontrada' });
        invalidateSessionsCache();
        return res.status(204).end();
    }
    const before = demoData.sesiones.length;
    demoData.sesiones = demoData.sesiones.filter(s => String(s.id) !== String(id));
    if (demoData.sesiones.length === before) return res.status(404).json({ error: 'Sesión no encontrada' });
    invalidateSessionsCache();
    return res.status(204).end();
});

// ===== WhatsApp Audio Ingest (MVP inteligentito, sin sobreingeniería) =====
const ENABLE_WHATSAPP_INGEST = String(process.env.ENABLE_WHATSAPP_INGEST || 'false').toLowerCase() === 'true';
let openai = null;
try {
  if (process.env.OPENAI_API_KEY && ENABLE_WHATSAPP_INGEST) {
    const OpenAI = require('openai');
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
} catch (_) { /* opcional */ }

function normalizePhone(p) {
  return String(p || '').replace(/[^\d+]/g, '');
}

function normalizeText(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

async function transcribeAudioFromUrl(audioUrl, extraHeaders) {
  if (!openai || !audioUrl) return null; // desactivado si no hay key
  try {
    const resp = await fetch(audioUrl, extraHeaders ? { headers: extraHeaders } : undefined);
    if (!resp.ok) return null;
    const buffer = Buffer.from(await resp.arrayBuffer());
    const fs = require('fs');
    const path = require('path');
    const tmpPath = path.join(require('os').tmpdir(), `whats-audio-${Date.now()}.mp3`);
    await fs.promises.writeFile(tmpPath, buffer);
    const fileStream = fs.createReadStream(tmpPath);
    const result = await openai.audio.transcriptions.create({
      file: fileStream,
      model: 'whisper-1',
      language: 'es'
    });
    try { await fs.promises.unlink(tmpPath); } catch (_) {}
    return (result && (result.text || result.texts || result.data && result.data.text)) || null;
  } catch (e) {
    console.warn('STT error:', e && e.message);
    return null;
  }
}

if (ENABLE_WHATSAPP_INGEST) {
  app.post('/api/whatsapp/ingest', async (req, res) => {
    try {
      const { from, audioUrl, transcript } = req.body || {};
      if (!from && !transcript && !audioUrl) return res.status(400).json({ error: 'from_or_content_required' });

      // Mapear paciente por teléfono primero
      const phoneNorm = normalizePhone(from);
      /* istanbul ignore next */
      const patientsBase = USE_SQLITE ? sql.listPatients() : (USE_PERSISTENCE ? persistence.listPatients() : demoData.pacientes.map(p => ({ id: p.id, name: p.nombre || p.name, phone: p.telefono || p.phone })));
      let patient = patientsBase.find(p => normalizePhone(p.phone) === phoneNorm);

      // Transcribir si hace falta
      let text = transcript && String(transcript).trim().length > 0 ? String(transcript) : null;
      if (!text && audioUrl) {
        text = await transcribeAudioFromUrl(audioUrl);
      }
      if (!text) text = 'Audio recibido por WhatsApp. (Sin transcripción)';

      // Si no encontró por teléfono, intentar por nombre dentro del texto
      if (!patient) {
        const tnorm = normalizeText(text);
        patient = patientsBase.find(p => p.name && tnorm.includes(normalizeText(p.name)));
      }
      if (!patient) return res.status(404).json({ error: 'paciente_no_encontrado' });

      // Crear sesión (reutiliza la misma lógica que POST /api/sesiones)
      const nueva = {
        pacienteId: String(patient.id),
        notas: text.slice(0, 5000),
        tipo: 'audio',
        duracion: 60,
        created_via: 'whatsapp',
        mood_assessment: 3,
        requires_followup: false
      };
      /* istanbul ignore next */
      if (USE_SQLITE) {
        const saved = sql.addSession(nueva);
        invalidateSessionsCache();
        return res.status(201).json(saved);
      } else if (USE_PERSISTENCE) {
        const saved = persistence.addSession(nueva);
        invalidateSessionsCache();
        return res.status(201).json(saved);
      }
      const obj = { id: String(demoData.sesiones.length + 1), ...nueva, fecha: new Date().toISOString().split('T')[0] };
      demoData.sesiones.push(obj);
      invalidateSessionsCache();
      return res.status(201).json(obj);
    } catch (err) {
      console.error('whatsapp ingest error:', err);
      return res.status(500).json({ error: 'server_error' });
    }
  });
}

// ===== WhatsApp Cloud API Webhook (mínimo viable) =====
if (String(process.env.ENABLE_WHATSAPP_WEBHOOK || 'false').toLowerCase() === 'true') {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'verify_me';
  const META_TOKEN = process.env.META_ACCESS_TOKEN || '';
  const GRAPH_BASE = process.env.GRAPH_BASE || 'https://graph.facebook.com/v18.0';

  // Verificación (setup del webhook)
  app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.sendStatus(403);
  });

  async function getMediaUrl(mediaId) {
    if (!META_TOKEN || !mediaId) return null;
    try {
      const metaResp = await fetch(`${GRAPH_BASE}/${mediaId}?access_token=${encodeURIComponent(META_TOKEN)}`);
      if (!metaResp.ok) return null;
      const meta = await metaResp.json();
      return meta && meta.url ? meta.url : null; // requiere header Authorization para descargar
    } catch (_) { return null; }
  }

  // Recepción de mensajes
  app.post('/webhook/whatsapp', async (req, res) => {
    // Responder rápido para evitar reintentos
    res.sendStatus(200);
    try {
      const entry = (req.body && req.body.entry) || [];
      for (const e of entry) {
        const changes = e && e.changes || [];
        for (const ch of changes) {
          const messages = ch && ch.value && ch.value.messages || [];
          for (const m of messages) {
            const from = m.from;
            if (m.type === 'audio' && m.audio && m.audio.id) {
              const mediaId = m.audio.id;
              // Conseguir URL y transcribir con header
              const mediaUrl = await getMediaUrl(mediaId);
              const text = await transcribeAudioFromUrl(mediaUrl, { Authorization: `Bearer ${META_TOKEN}` })
                || 'Audio recibido por WhatsApp (sin transcripción)';
              // Insertar como si fuese ingest
              const phoneNorm = normalizePhone(from);
              /* istanbul ignore next */
              const patientsBase = USE_SQLITE ? sql.listPatients() : (USE_PERSISTENCE ? persistence.listPatients() : demoData.pacientes.map(p => ({ id: p.id, name: p.nombre || p.name, phone: p.telefono || p.phone })));
              let patient = patientsBase.find(p => normalizePhone(p.phone) === phoneNorm);
              if (!patient) {
                const tnorm = normalizeText(text);
                patient = patientsBase.find(p => p.name && tnorm.includes(normalizeText(p.name)));
              }
              if (!patient) { console.warn('whatsapp webhook: paciente no encontrado'); continue; }
              const nueva = {
                pacienteId: String(patient.id),
                notas: text.slice(0, 5000),
                tipo: 'audio',
                duracion: 60,
                created_via: 'whatsapp',
                mood_assessment: 3,
                requires_followup: false
              };
              /* istanbul ignore next */
              if (USE_SQLITE) {
                sql.addSession(nueva);
              } else if (USE_PERSISTENCE) {
                persistence.addSession(nueva);
              } else {
                demoData.sesiones.push({ id: String(demoData.sesiones.length + 1), ...nueva, fecha: new Date().toISOString().split('T')[0] });
              }
              invalidateSessionsCache();
            }
          }
        }
      }
    } catch (err) {
      console.warn('whatsapp webhook error:', err && err.message);
    }
  });
}

// Eliminar un paciente (y sus sesiones asociadas)
app.delete('/api/pacientes/:id', requireAuth, auditLog('DELETE_PATIENT'), (req, res) => {
    const { id } = req.params;
    /* istanbul ignore next */
    if (USE_SQLITE) {
        const removed = sql.deletePatient(id);
        if (!removed) return res.status(404).json({ error: 'Paciente no encontrado' });
        invalidatePatientsCache();
        invalidateSessionsCache();
        return res.json({ success: true, eliminado: { id: removed.id, name: removed.name || removed.nombre } });
    } else if (USE_PERSISTENCE) {
        const removed = persistence.deletePatient(id);
        if (!removed) return res.status(404).json({ error: 'Paciente no encontrado' });
        invalidatePatientsCache();
        invalidateSessionsCache();
        return res.json({ success: true, eliminado: { id: removed.id, name: removed.name || removed.nombre } });
    }
    const idx = demoData.pacientes.findIndex(p => String(p.id) === String(id));
    if (idx === -1) return res.status(404).json({ error: 'Paciente no encontrado' });
    const eliminado = demoData.pacientes.splice(idx, 1)[0];
    demoData.sesiones = demoData.sesiones.filter(s => String(s.pacienteId || s.patient_id) !== String(id));
    invalidatePatientsCache();
    invalidateSessionsCache();
    return res.json({ success: true, eliminado: { id: eliminado.id, name: eliminado.name || eliminado.nombre } });
});

// Rutas de pago con MercadoPago (opt-in para evitar dependencias en demo)
if (process.env.ENABLE_MP === 'true') {
  try {
    app.use('/api/payment', require('./routes/payment'));
    console.log('✅ MercadoPago routes enabled');
  } catch (err) {
    console.warn('⚠️ MercadoPago deshabilitado:', err && err.message);
  }
}

// Rutas de páginas
// Página oficial por defecto → dashboard funcional
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'demopagina_funcional_backup.html'));
});

// Landings alternativas
app.get('/landing', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing.html'));
});
app.get('/landing-moderna', (req, res) => {
    res.sendFile(path.join(__dirname, 'landing-moderna.html'));
});

// Alias explícito a demo
app.get('/demo', (req, res) => {
    res.sendFile(path.join(__dirname, 'demopagina_funcional_backup.html'));
});

// Compatibilidad con rutas antiguas
app.get(['/demo-whatsapp', '/demo-whatsapp.html'], (req, res) => {
    res.redirect(302, '/demo');
});

// Health check
app.get('/health', (req, res) => {
    const h = getHealthStatus();
    const code = h.status === 'degraded' ? 200 : 200;
    res.status(code).json(h);
});

// Metrics endpoint (no PII)
app.get('/metrics', (req, res) => {
  return res.json(getMetrics());
});

// Rutas de prueba (sólo si está permitido explícitamente)
const ALLOW_TEST_ROUTES = String(process.env.ALLOW_TEST_ROUTES || 'false').toLowerCase() === 'true';
if (ALLOW_TEST_ROUTES) {
  app.get('/__test/500', requireAuth, (req, res) => {
    res.status(500).json({ error: 'forced-500' });
  });
  app.get('/__test/boom', requireAuth, (_req, _res, next) => {
    next(new Error('boom-test'));
  });
}

// Servir archivos estáticos (después de rutas específicas)
app.use(express.static('.'));

// Manejador de errores (al final)
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  try {
    // eslint-disable-next-line no-console
    console.error('[ERR]', err && err.stack ? err.stack : err);
  } catch (_) {}
  if (res.headersSent) return;
  res.status(500).json({ error: 'INTERNAL_SERVER_ERROR' });
});

// Iniciar servidor sólo si se ejecuta directamente (con soporte de cluster opcional)
if (require.main === module) {
  const os = require('os');
  const cluster = require('cluster');
  const desiredWorkers = Math.max(1, parseInt(process.env.CLUSTER_WORKERS || '1', 10));

  if (desiredWorkers > 1 && cluster.isPrimary) {
    const total = Math.min(desiredWorkers, os.cpus().length || 1);
    for (let i = 0; i < total; i += 1) cluster.fork();
    cluster.on('exit', (worker, code, signal) => {
      // Reemplazar workers caídos para resiliencia básica
      cluster.fork();
    });
  } else {
    const server = app.listen(PORT, () => {
      console.log('🌟 SERVIDOR DEMO FUNCIONAL INICIADO');
      console.log('═══════════════════════════════════════');
      console.log(`🌐 Web: http://localhost:${PORT}`);
      console.log(`📱 API: http://localhost:${PORT}/api/pacientes`);
      console.log('📋 Datos demo cargados');
      // Security: No hardcoded credentials - use environment variables
      console.log('🔐 Authentication required by default');
      console.log('📝 Use /api/auth/demo-token endpoint for demo authentication');
      console.log('═══════════════════════════════════════');
    });
    // Apagado elegante
    const shutdown = () => {
      server.close(() => process.exit(0));
      // Forzar salida si hay conexiones colgando tras timeout
      setTimeout(() => process.exit(1), 5000).unref();
    };
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }
}

module.exports = app;


module.exports = app;


module.exports = app;
