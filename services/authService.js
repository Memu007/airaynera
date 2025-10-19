/**
 * 🔐 AUTHENTICATION SERVICE - AIRA Medical System
 * JWT con rotation, seguridad robusta y session management
 * Versión 2.0 - Production Ready
 */

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { EventEmitter } = require('events');

class AuthService extends EventEmitter {
    constructor() {
        super();
        
        // Configuración de tokens
        this.config = {
            accessTokenExpiry: '15m',      // Access token: 15 minutos
            refreshTokenExpiry: '7d',      // Refresh token: 7 días
            maxSessions: 3,                // Máximo sesiones simultáneas por usuario
            passwordMinLength: 8,          // Mínimo 8 caracteres
            bcryptRounds: 12,              // Salt rounds para bcrypt
            lockoutTime: 15 * 60 * 1000,   // 15 minutos de bloqueo
            maxLoginAttempts: 5            // Máximo intentos fallidos
        };

        // Stores (en producción usar Redis)
        this.refreshTokens = new Map();    // token -> userId
        this.userSessions = new Map();     // userId -> Set de sessionIds
        this.loginAttempts = new Map();    // userId -> attempts
        this.blacklistedTokens = new Set(); // Tokens invalidados

        // JWT Secrets rotation
        this.secrets = {
            current: process.env.JWT_SECRET || this.generateSecureSecret(),
            previous: process.env.JWT_PREVIOUS_SECRET || null,
            rotationHistory: []
        };

        // Iniciar cleanup periódico
        this.startCleanupTimer();
        
        console.log('🔐 AuthService initialized with JWT rotation');
    }

    /**
     * Generar un secreto seguro para JWT
     */
    generateSecureSecret() {
        return crypto.randomBytes(64).toString('hex');
    }

    /**
     * Rotar JWT secrets (para implementación en producción)
     */
    rotateSecrets() {
        if (this.secrets.previous) {
            this.secrets.rotationHistory.push(this.secrets.previous);
        }
        this.secrets.previous = this.secrets.current;
        this.secrets.current = this.generateSecureSecret();
        
        console.log('🔄 JWT secrets rotated');
        this.emit('secretsRotated');
    }

    /**
     * Validar fuerza de contraseña
     */
    validatePasswordStrength(password) {
        const errors = [];

        if (password.length < this.config.passwordMinLength) {
            errors.push(`Mínimo ${this.config.passwordMinLength} caracteres`);
        }

        if (!/[A-Z]/.test(password)) {
            errors.push('Al menos una mayúscula');
        }

        if (!/[a-z]/.test(password)) {
            errors.push('Al menos una minúscula');
        }

        if (!/[0-9]/.test(password)) {
            errors.push('Al menos un número');
        }

        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            errors.push('Al menos un carácter especial');
        }

        // Patrones comunes prohibidos
        const commonPatterns = [
            /123456/, /password/i, /qwerty/i, 
            /admin/i, /letmein/i, /welcome/i
        ];

        for (const pattern of commonPatterns) {
            if (pattern.test(password)) {
                errors.push('No usar patrones comunes');
                break;
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            strength: errors.length === 0 ? 'strong' : 
                     errors.length <= 2 ? 'medium' : 'weak'
        };
    }

    /**
     * Hashear contraseña de forma segura
     */
    async hashPassword(password) {
        try {
            const salt = await bcrypt.genSalt(this.config.bcryptRounds);
            return await bcrypt.hash(password, salt);
        } catch (error) {
            console.error('Error hashing password:', error);
            throw new Error('Error al procesar contraseña');
        }
    }

    /**
     * Verificar contraseña
     */
    async verifyPassword(password, hash) {
        try {
            return await bcrypt.compare(password, hash);
        } catch (error) {
            console.error('Error verifying password:', error);
            return false;
        }
    }

    /**
     * Generar access token
     */
    generateAccessToken(userId, role, sessionId, additionalClaims = {}) {
        const payload = {
            sub: userId,
            role,
            sessionId,
            type: 'access',
            iat: Math.floor(Date.now() / 1000),
            jti: crypto.randomBytes(16).toString('hex'),
            ...additionalClaims
        };

        return jwt.sign(payload, this.secrets.current, {
            expiresIn: this.config.accessTokenExpiry,
            algorithm: 'HS256'
        });
    }

