/**
 * 🔐 AUTHENTICATION ROUTES - AIRA Medical System
 * Endpoints seguros para autenticación JWT con refresh tokens
 * Versión 2.0 - Production Ready
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const rateLimit = require('express-rate-limit');
const { 
    authService, 
    UserProvider, 
    authRateLimitMiddleware,
    authenticate,
    optionalAuthenticate,
    addSecurityHeaders,
    securityLogger
} = require('../middleware/authMiddleware');

const router = express.Router();

// Rate limiting específico para endpoints críticos
const createAccountLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3, // máximo 3 intentos de creación de cuenta
    message: {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiados intentos de creación de cuenta. Por favor, espera 15 minutos.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos de login
    message: {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Demasiados intentos de login. Por favor, espera 15 minutos.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Middleware para validación de errores
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: 'Error en los datos proporcionados',
            details: errors.array()
        });
    }
    next();
};

// Middleware para inicializar UserProvider
const initializeUserProvider = (req, res, next) => {
    req.userProvider = new UserProvider(req.app.locals.db);
    next();
};

/**
 * POST /api/auth/login
 * Login de usuarios con tokens JWT
 */
router.post('/login', 
    securityLogger,
    addSecurityHeaders,
    loginLimiter,
    authRateLimitMiddleware,
    initializeUserProvider,
    [
        body('userId')
            .notEmpty()
            .withMessage('ID de usuario requerido')
            .isLength({ min: 3, max: 50 })
            .withMessage('ID de usuario debe tener entre 3 y 50 caracteres')
            .matches(/^[a-zA-Z0-9_-]+$/)
            .withMessage('ID de usuario solo puede contener letras, números, guiones y guiones bajos'),
        
        body('password')
            .notEmpty()
            .withMessage('Contraseña requerida')
            .isLength({ min: 1, max: 128 })
            .withMessage('Contraseña inválida')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { userId, password } = req.body;
            
            console.log(`🔐 Login attempt: ${userId.substring(0, 4)}*** from ${req.ip}`);
            
            // Intentar login con el servicio de autenticación
            const result = await authService.login(userId, password, req.userProvider);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Login exitoso',
                    data: result
                });
            } else {
                res.status(401).json({
                    error: 'LOGIN_FAILED',
                    message: 'Credenciales incorrectas'
                });
            }
            
        } catch (error) {
            console.error('Login error:', error.message);
            
            let statusCode = 500;
            let errorResponse = {
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error interno del servidor'
            };
            
            // Manejar errores específicos
            if (error.message.startsWith('CUENTA_BLOQUEADA')) {
                const timeLeft = error.message.split(':')[1];
                statusCode = 423;
                errorResponse = {
                    error: 'ACCOUNT_LOCKED',
                    message: `Cuenta bloqueada temporalmente. Intenta en ${timeLeft} segundos`,
                    retryAfter: parseInt(timeLeft)
                };
            } else if (error.message === 'CREDENCIALES_INVALIDAS') {
                statusCode = 401;
                errorResponse = {
                    error: 'INVALID_CREDENTIALS',
                    message: 'Usuario o contraseña incorrectos'
                };
            } else if (error.message === 'USER_NOT_FOUND') {
                statusCode = 404;
                errorResponse = {
                    error: 'USER_NOT_FOUND',
                    message: 'Usuario no encontrado'
                };
            }
            
            res.status(statusCode).json(errorResponse);
        }
    }
);

/**
 * POST /api/auth/refresh
 * Refrescar access token usando refresh token
 */
router.post('/refresh',
    securityLogger,
    addSecurityHeaders,
    authRateLimitMiddleware,
    initializeUserProvider,
    [
        body('refreshToken')
            .notEmpty()
            .withMessage('Refresh token requerido')
            .isJWT()
            .withMessage('Refresh token inválido')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                return res.status(400).json({
                    error: 'REFRESH_TOKEN_REQUIRED',
                    message: 'Refresh token requerido'
                });
            }
            
            console.log(`🔄 Token refresh attempt from ${req.ip}`);
            
            const result = await authService.refreshTokens(refreshToken, req.userProvider);
            
            if (result.success) {
                res.json({
                    success: true,
                    message: 'Tokens refrescados exitosamente',
                    data: result
                });
            } else {
                res.status(401).json({
                    error: 'TOKEN_REFRESH_FAILED',
                    message: 'No se pudo refrescar el token'
                });
            }
            
        } catch (error) {
            console.error('Token refresh error:', error.message);
            
            let statusCode = 401;
            let errorResponse = {
                error: 'TOKEN_REFRESH_FAILED',
                message: 'No se pudo refrescar el token'
            };
            
            if (error.message === 'REFRESH_TOKEN_NOT_FOUND' || 
                error.message === 'REFRESH_TOKEN_EXPIRED' || 
                error.message === 'REFRESH_TOKEN_INVALID') {
                statusCode = 401;
                errorResponse = {
                    error: error.message,
                    message: 'Refresh token inválido o expirado. Por favor, inicia sesión nuevamente'
                };
            } else if (error.message === 'USER_NOT_FOUND') {
                statusCode = 404;
                errorResponse = {
                    error: 'USER_NOT_FOUND',
                    message: 'Usuario no encontrado'
                };
            } else if (error.message === 'SESSION_INACTIVE') {
                statusCode = 401;
                errorResponse = {
                    error: 'SESSION_INACTIVE',
                    message: 'Sesión inactiva. Inicia sesión nuevamente'
                };
            }
            
            res.status(statusCode).json(errorResponse);
        }
    }
);

