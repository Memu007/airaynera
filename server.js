/**
 * AIRA Medical System - Frontend Express Server
 * Servidor de desarrollo para visualización del nuevo sistema modular
 * HIPAA Compliance y seguridad médica integrada
 */

require('dotenv').config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const jwt = require("jsonwebtoken");
const { body, param, query, validationResult } = require("express-validator");

// JWT Secret - debe estar en .env en producción
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-in-production";
const JWT_EXPIRES = process.env.JWT_EXPIRES || "24h";

// Middleware para manejar errores de validación
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: "Datos inválidos", details: errors.array() });
  }
  next();
};

const app = express();
const PORT = process.env.PORT || 8080;

// Configuración de seguridad médica
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://fonts.googleapis.com",
          "https://cdnjs.cloudflare.com",
        ],
        fontSrc: [
          "'self'",
          "https://fonts.gstatic.com",
          "https://cdnjs.cloudflare.com",
        ],
        imgSrc: ["'self'", "data:", "https:"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "https://cdnjs.cloudflare.com",
          "https://cdn.jsdelivr.net",
          "https://code.jquery.com",
        ],
        scriptSrcAttr: ["'unsafe-inline'"],
        connectSrc: ["'self'", "https://cdnjs.cloudflare.com"],
        mediaSrc: ["'self'"],
        objectSrc: ["'none'"],
        childSrc: ["'none'"],
        frameSrc: ["'none'"],
        workerSrc: ["'self'"],
        manifestSrc: ["'self'"],
      },
    },
    hsts:
      process.env.NODE_ENV === "production"
        ? {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          }
        : false, // Desactivar HSTS en desarrollo
  })
);

// Rate limiting para seguridad - más permisivo en desarrollo
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: process.env.NODE_ENV === "production" ? 100 : 10000, // Más requests en desarrollo
  message: {
    error: "Too many requests from this IP, please try again later.",
    retryAfter: "15 minutes",
  },
  skip: (req) => {
    // Skip rate limiting para archivos estáticos en desarrollo
    if (process.env.NODE_ENV !== "production") {
      return (
        req.url.includes("/src/") ||
        req.url.includes(".js") ||
        req.url.includes(".css")
      );
    }
    return false;
  },
});

app.use(limiter);

// CORS configurado para desarrollo
app.use(
  cors({
    origin: process.env.NODE_ENV === "production" ? false : true,
    credentials: true,
  })
);

// Compression para mejor performance
app.use(compression());

// Parsear JSON y URL encoded
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging de requests (simplificado para desarrollo)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Runtime data (SQLite, temporary audio) must never be exposed by the broad static mount.
app.use('/data', (req, res) => res.status(404).json({ error: 'Route not found' }));

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Mock data para desarrollo
// Persistence Service (SQLite)
const sql = require("./services/sqlite");
const sessionDraftService = require("./services/sessionDraftService");
const audioDraftPipeline = require("./services/audioDraftPipeline");
const temporaryAudioStore = require("./services/audio/temporaryAudioStore");
const { listFixtures: listAudioFixtures } = require("./services/audio/fakeAudioProviders");
const whatsappLinkService = require("./services/whatsappLinkService");
const whatsappConversationService = require("./services/whatsappConversationService");

// Initialize DB tables
try {
  sql.getDb();
  console.log("✅ SQLite Database initialized successfully");
} catch (err) {
  console.error("❌ Failed to initialize SQLite database:", err);
  process.exit(1);
}

const SESSION_TYPE_ALIASES = {
  consulta: "individual",
  individual: "individual",
  grupal: "group",
  group: "group",
  familiar: "family",
  family: "family",
  pareja: "couple",
  couple: "couple",
  other: "other",
};

function issueToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      role: user.role || "doctor",
      dni: user.dni || "",
      specialty: user.specialty || "",
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined);
}

