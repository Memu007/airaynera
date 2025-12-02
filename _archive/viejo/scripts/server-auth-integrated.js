/**
 * 🌱 AIRA Medical System - AUTHENTICATION INTEGRATED SERVER
 * Servidor principal con sistema de autenticación robusto integrado
 * Versión 2.0 - Production Ready with JWT + Session Management
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { Firestore } = require('@google-cloud/firestore');
const path = require('path');
const fs = require('fs');

// Importar servicios de autenticación
const { authService, UserProvider, authenticate, optionalAuthenticate, requireRole, addSecurityHeaders, securityLogger } = require('./middleware/authMiddleware');
const { createRateLimiter, apiLimiter, authLimiter } = require('./middleware/rateLimiter');
const UserService = require('./services/userService');
const SessionService = require('./services/sessionService');

// Importar rutas
const authRoutes = require('./routes/auth');

// Configuración
const PORT = process.env.PORT || 8082;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Inicializar aplicación Express
const app = express();

// Configuración de CORS
const corsOptions = {
    origin: NODE_ENV === 'production' 
        ? ['https://aira-medical.firebaseapp.com', 'https://aira-medical.web.app']
        : ['http://localhost:8082', 'http://127.0.0.1:8082', 'http://localhost:8081', 'http://127.0.0.1:8081'],
    optionsSuccessStatus: 200,
    credentials: true
};

// Middlewares principales
app.use(cors(corsOptions));
app.use(helmet({
    contentSecurityPolicy: NODE_ENV === 'production' ? undefined : false,
    crossOriginEmbedderPolicy: false
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers y logging
app.use(addSecurityHeaders);
app.use(securityLogger);

// Rate limiting global
app.use(apiLimiter);

// Inicializar base de datos
let db;
try {
    db = new Firestore({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    console.log('✅ Firestore database connected');
} catch (error) {
    console.warn('⚠️ Could not connect to Firestore, using fallback:', error.message);
    // En desarrollo, podríamos usar una base de datos simulada
}

// Inicializar servicios
const userService = new UserService(db);
const sessionService = new SessionService(db, authService);

// Hacer servicios disponibles globalmente
app.locals.db = db;
app.locals.userService = userService;
app.locals.sessionService = sessionService;
app.locals.authService = authService;

// Logger personalizado
const logger = {
    info: (message, meta = {}) => {
        console.log(`ℹ️  ${new Date().toISOString()} - ${message}`, meta);
    },
    warn: (message, meta = {}) => {
        console.warn(`⚠️  ${new Date().toISOString()} - ${message}`, meta);
    },
    error: (message, meta = {}) => {
        console.error(`❌ ${new Date().toISOString()} - ${message}`, meta);
    },
    debug: (message, meta = {}) => {
        if (NODE_ENV === 'development') {
            console.log(`🐛 ${new Date().toISOString()} - ${message}`, meta);
        }
    }
};

// Rutas de autenticación (primeras)
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
    const authStats = authService.getStats();
    const sessionStats = sessionService.getStats();
    
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: NODE_ENV,
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        services: {
            authentication: {
                status: 'operational',
                ...authStats
            },
            sessions: {
                status: 'operational',
                ...sessionStats
            },
            database: db ? 'connected' : 'disconnected'
        }
    });
});

// Health check específico para autenticación
app.get('/api/health/auth', (req, res) => {
    const authStats = authService.getStats();
    const sessionStats = sessionService.getStats();
    
    res.json({
        authentication: {
            status: 'operational',
            ...authStats,
            uptime: process.uptime()
        },
        sessions: {
            status: 'operational',
            ...sessionStats
        },
        timestamp: new Date().toISOString()
    });
});

// Rutas estáticas (después de las rutas de API)
app.use(express.static(__dirname));

// Rutas principales de la aplicación
app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, 'demopagina_funcional_backup.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'demo.html'));
});

app.get('/webaira', (req, res) => {
    res.redirect('/');
});

// API Routes que requieren autenticación

// Obtener información del usuario actual
app.get('/api/user/profile', authenticate, async (req, res) => {
    try {
        const userInfo = await userService.getUserInfo(req.user.id);
        
        if (!userInfo) {
            return res.status(404).json({
                error: 'USER_NOT_FOUND',
                message: 'Usuario no encontrado'
            });
        }

        res.json({
            success: true,
            data: { user: userInfo }
        });
    } catch (error) {
        logger.error('Error getting user profile:', error);
        res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Error al obtener información del usuario'
        });
    }
});

// Obtener sesiones activas del usuario
app.get('/api/user/sessions', authenticate, async (req, res) => {
    try {
        const sessions = await sessionService.getUserSessions(req.user.id);
        
        res.json({
            success: true,
            data: { sessions }
        });
    } catch (error) {
        logger.error('Error getting user sessions:', error);
        res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Error al obtener sesiones del usuario'
        });
    }
});

// Cerrar todas las sesiones excepto la actual
app.post('/api/user/logout-all', authenticate, async (req, res) => {
    try {
        const currentSessionId = req.sessionId;
        
        // Obtener todas las sesiones y cerrarlas excepto la actual
        const sessions = await sessionService.getUserSessions(req.user.id);
        let closedCount = 0;
        
        for (const session of sessions) {
            if (session.sessionId !== currentSessionId) {
                await sessionService.invalidateSession(session.sessionId, 'user_logout_all');
                closedCount++;
            }
        }

        logger.info(`User ${req.user.id.substring(0, 4)}*** closed ${closedCount} sessions`);
        
        res.json({
            success: true,
            message: `${closedCount} sesiones cerradas exitosamente`,
            data: { closedCount }
        });
    } catch (error) {
        logger.error('Error closing user sessions:', error);
        res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Error al cerrar sesiones'
        });
    }
});

// Actualizar actividad de sesión
app.post('/api/session/activity', authenticate, async (req, res) => {
    try {
        const { action, details } = req.body;
        
        await sessionService.updateSessionActivity(req.sessionId, {
            action: action || 'user_activity',
            details: details || 'User activity update',
            metadata: {
                ip: req.ip,
                userAgent: req.headers['user-agent']
            }
        });

        res.json({
            success: true,
            message: 'Actividad de sesión actualizada'
        });
    } catch (error) {
        logger.error('Error updating session activity:', error);
        res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Error al actualizar actividad de sesión'
        });
    }
});

// Endpoints de administración (requieren rol admin)
app.get('/api/admin/stats', authenticate, requireRole(['admin']), async (req, res) => {
    try {
        const authStats = authService.getStats();
        const sessionStats = sessionService.getStats();
        
        res.json({
            success: true,
            data: {
                authentication: authStats,
                sessions: sessionStats,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error getting admin stats:', error);
        res.status(500).json({
            error: 'INTERNAL_SERVER_ERROR',
            message: 'Error al obtener estadísticas'
        });
    }
});

// Endpoint para crear usuarios de prueba (solo en desarrollo)
if (NODE_ENV === 'development') {
    app.post('/api/dev/test-users', async (req, res) => {
        try {
            const results = await userService.createTestUsers();
            
            res.json({
                success: true,
                message: 'Usuarios de prueba creados exitosamente',
                data: { results }
            });
        } catch (error) {
            logger.error('Error creating test users:', error);
            res.status(500).json({
                error: 'INTERNAL_SERVER_ERROR',
                message: 'Error al crear usuarios de prueba'
            });
        }
    });
}

// WhatsApp webhook (sin cambios del código original)
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

// Mantener el resto de las rutas existentes
try {
    const apiRoutes = require('./firestoreRoutes');
    app.use('/api', apiRoutes);
} catch (error) {
    logger.warn('Could not load firestoreRoutes:', error.message);
}

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    
    // No exponer detalles del error en producción
    const isDevelopment = NODE_ENV === 'development';
    
    res.status(error.status || 500).json({
        error: error.code || 'INTERNAL_SERVER_ERROR',
        message: isDevelopment ? error.message : 'Error interno del servidor',
        timestamp: new Date().toISOString(),
        ...(isDevelopment && { stack: error.stack })
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Ruta no encontrada',
        path: req.originalUrl,
        method: req.method
    });
});

// Event listeners para servicios
authService.on('login', (data) => {
    logger.info(`User login: ${data.userId.substring(0, 4)}***`, data);
});

authService.on('logout', (data) => {
    logger.info(`User logout: ${data.userId.substring(0, 4)}***`, data);
});

sessionService.on('sessionCreated', (data) => {
    logger.info(`Session created: ${data.sessionId.substring(0, 8)}*** for user ${data.userId.substring(0, 4)}***`);
});

sessionService.on('sessionInvalidated', (data) => {
    logger.info(`Session invalidated: ${data.sessionId.substring(0, 8)}*** (${data.reason})`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
        process.exit(0);
    });
});

// Iniciar servidor
const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`🚀 AIRA Medical System v2.0 - Authentication Integrated`);
    logger.info(`🌐 Server running on port ${PORT}`);
    logger.info(`🔐 Authentication: Enabled`);
    logger.info(`📊 Session Management: Active`);
    logger.info(`🔒 Security: Production Ready`);
    logger.info(`📍 Environment: ${NODE_ENV}`);
    
    if (NODE_ENV === 'development') {
        logger.info('\n📋 Development Endpoints:');
        logger.info('   POST /api/dev/test-users - Create test users');
        logger.info('   GET  /api/health/auth - Auth health check');
        logger.info('   GET  /health - System health check');
        logger.info('\n🔐 Authentication Endpoints:');
        logger.info('   POST /api/auth/login - User login');
        logger.info('   POST /api/auth/refresh - Refresh tokens');
        logger.info('   POST /api/auth/logout - User logout');
        logger.info('   GET  /api/auth/me - Get user info');
        logger.info('\n👥 User Endpoints:');
        logger.info('   GET  /api/user/profile - User profile');
        logger.info('   GET  /api/user/sessions - User sessions');
        logger.info('   POST /api/user/logout-all - Logout all sessions');
    }
});

module.exports = app;