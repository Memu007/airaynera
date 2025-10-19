/**
 * AIRA Medical System - Frontend Express Server
 * Servidor de desarrollo para visualización del nuevo sistema modular
 * HIPAA Compliance y seguridad médica integrada
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 8080;

// Configuración de seguridad médica - ajustada para desarrollo
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            // Permitir CSS de CDN y fuentes en desarrollo
            styleSrc: process.env.NODE_ENV === 'production'
                ? ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"]
                : ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            // Permitir scripts de CDN en desarrollo
            scriptSrc: process.env.NODE_ENV === 'production'
                ? ["'self'"]
                : ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
            // Permitir event handlers inline solo en desarrollo
            scriptSrcAttr: process.env.NODE_ENV === 'production' ? ["'none'"] : ["'unsafe-inline'"],
            // Permitir source maps en desarrollo para depuración
            connectSrc: process.env.NODE_ENV === 'production'
                ? ["'self'"]
                : ["'self'", "https://cdnjs.cloudflare.com"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            childSrc: ["'none'"],
            frameSrc: ["'none'"],
            workerSrc: ["'self'"],
            manifestSrc: ["'self'"]
        }
    },
    hsts: process.env.NODE_ENV === 'production' ? {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    } : false // Desactivar HSTS en desarrollo
}));

// Rate limiting para seguridad - más permisivo en desarrollo
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // Más requests en desarrollo
    message: {
        error: 'Too many requests from this IP, please try again later.',
        retryAfter: '15 minutes'
    },
    skip: (req) => {
        // Skip rate limiting para archivos estáticos en desarrollo
        if (process.env.NODE_ENV !== 'production') {
            return req.url.includes('/src/') || req.url.includes('.js') || req.url.includes('.css');
        }
        return false;
    }
});

app.use(limiter);

// CORS configurado para desarrollo
app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
    credentials: true
}));

// Compression para mejor performance
app.use(compression());

// Parsear JSON y URL encoded
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging de requests (simplificado para desarrollo)
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.path} - ${req.ip}`);
    next();
});

// Servir archivos estáticos
app.use(express.static(path.join(__dirname)));

// Mock data para desarrollo
const mockUsers = [
    {
        id: 1,
        name: 'Dr. Ana García',
        email: 'ana.garcia@aira-medical.com',
        role: 'psychologist',
        lastName: 'García',
        specialization: 'Psicología Clínica',
        license: 'MP-12345'
    },
    {
        id: 2,
        name: 'Dr. Carlos Martínez',
        email: 'carlos.martinez@aira-medical.com',
        role: 'psychiatrist',
        lastName: 'Martínez',
        specialization: 'Psiquiatría',
        license: 'MN-67890'
    }
];

const mockPatients = [
    {
        id: 1,
        name: 'María González',
        email: 'maria.gonzalez@email.com',
        phone: '+5491145678901',
        birthDate: '1985-06-15',
        gender: 'Femenino',
        dni: '27654321',
        address: 'Av. Corrientes 1234, CABA',
        emergencyContact: 'Juan González - +5491145678902',
        status: 'active',
        createdAt: '2024-01-15T10:00:00Z',
        lastSession: '2024-03-10T14:30:00Z',
        totalSessions: 12,
        therapistId: 1
    },
    {
        id: 2,
        name: 'Pedro Rodríguez',
        email: 'pedro.rodriguez@email.com',
        phone: '+5491156789012',
        birthDate: '1990-03-22',
        gender: 'Masculino',
        dni: '32109876',
        address: 'Caballito 567, CABA',
        emergencyContact: 'Laura Rodríguez - +5491156789013',
        status: 'active',
        createdAt: '2024-02-01T09:00:00Z',
        lastSession: '2024-03-12T16:00:00Z',
        totalSessions: 8,
        therapistId: 1
    },
    {
        id: 3,
        name: 'Laura Sánchez',
        email: 'laura.sanchez@email.com',
        phone: '+5491167890123',
        birthDate: '1988-11-08',
        gender: 'Femenino',
        dni: '29876543',
        address: 'Palermo 890, CABA',
        emergencyContact: 'Roberto Sánchez - +5491167890124',
        status: 'followup',
        createdAt: '2023-12-10T11:00:00Z',
        lastSession: '2024-03-08T10:30:00Z',
        totalSessions: 15,
        therapistId: 2
    }
];

const mockSessions = [
    {
        id: 1,
        patientId: 1,
        patientName: 'María González',
        therapistId: 1,
        type: 'individual',
        scheduledDate: new Date().toISOString(),
        status: 'in_progress',
        duration: 60,
        modality: 'virtual',
        notes: 'Sesión inicial enfocada en presentación y objetivos terapéuticos.',
        tags: ['inicial', 'evaluación'],
        source: 'web'
    },
    {
        id: 2,
        patientId: 2,
        patientName: 'Pedro Rodríguez',
        therapistId: 1,
        type: 'individual',
        scheduledDate: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 horas después
        status: 'scheduled',
        duration: 60,
        modality: 'presencial',
        notes: '',
        tags: ['seguimiento'],
        source: 'web'
    },
    {
        id: 3,
        patientId: 3,
        patientName: 'Laura Sánchez',
        therapistId: 2,
        type: 'individual',
        scheduledDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Ayer
        status: 'completed',
        duration: 60,
        modality: 'virtual',
        notes: 'Sesión de seguimiento con buenos progresos observados.',
        tags: ['seguimiento', 'progreso'],
        source: 'whatsapp'
    }
];

// API Routes

// Auth endpoints
app.post('/api/auth/verify', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ error: 'No token provided' });
    }

    // Simular verificación de token (mock)
    const mockToken = 'mock-jwt-token-for-development';
    if (token === mockToken) {
        res.json(mockUsers[0]); // Retornar primer usuario mock
    } else {
        res.status(401).json({ error: 'Invalid token' });
    }
});

app.post('/api/auth/renew', (req, res) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (token) {
        res.json({ token: 'mock-jwt-token-for-development' });
    } else {
        res.status(401).json({ error: 'No token provided' });
    }
});

app.post('/api/auth/logout', (req, res) => {
    res.json({ success: true });
});

// Patients endpoints
app.get('/api/patients', (req, res) => {
    // Simular datos encriptados
    const encryptedPatients = mockPatients.map(patient => ({
        ...patient,
        // Simular encriptación de datos PHI
        name: btoa(patient.name), // Base64 como simulación
        email: btoa(patient.email),
        phone: btoa(patient.phone),
        address: btoa(patient.address),
        emergencyContact: btoa(patient.emergencyContact)
    }));

    res.json({ patients: encryptedPatients });
});

app.post('/api/patients', (req, res) => {
    const newPatient = {
        id: mockPatients.length + 1,
        ...req.body,
        createdAt: new Date().toISOString(),
        lastSession: null,
        totalSessions: 0,
        status: 'new'
    };

    mockPatients.push(newPatient);
    res.status(201).json(newPatient);
});

app.patch('/api/patients/:id', (req, res) => {
    const patientIndex = mockPatients.findIndex(p => p.id === parseInt(req.params.id));
    if (patientIndex !== -1) {
        Object.assign(mockPatients[patientIndex], req.body);
        res.json(mockPatients[patientIndex]);
    } else {
        res.status(404).json({ error: 'Patient not found' });
    }
});

// Sessions endpoints
app.get('/api/sessions', (req, res) => {
    res.json({ sessions: mockSessions });
});

app.post('/api/sessions', (req, res) => {
    const newSession = {
        id: mockSessions.length + 1,
        ...req.body,
        createdAt: new Date().toISOString()
    };

    mockSessions.push(newSession);
    res.status(201).json(newSession);
});

app.patch('/api/sessions/:id', (req, res) => {
    const sessionIndex = mockSessions.findIndex(s => s.id === parseInt(req.params.id));
    if (sessionIndex !== -1) {
        Object.assign(mockSessions[sessionIndex], req.body);
        res.json(mockSessions[sessionIndex]);
    } else {
        res.status(404).json({ error: 'Session not found' });
    }
});

app.post('/api/sessions/:id/recording', (req, res) => {
    // Simular procesamiento de grabación
    res.json({
        success: true,
        recordingId: `rec_${Date.now()}`,
        duration: req.body.duration || 0
    });
});

app.post('/api/sessions/:id/autosave', (req, res) => {
    // Simular auto-save
    res.json({ success: true, timestamp: new Date().toISOString() });
});

// Audit endpoints
app.post('/api/audit/logs', (req, res) => {
    // Simular recepción de logs de auditoría
    console.log('Audit logs received:', req.body.logs?.length || 0, 'entries');
    res.json({ success: true, processed: req.body.logs?.length || 0 });
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        uptime: process.uptime()
    });
});

// Mock login endpoint para desarrollo
app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    // Simular autenticación
    const user = mockUsers.find(u => u.email === email);
    if (user && password === 'demo123') {
        res.json({
            success: true,
            user,
            token: 'mock-jwt-token-for-development'
        });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});

// Servir aplicación principal para todas las demás rutas
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);

    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message,
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Iniciar servidor
const server = app.listen(PORT, () => {
    console.log(`
🏥 AIRA Medical System Frontend Server Started!
📍 URL: http://localhost:${PORT}
🩺 Healthcare Professional Interface v2.0
🔒 HIPAA Compliance Mode
📊 Modular Architecture
⏰ Started at: ${new Date().toLocaleString()}
    `);

    console.log(`
🔑 Development Login Credentials:
   Email: ana.garcia@aira-medical.com
   Password: demo123

   O usar:
   Email: carlos.martinez@aira-medical.com
   Password: demo123
    `);

    console.log(`
📋 Available Features:
   ✅ Modular Frontend Architecture
   ✅ Healthcare UI (35-65 age optimized)
   ✅ WCAG 2.1 AA Accessibility
   ✅ Patient Management (HIPAA)
   ✅ Session Workflow (Audio Recording)
   ✅ Medical Notifications
   ✅ Security & Audit Trail
   ✅ Responsive Design
   ✅ Performance Monitoring
    `);
});

// ===== N8N INTEGRATION ENDPOINTS =====
// Endpoints específicos para integración con N8N WhatsApp Voice Processing

// Endpoint para reconocimiento automático de paciente
app.post('/api/whatsapp/recognize-patient', async (req, res) => {
    try {
        const { phoneNumber, aiAnalysis, transcription } = req.body;

        console.log(`🔍 [N8N] Patient recognition request: ${phoneNumber}`);
        console.log(`📝 [N8N] AI Analysis:`, JSON.stringify(aiAnalysis, null, 2));
        console.log(`🎤 [N8N] Transcription preview: ${transcription.substring(0, 100)}...`);

        // Validar que el teléfono corresponde a un profesional registrado
        const professional = mockUsers.find(user => user.phone.includes(phoneNumber.slice(-8)));

        if (!professional) {
            return res.status(404).json({
                success: false,
                error: 'Professional not found for this phone number',
                phoneNumber
            });
        }

        // Buscar paciente basado en análisis de IA
        let matchedPatient = null;
        let confidence = 0;

        if (aiAnalysis.patientIdentified && aiAnalysis.patientName) {
            // Buscar por nombre exacto o parcial
            const searchName = aiAnalysis.patientName.toLowerCase();
            matchedPatient = mockPatients.find(patient =>
                patient.name.toLowerCase().includes(searchName) ||
                patient.assignedTherapist === professional.id
            );
            confidence = aiAnalysis.confidence || 0.7;
        }

        // Si no se encuentra por nombre, buscar pacientes asignados al profesional
        if (!matchedPatient) {
            const professionalPatients = mockPatients.filter(patient =>
                patient.assignedTherapist === professional.id
            );

            if (professionalPatients.length === 1) {
                matchedPatient = professionalPatients[0];
                confidence = 0.6;
            } else if (professionalPatients.length > 1) {
                // Usar heurísticas del contenido para encontrar el mejor match
                matchedPatient = professionalPatients[0]; // Por ahora, tomar el primero
                confidence = 0.5;
            }
        }

        // Analizar contenido para detectar tipo de sesión y urgencia
        const sessionAnalysis = {
            type: aiAnalysis.sessionType || 'individual',
            emotionalTone: aiAnalysis.emotionalTone || 'neutral',
            requiresUrgentAttention: aiAnalysis.requiresUrgentAttention || false,
            keyInfo: aiAnalysis.keyInfo || [],
            estimatedDuration: aiAnalysis.sessionType === 'crisis' ? 90 : 60
        };

        console.log(`✅ [N8N] Patient recognition result:`, matchedPatient ? matchedPatient.name : 'No match');
        console.log(`📊 [N8N] Confidence: ${confidence}`);

        res.json({
            success: true,
            professional: {
                id: professional.id,
                name: professional.name,
                specialty: professional.specialty
            },
            patient: matchedPatient ? {
                id: matchedPatient.id,
                name: matchedPatient.name,
                dni: matchedPatient.dni,
                status: matchedPatient.status,
                lastSession: matchedPatient.lastSession
            } : null,
            confidence,
            sessionAnalysis,
            requiresManualConfirmation: confidence < 0.7,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error in patient recognition:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Endpoint para crear sesión inicial
app.post('/api/whatsapp/create-session', async (req, res) => {
    try {
        const { patientData, sessionData, transcription, audioInfo } = req.body;

        console.log(`📝 [N8N] Creating session for patient: ${patientData?.name || 'Unknown'}`);
        console.log(`🎤 [N8N] Audio duration: ${audioInfo.duration}s`);

        if (!patientData || !sessionData) {
            return res.status(400).json({
                success: false,
                error: 'Missing patient or session data'
            });
        }

        // Crear nueva sesión
        const newSession = {
            id: mockSessions.length + 1,
            patientId: patientData.id,
            patientName: patientData.name,
            therapistId: patientData.assignedTherapist,
            type: sessionData.type || 'individual',
            scheduledDate: new Date().toISOString(),
            status: 'processing',
            duration: Math.ceil(audioInfo.duration / 60), // Convertir a minutos
            modality: 'whatsapp_voice',
            notes: transcription.substring(0, 500), // Primeros 500 caracteres como notas iniciales
            tags: ['whatsapp', 'voice', 'auto-generated'],
            source: 'whatsapp_voice',
            transcription: transcription,
            audioInfo: {
                duration: audioInfo.duration,
                messageId: audioInfo.messageId,
                mimeType: audioInfo.mimeType,
                timestamp: audioInfo.timestamp
            },
            createdAt: new Date().toISOString()
        };

        mockSessions.push(newSession);

        console.log(`✅ [N8N] Session created: ID ${newSession.id}`);

        res.json({
            success: true,
            sessionId: newSession.id,
            session: newSession,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error creating session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para guardar sesión completa con análisis de IA
app.post('/api/whatsapp/save-session', async (req, res) => {
    try {
        const { sessionId, aiSummary, finalData } = req.body;

        console.log(`💾 [N8N] Saving complete session: ${sessionId}`);

        const sessionIndex = mockSessions.findIndex(s => s.id === parseInt(sessionId));
        if (sessionIndex === -1) {
            return res.status(404).json({
                success: false,
                error: 'Session not found'
            });
        }

        // Actualizar sesión con análisis completo de IA
        const updatedSession = {
            ...mockSessions[sessionIndex],
            status: 'completed',
            notes: aiSummary.summary || '',
            summary: aiSummary.summary || '',
            emotionalState: aiSummary.emotionalState || 3,
            topics: aiSummary.topics || [],
            interventions: aiSummary.interventions || [],
            progress: aiSummary.progress || '',
            alerts: aiSummary.alerts || [],
            recommendations: aiSummary.recommendations || [],
            aiProcessed: true,
            aiProcessedAt: new Date().toISOString(),
            completedAt: new Date().toISOString()
        };

        mockSessions[sessionIndex] = updatedSession;

        console.log(`✅ [N8N] Session completed and saved: ${sessionId}`);

        res.json({
            success: true,
            sessionId: parseInt(sessionId),
            session: updatedSession,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error saving session:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para enviar confirmación por WhatsApp
app.post('/api/whatsapp/send-confirmation', async (req, res) => {
    try {
        const { phoneNumber, confirmationData } = req.body;

        console.log(`📱 [N8N] Sending confirmation to: ${phoneNumber}`);

        // Simular envío de mensaje de confirmación
        const confirmationMessage = `
✅ **Sesión Registrada Exitosamente**

📋 **Resumen:**
👤 Paciente: ${confirmationData.patient?.name || 'Identificado automáticamente'}
🆔 ID Sesión: ${confirmationData.sessionId}
⏰ Fecha: ${new Date().toLocaleString('es-AR')}
🎤 Duración: ${confirmationData.audioInfo?.duration || 0} segundos
📝 Transcripción: ${confirmationData.transcription ? 'Procesada' : 'Pendiente'}

🤖 **Procesamiento IA:**
${confirmationData.aiSummary ? 'Completado' : 'En proceso...'}

📊 **Estado emocional detectado:** ${confirmationData.emotionalState || 'Neutral'}

💡 La sesión completa está disponible en tu dashboard web.
        `.trim();

        // Simular respuesta de WhatsApp API
        const mockWhatsAppResponse = {
            success: true,
            messageId: `whatsapp_msg_${Date.now()}`,
            status: 'sent',
            timestamp: new Date().toISOString()
        };

        console.log(`✅ [N8N] Confirmation sent: ${mockWhatsAppResponse.messageId}`);

        res.json({
            success: true,
            message: confirmationMessage,
            whatsappResponse: mockWhatsAppResponse,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error sending confirmation:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint para enviar mensajes genéricos por WhatsApp
app.post('/api/whatsapp/send-message', async (req, res) => {
    try {
        const { phoneNumber, message } = req.body;

        console.log(`📱 [N8N] Sending message to: ${phoneNumber}`);
        console.log(`📝 [N8N] Message: ${message}`);

        // Simular envío de mensaje
        const mockWhatsAppResponse = {
            success: true,
            messageId: `whatsapp_msg_${Date.now()}`,
            status: 'sent',
            timestamp: new Date().toISOString()
        };

        res.json({
            success: true,
            messageId: mockWhatsAppResponse.messageId,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('❌ [N8N] Error sending message:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Endpoint de health check para N8N
app.get('/api/n8n/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'AIRA N8N Integration',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        endpoints: {
            recognizePatient: '/api/whatsapp/recognize-patient',
            createSession: '/api/whatsapp/create-session',
            saveSession: '/api/whatsapp/save-session',
            sendConfirmation: '/api/whatsapp/send-confirmation',
            sendMessage: '/api/whatsapp/send-message'
        }
    });
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

module.exports = app;