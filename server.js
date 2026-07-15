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
const { body, param, validationResult } = require("express-validator");

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

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Mock data para desarrollo
// Persistence Service (SQLite)
const sql = require("./services/sqlite");

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
  if (requestedType !== undefined || isCreate) {
    const type = requestedType || "individual";
    normalized.sessionType = SESSION_TYPE_ALIASES[type] || type;
  }
  if (input.durationMinutes !== undefined || input.duracion !== undefined) {
    normalized.durationMinutes = firstDefined(input.durationMinutes, input.duracion);
  }
  if (input.careModality !== undefined || isCreate) {
    normalized.careModality = firstDefined(input.careModality, "unspecified");
  }
  if (cleanNote !== undefined || isCreate) normalized.cleanNote = cleanNote || "";
  if (input.rawTranscript !== undefined || input.transcription !== undefined) {
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
  if (input.audioDurationSeconds !== undefined) {
    normalized.audioDurationSeconds = input.audioDurationSeconds;
  }
  if (input.inputType !== undefined || isCreate) {
    normalized.inputType = firstDefined(
      input.inputType,
      input.rawTranscript || input.transcription ? "audio" : "text"
    );
  }
  req.body = normalized;
  next();
}

function toPersistenceSession(session) {
  return {
    ...session,
    pacienteId: session.patientId,
    source: "web",
  };
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
    durationMinutes: Number(s.duracion || 0),
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
    body('sessionType').optional().isString().isIn(['individual', 'group', 'family', 'couple', 'other']),
    body('durationMinutes').optional().isInt({ min: 1, max: 480 }).withMessage('Duración debe ser 1-480 minutos'),
    body('cleanNote').optional().isString().isLength({ max: 10000 }),
    body('moodAssessment').optional().isInt({ min: 1, max: 5 }),
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

app.patch('/api/sessions/:id', authMiddleware, normalizeSessionInput, (req, res) => {
    try {
        const changes = { ...req.body };
        if (changes.patientId !== undefined) changes.pacienteId = changes.patientId;
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

// Endpoint para crear sesión inicial
app.post('/api/whatsapp/create-session', n8nAuthMiddleware, async (req, res) => {
    try {
        const { patientData, sessionData, transcription, audioInfo } = req.body;
        const systemUserId = "1"; // Default system user for N8N

        if (!patientData || !sessionData) {
            return res.status(400).json({ success: false, error: 'Missing patient or session data' });
        }

        const newSession = sql.addSession(systemUserId, {
            pacienteId: patientData.id,
            tipo: sessionData.type || 'individual',
            duracion: Math.ceil((audioInfo.duration || 60) / 60),
            notas: transcription.substring(0, 500),
            created_via: 'whatsapp',
            mood_assessment: 3,
            requires_followup: false
        });

        console.log(`✅ [N8N] Session created: ID ${newSession.id}`);

        res.json({
            success: true,
            sessionId: newSession.id,
            session: normalizeSession(newSession),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error creating session:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Endpoint para guardar sesión completa con análisis de IA
app.post('/api/whatsapp/save-session', n8nAuthMiddleware, async (req, res) => {
    try {
        const { sessionId, aiSummary, finalData } = req.body;
        const systemUserId = "1"; // Default system user for N8N

        console.log(`💾 [N8N] Saving complete session: ${sessionId}`);

        const updated = sql.updateSession(systemUserId, sessionId, {
            notas: aiSummary.summary || '',
            medication_notes: JSON.stringify(aiSummary.recommendations || []),
            mood_assessment: aiSummary.emotionalState?.intensity || 5,
            requires_followup: aiSummary.requiresFollowUp || false
        });

        if (!updated) {
            return res.status(404).json({ success: false, error: 'Session not found' });
        }

        res.json({
            success: true,
            sessionId: parseInt(sessionId),
            session: normalizeSession(updated),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error saving session:', error);
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
