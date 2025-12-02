/**
 * Middleware de Seguridad - AIRA Backend
 * Implementa todas las medidas de seguridad necesarias
 * @version 1.0.0
 */

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

// Configuración de seguridad
const securityConfig = {
    jwtSecret: process.env.JWT_SECRET || 'CHANGE_THIS_IN_PRODUCTION',
    jwtExpiry: '15m',
    jwtRefreshExpiry: '7d',
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDuration: 30 * 60 * 1000 // 30 minutos
};

/**
 * Configurar Helmet con políticas de seguridad
 */
const helmetConfig = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            scriptSrc: ["'self'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https:"],
            connectSrc: ["'self'", "https://firestore.googleapis.com", "https://api.whatsapp.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            objectSrc: ["'none'"],
            frameAncestors: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
        }
    },
    hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
    },
    crossOriginEmbedderPolicy: false // Permitir embeds de WhatsApp
});

/**
 * Rate limiting general para APIs
 */
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // límite de requests
    message: 'Demasiadas solicitudes desde esta IP, por favor intente más tarde.',
    standardHeaders: true,
    legacyHeaders: false,
    // Skip para IPs confiables (desarrollo)
    skip: (req) => {
        const trustedIPs = process.env.TRUSTED_IPS?.split(',') || [];
        return trustedIPs.includes(req.ip);
    }
});

/**
 * Rate limiting estricto para autenticación
 */
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // solo 5 intentos
    skipSuccessfulRequests: true,
    message: 'Demasiados intentos de login. Cuenta bloqueada temporalmente.',
    standardHeaders: true,
    legacyHeaders: false,
    // Store para tracking de intentos por usuario
    keyGenerator: (req) => {
        return req.body.email || req.body.dni || req.ip;
    }
});

/**
 * Rate limiting para creación de recursos
 */
const createLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 30, // 30 creaciones por hora
    message: 'Límite de creación de recursos excedido.',
    skipSuccessfulRequests: false
});

/**
 * Middleware de autenticación JWT
 */
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({
            error: 'Token de autenticación requerido',
            code: 'NO_TOKEN'
        });
    }

    jwt.verify(token, securityConfig.jwtSecret, (err, user) => {
        if (err) {
            // Log intento sospechoso
            console.error('JWT verification failed:', {
                error: err.message,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });

            if (err.name === 'TokenExpiredError') {
                return res.status(401).json({
                    error: 'Token expirado',
                    code: 'TOKEN_EXPIRED'
                });
            }

            return res.status(403).json({
                error: 'Token inválido',
                code: 'INVALID_TOKEN'
            });
        }

        // Verificar que el usuario aún existe y está activo
        if (!user.active) {
            return res.status(403).json({
                error: 'Usuario desactivado',
                code: 'USER_INACTIVE'
            });
        }

        req.user = user;
        next();
    });
};

/**
 * Sanitización de inputs
 */
const sanitizeInputs = (req, res, next) => {
    // Sanitizar body, query y params
    ['body', 'query', 'params'].forEach(location => {
        if (req[location]) {
            Object.keys(req[location]).forEach(key => {
                if (typeof req[location][key] === 'string') {
                    // Remover caracteres peligrosos
                    req[location][key] = req[location][key]
                        .replace(/[<>]/g, '')
                        .trim();
                }
            });
        }
    });

    next();
};

/**
 * Prevención de inyección NoSQL
 */
const preventNoSQLInjection = (req, res, next) => {
    // Detectar operadores MongoDB/NoSQL en inputs
    const checkForOperators = (obj) => {
        for (let key in obj) {
            if (key.startsWith('$') || key.includes('.')) {
                return true;
            }
            if (typeof obj[key] === 'object' && obj[key] !== null) {
                if (checkForOperators(obj[key])) return true;
            }
        }
        return false;
    };

    if (checkForOperators(req.body) || checkForOperators(req.query)) {
        console.error('NoSQL injection attempt detected:', {
            ip: req.ip,
            path: req.path,
            body: req.body,
            query: req.query
        });

        return res.status(400).json({
            error: 'Solicitud inválida',
            code: 'INVALID_REQUEST'
        });
    }

    next();
};