function normalizeSessionInput(req, res, next) {
  const input = req.body || {};
  const isCreate = req.method === "POST";
  const normalized = {};
  const patientId = firstDefined(input.patientId, input.pacienteId);
  const requestedType = firstDefined(input.sessionType, input.tipo);
  const cleanNote = firstDefined(input.cleanNote, input.notes, input.notas, input.summary);

  if (patientId !== undefined) normalized.patientId = patientId;
  if (input.clinicalDate !== undefined || input.fecha !== undefined) {
    normalized.clinicalDate = firstDefined(input.clinicalDate, input.fecha);
  }
  // Defaults are only injected when creating. On PATCH the raw value (including
  // null / false / an invalid type) must survive so the validator can reject it
  // instead of it being silently coerced into a default.
  if (requestedType !== undefined) {
    const aliased = requestedType != null ? SESSION_TYPE_ALIASES[requestedType] : undefined;
    normalized.sessionType = aliased || requestedType;
  } else if (isCreate) {
    normalized.sessionType = "individual";
  }
  if (input.durationMinutes !== undefined || input.duracion !== undefined) {
    normalized.durationMinutes = firstDefined(input.durationMinutes, input.duracion);
  }
  if (input.careModality !== undefined) {
    normalized.careModality = input.careModality;
  } else if (isCreate) {
    normalized.careModality = "unspecified";
  }
  if (cleanNote !== undefined) {
    normalized.cleanNote = cleanNote;
  } else if (isCreate) {
    normalized.cleanNote = "";
  }
  if (isCreate && (input.rawTranscript !== undefined || input.transcription !== undefined)) {
    normalized.rawTranscript = firstDefined(input.rawTranscript, input.transcription);
  }
  if (input.medicationNotes !== undefined || input.medication_notes !== undefined) {
    normalized.medicationNotes = firstDefined(input.medicationNotes, input.medication_notes);
  }
  if (input.moodAssessment !== undefined || input.mood_assessment !== undefined) {
    normalized.moodAssessment = firstDefined(input.moodAssessment, input.mood_assessment);
  }
  if (input.requiresFollowUp !== undefined || input.requires_followup !== undefined) {
    normalized.requiresFollowUp = firstDefined(input.requiresFollowUp, input.requires_followup);
  }
  if (isCreate && input.audioDurationSeconds !== undefined) {
    normalized.audioDurationSeconds = input.audioDurationSeconds;
  }
  if (isCreate) {
    normalized.inputType = firstDefined(
      input.inputType,
      input.rawTranscript || input.transcription ? "audio" : "text"
    );
  }
  req.body = normalized;
  next();
}

// A real calendar date, not just the YYYY-MM-DD shape: rejects 2026-02-31.
function isRealCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

// One clinical-field contract shared by POST and PATCH so both reject the same
// out-of-contract values instead of coercing them. Patient identity and the
// audio evidence fields are handled per route.
function clinicalSessionValidators() {
  return [
    body("clinicalDate").optional().custom(isRealCalendarDate)
      .withMessage("La fecha clínica debe existir en el calendario (YYYY-MM-DD)"),
    body("sessionType").optional().isIn(["individual", "group", "family", "couple", "other"])
      .withMessage("Tipo de sesión inválido"),
    body("careModality").optional().isIn(["inPerson", "video", "phone", "unspecified"])
      .withMessage("Modalidad inválida"),
    body("durationMinutes").optional({ nullable: true }).isInt({ min: 1, max: 480 })
      .withMessage("La duración debe ser un entero entre 1 y 480"),
    body("moodAssessment").optional({ nullable: true }).isInt({ min: 1, max: 5 })
      .withMessage("El ánimo debe ser un entero entre 1 y 5"),
    body("cleanNote").optional().isString().withMessage("La nota debe ser texto")
      .isLength({ max: 10000 }).withMessage("La nota supera el máximo permitido"),
    body("medicationNotes").optional({ nullable: true }).isString().withMessage("La medicación debe ser texto")
      .isLength({ max: 5000 }).withMessage("La medicación supera el máximo permitido"),
    body("requiresFollowUp").optional().custom((value) => typeof value === "boolean")
      .withMessage("El seguimiento debe ser un booleano"),
  ];
}

// A session's patient can never be reassigned through PATCH.
function rejectPatientReassignment(req, res, next) {
  const body = req.body || {};
  if (body.patientId !== undefined || body.pacienteId !== undefined) {
    return res.status(400).json({
      error: "PATIENT_REASSIGNMENT_NOT_ALLOWED",
      message: "No se puede reasignar el paciente de una sesión existente",
    });
  }
  next();
}

function toPersistenceSession(session) {
  return {
    ...session,
    pacienteId: session.patientId,
    source: "web",
  };
}

