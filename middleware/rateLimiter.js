/**
 * 🛡️ RATE LIMITING MIDDLEWARE - AIRA Medical System
 * Rate limiting robusto y específico para autenticación
 * Versión 2.0 - Production Ready
 */

const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');

// Configuración centralizada de límites
const RATE_LIMITS = {
    // Endpoints de autenticación (muy restrictivos)
    auth: {
        windowMs: 15 * 60 * 1000,    // 15 minutos
        max: 5,                       // 5 intentos por ventana
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        message: {
            error: 'AUTH_RATE_LIMIT_EXCEEDED',
            message: 'Demasiados intentos de autenticación. Por favor, espera 15 minutos.',
            retryAfter: '15 minutos',
            code: 'AUTH_BLOCKED'
        }
    },
    
    // Login específico (aún más restrictivo)
    login: {
        windowMs: 15 * 60 * 1000,    // 15 minutos
        max: 3,                       // 3 intentos por ventana
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        message: {
            error: 'LOGIN_RATE_LIMIT_EXCEEDED',
            message: 'Demasiados intentos de login. Por favor, espera 15 minutos.',
            retryAfter: '15 minutos',
            code: 'LOGIN_BLOCKED'
        }
    },
    
    // Refresh tokens
    refresh: {
        windowMs: 60 * 60 * 1000,    // 1 hora
        max: 50,                      // 50 refresh por hora
        message: {
            error: 'REFRESH_RATE_LIMIT_EXCEEDED',
            message: 'Demasiados refresh de tokens. Por favor, espera 1 hora.',
            retryAfter: '1 hora',
            code: 'REFRESH_BLOCKED'
        }
    },
    
    // API general
    api: {
        windowMs: 1 * 60 * 1000,     // 1 minuto
        max: 100,                     // 100 requests por minuto
        message: {
            error: 'API_RATE_LIMIT_EXCEEDED',
            message: 'Demasiadas solicitudes a la API. Por favor, espera 1 minuto.',
            retryAfter: '1 minuto',
            code: 'API_THROTTLED'
        }
    },
    
    // Endpoints críticos (pacientes, sesiones)
    critical: {
        windowMs: 1 * 60 * 1000,     // 1 minuto
        max: 30,                      // 30 requests por minuto
        message: {
            error: 'CRITICAL_RATE_LIMIT_EXCEEDED',
            message: 'Demasiadas solicitudes críticas. Por favor, espera 1 minuto.',
            retryAfter: '1 minuto',
            code: 'CRITICAL_THROTTLED'
        }
    },
    
    // Upload de archivos
    upload: {
        windowMs: 1 * 60 * 1000,     // 1 minuto
        max: 5,                       // 5 uploads por minuto
        message: {
            error: 'UPLOAD_RATE_LIMIT_EXCEEDED',
            message: 'Demasiados uploads. Por favor, espera 1 minuto.',
            retryAfter: '1 minuto',
            code: 'UPLOAD_BLOCKED'
        }
    },
    
    // WhatsApp webhook
    whatsapp: {
        windowMs: 1 * 60 * 1000,     // 1 minuto
        max: 60,                      // 60 mensajes por minuto
        message: {
            error: 'WHATSAPP_RATE_LIMIT_EXCEEDED',
            message: 'Demasiados mensajes de WhatsApp. Por favor, espera 1 minuto.',
            retryAfter: '1 minuto',
            code: 'WHATSAPP_THROTTLED'
        }
    }
};

// Store en memoria para desarrollo/ fallback
class MemoryStore {
    constructor() {
        this.store = new Map();
        this.cleanupInterval = setInterval(() => this.cleanup(), 60000); // Cleanup cada minuto
    }
    
    async increment(key) {
        const now = Date.now();
        const record = this.store.get(key);
        
        if (!record) {
            const newRecord = {
                count: 1,
                resetTime: now + this.windowMs
            };
            this.store.set(key, newRecord);
            return newRecord;
        }
        
        // Reset si expiró
        if (now > record.resetTime) {
            record.count = 1;
            record.resetTime = now + this.windowMs;
        } else {
            record.count++;
        }
        
        return record;
    }
    
    async decrement(key) {
        const record = this.store.get(key);
        if (record && record.count > 0) {
            record.count--;
        }
    }
    
    async resetKey(key) {
        this.store.delete(key);
    }
    
    cleanup() {
        const now = Date.now();
        for (const [key, record] of this.store.entries()) {
            if (now > record.resetTime) {
                this.store.delete(key);
            }
        }
    }
    
    setWindowMs(ms) {
        this.windowMs = ms;
    }
    
    async shutdown() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }
}

// Crear store (Redis si está disponible, sino memoria)
let store;

try {
    // Intentar usar Redis (producción)
    if (process.env.REDIS_URL) {
        const redis = new Redis(process.env.REDIS_URL);
        store = new RedisStore({
            sendCommand: (...args) => redis.call(...args),
        });
        console.log('📦 Rate limiter using Redis store');
    }
} catch (error) {
    console.warn('⚠️ Redis not available, using memory store for rate limiting');
}

// Fallback a memoria
if (!store) {
    store = new MemoryStore();
    console.log('💾 Rate limiter using memory store');
}

/**
 * Crear rate limiter personalizado
 */