/**
 * Headers de seguridad adicionales
 */
const securityHeaders = (req, res, next) => {
    // Prevenir clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevenir MIME sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // XSS Protection (legacy browsers)
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Permissions Policy
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Cache Control para datos sensibles
    if (req.path.includes('/api/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }

    next();
};

/**
 * Logging de seguridad
 */
const securityLogger = (req, res, next) => {
    // Log de accesos a endpoints sensibles
    const sensitiveEndpoints = ['/api/auth', '/api/patients', '/api/sessions'];
    
    if (sensitiveEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
        console.log('Security Log:', {
            timestamp: new Date().toISOString(),
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('user-agent'),
            userId: req.user?.id || 'anonymous'
        });
    }

    next();
};

/**
 * Validación CSRF
 */
const validateCSRF = (req, res, next) => {
    // Skip para métodos seguros
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    const token = req.headers['x-csrf-token'] || req.body._csrf;
    const sessionToken = req.session?.csrfToken;

    if (!token || !sessionToken || token !== sessionToken) {
        return res.status(403).json({
            error: 'Token CSRF inválido',
            code: 'INVALID_CSRF_TOKEN'
        });
    }

    next();
};

/**
 * Generar token JWT
 */
const generateToken = (user) => {
    const payload = {
        id: user.id,
        email: user.email,
        role: user.role,
        active: true
    };

    const token = jwt.sign(payload, securityConfig.jwtSecret, {
        expiresIn: securityConfig.jwtExpiry,
        issuer: 'aira-app',
        audience: 'aira-users'
    });

    const refreshToken = jwt.sign(
        { id: user.id, type: 'refresh' },
        securityConfig.jwtSecret,
        { expiresIn: securityConfig.jwtRefreshExpiry }
    );

    return { token, refreshToken };
};

/**
 * Hash de contraseña
 */
const hashPassword = async (password) => {
    if (!password) {
        throw new Error('Password cannot be empty');
    }
    return await bcrypt.hash(password, securityConfig.bcryptRounds);
};

/**
 * Verificar contraseña de forma asíncrona
 */
const verifyPassword = async (password, hash) => {
    if (!password || !hash) {
        return false;
    }
    return await bcrypt.compare(password, hash);
};

/**
 * Middleware para detectar intentos de ataque
 */
const detectAttacks = (req, res, next) => {
    const suspiciousPatterns = [
        /(<script|javascript:|onerror|onload)/i,
        /(\.\.|\/\/|\\\\)/,
        /(union|select|insert|update|delete|drop)\s/i,
        /(\$ne|\$gt|\$lt|\$gte|\$lte|\$in|\$nin)/i // NoSQL operators
    ];

    const checkValue = JSON.stringify(req.body) + 
                      JSON.stringify(req.query) + 
                      req.path;

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(checkValue)) {
            console.error('Potential attack detected:', {
                pattern: pattern.toString(),
                ip: req.ip,
                path: req.path,
                method: req.method,
                timestamp: new Date().toISOString()
            });

            return res.status(400).json({
                error: 'Solicitud inválida',
                code: 'SUSPICIOUS_REQUEST'
            });
        }
    }

    next();
};

// Exportar todo
module.exports = {
    // Configuraciones
    helmetConfig,
    generalLimiter,
    authLimiter,
    createLimiter,
    
    // Middlewares
    authenticateToken,
    sanitizeInputs,
    preventNoSQLInjection,
    securityHeaders,
    securityLogger,
    validateCSRF,
    detectAttacks,
    
    // Utilidades
    generateToken,
    hashPassword,
    verifyPassword,
    securityConfig
}; 