function sendDraftError(res, error) {
  const statusByCode = {
    INVALID_DRAFT: 400,
    PATIENT_NOT_FOUND: 404,
    DRAFT_NOT_FOUND: 404,
    DRAFT_NOT_READY: 409,
    DRAFT_CANCELLED: 409,
    INVALID_AUDIO_INPUT: 400,
    IDEMPOTENCY_CONFLICT: 409,
    DRAFT_NOT_PROCESSABLE: 409,
    PROCESSING_ALREADY_CLAIMED: 409,
    AUDIO_PROVIDER_NOT_CONFIGURED: 503,
    EMPTY_AUDIO_FILE: 400,
    AUDIO_FILE_TOO_LARGE: 413,
    UNSUPPORTED_AUDIO_TYPE: 415,
    AUDIO_TYPE_MISMATCH: 415,
    INVALID_AUDIO_REFERENCE: 400,
    AUDIO_FILE_MISSING: 410,
    AUDIO_FILE_CHANGED: 409,
  };
  const status = statusByCode[error.code] || 500;
  if (status === 500) console.error('Session draft error:', error);
  return res.status(status).json({
    error: error.code || 'DRAFT_ERROR',
    message: status === 500 ? 'Unable to process session draft' : error.message,
  });
}

function publicAudioProcessing(job) {
  if (!job) return null;
  return {
    id: job.id,
    draftId: job.draftId,
    status: job.status,
    attempts: job.attempts,
    failure: job.failure,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    finishedAt: job.finishedAt,
  };
}

function sendWhatsappError(res, error) {
  const statusByCode = {
    INVALID_PHONE: 400,
    INVALID_LINK_COMMAND: 400,
    INVALID_LINK_CODE: 400,
    PHONE_MISMATCH: 409,
    PHONE_ALREADY_IN_USE: 409,
    WHATSAPP_ALREADY_LINKED: 409,
    LINK_CODE_EXPIRED: 410,
    WHATSAPP_NOT_LINKED: 409,
    MESSAGE_ID_CONFLICT: 409,
  };
  const status = statusByCode[error.code] || 500;
  if (status === 500) console.error('WhatsApp link error:', error);
  return res.status(status).json({
    error: error.code || 'WHATSAPP_LINK_ERROR',
    message: status === 500 ? 'Unable to process WhatsApp link' : error.message,
  });
}

// Helpers that keep the public API canonical while SQLite remains compatible.
function normalizePatient(p) {
  return {
    id: String(p.id),
    name: p.name,
    email: p.email,
    phone: p.phone,
    dni: p.dni,
    insurance: p.insurance,
    status: p.habilitado ? "active" : "inactive",
    source: p.created_via || "web",
    createdAt: p.created_at || null,
    updatedAt: p.updated_at || p.created_at || null,
    lastSessionDate: p.last_session_date || null,
    totalSessions: Number(p.total_sessions || 0),
  };
}

function normalizeSession(s) {
  return {
    id: String(s.id),
    patientId: String(s.pacienteId),
    patientName: s.patientName || "Paciente",
    clinicalDate: s.clinical_date || s.fecha,
    sessionType: SESSION_TYPE_ALIASES[s.tipo] || s.tipo || "individual",
    durationMinutes: s.duracion == null ? null : Number(s.duracion),
    careModality: s.care_modality || "unspecified",
    source: s.created_via || "web",
    inputType: s.input_type || "text",
    rawTranscript: s.raw_transcript || null,
    cleanNote: s.clean_note ?? s.notas ?? "",
    medicationNotes: s.medication_notes || null,
    moodAssessment: s.mood_assessment == null ? null : Number(s.mood_assessment),
    requiresFollowUp: Boolean(s.requires_followup),
    audioDurationSeconds: s.audio_duration_seconds == null ? null : Number(s.audio_duration_seconds),
    status: s.status || "confirmed",
    draftId: s.draft_id == null ? null : String(s.draft_id),
    createdAt: s.created_at || null,
    updatedAt: s.updated_at || s.created_at || null,
    confirmedAt: s.confirmed_at || null,
  };
}