    /**
     * Generar refresh token
     */
    generateRefreshToken(userId, sessionId) {
        const payload = {
            sub: userId,
            sessionId,
            type: 'refresh',
            iat: Math.floor(Date.now() / 1000),
            jti: crypto.randomBytes(32).toString('hex')
        };

        const token = jwt.sign(payload, this.secrets.current, {
            expiresIn: this.config.refreshTokenExpiry,
            algorithm: 'HS256'
        });

        // Store refresh token
        this.refreshTokens.set(token, { userId, sessionId, createdAt: Date.now() });
        
        return token;
    }

    /**
     * Verificar access token (con rotation)
     */
    verifyAccessToken(token) {
        try {
            // Primero intentar con secret actual
            return jwt.verify(token, this.secrets.current, { algorithms: ['HS256'] });
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                throw new Error('TOKEN_EXPIRED');
            }
            
            // Si falla, intentar con secret anterior (rotation)
            if (this.secrets.previous) {
                try {
                    return jwt.verify(token, this.secrets.previous, { algorithms: ['HS256'] });
                } catch (prevError) {
                    throw new Error('TOKEN_INVALID');
                }
            }
            
            throw new Error('TOKEN_INVALID');
        }
    }

    /**
     * Verificar refresh token
     */
    verifyRefreshToken(token) {
        // Check if token exists in store
        const tokenData = this.refreshTokens.get(token);
        if (!tokenData) {
            throw new Error('REFRESH_TOKEN_NOT_FOUND');
        }

        try {
            const decoded = jwt.verify(token, this.secrets.current, { algorithms: ['HS256'] });
            return { decoded, tokenData };
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                // Remove expired refresh token
                this.refreshTokens.delete(token);
                throw new Error('REFRESH_TOKEN_EXPIRED');
            }
            
            // Try with previous secret
            if (this.secrets.previous) {
                try {
                    const decoded = jwt.verify(token, this.secrets.previous, { algorithms: ['HS256'] });
                    return { decoded, tokenData };
                } catch (prevError) {
                    this.refreshTokens.delete(token);
                    throw new Error('REFRESH_TOKEN_INVALID');
                }
            }
            
            this.refreshTokens.delete(token);
            throw new Error('REFRESH_TOKEN_INVALID');
        }
    }

    /**
     * Login con rate limiting y bloqueo
     */
    async login(userId, password, userProvider) {
        try {
            // Check rate limiting
            const attemptData = this.loginAttempts.get(userId) || { count: 0, lastAttempt: 0 };
            const now = Date.now();
            
            // Reset si pasó el tiempo de bloqueo
            if (now - attemptData.lastAttempt > this.config.lockoutTime) {
                attemptData.count = 0;
            }
            
            // Check si está bloqueado
            if (attemptData.count >= this.config.maxLoginAttempts) {
                const timeLeft = Math.ceil((this.config.lockoutTime - (now - attemptData.lastAttempt)) / 1000);
                throw new Error(`CUENTA_BLOQUEADA:${timeLeft}`);
            }

            // Obtener usuario del provider
            const user = await userProvider.findById(userId);
            if (!user) {
                this.recordFailedAttempt(userId);
                throw new Error('CREDENCIALES_INVALIDAS');
            }

            // Verificar contraseña
            const isValidPassword = await this.verifyPassword(password, user.passwordHash);
            if (!isValidPassword) {
                this.recordFailedAttempt(userId);
                throw new Error('CREDENCIALES_INVALIDAS');
            }

            // Login exitoso - limpiar intentos
            this.clearFailedAttempts(userId);

            // Generar sessionId única
            const sessionId = crypto.randomBytes(32).toString('hex');

            // Manejar sesiones múltiples
            await this.manageUserSessions(userId, sessionId);

            // Generar tokens
            const accessToken = this.generateAccessToken(userId, user.role, sessionId, {
                name: user.name,
                email: user.email
            });
            const refreshToken = this.generateRefreshToken(userId, sessionId);

            // Actualizar último login
            await userProvider.updateLastLogin(userId);

            console.log(`✅ Login successful: ${userId.substring(0, 4)}***`);

            this.emit('login', { userId, sessionId, timestamp: Date.now() });

            return {
                success: true,
                tokens: {
                    accessToken,
                    refreshToken,
                    expiresIn: this.parseExpiration(this.config.accessTokenExpiry)
                },
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    sessionId
                }
            };

        } catch (error) {
            console.error('Login error:', error.message);
            throw error;
        }
    }

    /**
     * Refresh tokens
     */
    async refreshTokens(refreshToken, userProvider) {
        try {
            const { decoded, tokenData } = this.verifyRefreshToken(refreshToken);
            
            // Obtener usuario actualizado
            const user = await userProvider.findById(decoded.sub);
            if (!user) {
                this.refreshTokens.delete(refreshToken);
                throw new Error('USER_NOT_FOUND');
            }

            // Verificar que la sesión siga activa
            if (!this.userSessions.has(decoded.sub) || 
                !this.userSessions.get(decoded.sub).has(decoded.sessionId)) {
                this.refreshTokens.delete(refreshToken);
                throw new Error('SESSION_INACTIVE');
            }

            // Generar nuevos tokens
            const newAccessToken = this.generateAccessToken(
                decoded.sub, 
                user.role, 
                decoded.sessionId,
                { name: user.name, email: user.email }
            );
            const newRefreshToken = this.generateRefreshToken(decoded.sub, decoded.sessionId);

            // Invalidar refresh token anterior
            this.refreshTokens.delete(refreshToken);

            console.log(`🔄 Tokens refreshed: ${decoded.sub.substring(0, 4)}***`);

            return {
                success: true,
                tokens: {
                    accessToken: newAccessToken,
                    refreshToken: newRefreshToken,
                    expiresIn: this.parseExpiration(this.config.accessTokenExpiry)
                }
            };

        } catch (error) {
            console.error('Token refresh error:', error.message);
            throw error;
        }
    }

    /**
     * Logout - invalidar tokens
     */
    async logout(accessToken, refreshToken) {
        try {
            // Verificar y extraer info del access token
            const decoded = this.verifyAccessToken(accessToken);
            
            // Add access token to blacklist
            this.blacklistedTokens.add(accessToken);
            
            // Remove refresh token
            if (refreshToken) {
                this.refreshTokens.delete(refreshToken);
            }
            
            // Remove session
            const userSessions = this.userSessions.get(decoded.sub);
            if (userSessions) {
                userSessions.delete(decoded.sessionId);
                if (userSessions.size === 0) {
                    this.userSessions.delete(decoded.sub);
                }
            }

            console.log(`🚪 Logout: ${decoded.sub.substring(0, 4)}***`);
            this.emit('logout', { userId: decoded.sub, sessionId: decoded.sessionId });

            return { success: true };

        } catch (error) {
            console.error('Logout error:', error.message);
            return { success: true }; // Logout siempre es exitoso para el cliente
        }
    }

    /**
     * Logout de todas las sesiones del usuario
     */
    async logoutAll(userId) {
        try {
            // Eliminar todas las sesiones
            const sessions = this.userSessions.get(userId);
            if (sessions) {
                for (const sessionId of sessions) {
                    // En una implementación real, buscar y eliminar refresh tokens asociados
                    console.log(`🚪 Session invalidated: ${sessionId}`);
                }
                this.userSessions.delete(userId);
            }

            // Eliminar todos los refresh tokens del usuario
            for (const [token, data] of this.refreshTokens.entries()) {
                if (data.userId === userId) {
                    this.refreshTokens.delete(token);
                }
            }

            console.log(`🚪 All sessions logged out: ${userId.substring(0, 4)}***`);
            this.emit('logoutAll', { userId });

            return { success: true };

        } catch (error) {
            console.error('Logout all error:', error.message);
            throw error;
        }
    }

    /**
     * Verificar sesión activa
     */
    async verifySession(accessToken) {
        try {
            // Check if token is blacklisted
            if (this.blacklistedTokens.has(accessToken)) {
                throw new Error('TOKEN_BLACKLISTED');
            }

            const decoded = this.verifyAccessToken(accessToken);
            
            // Check if session is still active
            const userSessions = this.userSessions.get(decoded.sub);
            if (!userSessions || !userSessions.has(decoded.sessionId)) {
                throw new Error('SESSION_INACTIVE');
            }

            return {
                valid: true,
                user: {
                    id: decoded.sub,
                    role: decoded.role,
                    sessionId: decoded.sessionId,
                    name: decoded.name,
                    email: decoded.email
                }
            };

        } catch (error) {
            return {
                valid: false,
                error: error.message
            };
        }
    }

    /**
     * Registrar intento fallido
     */
    recordFailedAttempt(userId) {
        const attempts = this.loginAttempts.get(userId) || { count: 0, lastAttempt: 0 };
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.loginAttempts.set(userId, attempts);
        
        console.log(`❌ Failed login attempt ${attempts.count}/${this.config.maxLoginAttempts}: ${userId.substring(0, 4)}***`);
    }

    /**
     * Limpiar intentos fallidos
     */
    clearFailedAttempts(userId) {
        this.loginAttempts.delete(userId);
    }

    /**
     * Manejar sesiones múltiples
     */
    async manageUserSessions(userId, newSessionId) {
        const sessions = this.userSessions.get(userId) || new Set();
        
        // Si ya hay máximo de sesiones, eliminar la más antigua
        if (sessions.size >= this.config.maxSessions) {
            const oldestSession = sessions.values().next().value;
            sessions.delete(oldestSession);
            
            // Eliminar refresh tokens asociados
            for (const [token, data] of this.refreshTokens.entries()) {
                if (data.userId === userId && data.sessionId === oldestSession) {
                    this.refreshTokens.delete(token);
                }
            }
            
            console.log(`🔄 Session rotated: ${oldestSession.substring(0, 8)}***`);
        }
        
        // Agregar nueva sesión
        sessions.add(newSessionId);
        this.userSessions.set(userId, sessions);
    }

    /**
     * Parse time string to milliseconds
     */
    parseExpiration(timeStr) {
        const unit = timeStr.slice(-1);
        const value = parseInt(timeStr.slice(0, -1));
        
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 15 * 60 * 1000; // Default 15 minutes
        }
    }

    /**
     * Cleanup periódico de tokens expirados
     */
    startCleanupTimer() {
        setInterval(() => {
            const now = Date.now();
            
            // Limpiar refresh tokens expirados
            for (const [token, data] of this.refreshTokens.entries()) {
                const maxAge = this.parseExpiration(this.config.refreshTokenExpiry);
                if (now - data.createdAt > maxAge) {
                    this.refreshTokens.delete(token);
                }
            }
            
            // Limpiar intentos de login expirados
            for (const [userId, attempts] of this.loginAttempts.entries()) {
                if (now - attempts.lastAttempt > this.config.lockoutTime) {
                    this.loginAttempts.delete(userId);
                }
            }
            
            // Limpiar tokens en blacklist (conservar por tiempo de expiración)
            for (const token of this.blacklistedTokens) {
                try {
                    const decoded = jwt.decode(token);
                    if (decoded && decoded.exp * 1000 < now) {
                        this.blacklistedTokens.delete(token);
                    }
                } catch (error) {
                    this.blacklistedTokens.delete(token);
                }
            }
            
        }, 60 * 60 * 1000); // Cada hora
    }

    /**
     * Obtener estadísticas de autenticación
     */
    getStats() {
        return {
            activeSessions: Array.from(this.userSessions.values()).reduce((sum, sessions) => sum + sessions.size, 0),
            activeUsers: this.userSessions.size,
            refreshTokens: this.refreshTokens.size,
            blacklistedTokens: this.blacklistedTokens.size,
            lockedAccounts: this.loginAttempts.size,
            config: this.config
        };
    }
}

module.exports = AuthService;