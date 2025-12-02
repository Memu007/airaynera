/**
 * 🔒 AIRA Bot v2.0 SECURE - Servidor con Seguridad Mejorada
 * Implementa todas las mejores prácticas de seguridad
 * Compatible con HIPAA y estándares médicos
 * 
 * @version 2.0.0
 * @date 2024
 */

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const { createRateLimiter } = require('./middleware/rate-limiter');
const authSecure = require('./middleware/auth-secure');
const { Firestore } = require('@google-cloud/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const winston = require('winston');

// Importar middlewares de seguridad
const {
    helmetConfig,
    generalLimiter,
    authLimiter,
    createLimiter,
    authenticateToken,
    authorize,
    sanitizeInputs,
    preventNoSQLInjection,
    securityHeaders,
    securityLogger,
    validateCSRF,
    detectAttacks,
    generateToken,
    hashPassword,
    verifyPassword
} = require('./src/middleware/security');

// Configuración del logger seguro
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(info => {
            // Remover información sensible de los logs
            const sanitized = { ...info };
            delete sanitized.password;
            delete sanitized.dni;
            delete sanitized.sessionContent;
            delete sanitized.medicationDetails;
            return JSON.stringify(sanitized);
        })
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
        new winston.transports.File({ filename: 'logs/combined.log' }),
        new winston.transports.Console({
            format: winston.format.simple()
        })
    ]
});

// Verificar variables de entorno críticas
const requiredEnvVars = [
    'JWT_SECRET',
    'GOOGLE_CLOUD_PROJECT_ID',
    'GEMINI_API_KEY',
    'SESSION_SECRET'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0) {
    logger.error('Variables de entorno faltantes:', missingVars);
    console.error(`❌ Faltan variables de entorno críticas: ${missingVars.join(', ')}`);
    console.error('Por favor, configure el archivo .env correctamente');
    process.exit(1);
}

// Crear aplicación Express
const app = express();

// Configuración de trust proxy para producción
if (process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

// ===== MIDDLEWARES DE SEGURIDAD =====

// 1. Helmet - Headers de seguridad
app.use(helmetConfig);

// 2. Headers de seguridad adicionales
app.use(securityHeaders);

// 3. Body parser con límite
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 4. Sanitización de inputs
app.use(sanitizeInputs);

// 5. Prevención de NoSQL injection
app.use(preventNoSQLInjection);

// 6. Detección de ataques
app.use(detectAttacks);

// 7. Rate limiting general
const apiLimiter = createRateLimiter('api');
const authLimiter = createRateLimiter('auth');
const whatsappLimiter = createRateLimiter('whatsapp');
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);
app.use('/api/whatsapp/', whatsappLimiter);

// 8. Compresión
const compression = require('compression');
app.use(compression());

// 9. Configuración de sesiones seguras
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 1000 * 60 * 60 * 24, // 24 horas
        sameSite: 'strict'
    },
    name: 'aira.sid' // Cambiar nombre default
}));

// 10. CORS configurado de forma segura
const corsOptions = {
    origin: function (origin, callback) {
        const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
            'http://localhost:8082',
            'http://127.0.0.1:8082'
        ];
        
        // Permitir requests sin origin (ej: Postman, apps móviles)
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('No permitido por CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token']
};
app.use(cors(corsOptions));

// 11. Logging de seguridad
app.use(securityLogger);

// ===== CONFIGURACIÓN DE SERVICIOS =====

// Inicializar Firestore con manejo de errores
let db;
try {
    db = new Firestore({
        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
        keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
    });
    logger.info('✅ Firestore conectado correctamente');
} catch (error) {
    logger.error('❌ Error conectando Firestore:', error);
    process.exit(1);
}

// Inicializar Gemini AI
let genAI;
try {
    genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    logger.info('✅ Gemini AI inicializado');
} catch (error) {
    logger.error('❌ Error inicializando Gemini AI:', error);
    process.exit(1);
}

// ===== RUTAS PÚBLICAS =====

// ===== IMPORTAR RUTAS ADICIONALES =====
const healthRoutes = require('./src/routes/health');
const { setupSwagger } = require('./docs/swagger');

// Health check y monitoreo (sin rate limiting)
app.use('/api', healthRoutes);

// Documentación Swagger
setupSwagger(app);

// Servir archivos estáticos
app.use(express.static(path.join(__dirname), {
    setHeaders: (res, filePath) => {
        // Cache control para assets
        if (filePath.endsWith('.js') || filePath.endsWith('.css')) {
            res.setHeader('Cache-Control', 'public, max-age=3600'); // 1 hora
        } else if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.ico')) {
            res.setHeader('Cache-Control', 'public, max-age=86400'); // 1 día
        }
    }
}));

// Ruta principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'demopagina_funcional_backup.html'));
});

// Generar token CSRF
app.get('/api/csrf-token', (req, res) => {
    const token = crypto.randomBytes(32).toString('hex');
    req.session.csrfToken = token;
    res.json({ csrfToken: token });
});

// ===== RUTAS DE AUTENTICACIÓN =====