/**
 * POST /api/auth/logout
 * Logout e invalidación de tokens
 */
router.post('/logout',
    securityLogger,
    addSecurityHeaders,
    authenticate,
    [
        body('refreshToken')
            .optional()
            .isJWT()
            .withMessage('Refresh token inválido')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { refreshToken } = req.body;
            const accessToken = req.headers.authorization.substring(7);
            
            console.log(`🚪 Logout: ${req.user.id.substring(0, 4)}*** from ${req.ip}`);
            
            await authService.logout(accessToken, refreshToken);
            
            res.json({
                success: true,
                message: 'Logout exitoso'
            });
            
        } catch (error) {
            console.error('Logout error:', error.message);
            
            // Logout siempre debe ser exitoso para el cliente
            res.json({
                success: true,
                message: 'Logout exitoso'
            });
        }
    }
);

/**
 * POST /api/auth/logout-all
 * Logout de todas las sesiones del usuario
 */
router.post('/logout-all',
    securityLogger,
    addSecurityHeaders,
    authenticate,
    async (req, res) => {
        try {
            console.log(`🚪 Logout all sessions: ${req.user.id.substring(0, 4)}*** from ${req.ip}`);
            
            await authService.logoutAll(req.user.id);
            
            res.json({
                success: true,
                message: 'Todas las sesiones han sido cerradas exitosamente'
            });
            
        } catch (error) {
            console.error('Logout all error:', error.message);
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al cerrar todas las sesiones'
            });
        }
    }
);

/**
 * GET /api/auth/me
 * Obtener información del usuario actual
 */
router.get('/me',
    securityLogger,
    addSecurityHeaders,
    authenticate,
    initializeUserProvider,
    async (req, res) => {
        try {
            // Obtener información actualizada del usuario
            const user = await req.userProvider.findById(req.user.id);
            
            if (!user) {
                return res.status(404).json({
                    error: 'USER_NOT_FOUND',
                    message: 'Usuario no encontrado'
                });
            }
            
            // Devolver información pública del usuario
            const publicUserInfo = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                speciality: user.speciality,
                lastLogin: user.lastLogin,
                sessionId: req.sessionId
            };
            
            res.json({
                success: true,
                data: {
                    user: publicUserInfo
                }
            });
            
        } catch (error) {
            console.error('Get user info error:', error.message);
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al obtener información del usuario'
            });
        }
    }
);

/**
 * GET /api/auth/sessions
 * Obtener información de sesiones activas (solo para el usuario actual)
 */
router.get('/sessions',
    securityLogger,
    addSecurityHeaders,
    authenticate,
    async (req, res) => {
        try {
            const stats = authService.getStats();
            
            // Para el usuario actual, obtener información básica
            const userSessionInfo = {
                currentSessionId: req.sessionId,
                stats: {
                    activeSessions: stats.activeSessions,
                    activeUsers: stats.activeUsers
                }
            };
            
            res.json({
                success: true,
                data: userSessionInfo
            });
            
        } catch (error) {
            console.error('Get sessions error:', error.message);
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al obtener información de sesiones'
            });
        }
    }
);

/**
 * POST /api/auth/verify-token
 * Verificar si un token es válido (sin requerir autenticación)
 */
router.post('/verify-token',
    securityLogger,
    addSecurityHeaders,
    optionalAuthenticate,
    [
        body('token')
            .notEmpty()
            .withMessage('Token requerido')
            .isJWT()
            .withMessage('Token inválido')
    ],
    handleValidationErrors,
    async (req, res) => {
        try {
            const { token } = req.body;
            
            if (!token) {
                return res.status(400).json({
                    error: 'TOKEN_REQUIRED',
                    message: 'Token requerido'
                });
            }
            
            const result = await authService.verifySession(token);
            
            res.json({
                success: true,
                data: {
                    valid: result.valid,
                    error: result.error || null,
                    user: result.valid ? {
                        id: result.user.id,
                        name: result.user.name,
                        role: result.user.role,
                        sessionId: result.user.sessionId
                    } : null
                }
            });
            
        } catch (error) {
            console.error('Verify token error:', error.message);
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al verificar token'
            });
        }
    }
);

/**
 * GET /api/auth/stats
 * Obtener estadísticas del sistema (solo admins)
 */
router.get('/stats',
    securityLogger,
    addSecurityHeaders,
    authenticate,
    // requireRole(['admin', 'superadmin']), // Descomentar cuando se implemente RBAC
    async (req, res) => {
        try {
            const stats = authService.getStats();
            
            res.json({
                success: true,
                data: {
                    authentication: stats,
                    timestamp: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Get stats error:', error.message);
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al obtener estadísticas'
            });
        }
    }
);

/**
 * GET /api/auth/health
 * Health check del sistema de autenticación
 */
router.get('/health',
    (req, res) => {
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            authService: {
                status: 'operational',
                stats: authService.getStats()
            }
        });
    }
);

module.exports = router;