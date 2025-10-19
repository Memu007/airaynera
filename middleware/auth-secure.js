const crypto = require('crypto');

// Configuración segura
const CONFIG = {
    JWT_SECRET: process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex'),
    SESSION_DURATION: '24h',
    MAX_LOGIN_ATTEMPTS: 5,
    LOCKOUT_TIME: 15 * 60 * 1000 // 15 minutos
};

// Store de intentos (en prod usar Redis)
const loginAttempts = new Map();

// Hash seguro para passwords
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return { salt, hash };
}

// Verificar password
function verifyPassword(password, hash, salt) {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

// Rate limiting para login
function checkLoginAttempts(dni) {
    const attempts = loginAttempts.get(dni) || { count: 0, lastAttempt: 0 };
    const now = Date.now();
    
    // Reset si pasó el tiempo de lockout
    if (now - attempts.lastAttempt > CONFIG.LOCKOUT_TIME) {
        attempts.count = 0;
    }
    
    if (attempts.count >= CONFIG.MAX_LOGIN_ATTEMPTS) {
        const timeLeft = Math.ceil((CONFIG.LOCKOUT_TIME - (now - attempts.lastAttempt)) / 1000);
        throw new Error(`Cuenta bloqueada. Intente en ${timeLeft} segundos`);
    }
    
    attempts.count++;
    attempts.lastAttempt = now;
    loginAttempts.set(dni, attempts);
    
    return attempts.count;
}

// Limpiar intentos exitosos
function clearLoginAttempts(dni) {
    loginAttempts.delete(dni);
}

// Generar token JWT seguro
function generateToken(userId, role = 'professional') {
    const jwt = require('jsonwebtoken');
    return jwt.sign(
        { 
            userId, 
            role,
            iat: Date.now(),
            jti: crypto.randomBytes(16).toString('hex') // ID único
        },
        CONFIG.JWT_SECRET,
        { expiresIn: CONFIG.SESSION_DURATION }
    );
}

// Verificar token
function verifyToken(token) {
    const jwt = require('jsonwebtoken');
    try {
        return jwt.verify(token, CONFIG.JWT_SECRET);
    } catch (error) {
        if (error.name === 'TokenExpiredError') {
            throw new Error('Sesión expirada');
        }
        throw new Error('Token inválido');
    }
}

// Middleware de autenticación
function authMiddleware(req, res, next) {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({ error: 'No autorizado' });
        }
        
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ error: error.message });
    }
}

module.exports = {
    hashPassword,
    verifyPassword,
    checkLoginAttempts,
    clearLoginAttempts,
    generateToken,
    verifyToken,
    authMiddleware,
    CONFIG
};
