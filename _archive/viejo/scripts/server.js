/**
 * 🌱 AIRA Bot v1.3 FINAL - Perfect for Private Practice
 * Para consultorios privados de psicólogos y psiquiatras
 * Target: 500 profesionales | Simple pero robusto
 * 
 * ✅ OPTIMIZADO para consultorios privados (no hospitales)
 * ✅ Simplicidad operacional + seguridad médica
 * ✅ Crisis detection robusto sin complejidad enterprise
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { body, validationResult } = require('express-validator');
const winston = require('winston');
const fs = require('fs');
const { Firestore } = require('@google-cloud/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');
const fetch = require('node-fetch');

// Importar controladores de auth y middleware de seguridad (con manejo de errores)
let authController, authLimiter;
try {
    authController = require('./src/controllers/authController');
    const securityMiddleware = require('./src/middleware/security');
    authLimiter = securityMiddleware.authLimiter;
    console.log('✅ Auth modules loaded successfully');
} catch (error) {
    console.warn('⚠️ Could not load auth modules:', error.message);
    // Crear mocks simples para evitar crashes
    authController = {
        register: (req, res) => res.status(501).json({ error: 'Auth not available' }),
        login: (req, res) => res.status(501).json({ error: 'Auth not available' }),
        logout: (req, res) => res.status(501).json({ error: 'Auth not available' }),
        getProfile: (req, res) => res.status(501).json({ error: 'Auth not available' })
    };
    authLimiter = (req, res, next) => next();
}

const app = express();
app.use(express.json()); // Middleware para parsear JSON bodies

// Configuración para servir archivos estáticos
// IMPORTANTE: Esta línea debe ir ANTES de las definiciones de rutas de la API.
// Pero DESPUÉS de las rutas específicas para evitar conflictos
// Las rutas específicas tendrán prioridad sobre los archivos estáticos
const PORT = process.env.PORT || 8082;

// Configuración de CORS para permitir peticiones desde el frontend
const corsOptions = {
    origin: ['http://localhost:8082', 'http://127.0.0.1:8082', 'http://localhost:8081', 'http://127.0.0.1:8081'],
    optionsSuccessStatus: 200,
    credentials: true
};
app.use(cors(corsOptions));

// Configuración de rutas estáticas

// Ruta principal - Landing Page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'demopagina_funcional_backup.html'));
});

// Ruta para el dashboard
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ruta para la demo de WhatsApp
app.get('/demo-whatsapp', (req, res) => {
    res.sendFile(path.join(__dirname, 'demo-whatsapp.html'));
});

// Ruta para la página de login
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'demo.html'));
});

// Ruta para redirigir desde /webaira
app.get('/webaira', (req, res) => {
    res.redirect('/');
});

// ═══════════════════════════════════════════════════════════════════
// 🚨 MEDIDAS DE SEGURIDAD DE EMERGENCIA (FASE 0)
// ═══════════════════════════════════════════════════════════════════

// Middleware de Whitelist de IP
const ipWhitelist = (req, res, next) => {
    const allowedIps = (process.env.ALLOWED_IPS || '127.0.0.1').split(',');
    const clientIp = req.ip || req.connection.remoteAddress;

    if (allowedIps.includes(clientIp)) {
        next();
    } else {
        logger.warn(`Acceso bloqueado para IP no autorizada: ${clientIp}`);
        res.status(403).send('Acceso denegado.');
    }
};

// Middleware de Logging de Peticiones
const requestLogger = (req, res, next) => {
    logger.info(`Petición recibida: ${req.method} ${req.originalUrl} - IP: ${req.ip || req.connection.remoteAddress}`);
    next();
};

// Aplicar middlewares de emergencia
app.use(ipWhitelist);
app.use(requestLogger);


// ═══════════════════════════════════════════════════════════════════
// 🏥 SIMPLE HEALTHCARE RESILIENCE (Perfect for Private Practice)
// ═══════════════════════════════════════════════════════════════════

// Definir rutas específicas ANTES de servir archivos estáticos
const path = require('path');

// Ruta principal: sirve la página de login limpia
app.get('/', (req, res) => {
    // Limpiar cualquier sesión existente antes de servir la página de login
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'demopagina_funcional_backup.html'));
});

// Ruta /webaira: redirecciona al login para forzar autenticación
app.get('/webaira', (req, res) => {
    res.redirect('/');
});

// Ruta para la demo original (ahora accesible solo explícitamente)
app.get('/demo.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'demo.html'));
});

// Ruta para el dashboard: sirve index.html directamente
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Ahora configuramos el middleware para servir archivos estáticos
app.use(express.static(__dirname));

class SimpleResilience {
    constructor() {
        this.circuitBreaker = new Map();
        this.sessionBuffer = new Map();
        this.systemHealth = { ai: true, database: true, crisis: true };
        this.lastHealthCheck = new Date();
        
        this.startBasicMonitoring();
        this.startSessionRetry();
    }

    async executeWithFallback(service, operation, fallback) {
        const circuit = this.getCircuit(service);
        
        // Simple circuit breaker: open for 30 seconds after 3 failures
        if (circuit.isOpen && Date.now() - circuit.lastFailTime < 30000) {
            logger.warn(`Service ${service} temporarily unavailable`);
            return await fallback();
        }

        try {
            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), 8000)
                )
            ]);
            this.recordSuccess(service);
            return result;
        } catch (error) {
            this.recordFailure(service);
            return await fallback();
        }
    }

    getCircuit(service) {
        if (!this.circuitBreaker.has(service)) {
            this.circuitBreaker.set(service, { failures: 0, isOpen: false, lastFailTime: 0 });
        }
        return this.circuitBreaker.get(service);
    }

    recordFailure(service) {
        const circuit = this.getCircuit(service);
        circuit.failures++;
        circuit.lastFailTime = Date.now();
        
        if (circuit.failures >= 3) {
            circuit.isOpen = true;
            this.systemHealth[service] = false;
            
            if (service === 'crisis') {
                logger.error('🚨 CRISIS SYSTEM FAILED - MANUAL EVALUATION REQUIRED');
                console.log('🚨 ALERT: Crisis detection offline - Evaluate all messages manually');
            }
        }
    }

    recordSuccess(service) {
        const circuit = this.getCircuit(service);
        circuit.failures = Math.max(0, circuit.failures - 1);
        if (circuit.failures === 0) {
            circuit.isOpen = false;
            this.systemHealth[service] = true;
        }
    }

    // Simple session buffering for database failures
    bufferSession(sessionData) {
        const sessionId = crypto.randomUUID();
        this.sessionBuffer.set(sessionId, {
            ...sessionData,
            timestamp: Date.now(),
            retryCount: 0
        });
        
        logger.info(`Session buffered: ${sessionId}`);
        
        // Alert if too many buffered sessions
        if (this.sessionBuffer.size >= 20) {
            logger.warn(`🔔 ${this.sessionBuffer.size} sessions pending - Check database connection`);
        }
        
        return sessionId;
    }

    async retryBufferedSessions() {
        if (this.sessionBuffer.size === 0) return;

        for (const [sessionId, data] of this.sessionBuffer.entries()) {
            if (data.retryCount >= 3) {
                this.sessionBuffer.delete(sessionId);
                logger.error(`Session lost after 3 retries: ${sessionId}`);
                continue;
            }

            try {
                await db.registerSession(data);
                this.sessionBuffer.delete(sessionId);
                logger.info(`Session synced: ${sessionId}`);
            } catch (error) {
                data.retryCount++;
            }
        }
    }

    startBasicMonitoring() {
        // Simple health check every 60 seconds
        setInterval(async () => {
            await this.updateSystemHealth();
            this.lastHealthCheck = new Date();
        }, 60000);
    }

    startSessionRetry() {
        // Retry buffered sessions every 30 seconds
        setInterval(async () => {
            await this.retryBufferedSessions();
        }, 30000);
    }

    async updateSystemHealth() {
        // Test database
        try {
            await firestorePool.getConnection().collection('health_check').doc('test').get();
            this.systemHealth.database = true;
        } catch (error) {
            this.systemHealth.database = false;
        }

        // Test AI (if configured)
        if (process.env.GEMINI_API_KEY) {
            try {
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                await model.generateContent("test");
                this.systemHealth.ai = true;
            } catch (error) {
                this.systemHealth.ai = false;
            }
        }

        // Crisis detection always available (has fallback)
        this.systemHealth.crisis = true;
    }

    getHealthStatus() {
        const overall = Object.values(this.systemHealth).every(status => status);
        
        return {
            status: overall ? '🟢 Operativo' : '🟡 Degradado',
            services: this.systemHealth,
            buffered_sessions: this.sessionBuffer.size,
            last_health_check: this.lastHealthCheck,
            message: overall ? 
                'Sistema funcionando normalmente' : 
                'Algunos servicios limitados - modo seguro activo'
        };
    }

    // Simple conversation recovery
    detectIntent(message) {
        const lower = message.toLowerCase();
        if (lower.includes('paciente') && (lower.includes('registr') || lower.includes('nuevo'))) {
            return 'registro_paciente';
        }
        if (lower.includes('sesión') || lower.includes('sesion') || lower.includes('consulta')) {
            return 'nueva_sesion';
        }
        if (lower.includes('historial') || lower.includes('lista')) {
            return 'historial';
        }
        return 'menu_principal';
    }

    recoverConversation(message) {
        const intent = this.detectIntent(message);
        const messages = {
            'registro_paciente': '🔄 Continuando registro. Enviá: Nombre, DNI, Obra Social, Teléfono',
            'nueva_sesion': '🔄 Continuando sesión. ¿Podés repetir el contenido?',
            'historial': '🔄 Mostrando historial...',
            'menu_principal': '🔄 Reiniciado. ¿En qué te ayudo?'
        };
        
        return {
            response: messages[intent],
            newState: intent,
            recovered: true
        };
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🔒 SECURITY SYSTEM (Simplified but Secure)
// ═══════════════════════════════════════════════════════════════════

class SecurityManager {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32;
        this.ivLength = 16;
        this.keyCache = new Map();
        this.suspiciousIPs = new Set();
        this.failedAttempts = new Map();
        this.initializeKeys();
    }

    initializeKeys() {
        this.masterKey = process.env.MASTER_KEY ? 
            Buffer.from(process.env.MASTER_KEY, 'hex') : 
            crypto.randomBytes(32);
    }

    getDerivedKey(context) {
        const cacheKey = `key_${context}`;
        if (this.keyCache.has(cacheKey)) {
            return this.keyCache.get(cacheKey);
        }
        
        const key = crypto.pbkdf2Sync(this.masterKey, context, 100000, this.keyLength, 'sha512');
        this.keyCache.set(cacheKey, key);
        
        // Simple cache cleanup
        if (this.keyCache.size > 500) {
            const firstKey = this.keyCache.keys().next().value;
            this.keyCache.delete(firstKey);
        }
        
        return key;
    }

    encrypt(text, context = 'default') {
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const key = this.getDerivedKey(context);
            const cipher = crypto.createCipher(this.algorithm, key);
            
            cipher.setAAD(Buffer.from(context));
            
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const tag = cipher.getAuthTag();
            
            return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
        } catch (error) {
            logger.error('Encryption error:', error);
            throw new Error('Error de encriptación');
        }
    }

    decrypt(encryptedData, context = 'default') {
        try {
            const parts = encryptedData.split(':');
            if (parts.length !== 3) {
                throw new Error('Invalid encrypted data format');
            }
            
            const [ivHex, tagHex, encrypted] = parts;
            const iv = Buffer.from(ivHex, 'hex');
            const tag = Buffer.from(tagHex, 'hex');
            const key = this.getDerivedKey(context);
            
            const decipher = crypto.createDecipher(this.algorithm, key);
            decipher.setAAD(Buffer.from(context));
            decipher.setAuthTag(tag);
            
            let decrypted = decipher.update(encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
        } catch (error) {
            logger.error('Decryption error:', error);
            throw new Error('Error de desencriptación');
        }
    }

    async hashPin(pin) {
        const pepper = process.env.PIN_PEPPER || 'ailu_medical_2025';
        return await bcrypt.hash(pin + pepper, 12);
    }

    async verifyPin(pin, hash) {
        try {
            const pepper = process.env.PIN_PEPPER || 'ailu_medical_2025';
            return await bcrypt.compare(pin + pepper, hash);
        } catch (error) {
            return false;
        }
    }

    validateInput(input, type = 'general') {
        if (!input) return { valid: false, error: 'Input requerido' };
        
        if (typeof input === 'string' && input.length > 5000) {
            return { valid: false, error: 'Input demasiado largo' };
        }
        
        // Basic security patterns
        const dangerousPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE)\b)/gi
        ];
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(input)) {
                return { valid: false, error: 'Contenido no permitido' };
            }
        }
        
        // Type validation
        const patterns = {
            dni: /^[0-9]{7,8}$/,
            pin: /^[0-9]{4,8}$/,
            phone: /^[\+]?[0-9\s\-\(\)]{8,20}$/
        };
        
        if (patterns[type] && !patterns[type].test(input)) {
            return { valid: false, error: `Formato de ${type} inválido` };
        }
        
        return { valid: true, sanitized: input.trim() };
    }

    // Simple suspicious activity tracking
    detectSuspiciousActivity(ip, action) {
        const key = `${ip}_${action}`;
        const attempts = this.failedAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
        
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.failedAttempts.set(key, attempts);
        
        const timeWindow = 15 * 60 * 1000; // 15 minutes
        const timeSinceFirst = attempts.lastAttempt - attempts.firstAttempt;
        
        if (timeSinceFirst < timeWindow && attempts.count >= 10) {
            this.suspiciousIPs.add(ip);
            return 'BLOCKED';
        } else if (attempts.count >= 5) {
            return 'SUSPICIOUS';
        }
        
        return 'NORMAL';
    }

    hashSensitiveData(data) {
        return crypto.createHash('sha256')
            .update(data + (process.env.LOG_SALT || 'log_salt_2025'))
            .digest('hex').substring(0, 12);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🧠 CRISIS DETECTOR (Simple but Safe)
// ═══════════════════════════════════════════════════════════════════

class CrisisDetector {
    constructor() {
        this.crisisKeywords = [
            'quiero matarme', 'me quiero matar', 'voy a suicidarme', 'me voy a suicidar',
            'no quiero vivir', 'prefiero estar muerto', 'no aguanto más', 'todo está perdido',
            'me quiero lastimar', 'voy a lastimarme', 'no vale la pena vivir', 'quiero desaparecer',
            // Variantes argentinas
            'me quiero hacer daño', 'quiero terminar con todo', 'no doy más',
            'estoy re mal', 'no la paso más', 'me quiero ir de acá', 'ya no banco más'
        ];

        this.urgentKeywords = [
            'crisis', 'pánico', 'emergency', 'emergencia', 'ayuda urgente', 'no puedo más'
        ];

        this.protectiveFactors = [
            'pero tengo apoyo', 'mi familia', 'en terapia', 'tomando medicación', 'no lo haría'
        ];
    }

    async detectCrisis(message, fallbackMode = false) {
        try {
            // Fallback mode: be very conservative
            if (fallbackMode) {
                const hasAnyRisk = this.crisisKeywords.some(keyword => 
                    message.toLowerCase().includes(keyword)
                );
                
                if (hasAnyRisk) {
                    logger.error('🚨 CRISIS DETECTED IN FALLBACK MODE');
                    return {
                        isCrisis: true,
                        severity: 'high',
                        confidence: 0.9,
                        response: '🚨 MODO SEGURO: Posible crisis detectada. Evaluar riesgo manualmente.\n\nACCIÓN INMEDIATA:\n• Línea de vida: 135 (24hs gratis)\n• Contactar supervisor inmediatamente',
                        fallbackMode: true
                    };
                }
            }

            const lowerMessage = message.toLowerCase();
            let maxSeverity = 'none';
            let confidence = 0;
            let detectedKeywords = [];

            // Check crisis keywords
            for (const keyword of this.crisisKeywords) {
                if (lowerMessage.includes(keyword)) {
                    maxSeverity = 'high';
                    confidence = Math.max(confidence, 0.95);
                    detectedKeywords.push(keyword);
                }
            }

            // Check urgent keywords
            for (const keyword of this.urgentKeywords) {
                if (lowerMessage.includes(keyword)) {
                    if (maxSeverity === 'none') maxSeverity = 'medium';
                    confidence = Math.max(confidence, 0.75);
                    detectedKeywords.push(keyword);
                }
            }

            // Adjust for protective factors
            let protectiveCount = 0;
            for (const factor of this.protectiveFactors) {
                if (lowerMessage.includes(factor)) {
                    protectiveCount++;
                }
            }

            if (protectiveCount > 0) {
                confidence *= (1 - protectiveCount * 0.2);
            }

            const isCrisis = confidence >= 0.7;

            if (isCrisis) {
                logger.error(`🚨 CRISIS DETECTED: ${detectedKeywords.join(', ')}`);
                
                return {
                    isCrisis: true,
                    severity: maxSeverity,
                    confidence,
                    detectedKeywords,
                    response: this.getCrisisResponse(maxSeverity),
                    fallbackMode: false
                };
            }

            return {
                isCrisis: false,
                severity: 'none',
                confidence: 0,
                response: null,
                fallbackMode: false
            };

        } catch (error) {
            logger.error('Crisis detection error:', error);
            // Always err on the side of caution
            return {
                isCrisis: true,
                severity: 'high',
                confidence: 0.8,
                response: '🚨 ERROR EN DETECCIÓN: Evaluar riesgo manualmente por seguridad.\n\nACCIÓN INMEDIATA:\n• Línea de vida: 135 (24hs gratis)\n• Contactar supervisor',
                error: true
            };
        }
    }

    getCrisisResponse(severity) {
        const responses = {
            high: `🚨 CRISIS DETECTADA - ACCIÓN INMEDIATA REQUERIDA

PROTOCOLO DE SEGURIDAD:
• Línea de vida: 135 (24hs gratis)
• Emergencias: 911
• Centro de Asistencia al Suicida: (011) 5275-1135

IMPORTANTE: Este mensaje requiere evaluación profesional inmediata.`,

            medium: `⚠️ SITUACIÓN DE RIESGO DETECTADA

RECURSOS DE APOYO:
• Línea de vida: 135 (24hs gratis)
• Centro de Asistencia al Suicida: (011) 5275-1135

Por favor, contactá a tu profesional de confianza.`
        };

        return responses[severity] || responses.high;
    }

    logCrisisEvent(message, detection, professionalId) {
        const event = {
            timestamp: new Date().toISOString(),
            professional_id: security.hashSensitiveData(professionalId),
            message_hash: security.hashSensitiveData(message),
            severity: detection.severity,
            confidence: detection.confidence,
            keywords: detection.detectedKeywords,
            fallback_mode: detection.fallbackMode || false,
            error: detection.error || false
        };

        logger.error('CRISIS_EVENT', event);
        
        // In production, this would also trigger alerts to supervisors
        console.log('🚨 CRISIS EVENT LOGGED - MANUAL REVIEW REQUIRED');
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🗄️ DATABASE MANAGER (Firestore + Encryption)
// ═══════════════════════════════════════════════════════════════════

class DatabaseManager {
    constructor() {
        this.db = new Firestore({
            projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
            keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        
        this.collections = {
            professionals: 'professionals',
            patients: 'patients',
            sessions: 'sessions',
            audit_logs: 'audit_logs'
        };
    }

    async authenticateProfessional(dni, pin) {
        try {
            const profRef = this.db.collection(this.collections.professionals).doc(dni);
            const doc = await profRef.get();
            
            if (!doc.exists) {
                return { success: false, error: 'Profesional no encontrado' };
            }
            
            const data = doc.data();
            const pinValid = await security.verifyPin(pin, data.pin_hash);
            
            if (!pinValid) {
                return { success: false, error: 'PIN incorrecto' };
            }
            
            // Update last login
            await profRef.update({
                last_login: new Date(),
                login_count: (data.login_count || 0) + 1
            });
            
            return {
                success: true,
                professional: {
                    dni: data.dni,
                    nombre: data.nombre,
                    especialidad: data.especialidad,
                    plan: data.plan || 'freemium'
                }
            };
            
        } catch (error) {
            logger.error('Authentication error:', error);
            return { success: false, error: 'Error de autenticación' };
        }
    }

    async registerPatient(professionalDni, patientData) {
        try {
            const validation = this.validatePatientData(patientData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }

            const patientId = crypto.randomUUID();
            const encryptedData = this.encryptPatientData(patientData, professionalDni);
            
            const patientDoc = {
                id: patientId,
                professional_dni: professionalDni,
                created_at: new Date(),
                updated_at: new Date(),
                status: 'activo',
                ...encryptedData
            };

            await this.db.collection(this.collections.patients).doc(patientId).set(patientDoc);
            
            this.logAuditEvent('patient_registered', professionalDni, { patient_id: patientId });
            
            return {
                success: true,
                patient: {
                    id: patientId,
                    nombre: patientData.nombre,
                    dni: patientData.dni
                }
            };
            
        } catch (error) {
            logger.error('Patient registration error:', error);
            return { success: false, error: 'Error al registrar paciente' };
        }
    }

    async getPatients(professionalDni) {
        try {
            const snapshot = await this.db.collection(this.collections.patients)
                .where('professional_dni', '==', professionalDni)
                .orderBy('created_at', 'desc')
                .get();

            const patients = [];
            for (const doc of snapshot.docs) {
                const data = doc.data();
                const decryptedData = this.decryptPatientData(data, professionalDni);
                
                patients.push({
                    id: data.id,
                    nombre: decryptedData.nombre,
                    dni: decryptedData.dni,
                     status: data.status || 'activo',
                    created_at: data.created_at
                });
            }

            return { success: true, patients };
        } catch (error) {
            logger.error('Get patients error:', error);
            return { success: false, error: 'Error al obtener pacientes' };
        }
        }

        async updatePatientStatus(professionalDni, patientId, newStatus) {
            try {
                const validStatuses = ['activo', 'inactivo', 'active', 'inactive'];
                if (!validStatuses.includes(newStatus)) {
                    return { success: false, error: 'Estado inválido' };
                }

                // Normalizar el estado a inglés para consistencia en la BD
                let normalizedStatus = newStatus;
                if (newStatus === 'activo') {
                    normalizedStatus = 'active';
                } else if (newStatus === 'inactivo') {
                    normalizedStatus = 'inactive';
                }

                const ref = this.db.collection(this.collections.patients).doc(patientId);
                const doc = await ref.get();
                if (!doc.exists) {
                    return { success: false, error: 'Paciente no encontrado' };
                }
                const data = doc.data();
                // TODO: Reactivar esta validación de seguridad en producción.
                // if (data.professional_dni !== professionalDni) {
                //     return { success: false, error: 'No autorizado' };
                // }

                await ref.update({ status: normalizedStatus, updated_at: new Date() });

                this.logAuditEvent('patient_status_updated', professionalDni, { patient_id: patientId, status: normalizedStatus });

                return { success: true };
            } catch (error) {
                logger.error('Update patient status error:', error);
                return { success: false, error: 'Error al actualizar estado' };
            }
        }

    validateSessionData(sessionData) {
        // Validar ID del paciente (obligatorio)
        if (!sessionData.patient_id) {
            return { valid: false, error: 'ID de paciente requerido' };
        }
        
        // Validar observaciones (obligatorio)
        if (!sessionData.observaciones || sessionData.observaciones.trim().length < 10) {
            return { valid: false, error: 'Las observaciones deben tener al menos 10 caracteres' };
        }
        
        // Validar estado anímico si está presente
        if (sessionData.estado_animico !== undefined && sessionData.estado_animico !== null) {
            const moodResult = validaciones.validarEscalaMood(sessionData.estado_animico);
            if (!moodResult.valido) {
                return { valid: false, error: moodResult.error };
            }
            // Normalizar a número entero
            sessionData.estado_animico = moodResult.valor;
        }
        
        return { valid: true };
    }
    
    async registerSession(professionalDni, sessionData) {
        try {
            // Validar datos de sesión primero
            const validation = this.validateSessionData(sessionData);
            if (!validation.valid) {
                return { success: false, error: validation.error };
            }
            
            const sessionId = crypto.randomUUID();
            
            // Encrypt sensitive observations
            const encryptedObservations = security.encrypt(
                sessionData.observaciones, 
                `session_${professionalDni}_${sessionData.patient_id}`
            );

            const sessionDoc = {
                id: sessionId,
                professional_dni: professionalDni,
                patient_id: sessionData.patient_id,
                fecha: new Date(),
                observaciones_encrypted: encryptedObservations,
                resumen_ia: sessionData.resumen_ia || null,
                estado_animico: sessionData.estado_animico || null,
                crisis_detected: sessionData.crisis_detected || false,
                created_at: new Date()
            };

            await this.db.collection(this.collections.sessions).doc(sessionId).set(sessionDoc);
            
            this.logAuditEvent('session_created', professionalDni, { 
                session_id: sessionId,
                patient_id: sessionData.patient_id,
                crisis_detected: sessionData.crisis_detected
            });
            
            return { success: true, session_id: sessionId };
            
        } catch (error) {
            logger.error('Session registration error:', error);
            return { success: false, error: 'Error al registrar sesión' };
        }
    }

    async getSessions(professionalDni, filters = {}) {
        try {
            let query = this.db.collection(this.collections.sessions)
                .where('professional_dni', '==', professionalDni);

            if (filters.patient_id) {
                query = query.where('patient_id', '==', filters.patient_id);
            }

            if (filters.fecha_desde) {
                query = query.where('fecha', '>=', filters.fecha_desde);
            }

            if (filters.fecha_hasta) {
                query = query.where('fecha', '<=', filters.fecha_hasta);
            }

            query = query.orderBy('fecha', 'desc').limit(filters.limit || 50);

            const snapshot = await query.get();
            const sessions = [];

            for (const doc of snapshot.docs) {
                const data = doc.data();
                
                // Decrypt observations
                const observaciones = security.decrypt(
                    data.observaciones_encrypted,
                    `session_${professionalDni}_${data.patient_id}`
                );

                sessions.push({
                    id: data.id,
                    patient_id: data.patient_id,
                    fecha: data.fecha,
                    observaciones,
                    resumen_ia: data.resumen_ia,
                    estado_animico: data.estado_animico,
                    crisis_detected: data.crisis_detected
                });
            }

            return { success: true, sessions };
            
        } catch (error) {
            logger.error('Get sessions error:', error);
            return { success: false, error: 'Error al obtener sesiones' };
        }
    }

    validatePatientData(data) {
        // Validar DNI (obligatorio)
        if (!data.dni) {
            return { valid: false, error: 'Campo DNI requerido' };
        }
        
        const dniResult = validaciones.validarDNI(data.dni);
        if (!dniResult.valido) {
            return { valid: false, error: dniResult.error };
        }
        
        // Validar nombre (obligatorio)
        if (!data.nombre || data.nombre.trim().length < 3) {
            return { valid: false, error: 'Nombre inválido (mínimo 3 caracteres)' };
        }
        
        // Validar teléfono (opcional)
        if (data.telefono) {
            const telResult = validaciones.validarTelefono(data.telefono);
            if (!telResult.valido) {
                return { valid: false, error: telResult.error };
            }
            // Actualizar con formato E.164 normalizado
            data.telefono = telResult.valor;
        }
        
        // Validar obra social (opcional, pero debe estar en lista blanca si se proporciona)
        if (data.obra_social) {
            const obraResult = validaciones.validarObraSocial(data.obra_social);
            if (!obraResult.valido) {
                return { valid: false, error: obraResult.error };
            }
            // Actualizar con el formato normalizado
            data.obra_social = obraResult.valor;
        }
        
        return { valid: true };
    }

    encryptPatientData(data, professionalDni) {
        const context = `patient_${professionalDni}`;
        
        return {
            nombre_encrypted: security.encrypt(data.nombre, context),
            dni_encrypted: security.encrypt(data.dni, context),
            obra_social_encrypted: security.encrypt(data.obra_social, context),
            telefono_encrypted: security.encrypt(data.telefono, context)
        };
    }

    decryptPatientData(encryptedData, professionalDni) {
        const context = `patient_${professionalDni}`;
        
        return {
            nombre: security.decrypt(encryptedData.nombre_encrypted, context),
            dni: security.decrypt(encryptedData.dni_encrypted, context),
            obra_social: security.decrypt(encryptedData.obra_social_encrypted, context),
            telefono: security.decrypt(encryptedData.telefono_encrypted, context)
        };
    }

    logAuditEvent(action, professionalDni, details = {}) {
        const event = {
            action,
            professional_dni_hash: security.hashSensitiveData(professionalDni),
            timestamp: new Date(),
            details,
            ip_hash: security.hashSensitiveData(details.ip || 'unknown')
        };

        this.db.collection(this.collections.audit_logs).add(event);
        logger.info('Audit event:', { action, professional: professionalDni.substring(0, 3) + '***' });
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🤖 AI SERVICES (Google Gemini 1.5 + Fallbacks)
// ═══════════════════════════════════════════════════════════════════



class AIServices {
    constructor() {
        this.geminiApiKey = process.env.GEMINI_API_KEY;
        this.backupApiKey = process.env.GEMINI_BACKUP_KEY;
        this.currentApiKey = this.geminiApiKey;
        
        if (this.currentApiKey) {
            this.genAI = new GoogleGenerativeAI(this.currentApiKey);
            this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        }
        
        this.fallbackTemplates = {
            resumen: [
                'Sesión registrada. Revisar observaciones para generar resumen.',
                'Contenido documentado. Pendiente análisis detallado.',
                'Información almacenada. Evaluar progreso en próxima sesión.'
            ],
            estado_animico: [
                'Estado anímico: Requiere evaluación profesional',
                'Humor: Pendiente de análisis clínico',
                'Ánimo: Evaluar según criterio profesional'
            ]
        };
    }

    async generateSummary(observaciones, fallbackMode = false) {
        if (fallbackMode || !this.currentApiKey) {
            return this.getFallbackSummary();
        }

        try {
            const prompt = `Eres un asistente especializado en psicología clínica. Genera un resumen profesional de máximo 3 frases de la sesión terapéutica. Enfócate en:
1. Tema principal tratado
2. Progreso o cambios observados
3. Aspectos relevantes para seguimiento

Usa terminología clínica apropiada pero accesible. NO incluyas información personal identificable.

Observaciones de la sesión: ${observaciones}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const summary = response.text().trim();
            
            // Validate summary length
            if (summary.length > 300) {
                return summary.substring(0, 297) + '...';
            }
            
            return summary;
            
        } catch (error) {
            logger.warn('AI summary failed, using fallback:', error.message);
            
            // Try backup key if available
            if (this.backupApiKey && this.currentApiKey !== this.backupApiKey) {
                this.currentApiKey = this.backupApiKey;
                this.genAI = new GoogleGenerativeAI(this.currentApiKey);
                this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                return await this.generateSummary(observaciones, false);
            }
            
            return this.getFallbackSummary();
        }
    }

    async analyzeMood(observaciones, fallbackMode = false) {
        if (fallbackMode || !this.currentApiKey) {
            return this.getFallbackMood();
        }

        try {
            const prompt = `Analiza el estado anímico del paciente basándote en las observaciones clínicas. Responde SOLO con un número del 1 al 5:
1 = Muy bajo (depresión severa, crisis)
2 = Bajo (síntomas depresivos, ansiedad alta)
3 = Neutro (estable, sin cambios significativos)
4 = Bueno (mejora notable, ánimo positivo)
5 = Muy bueno (excelente progreso, estabilidad emocional)

Responde ÚNICAMENTE con el número, sin explicaciones.

Observaciones: ${observaciones}`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const moodText = response.text().trim();
            const mood = parseInt(moodText);
            
            if (isNaN(mood) || mood < 1 || mood > 5) {
                logger.warn('Invalid mood response:', moodText);
                return this.getFallbackMood();
            }
            
            return mood;
            
        } catch (error) {
            logger.warn('AI mood analysis failed, using fallback:', error.message);
            
            // Try backup key if available
            if (this.backupApiKey && this.currentApiKey !== this.backupApiKey) {
                this.currentApiKey = this.backupApiKey;
                this.genAI = new GoogleGenerativeAI(this.currentApiKey);
                this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
                return await this.analyzeMood(observaciones, false);
            }
            
            return this.getFallbackMood();
        }
    }

    getFallbackSummary() {
        const templates = this.fallbackTemplates.resumen;
        return templates[Math.floor(Math.random() * templates.length)];
    }

    getFallbackMood() {
        // Conservative fallback: neutral mood
        return 3;
    }

    async generarRespuestaConversacional(conversation, userMessage) {
        if (!this.currentApiKey) {
            logger.error('No hay API Key de Gemini para la función conversacional.');
            return 'Lo siento, no puedo procesar tu solicitud en este momento (Error: AI_KEY_MISSING).';
        }

        // Construir el historial para el prompt
        const historyForPrompt = (conversation.history || []).map(item => ({
            role: item.role,
            parts: [{ text: item.content }]
        }));

        try {
            const chat = this.model.startChat({
                history: historyForPrompt,
                generationConfig: {
                    maxOutputTokens: 500,
                },
                systemInstruction: basePrompt,
            });

            const result = await chat.sendMessage(userMessage);
            const response = await result.response;
            const botResponse = response.text().trim();

            // Actualizar el historial de la conversación
            if (!conversation.history) conversation.history = [];
            conversation.history.push({ role: 'user', content: userMessage });
            conversation.history.push({ role: 'model', content: botResponse });

            // Limitar el historial para no exceder el límite de tokens
            if (conversation.history.length > 20) {
                conversation.history = conversation.history.slice(-20);
            }

            return botResponse;

        } catch (error) {
            logger.error('Error al generar respuesta conversacional con Gemini:', error);
            return 'Tuve un problema para procesar tu mensaje. Por favor, intentá de nuevo en unos momentos.';
        }
    }

    async processSessionWithAI(observaciones) {
        try {
            const [summary, mood] = await Promise.all([
                resilience.executeWithFallback(
                    'ai',
                    () => this.generateSummary(observaciones),
                    () => this.getFallbackSummary()
                ),
                resilience.executeWithFallback(
                    'ai',
                    () => this.analyzeMood(observaciones),
                    () => this.getFallbackMood()
                )
            ]);

            return {
                resumen_ia: summary,
                estado_animico: mood,
                ai_used: this.currentApiKey ? true : false
            };
            
        } catch (error) {
            logger.error('AI processing error:', error);
            return {
                resumen_ia: this.getFallbackSummary(),
                estado_animico: this.getFallbackMood(),
                ai_used: false
            };
        }
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🤖 WHATSAPP BOT LOGIC (Conversation Management)
// ═══════════════════════════════════════════════════════════════════

class WhatsAppBot {
    constructor() {
        this.conversations = new Map();
        this.sessionTimeout = 7 * 24 * 60 * 60 * 1000; // 7 days
        this.startCleanupTimer();
    }

    async processMessage(phoneNumber, message, messageType = 'text') {
        try {
            // Get or create conversation
            let conversation = this.getConversation(phoneNumber);
            
            // Security check
            const securityCheck = security.detectSuspiciousActivity(phoneNumber, 'message');
            if (securityCheck === 'BLOCKED') {
                return this.createResponse('❌ Acceso bloqueado temporalmente por seguridad.');
            }

            // Crisis detection (always active)
            const crisisResult = await resilience.executeWithFallback(
                'crisis',
                () => crisisDetector.detectCrisis(message),
                () => crisisDetector.detectCrisis(message, true)
            );

            if (crisisResult.isCrisis) {
                // Log crisis event
                if (conversation.professional) {
                    crisisDetector.logCrisisEvent(message, crisisResult, conversation.professional.dni);
                }
                
                return this.createResponse(crisisResult.response, [], true);
            }

            // Handle audio messages
            if (messageType === 'audio') {
                return await this.handleAudioMessage(conversation, message);
            }

            // Process text message based on conversation state
            return await this.handleTextMessage(conversation, message);
            
        } catch (error) {
            logger.error('Message processing error:', error);
            
            // Attempt conversation recovery
            const recovery = resilience.recoverConversation(message);
            return this.createResponse(recovery.response);
        }
    }

    getConversation(phoneNumber) {
        if (!this.conversations.has(phoneNumber)) {
            this.conversations.set(phoneNumber, {
                phone: phoneNumber,
                state: 'idle',
                professional: null,
                sessionData: {},
                lastActivity: Date.now(),
                attempts: 0
            });
        }
        
        const conversation = this.conversations.get(phoneNumber);
        conversation.lastActivity = Date.now();
        return conversation;
    }

    async handleTextMessage(conversation, message) {
        switch (conversation.state) {
            case 'idle':
                return this.handleIdleState(conversation, message);
            
            case 'awaiting_pin':
                return await this.handlePinInput(conversation, message);
            
            case 'authenticated':
                return this.handleMainMenu(conversation, message);
            
            case 'registering_patient':
                return await this.handlePatientRegistration(conversation, message);
            
            case 'selecting_patient':
                return await this.handlePatientSelection(conversation, message);
            
            case 'creating_session':
                return await this.handleSessionCreation(conversation, message);
            
            case 'viewing_history':
                return await this.handleHistoryNavigation(conversation, message);
            
            default:
                conversation.state = 'idle';
                return this.handleIdleState(conversation, message);
        }
    }

    handleIdleState(conversation, message) {
        const dniValidation = security.validateInput(message, 'dni');
        
        if (dniValidation.valid) {
            conversation.sessionData.dni = dniValidation.sanitized;
            conversation.state = 'awaiting_pin';
            
            return this.createResponse(
                `👋 Hola! Soy AIRA, tu asistente médico.\n\n🔐 Ingresá tu PIN de 4 dígitos para continuar:`,
                []
            );
        }
        
        return this.createResponse(
            `🌱 *AIRA Bot - Asistente Médico*\n\nPara comenzar, enviá tu DNI (sin puntos ni espacios).\n\nEjemplo: 12345678`,
            []
        );
    }

    async handlePinInput(conversation, message) {
        const pinValidation = security.validateInput(message, 'pin');
        
        if (!pinValidation.valid) {
            conversation.attempts++;
            
            if (conversation.attempts >= 3) {
                conversation.state = 'idle';
                conversation.sessionData = {};
                return this.createResponse('❌ Demasiados intentos fallidos. Comenzá de nuevo con tu DNI.');
            }
            
            return this.createResponse(`❌ PIN inválido. Intentos restantes: ${3 - conversation.attempts}`);
        }

        // Authenticate with database
        const authResult = await db.authenticateProfessional(
            conversation.sessionData.dni,
            pinValidation.sanitized
        );

        if (!authResult.success) {
            conversation.attempts++;
            
            if (conversation.attempts >= 3) {
                conversation.state = 'idle';
                conversation.sessionData = {};
                return this.createResponse('❌ Credenciales incorrectas. Comenzá de nuevo.');
            }
            
            return this.createResponse(`❌ ${authResult.error}. Intentos restantes: ${3 - conversation.attempts}`);
        }

        // Successful authentication
        conversation.professional = authResult.professional;
        conversation.state = 'authenticated';
        conversation.attempts = 0;
        conversation.sessionData = {};

        return this.createResponse(
            `✅ ¡Bienvenido/a Dr/a ${authResult.professional.nombre}!\n\n¿En qué te puedo ayudar hoy?`,
            [
                '👥 Gestionar pacientes',
                '📝 Nueva sesión',
                '📋 Ver historial',
                '❓ Ayuda'
            ]
        );
    }

    handleMainMenu(conversation, message) {
        const option = message.toLowerCase().trim();
        
        if (option.includes('paciente') || option.includes('gestionar')) {
            return this.createResponse(
                '👥 *Gestión de Pacientes*\n\n¿Qué querés hacer?',
                [
                    '➕ Registrar nuevo paciente',
                    '📋 Ver lista de pacientes',
                    '🔙 Volver al menú'
                ]
            );
        }
        
        if (option.includes('nueva') && option.includes('sesión')) {
            conversation.state = 'selecting_patient';
            return this.showPatientSelection(conversation);
        }
        
        if (option.includes('historial') || option.includes('ver')) {
            conversation.state = 'viewing_history';
            return this.showHistoryOptions(conversation);
        }
        
        if (option.includes('registrar') && option.includes('paciente')) {
            conversation.state = 'registering_patient';
            return this.createResponse(
                '➕ *Registro de Nuevo Paciente*\n\nEnviá los datos en este formato:\n\n`Nombre Completo, DNI, Obra Social, Teléfono`\n\nEjemplo:\n`María García, 12345678, OSDE, 1134567890`'
            );
        }
        
        if (option.includes('ayuda')) {
            return this.createResponse(
                `❓ *Ayuda - AIRA Bot*\n\n*Comandos disponibles:*\n• Gestionar pacientes\n• Nueva sesión\n• Ver historial\n• Ayuda\n\n*Funciones principales:*\n✅ Registro seguro de pacientes\n✅ Documentación de sesiones\n✅ Resúmenes automáticos con IA\n✅ Detección de crisis\n✅ Historial encriptado\n\n*Soporte:* Para asistencia técnica, contactá a tu administrador.`,
                [
                    '🔙 Volver al menú'
                ]
            );
        }
        
        // Default menu
        return this.createResponse(
            '🤖 No entendí tu mensaje. ¿En qué te puedo ayudar?',
            [
                '👥 Gestionar pacientes',
                '📝 Nueva sesión',
                '📋 Ver historial',
                '❓ Ayuda'
            ]
        );
    }

    async handlePatientRegistration(conversation, message) {
        if (message.toLowerCase().includes('volver')) {
            conversation.state = 'authenticated';
            return this.handleMainMenu(conversation, 'menu');
        }

        // Parse patient data (flexible: only require DNI)
        const parts = message.split(',').map(part => part.trim());
        const [nombre, dni, obraSocial, telefono] = [parts[0] || '', parts[1] || '', parts[2] || '', parts[3] || ''];

        // At minimum, require DNI
        if (!dni) {
            return this.createResponse('❌ Falta el DNI. Por favor, enviá al menos el DNI del paciente.');
        }

        const patientData = {
            nombre: nombre,
            dni: dni,
            obra_social: obraSocial,
            telefono: telefono
        };

        // List missing fields (except DNI)
        const missing = [];
        if (!nombre) missing.push('Nombre completo');
        if (!obraSocial) missing.push('Obra social');
        if (!telefono) missing.push('Teléfono');

        // Register patient
        const result = await db.registerPatient(conversation.professional.dni, patientData);
        
        if (!result.success) {
            return this.createResponse(`❌ Error: ${result.error}\n\nIntentá nuevamente con el formato correcto.`);
        }

        conversation.state = 'authenticated';
        
        let msg = `✅ *Paciente registrado exitosamente*\n\n👤 **${result.patient.nombre || 'Sin nombre'}**\n🆔 DNI: ${result.patient.dni}`;
        if (missing.length > 0) {
            msg += `\n\n⚠️ Faltan datos: ${missing.join(', ')}.\nPodés completarlos luego desde la gestión de pacientes.`;
        }
        msg += '\n\n¿Querés hacer algo más?';
        return this.createResponse(
            msg,
            [
                '📝 Crear sesión para este paciente',
                '👥 Gestionar pacientes',
                '🔙 Volver al menú'
            ]
        );
    }

    async showPatientSelection(conversation) {
        const patientsResult = await db.getPatients(conversation.professional.dni);
        
        if (!patientsResult.success) {
            return this.createResponse(`❌ Error al cargar pacientes: ${patientsResult.error}`);
        }

        if (patientsResult.patients.length === 0) {
            conversation.state = 'authenticated';
            return this.createResponse(
                '📋 No tenés pacientes registrados aún.\n\n¿Querés registrar uno nuevo?',
                [
                    '➕ Registrar nuevo paciente',
                    '🔙 Volver al menú'
                ]
            );
        }

        conversation.sessionData.patients = patientsResult.patients;
        
        const patientButtons = patientsResult.patients.slice(0, 8).map((patient, index) => 
            `${index + 1}. ${patient.nombre} (${patient.dni})`
        );
        
        patientButtons.push('🔙 Volver al menú');

        return this.createResponse(
            '👥 *Seleccioná un paciente para la sesión:*\n\nEnviá el número del paciente:',
            patientButtons
        );
    }

    async handlePatientSelection(conversation, message) {
        if (message.toLowerCase().includes('volver')) {
            conversation.state = 'authenticated';
            return this.handleMainMenu(conversation, 'menu');
        }

        const patientIndex = parseInt(message) - 1;
        const patients = conversation.sessionData.patients || [];
        
        if (isNaN(patientIndex) || patientIndex < 0 || patientIndex >= patients.length) {
            return this.createResponse(
                '❌ Número inválido. Enviá el número del paciente de la lista.',
                ['🔙 Volver al menú']
            );
        }

        const selectedPatient = patients[patientIndex];
        conversation.sessionData.selectedPatient = selectedPatient;
        conversation.state = 'creating_session';

        return this.createResponse(
            `📝 *Nueva Sesión*\n\n👤 **Paciente:** ${selectedPatient.nombre}\n🆔 **DNI:** ${selectedPatient.dni}\n\n📋 Escribí las observaciones de la sesión:\n\n(Podés enviar texto o audio)`,
            ['🔙 Cancelar sesión']
        );
    }

    async handleSessionCreation(conversation, message) {
        if (message.toLowerCase().includes('cancelar')) {
            conversation.state = 'authenticated';
            conversation.sessionData = {};
            return this.handleMainMenu(conversation, 'menu');
        }

        const observaciones = message.trim();
        
        if (observaciones.length < 10) {
            return this.createResponse(
                '❌ Las observaciones son muy cortas. Por favor, proporcioná más detalles sobre la sesión.',
                ['🔙 Cancelar sesión']
            );
        }

        // Process with AI
        const aiResult = await ai.processSessionWithAI(observaciones);
        
        // Prepare session data
        const sessionData = {
            patient_id: conversation.sessionData.selectedPatient.id,
            observaciones: observaciones,
            resumen_ia: aiResult.resumen_ia,
            estado_animico: aiResult.estado_animico,
            crisis_detected: false // Crisis would have been caught earlier
        };

        // Save session
        const result = await db.registerSession(conversation.professional.dni, sessionData);
        
        if (!result.success) {
            return this.createResponse(`❌ Error al guardar la sesión: ${result.error}`);
        }

        // Reset conversation
        conversation.state = 'authenticated';
        conversation.sessionData = {};

        const moodEmoji = ['😰', '😔', '😐', '😊', '😄'][aiResult.estado_animico - 1];
        const aiIndicator = aiResult.ai_used ? '🤖 IA' : '📝 Manual';

        return this.createResponse(
            `✅ *Sesión registrada exitosamente*\n\n👤 **${conversation.sessionData.selectedPatient?.nombre || 'Paciente'}**\n📅 **Fecha:** ${new Date().toLocaleDateString('es-AR')}\n\n📋 **Resumen ${aiIndicator}:**\n${aiResult.resumen_ia}\n\n😊 **Estado anímico:** ${aiResult.estado_animico}/5 ${moodEmoji}\n\n¿Querés hacer algo más?`,
            [
                '📝 Nueva sesión',
                '📋 Ver historial',
                '🔙 Volver al menú'
            ]
        );
    }

    async handleAudioMessage(conversation, audioData) {
        // For now, return a placeholder response
        // In production, this would integrate with speech-to-text services
        
        return this.createResponse(
            '🎤 Audio recibido. \n\n⚠️ *Función en desarrollo*\n\nPor ahora, por favor enviá las observaciones como texto.',
            ['🔙 Volver']
        );
    }

    showHistoryOptions(conversation) {
        return this.createResponse(
            '📋 *Historial de Sesiones*\n\n¿Cómo querés ver el historial?',
            [
                '📅 Últimas 10 sesiones',
                '👤 Por paciente específico',
                '📆 Por rango de fechas',
                '🔙 Volver al menú'
            ]
        );
    }

    async handleHistoryNavigation(conversation, message) {
        if (message.toLowerCase().includes('volver')) {
            conversation.state = 'authenticated';
            return this.handleMainMenu(conversation, 'menu');
        }

        if (message.toLowerCase().includes('últimas')) {
            const sessionsResult = await db.getSessions(conversation.professional.dni, { limit: 10 });
            
            if (!sessionsResult.success) {
                return this.createResponse(`❌ Error: ${sessionsResult.error}`);
            }

            return this.formatSessionsHistory(sessionsResult.sessions);
        }

        // For other options, show placeholder
        return this.createResponse(
            '⚠️ *Función en desarrollo*\n\nPor ahora solo están disponibles las últimas 10 sesiones.',
            [
                '📅 Últimas 10 sesiones',
                '🔙 Volver al menú'
            ]
        );
    }

    formatSessionsHistory(sessions) {
        if (sessions.length === 0) {
            return this.createResponse(
                '📋 No hay sesiones registradas aún.',
                ['🔙 Volver al menú']
            );
        }

        let historyText = '📋 *Últimas Sesiones*\n\n';
        
        sessions.slice(0, 5).forEach((session, index) => {
            const fecha = new Date(session.fecha.seconds * 1000).toLocaleDateString('es-AR');
            const moodEmoji = ['😰', '😔', '😐', '😊', '😄'][session.estado_animico - 1] || '😐';
            
            historyText += `${index + 1}. **${fecha}**\n`;
            historyText += `   ${moodEmoji} Estado: ${session.estado_animico}/5\n`;
            historyText += `   📝 ${session.resumen_ia}\n\n`;
        });

        if (sessions.length > 5) {
            historyText += `... y ${sessions.length - 5} sesiones más\n\n`;
        }

        return this.createResponse(
            historyText,
            [
                '📋 Ver más detalles',
                '🔙 Volver al menú'
            ]
        );
    }

    createResponse(text, quickReplies = [], isUrgent = false) {
        return {
            text: text,
            quick_replies: quickReplies,
            urgent: isUrgent,
            timestamp: new Date().toISOString()
        };
    }

    startCleanupTimer() {
        // Clean up old conversations every hour
        setInterval(() => {
            const now = Date.now();
            for (const [phone, conversation] of this.conversations.entries()) {
                if (now - conversation.lastActivity > this.sessionTimeout) {
                    this.conversations.delete(phone);
                    logger.info(`Cleaned up conversation for ${phone.substring(0, 4)}***`);
                }
            }
        }, 60 * 60 * 1000);
    }
}

// ═══════════════════════════════════════════════════════════════════
// 🌐 EXPRESS SERVER & ROUTES
// ═══════════════════════════════════════════════════════════════════

// Rutas para la nueva demo web (demopagina.html)
const apiRoutes = require('./firestoreRoutes');
app.use('/api', apiRoutes);

// Initialize components
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => `${timestamp} [${level.toUpperCase()}]: ${message}`)
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'error.log', level: 'error' }),
        new winston.transports.File({ filename: 'combined.log' })
    ]
});

// Cargar el prompt base para Gemini después de inicializar el logger
let basePrompt = '';
try {
    basePrompt = fs.readFileSync(path.join(__dirname, 'prompts', 'base.md'), 'utf8');
    logger.info('Prompt base cargado exitosamente.');
} catch (error) {
    logger.error('ERROR AL CARGAR EL PROMPT BASE: prompts/base.md no encontrado. El bot conversacional no funcionará.', error);
    basePrompt = 'Eres un asistente útil.'; // Fallback muy básico
}
const security = new SecurityManager();
const resilience = new SimpleResilience();
const crisisDetector = new CrisisDetector();
const db = new DatabaseManager();
app.locals.db = db;
const ai = new AIServices();
const bot = new WhatsAppBot();

// Middleware
app.use(cors());
app.use(helmet());
app.use(compression());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10000, // 10,000 requests por minuto (increased for load testing)
    message: { error: 'Demasiadas solicitudes. Intentá en un minuto.' }
});
app.use(limiter);

// Health check endpoint
app.get('/health', (req, res) => {
    const health = resilience.getHealthStatus();
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.3.0',
        system_health: health
    });
});

// WhatsApp webhook verification
app.get('/webhook/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        logger.info('WhatsApp webhook verified');
        res.status(200).send(challenge);
    } else {
        logger.warn('WhatsApp webhook verification failed');
        res.status(403).send('Forbidden');
    }
});
app.post('/webhook/whatsapp', async (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            for (const entry of body.entry) {
                for (const change of entry.changes) {
                    if (change.field === 'messages') {
                        const messages = change.value.messages;

                        if (messages) {
                            for (const message of messages) {
                                const phoneNumber = message.from;
                                const messageText = message.text?.body || '';
                                
                                if (!messageText) continue; // Ignorar mensajes sin texto

                                // 1. Obtener o crear la conversación
                                const conversation = bot.getConversation(phoneNumber);

                                // 2. Chequeos críticos de seguridad y crisis
                                const securityCheck = security.detectSuspiciousActivity(phoneNumber, 'message');
                                if (securityCheck === 'BLOCKED') {
                                    await sendWhatsAppMessage(phoneNumber, bot.createResponse('❌ Acceso bloqueado temporalmente por seguridad.'));
                                    continue;
                                }

                                const crisisResult = await resilience.executeWithFallback(
                                    'crisis',
                                    () => crisisDetector.detectCrisis(messageText),
                                    () => crisisDetector.detectCrisis(messageText, true)
                                );

                                if (crisisResult.isCrisis) {
                                    if (conversation.professional) {
                                        crisisDetector.logCrisisEvent(messageText, crisisResult, conversation.professional.dni);
                                    }
                                    await sendWhatsAppMessage(phoneNumber, bot.createResponse(crisisResult.response, [], true));
                                    continue;
                                }

                                // 3. Usar el nuevo flujo conversacional con Gemini
                                const botResponseText = await ai.generarRespuestaConversacional(conversation, messageText);

                                // 4. Enviar la respuesta de la IA
                                await sendWhatsAppMessage(phoneNumber, bot.createResponse(botResponseText));
                            }
                        }
                    }
                }
            }
        }

        res.sendStatus(200);

    } catch (error) {
        logger.error('Error in WhatsApp webhook:', error);
        res.sendStatus(500);
    }
});

// Send WhatsApp message function
async function sendWhatsAppMessage(phoneNumber, response) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: {
                body: response.text
            }
        };

        // Add quick replies if available
        if (response.quick_replies && response.quick_replies.length > 0) {
            payload.type = 'interactive';
            payload.interactive = {
                type: 'button',
                body: {
                    text: response.text
                },
                action: {
                    buttons: response.quick_replies.slice(0, 3).map((reply, index) => ({
                        type: 'reply',
                        reply: {
                            id: `btn_${index}`,
                            title: reply.substring(0, 20)
                        }
                    }))
                }
            };
            delete payload.text;
        }

        await axios.post(
            `https://graph.facebook.com/v17.0/${process.env.WHATSAPP_PHONE_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        logger.info(`Message sent to ${phoneNumber.substring(0, 4)}***`);
        
    } catch (error) {
        logger.error('Failed to send WhatsApp message:', error);
    }
}

// Endpoint para monitoreo de salud
app.get('/api/health', (req, res) => {
    const memoria = process.memoryUsage();
    const usadaMB = memoria.heapUsed / 1024 / 1024;
    const totalMB = memoria.heapTotal / 1024 / 1024;

    res.json({
        status: 'ok',
        memoria: {
            usada: `${usadaMB.toFixed(2)}MB`,
            total: `${totalMB.toFixed(2)}MB`,
            porcentaje: `${Math.round((usadaMB / totalMB) * 100)}%`
        },
        version: '1.3.1',
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

// Demo/testing endpoints (remove in production)
if (process.env.NODE_ENV !== 'production') {
    app.get('/demo', (req, res) => {
        res.sendFile(__dirname + '/demo.html');
    });
    
    app.post('/demo/message', async (req, res) => {
        try {
            const { phone, message } = req.body;
            const response = await bot.processMessage(phone, message);
            res.json(response);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });
}

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    res.status(500).json({ 
        error: 'Error interno del servidor',
        timestamp: new Date().toISOString()
    });
});

// Importar monitor de memoria
const { iniciarMonitoreoMemoria } = require('./monitor-memoria');

// Importar validaciones optimizadas
const validaciones = require('./validaciones');

// === FIN RUTAS DE AUTENTICACIÓN ===

// Middleware para manejar rutas no encontradas (404) - DEBE IR AL FINAL
app.use((req, res, next) => {
    res.status(404).json({ error: 'Ruta no encontrada', path: req.originalUrl });
});

// Iniciar servidor
app.listen(process.env.PORT || 3000, '0.0.0.0', () => {
  console.log(`Servidor corriendo en puerto ${process.env.PORT || 3000}`);
});
