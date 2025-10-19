/**
 * 🔐 AUTHENTICATION MIDDLEWARE - AIRA Medical System
 * Middleware robusto para autenticación JWT con RBAC
 * Versión 2.0 - Production Ready
 */

const AuthService = require('../services/authService');

// Instancia global del servicio
const authService = new AuthService();

/**
 * Provider de usuarios para Firestore/Database
 */
class UserProvider {
    constructor(db) {
        this.db = db;
    }

    async findById(userId) {
        try {
            // Para profesionales médicos
            const profRef = this.db.collection('professionals').doc(userId);
            const profDoc = await profRef.get();
            
            if (profDoc.exists) {
                const data = profDoc.data();
                return {
                    id: userId,
                    name: data.nombre,
                    email: data.email || `${userId}@aira.medical`,
                    role: data.role || 'professional',
                    passwordHash: data.password_hash,
                    status: data.status || 'active',
                    speciality: data.especialidad,
                    lastLogin: data.last_login
                };
            }

            // Para usuarios del dashboard (si aplica)
            const userRef = this.db.collection('users').doc(userId);
            const userDoc = await userRef.get();
            
            if (userDoc.exists) {
                const data = userDoc.data();
                return {
                    id: userId,
                    name: data.name,
                    email: data.email,
                    role: data.role || 'user',
                    passwordHash: data.password_hash,
                    status: data.status || 'active'
                };
            }

            return null;
        } catch (error) {
            console.error('Error finding user:', error);
            return null;
        }
    }

    async updateLastLogin(userId) {
        try {
            const profRef = this.db.collection('professionals').doc(userId);
            await profRef.update({
                last_login: new Date(),
                login_count: this.db.FieldValue.increment(1)
            });
        } catch (error) {
            console.error('Error updating last login:', error);
        }
    }
}

/**
 * Rate limiting específico para autenticación
 */
const authRateLimit = new Map();

function checkAuthRateLimit(req, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    
    if (!authRateLimit.has(key)) {
        authRateLimit.set(key, { count: 0, resetTime: now + windowMs });
    }
    
    const limit = authRateLimit.get(key);
    
    // Reset si pasó la ventana
    if (now > limit.resetTime) {
        limit.count = 0;
        limit.resetTime = now + windowMs;
    }
    
    limit.count++;
    
    if (limit.count > maxAttempts) {
        const timeLeft = Math.ceil((limit.resetTime - now) / 1000);
        return {
            allowed: false,
            error: 'RATE_LIMIT_EXCEEDED',
            retryAfter: timeLeft
        };
    }
    
    return { allowed: true };
}

/**
 * Middleware de autenticación principal
 */
function authenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                error: 'AUTH_REQUIRED',
                message: 'Se requiere token de autenticación',
                code: 'MISSING_BEARER_TOKEN'
            });
        }

        const token = authHeader.substring(7);
        
        // Verificar token con el servicio de autenticación
        const result = authService.verifySession(token);
        
        if (!result.valid) {
            let statusCode = 401;
            let message = 'Token inválido';
            
            switch (result.error) {
                case 'TOKEN_EXPIRED':
                    statusCode = 401;
                    message = 'Token expirado. Por favor, refresca tu sesión';
                    break;
                case 'TOKEN_BLACKLISTED':
                    statusCode = 401;
                    message = 'Sesión inválida. Inicia sesión nuevamente';
                    break;
                case 'SESSION_INACTIVE':
                    statusCode = 401;
                    message = 'Sesión inactiva. Inicia sesión nuevamente';
                    break;
                case 'TOKEN_INVALID':
                    statusCode = 401;
                    message = 'Token inválido o corrupto';
                    break;
            }
            
            return res.status(statusCode).json({
                error: result.error,
                message,
                code: result.error
            });
        }

        // Añadir información del usuario al request
        req.user = result.user;
        req.sessionId = result.user.sessionId;
        
        // Logging de acceso (sin datos sensibles)
        console.log(`🔐 Authenticated: ${result.user.role} ${result.user.id.substring(0, 4)}***`);
        
        next();
    } catch (error) {
        console.error('Authentication middleware error:', error);
        res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Error en el servidor de autenticación'
        });
    }
}

/**
 * Middleware de autenticación opcional
 */