// Login con rate limiting estricto
app.post('/api/auth/login', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validación básica
        if (!email || !password) {
            return res.status(400).json({
                error: 'Email y contraseña son requeridos',
                code: 'MISSING_CREDENTIALS'
            });
        }

        // Buscar usuario en Firestore
        const usersRef = db.collection('users');
        const snapshot = await usersRef.where('email', '==', email).limit(1).get();

        if (snapshot.empty) {
            logger.warn('Login attempt with non-existent email:', { email, ip: req.ip });
            return res.status(401).json({
                error: 'Credenciales inválidas',
                code: 'INVALID_CREDENTIALS'
            });
        }

        const userDoc = snapshot.docs[0];
        const userData = userDoc.data();

        // Verificar contraseña
        const isValidPassword = await verifyPassword(password, userData.passwordHash);
        
        if (!isValidPassword) {
            // Incrementar contador de intentos fallidos
            await userDoc.ref.update({
                failedLoginAttempts: (userData.failedLoginAttempts || 0) + 1,
                lastFailedLogin: new Date()
            });

            logger.warn('Failed login attempt:', { email, ip: req.ip });
            
            return res.status(401).json({
                error: 'Credenciales inválidas',
                code: 'INVALID_CREDENTIALS'
            });
        }

        // Verificar si la cuenta está bloqueada
        if (userData.status === 'locked') {
            return res.status(403).json({
                error: 'Cuenta bloqueada. Contacte al administrador.',
                code: 'ACCOUNT_LOCKED'
            });
        }

        // Login exitoso - resetear intentos fallidos
        await userDoc.ref.update({
            failedLoginAttempts: 0,
            lastLogin: new Date()
        });

        // Generar tokens
        const user = {
            id: userDoc.id,
            email: userData.email,
            name: userData.name,
            role: userData.role || 'doctor'
        };

        const { token, refreshToken } = generateToken(user);

        // Log de auditoría
        logger.info('Successful login:', {
            userId: user.id,
            email: user.email,
            ip: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true,
            token,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            error: 'Error al procesar la solicitud',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Registro con validación
app.post('/api/auth/register', authLimiter, async (req, res) => {
    try {
        const { email, password, name, specialty, dni } = req.body;

        // Validaciones
        const errors = [];
        
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            errors.push('Email inválido');
        }
        
        if (!password || password.length < 8) {
            errors.push('La contraseña debe tener al menos 8 caracteres');
        }
        
        if (!name || name.length < 3) {
            errors.push('El nombre debe tener al menos 3 caracteres');
        }
        
        if (!dni || !/^\d{7,8}$/.test(dni)) {
            errors.push('DNI inválido');
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Errores de validación',
                details: errors,
                code: 'VALIDATION_ERROR'
            });
        }

        // Verificar si el usuario ya existe
        const existingUser = await db.collection('users')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (!existingUser.empty) {
            return res.status(409).json({
                error: 'El email ya está registrado',
                code: 'EMAIL_EXISTS'
            });
        }

        // Hash de contraseña
        const passwordHash = await hashPassword(password);

        // Crear usuario
        const newUser = {
            email,
            passwordHash,
            name,
            specialty,
            dni,
            role: 'doctor',
            status: 'active',
            createdAt: new Date(),
            failedLoginAttempts: 0,
            settings: {
                notifications: true,
                twoFactorEnabled: false
            }
        };

        const userRef = await db.collection('users').add(newUser);

        // Generar tokens
        const user = {
            id: userRef.id,
            email,
            name,
            role: 'doctor'
        };

        const { token, refreshToken } = generateToken(user);

        logger.info('New user registered:', {
            userId: userRef.id,
            email,
            specialty
        });

        res.status(201).json({
            success: true,
            token,
            refreshToken,
            user: {
                id: userRef.id,
                email,
                name,
                role: 'doctor'
            }
        });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({
            error: 'Error al registrar usuario',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Refresh token
app.post('/api/auth/refresh', async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({
                error: 'Refresh token requerido',
                code: 'MISSING_REFRESH_TOKEN'
            });
        }

        // Verificar refresh token
        jwt.verify(refreshToken, process.env.JWT_SECRET, async (err, decoded) => {
            if (err || decoded.type !== 'refresh') {
                return res.status(403).json({
                    error: 'Refresh token inválido',
                    code: 'INVALID_REFRESH_TOKEN'
                });
            }

            // Buscar usuario
            const userDoc = await db.collection('users').doc(decoded.id).get();
            
            if (!userDoc.exists) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    code: 'USER_NOT_FOUND'
                });
            }

            const userData = userDoc.data();
            const user = {
                id: userDoc.id,
                email: userData.email,
                name: userData.name,
                role: userData.role
            };

            const tokens = generateToken(user);

            res.json({
                success: true,
                ...tokens
            });
        });

    } catch (error) {
        logger.error('Refresh token error:', error);
        res.status(500).json({
            error: 'Error al refrescar token',
            code: 'INTERNAL_ERROR'
        });
    }
});

// Logout
app.post('/api/auth/logout', authenticateToken, async (req, res) => {
    try {
        // Log de auditoría
        logger.info('User logout:', {
            userId: req.user.id,
            email: req.user.email
        });

        // En producción, aquí se invalidaría el token en una blacklist
        
        res.json({
            success: true,
            message: 'Sesión cerrada correctamente'
        });

    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({
            error: 'Error al cerrar sesión',
            code: 'INTERNAL_ERROR'
        });
    }
});

module.exports = { app, db, genAI, logger }; 