// Auth Middleware - JWT real
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  
  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: String(decoded.sub || decoded.userId || "1") };
    next();
  } catch (err) {
    console.error("JWT verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
};

// Auth endpoints
app.post("/api/auth/verify", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");

  if (!token) {
    return res.status(401).json({ error: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({
      id: decoded.sub || decoded.userId,
      name: decoded.name || "Usuario",
      email: decoded.email || "",
      role: decoded.role || "doctor",
      dni: decoded.dni || "",
      specialty: decoded.specialty || ""
    });
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

app.post("/api/auth/renew", (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (token) {
    res.json({ token: token }); // Return same token for mock renewal
  } else {
    res.status(401).json({ error: "No token provided" });
  }
});

app.post("/api/auth/logout", (req, res) => {
  res.json({ success: true });
});

// Registro de usuarios
app.post("/api/auth/register",
  body('dni').isString().trim().isLength({ min: 7, max: 15 }).withMessage('DNI inválido'),
  body('pin').isString().isLength({ min: 4, max: 20 }).withMessage('PIN debe tener 4-20 caracteres'),
  body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Nombre inválido'),
  body('email').optional().isEmail(),
  body('specialty').optional().isString(),
  handleValidationErrors,
  async (req, res) => {
    try {
      const user = await sql.createUser(req.body);
      const token = issueToken(user);
      res.status(201).json({ success: true, user, token });
    } catch (err) {
      if (err.message === 'USER_EXISTS') {
        return res.status(409).json({ error: "Ya existe un usuario con ese DNI" });
      }
      console.error("Error creando usuario:", err);
      res.status(500).json({ error: "Error al crear usuario" });
    }
  }
);

// Patients endpoints - Protected
app.get('/api/patients', authMiddleware, (req, res) => {
    try {
        const patients = sql.listPatients(req.user.id).map(normalizePatient);
        res.json({ patients });
    } catch (err) {
        console.error('Error listing patients:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/patients', 
    authMiddleware,
    body('name').isString().trim().isLength({ min: 2, max: 100 }).withMessage('Nombre debe tener 2-100 caracteres'),
    body('dni').optional().isString().trim().isLength({ max: 20 }),
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('phone').optional().isString().trim().isLength({ max: 30 }),
    handleValidationErrors,
    (req, res) => {
    try {
        const newPatient = sql.addPatient(req.user.id, {
          ...req.body,
          habilitado: req.body.status !== 'inactive',
          created_via: 'web',
        });
        res.status(201).json(normalizePatient(newPatient));
    } catch (err) {
        console.error('Error creating patient:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.patch('/api/patients/:id', authMiddleware, (req, res) => {
    try {
        const changes = { ...req.body };
        if (changes.status != null) changes.habilitado = changes.status === 'active';
        const updated = sql.updatePatient(req.user.id, req.params.id, changes);
        if (updated) {
            res.json(normalizePatient(updated));
        } else {
            res.status(404).json({ error: 'Patient not found' });
        }
    } catch (err) {
        console.error('Error updating patient:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/patients/:id', authMiddleware, (req, res) => {
    try {
        const deleted = sql.deletePatient(req.user.id, req.params.id);
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Patient not found' });
        }
    } catch (err) {
        console.error('Error deleting patient:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Sessions endpoints - Protected
app.get('/api/sessions', authMiddleware, (req, res) => {
    try {
        let sessions = sql.listSessions(req.user.id).map(normalizeSession);
        if (req.query.patientId) {
          sessions = sessions.filter((session) => session.patientId === String(req.query.patientId));
        }
        if (req.query.from) {
          sessions = sessions.filter((session) => session.clinicalDate >= req.query.from);
        }
        if (req.query.to) {
          sessions = sessions.filter((session) => session.clinicalDate <= req.query.to);
        }
        res.json({ sessions });
    } catch (err) {
        console.error('Error listing sessions:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.post('/api/sessions',
    authMiddleware,
    normalizeSessionInput,
    body('patientId').notEmpty().withMessage('patientId es requerido'),
    ...clinicalSessionValidators(),
    handleValidationErrors,
    (req, res) => {
    try {
        const newSession = sql.addSession(req.user.id, toPersistenceSession(req.body));
        res.status(201).json(normalizeSession(newSession));
    } catch (err) {
        if (err.code === 'PATIENT_NOT_FOUND') {
            return res.status(404).json({ error: 'Patient not found' });
        }
        console.error('Error creating session:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.patch('/api/sessions/:id',
    authMiddleware,
    rejectPatientReassignment,
    normalizeSessionInput,
    ...clinicalSessionValidators(),
    handleValidationErrors,
    (req, res) => {
    try {
        const changes = { ...req.body };
        // Patient identity is never mutable through PATCH (guarded above too).
        delete changes.patientId;
        delete changes.pacienteId;
        const updated = sql.updateSession(req.user.id, req.params.id, changes);
        if (updated) {
            res.json(normalizeSession(updated));
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (err) {
        console.error('Error updating session:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

app.delete('/api/sessions/:id', authMiddleware, (req, res) => {
    try {
        const deleted = sql.deleteSession(req.user.id, req.params.id);
        if (deleted) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Session not found' });
        }
    } catch (err) {
        console.error('Error deleting session:', err);
        res.status(500).json({ error: 'Database error' });
    }
});

// Session drafts are the canonical entry point for web and WhatsApp notes.
app.get('/api/session-drafts', authMiddleware, (req, res) => {
  try {
    const drafts = sessionDraftService.listDrafts(req.user.id, {
      status: req.query.status,
      patientId: req.query.patientId,
    });
    res.json({ drafts });
  } catch (error) {
    sendDraftError(res, error);
  }
});

app.get('/api/session-drafts/:id', authMiddleware, (req, res) => {
  try {
    res.json({ draft: sessionDraftService.getDraft(req.user.id, req.params.id) });
  } catch (error) {
    sendDraftError(res, error);
  }
});

app.post('/api/session-drafts',
  authMiddleware,
  body('patientId').notEmpty().withMessage('patientId es requerido'),
  body('clinicalDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  body('sessionType').optional().isIn(['individual', 'group', 'family', 'couple', 'other']),
  body('durationMinutes').optional({ nullable: true }).isInt({ min: 1, max: 480 }),
  body('inputType').optional().equals('text').withMessage('Los audios deben ingresar por /api/audio-drafts'),
  body('cleanNote').optional().isString().isLength({ max: 10000 }),
  body('moodAssessment').optional({ nullable: true }).isInt({ min: 1, max: 5 }),
  handleValidationErrors,
  (req, res) => {
    try {
      const result = sessionDraftService.createDraft(req.user.id, req.body, { source: 'web' });
      res.status(result.created ? 201 : 200).json({ draft: result.draft });
    } catch (error) {
      sendDraftError(res, error);
    }
  }
);

app.patch('/api/session-drafts/:id', authMiddleware, (req, res) => {
  try {
    const draft = sessionDraftService.updateDraft(req.user.id, req.params.id, req.body);
    res.json({ draft });
  } catch (error) {
    sendDraftError(res, error);
  }
});

app.post('/api/session-drafts/:id/cancel', authMiddleware, (req, res) => {
  try {
    const draft = sessionDraftService.cancelDraft(req.user.id, req.params.id);
    res.json({ draft });
  } catch (error) {
    sendDraftError(res, error);
  }
});

app.post('/api/session-drafts/:id/confirm', authMiddleware, (req, res) => {
  try {
    const result = sessionDraftService.confirmDraft(req.user.id, req.params.id);
    res.status(result.created ? 201 : 200).json({
      draft: result.draft,
      session: normalizeSession(result.session),
    });
  } catch (error) {
    sendDraftError(res, error);
  }
});

app.get('/api/audio-drafts/fixtures', authMiddleware, (req, res) => {
  res.json({ fixtures: listAudioFixtures() });
});

app.post('/api/audio-drafts/upload',
  authMiddleware,
  query('patientId').notEmpty().withMessage('patientId es requerido'),
  query('clinicalDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  query('sessionType').optional().isIn(['individual', 'group', 'family', 'couple', 'other']),
  query('durationMinutes').optional().isInt({ min: 1, max: 480 }),
  query('careModality').optional().isIn(['inPerson', 'video', 'phone', 'unspecified']),
  query('audioDurationSeconds').optional().isFloat({ min: 0.1, max: 3600 }),
  handleValidationErrors,
  async (req, res) => {
    let storedMedia = null;
    try {
      const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
      if (!idempotencyKey || idempotencyKey.length > 200) {
        return res.status(400).json({
          error: 'INVALID_AUDIO_INPUT',
          message: 'Idempotency-Key is required',
        });
      }
      if (!sql.patientExists(req.user.id, req.query.patientId)) {
        const error = new Error('Patient not found or access denied');
        error.code = 'PATIENT_NOT_FOUND';
        throw error;
      }

      storedMedia = await temporaryAudioStore.storeStream(req, {
        declaredMimeType: req.get('Content-Type'),
        contentLength: req.get('Content-Length'),
      });
      const result = audioDraftPipeline.ingestUpload(req.user.id, {
        patientId: req.query.patientId,
        clinicalDate: req.query.clinicalDate,
        sessionType: req.query.sessionType,
        durationMinutes: req.query.durationMinutes == null
          ? null
          : Number(req.query.durationMinutes),
        careModality: req.query.careModality,
        audioDurationSeconds: req.query.audioDurationSeconds == null
          ? null
          : Number(req.query.audioDurationSeconds),
      }, storedMedia, {
        source: 'web',
        sourceMessageId: idempotencyKey,
      });
      storedMedia = null;
      const terminal = ['ready', 'failed', 'confirmed', 'cancelled'].includes(result.draft.status);
      return res.status(result.created || !terminal ? 202 : 200).json({
        draft: result.draft,
        processing: publicAudioProcessing(result.processing),
        created: result.created,
        deduplicated: result.deduplicated,
        queued: result.queued,
      });
    } catch (error) {
      if (storedMedia?.reference) temporaryAudioStore.remove(storedMedia.reference);
      return sendDraftError(res, error);
    }
  }
);

app.get('/api/audio-drafts/:id', authMiddleware, (req, res) => {
  try {
    const result = audioDraftPipeline.getProcessing(req.user.id, req.params.id);
    res.json({ draft: result.draft, processing: publicAudioProcessing(result.processing) });
  } catch (error) {
    sendDraftError(res, error);
  }
});

app.post('/api/audio-drafts',
  authMiddleware,
  body('patientId').notEmpty().withMessage('patientId es requerido'),
  body('fixtureId').isString().trim().isLength({ min: 1, max: 100 }),
  body('clinicalDate').optional().matches(/^\d{4}-\d{2}-\d{2}$/),
  handleValidationErrors,
  (req, res) => {
    try {
      const idempotencyKey = String(req.get('Idempotency-Key') || '').trim();
      if (!idempotencyKey || idempotencyKey.length > 200) {
        return res.status(400).json({
          error: 'INVALID_AUDIO_INPUT',
          message: 'Idempotency-Key is required',
        });
      }
      const result = audioDraftPipeline.ingest(req.user.id, req.body, {
        source: 'web',
        sourceMessageId: idempotencyKey,
      });
      return res.status(result.created ? 201 : 200).json(result);
    } catch (error) {
      return sendDraftError(res, error);
    }
  }
);

app.post('/api/audio-drafts/:id/retry', authMiddleware, (req, res) => {
  try {
    const result = audioDraftPipeline.retry(req.user.id, req.params.id);
    if (result.processing) result.processing = publicAudioProcessing(result.processing);
    res.status(result.queued ? 202 : 200).json(result);
  } catch (error) {
    sendDraftError(res, error);
  }
});

// The web account creates the code; WhatsApp consumes it from the selected phone.
app.get('/api/whatsapp/link', authMiddleware, (req, res) => {
  try {
    res.json({ link: whatsappLinkService.getLink(req.user.id, { includeCode: true }) });
  } catch (error) {
    sendWhatsappError(res, error);
  }
});

app.post('/api/whatsapp/link',
  authMiddleware,
  body('phoneNumber').isString().trim().isLength({ min: 8, max: 30 }),
  handleValidationErrors,
  (req, res) => {
    try {
      res.status(201).json(whatsappLinkService.requestLink(
        req.user.id,
        req.body.phoneNumber
      ));
    } catch (error) {
      sendWhatsappError(res, error);
    }
  }
);

app.delete('/api/whatsapp/link', authMiddleware, (req, res) => {
  try {
    res.json({ link: whatsappLinkService.unlink(req.user.id) });
  } catch (error) {
    sendWhatsappError(res, error);
  }
});

// Local functional adapter. A future Meta webhook will resolve the same inputs.
app.post('/api/dev/whatsapp/inbound',
  (req, res) => {
    if (process.env.NODE_ENV === 'production' && process.env.WHATSAPP_ADAPTER !== 'fake') {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }

    try {
      const messageId = String(req.body.messageId || '').trim();
      const from = String(req.body.from || '').trim();
      const message = req.body.message || {};
      const text = String(message.text || '').trim();
      const fixtureId = String(message.fixtureId || message.audio?.fixtureId || '').trim();
      const validText = message.type === 'text' && text && text.length <= 10000;
      const validAudio = message.type === 'audio' && fixtureId && fixtureId.length <= 100;
      if (!messageId || !from || (!validText && !validAudio)) {
        return res.status(400).json({ error: 'INVALID_WHATSAPP_EVENT' });
      }

      if (message.type === 'text' && /^VINCULAR\b/i.test(text)) {
        const linked = whatsappLinkService.consumeCommand({ messageId, from, text });
        return res.status(linked.deduplicated ? 200 : 201).json({
          reply: {
            kind: 'accountLinked',
            text: 'WhatsApp vinculado correctamente.',
          },
          link: linked.link,
          deduplicated: linked.deduplicated,
        });
      }

      const result = whatsappConversationService.handleInbound({ messageId, from, message });
      return res.status(result.status).json(result.body);
    } catch (error) {
      if (
        error.code?.startsWith('DRAFT')
        || error.code === 'PATIENT_NOT_FOUND'
        || error.code === 'INVALID_DRAFT'
        || error.code === 'INVALID_AUDIO_INPUT'
        || error.code === 'IDEMPOTENCY_CONFLICT'
        || error.code === 'PROCESSING_ALREADY_CLAIMED'
        || error.code === 'AUDIO_PROVIDER_NOT_CONFIGURED'
      ) {
        return sendDraftError(res, error);
      }
      return sendWhatsappError(res, error);
    }
  }
);

// Legacy endpoints must not bypass draft confirmation anymore.
app.post(['/api/whatsapp/create-session', '/api/whatsapp/save-session'], (req, res) => {
  res.status(410).json({
    error: 'WHATSAPP_SESSION_WRITE_DISABLED',
    message: 'WhatsApp must create and confirm a session draft',
  });
});

app.post("/api/sessions/:id/recording", authMiddleware, (req, res) => {
  // Simular procesamiento de grabación
  res.json({
    success: true,
    recordingId: `rec_${Date.now()}`,
    duration: req.body.duration || 0,
  });
});

app.post("/api/sessions/:id/autosave", authMiddleware, (req, res) => {
  // Simular auto-save
  res.json({ success: true, timestamp: new Date().toISOString() });
});

// Audit endpoints
app.post("/api/audit/logs", authMiddleware, (req, res) => {
  // Simular recepción de logs de auditoría
  console.log("Audit logs received:", req.body.logs?.length || 0, "entries");
  res.json({ success: true, processed: req.body.logs?.length || 0 });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: "2.0.0",
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
  });
});

// Login endpoint - genera JWT real
app.post("/api/login", 
  body('dni').optional().isString().trim(),
  body('pin').optional().isString(),
  body('email').optional().isEmail(),
  body('password').optional().isString(),
  handleValidationErrors,
  async (req, res) => {
  const { email, password, dni, pin } = req.body;

  let user = null;
  
  // Primero intentar verificar en BD real
  if (dni && pin) {
    try {
      user = await sql.verifyUser(dni, pin);
    } catch (err) {
      console.error("Error verificando usuario:", err);
    }
  }
  
  // Fallback a modo demo si no hay usuario en BD
  if (!user) {
    // Check Email/Password (demo)
    if (email && password === "demo123") {
        user = { id: 1, name: "Dr. Usuario", email: email, role: "doctor" };
    }
    
    // Check DNI/PIN (demo: cualquier DNI con PIN "1234" o "demo123")
    if (dni && pin) {
        if (pin === "1234" || pin === "demo123") {
            // Generar ID único basado en DNI para aislamiento de datos
            const demoId = Math.abs(dni.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 100000) + 1;
            user = { id: demoId, name: "Dr. Usuario", email: "demo@aira.com", role: "doctor", dni: dni };
        }
    }
  }

  if (user) {
    const token = issueToken(user);
    
    res.json({
      success: true,
      user,
      token
    });
  } else {
    res.status(401).json({ error: "Credenciales inválidas" });
  }
});

// ===== N8N INTEGRATION ENDPOINTS =====
// Endpoints específicos para integración con N8N WhatsApp Voice Processing

// Middleware de autenticación para n8n
const n8nAuthMiddleware = (req, res, next) => {
  const token = req.headers['x-n8n-token'];
  const validToken = process.env.N8N_SERVICE_TOKEN;
  
  if (!validToken) {
    console.warn('⚠️ [N8N] N8N_SERVICE_TOKEN not configured - allowing request in dev mode');
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'N8N integration not configured' });
    }
    return next();
  }
  
  if (token !== validToken) {
    console.warn('❌ [N8N] Invalid token attempt');
    return res.status(401).json({ error: 'Invalid or missing n8n token' });
  }
  
  next();
};

// Endpoint para reconocimiento automático de paciente
app.post('/api/whatsapp/recognize-patient', n8nAuthMiddleware, async (req, res) => {
    try {
        const { phoneNumber, aiAnalysis, transcription } = req.body;
        const systemUserId = "1"; // Default system user for N8N

        console.log(`🔍 [N8N] Patient recognition request: ${phoneNumber}`);
        
        // Buscar paciente por teléfono
        const patients = sql.listPatients(systemUserId);
        let matchedPatient = patients.find(p => p.phone && p.phone.includes(phoneNumber.slice(-8)));
        let confidence = 0;

        if (matchedPatient) {
            confidence = 0.9;
        } else if (aiAnalysis.patientIdentified && aiAnalysis.patientName) {
            // Buscar por nombre si no hay match de teléfono
            const searchName = aiAnalysis.patientName.toLowerCase();
            matchedPatient = patients.find(p => p.name.toLowerCase().includes(searchName));
            confidence = matchedPatient ? (aiAnalysis.confidence || 0.7) : 0;
        }

        // Analizar contenido para detectar tipo de sesión y urgencia
        const sessionAnalysis = {
            type: aiAnalysis.sessionType || 'individual',
            emotionalTone: aiAnalysis.emotionalTone || 'neutral',
            requiresUrgentAttention: aiAnalysis.requiresUrgentAttention || false,
            keyInfo: aiAnalysis.keyInfo || [],
            estimatedDuration: aiAnalysis.sessionType === 'crisis' ? 90 : 60
        };

        res.json({
            success: true,
            professional: { id: 1, name: 'Dr. Default', specialty: 'General' }, // Mock for now
            patient: matchedPatient ? normalizePatient(matchedPatient) : null,
            confidence,
            sessionAnalysis,
            requiresManualConfirmation: confidence < 0.7,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error in patient recognition:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para enviar confirmación por WhatsApp
app.post("/api/whatsapp/send-confirmation", n8nAuthMiddleware, async (req, res) => {
  try {
    const { phoneNumber, confirmationData } = req.body;

    console.log(`📱 [N8N] Sending confirmation to: ${phoneNumber}`);

    // Simular envío de mensaje de confirmación
    const confirmationMessage = `
✅ **Sesión Registrada Exitosamente**

📋 **Resumen:**
👤 Paciente: ${confirmationData.patient?.name || "Identificado automáticamente"}
🆔 ID Sesión: ${confirmationData.sessionId}
⏰ Fecha: ${new Date().toLocaleString("es-AR")}
🎤 Duración: ${confirmationData.audioInfo?.duration || 0} segundos
📝 Transcripción: ${confirmationData.transcription ? "Procesada" : "Pendiente"}

🤖 **Procesamiento IA:**
${confirmationData.aiSummary ? "Completado" : "En proceso..."}

📊 **Estado emocional detectado:** ${
      confirmationData.emotionalState || "Neutral"
    }

💡 La sesión completa está disponible en tu dashboard web.
        `.trim();

    // Simular respuesta de WhatsApp API
    const mockWhatsAppResponse = {
      success: true,
      messageId: `whatsapp_msg_${Date.now()}`,
      status: "sent",
      timestamp: new Date().toISOString(),
    };

    console.log(
      `✅ [N8N] Confirmation sent: ${mockWhatsAppResponse.messageId}`
    );

    res.json({
      success: true,
      message: confirmationMessage,
      whatsappResponse: mockWhatsAppResponse,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [N8N] Error sending confirmation:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint para enviar mensajes genéricos por WhatsApp
app.post("/api/whatsapp/send-message", n8nAuthMiddleware, async (req, res) => {
  try {
    const { phoneNumber, message } = req.body;

    console.log(`📱 [N8N] Sending message to: ${phoneNumber}`);
    console.log(`📝 [N8N] Message: ${message}`);

    // Simular envío de mensaje
    const mockWhatsAppResponse = {
      success: true,
      messageId: `whatsapp_msg_${Date.now()}`,
      status: "sent",
      timestamp: new Date().toISOString(),
    };

    res.json({
      success: true,
      messageId: mockWhatsAppResponse.messageId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ [N8N] Error sending message:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Endpoint de health check para N8N
app.get("/api/n8n/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "AIRA N8N Integration",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    endpoints: {
      recognizePatient: "/api/whatsapp/recognize-patient",
      createSession: "/api/whatsapp/create-session",
      saveSession: "/api/whatsapp/save-session",
      sendConfirmation: "/api/whatsapp/send-confirmation",
      sendMessage: "/api/whatsapp/send-message",
    },
  });
});

// Servir aplicación principal para todas las demás rutas
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Server error:", err);

  res.status(err.status || 500).json({
    error:
      process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Iniciar servidor
// Server startup moved to end of file

// N8N Routes moved up

// Graceful shutdown
// Signal handlers moved to end of file

module.exports = app;

// Start server if run directly
if (require.main === module) {
    const PORT = process.env.PORT || 8080;
    const server = app.listen(PORT, () => {
        console.log(`\n🚀 AIRA Frontend Server running on port ${PORT}`);
        console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`🔒 Security: Enabled`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
        console.log('SIGTERM received, shutting down gracefully');
        server.close(() => {
            console.log('Process terminated');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received, shutting down gracefully');
        server.close(() => {
            console.log('Process terminated');
            process.exit(0);
        });
    });
}