function optionalAuthenticate(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }

        const token = authHeader.substring(7);
        const result = authService.verifySession(token);
        
        if (result.valid) {
            req.user = result.user;
            req.sessionId = result.user.sessionId;
        }
        
        next();
    } catch (error) {
        // En modo opcional, errores no bloquean el request
        console.warn('Optional authentication failed:', error.message);
        next();
    }
}

/**
 * Middleware para verificar roles específicos (RBAC)
 */
function requireRole(allowedRoles) {
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'AUTH_REQUIRED',
                message: 'Autenticación requerida'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                error: 'INSUFFICIENT_PERMISSIONS',
                message: `Rol '${req.user.role}' no autorizado. Se requiere: ${roles.join(', ')}`,
                requiredRoles: roles,
                currentRole: req.user.role
            });
        }

        next();
    };
}

/**
 * Middleware para verificar si es administrador
 */
function requireAdmin(req, res, next) {
    return requireRole(['admin', 'superadmin'])(req, res, next);
}

/**
 * Middleware para verificar si es profesional médico
 */
function requireProfessional(req, res, next) {
    return requireRole(['professional', 'admin', 'superadmin'])(req, res, next);
}

/**
 * Middleware para rate limiting en endpoints de auth
 */
function authRateLimitMiddleware(req, res, next) {
    const rateLimit = checkAuthRateLimit(req);
    
    if (!rateLimit.allowed) {
        return res.status(429).json({
            error: rateLimit.error,
            message: 'Demasiados intentos. Por favor, espera antes de intentar nuevamente',
            retryAfter: rateLimit.retryAfter,
            code: 'RATE_LIMIT_EXCEEDED'
        });
    }
    
    next();
}

/**
 * Middleware para validar que el usuario tenga acceso a sus propios recursos
 */
function requireOwnership(resourceUserIdField = 'userId') {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                error: 'AUTH_REQUIRED',
                message: 'Autenticación requerida'
            });
        }

        // Los admins pueden acceder a cualquier recurso
        if (['admin', 'superadmin'].includes(req.user.role)) {
            return next();
        }

        // Verificar ownership
        const resourceUserId = req.params[resourceUserIdField] || req.body[resourceUserIdField];
        
        if (resourceUserId !== req.user.id) {
            return res.status(403).json({
                error: 'ACCESS_DENIED',
                message: 'No tienes permisos para acceder a este recurso',
                code: 'OWNERSHIP_REQUIRED'
            });
        }

        next();
    };
}

/**
 * Middleware para añadir headers de seguridad
 */
function addSecurityHeaders(req, res, next) {
    // Headers para prevenir ataques
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Cache control para endpoints sensibles
    if (req.path.startsWith('/api/auth/')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
    }
    
    next();
}

/**
 * Middleware para logging de seguridad
 */
function securityLogger(req, res, next) {
    const start = Date.now();
    
    // Capturar response
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - start;
        const userId = req.user ? req.user.id.substring(0, 4) + '***' : 'anonymous';
        
        console.log(`🔐 ${req.method} ${req.path} - ${userId} - ${res.statusCode} - ${duration}ms`);
        
        // Log de eventos sospechosos
        if (res.statusCode === 401 || res.statusCode === 403) {
            console.warn(`🚨 Security event: ${req.method} ${req.path} - ${req.ip} - ${res.statusCode}`);
        }
        
        originalSend.call(this, data);
    };
    
    next();
}

/**
 * Middleware de validación de estado de cuenta
 */
function requireActiveAccount(req, res, next) {
    if (!req.user) {
        return res.status(401).json({
            error: 'AUTH_REQUIRED',
            message: 'Autenticación requerida'
        });
    }

    // Para implementación futura: verificar status en la base de datos
    if (req.user.status === 'inactive' || req.user.status === 'suspended') {
        return res.status(403).json({
            error: 'ACCOUNT_INACTIVE',
            message: 'Tu cuenta está inactiva. Contacta al administrador',
            status: req.user.status
        });
    }

    next();
}

module.exports = {
    // Instancia del servicio
    authService,
    
    // Factories
    UserProvider,
    
    // Middlewares principales
    authenticate,
    optionalAuthenticate,
    
    // RBAC
    requireRole,
    requireAdmin,
    requireProfessional,
    requireOwnership,
    
    // Seguridad
    authRateLimitMiddleware,
    addSecurityHeaders,
    securityLogger,
    requireActiveAccount,
    
    // Rate limiting
    checkAuthRateLimit
};