function createRateLimiter(type = 'api', options = {}) {
    const config = { ...RATE_LIMITS[type], ...options };
    
    // Setear windowMs en el store si es MemoryStore
    if (store.setWindowMs) {
        store.setWindowMs(config.windowMs);
    }
    
    return rateLimit({
        windowMs: config.windowMs,
        max: config.max,
        message: config.message,
        standardHeaders: true,
        legacyHeaders: false,
        store,
        skipSuccessfulRequests: config.skipSuccessfulRequests || false,
        skipFailedRequests: config.skipFailedRequests || false,
        keyGenerator: (req) => {
            // IP-based con user-based si está autenticado
            const ip = req.ip || req.connection.remoteAddress || 'unknown';
            if (req.user && req.user.id) {
                return `${ip}:${req.user.id}`;
            }
            return ip;
        },
        onLimitReached: (req, res, options) => {
            console.warn(`🚨 Rate limit exceeded: ${req.method} ${req.path} - IP: ${req.ip} - User: ${req.user?.id || 'anonymous'}`);
            
            // Logging para seguridad
            if (type === 'login' || type === 'auth') {
                console.error(`🔥 SECURITY ALERT: Authentication rate limit exceeded from ${req.ip}`);
            }
        },
        handler: (req, res) => {
            const retryAfter = Math.ceil(config.windowMs / 1000);
            res.setHeader('Retry-After', retryAfter);
            res.setHeader('X-RateLimit-Limit', config.max);
            res.setHeader('X-RateLimit-Remaining', 0);
            res.setHeader('X-RateLimit-Reset', new Date(Date.now() + config.windowMs).toISOString());
            
            res.status(429).json(config.message);
        }
    });
}

/**
 * Rate limiter específico para autenticación
 */
const authLimiter = createRateLimiter('auth');

/**
 * Rate limiter específico para login
 */
const loginLimiter = createRateLimiter('login');

/**
 * Rate limiter específico para refresh tokens
 */
const refreshLimiter = createRateLimiter('refresh');

/**
 * Rate limiter para API general
 */
const apiLimiter = createRateLimiter('api');

/**
 * Rate limiter para endpoints críticos
 */
const criticalLimiter = createRateLimiter('critical');

/**
 * Rate limiter para uploads
 */
const uploadLimiter = createRateLimiter('upload');

/**
 * Rate limiter para WhatsApp
 */
const whatsappLimiter = createRateLimiter('whatsapp');

/**
 * Middleware de rate limiting adaptativo
 */
function adaptiveRateLimiter(baseType = 'api') {
    return (req, res, next) => {
        // Seleccionar tipo basado en el rol del usuario
        let limiterType = baseType;
        
        if (req.user) {
            // Los usuarios premium tienen límites más permisivos
            if (req.user.role === 'premium' || req.user.role === 'admin') {
                // Aumentar límites en 50% para usuarios premium
                const customConfig = {
                    ...RATE_LIMITS[baseType],
                    max: Math.ceil(RATE_LIMITS[baseType].max * 1.5)
                };
                return createRateLimiter(baseType, customConfig)(req, res, next);
            }
        }
        
        return createRateLimiter(limiterType)(req, res, next);
    };
}

/**
 * Rate limiter con bloqueo progresivo
 */
function progressiveRateLimiter(baseType = 'auth') {
    const attempts = new Map();
    
    return (req, res, next) => {
        const key = req.ip || req.connection.remoteAddress;
        const now = Date.now();
        const attemptData = attempts.get(key) || { count: 0, lastAttempt: 0, blockTime: 0 };
        
        // Reset si pasó el tiempo de bloqueo
        if (now > attemptData.blockTime) {
            attemptData.count = 0;
            attemptData.blockTime = 0;
        }
        
        // Si está bloqueado
        if (attemptData.blockTime > now) {
            const timeLeft = Math.ceil((attemptData.blockTime - now) / 1000);
            return res.status(429).json({
                error: 'PROGRESSIVE_RATE_LIMIT_EXCEEDED',
                message: `Demasiados intentos. Cuenta bloqueada por ${timeLeft} segundos.`,
                retryAfter: timeLeft,
                code: 'PROGRESSIVE_BLOCK'
            });
        }
        
        // Contar intento
        attemptData.count++;
        attemptData.lastAttempt = now;
        
        // Aplicar bloqueo progresivo
        if (attemptData.count > RATE_LIMITS[baseType].max) {
            // Bloquear por tiempo exponencial
            const blockDuration = Math.min(
                Math.pow(2, attemptData.count - RATE_LIMITS[baseType].max) * 60000, // Exponencial, mínimo 1 minuto
                24 * 60 * 60 * 1000 // Máximo 24 horas
            );
            
            attemptData.blockTime = now + blockDuration;
            attempts.set(key, attemptData);
            
            return res.status(429).json({
                error: 'PROGRESSIVE_RATE_LIMIT_EXCEEDED',
                message: `Demasiados intentos. Cuenta bloqueada por ${Math.ceil(blockDuration / 1000)} segundos.`,
                retryAfter: Math.ceil(blockDuration / 1000),
                code: 'PROGRESSIVE_BLOCK'
            });
        }
        
        attempts.set(key, attemptData);
        next();
    };
}

/**
 * Middleware para añadir headers de rate limiting
 */
function addRateLimitHeaders(req, res, next) {
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', '99');
    res.setHeader('X-RateLimit-Reset', new Date(Date.now() + 60000).toISOString());
    next();
}

/**
 * Cleanup de stores de memoria
 */
function cleanup() {
    if (store.shutdown) {
        store.shutdown();
    }
}

// Cleanup al cerrar el proceso
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

module.exports = {
    // Limiters pre-configurados
    authLimiter,
    loginLimiter,
    refreshLimiter,
    apiLimiter,
    criticalLimiter,
    uploadLimiter,
    whatsappLimiter,
    
    // Funciones creatoras
    createRateLimiter,
    adaptiveRateLimiter,
    progressiveRateLimiter,
    
    // Middleware auxiliar
    addRateLimitHeaders,
    
    // Configuración
    RATE_LIMITS,
    
    // Store (para testing)
    store
};