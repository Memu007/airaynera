const crypto = require('crypto');
const bcrypt = require('bcrypt');
const config = require('../config/environment');
const logger = require('../utils/logger');

class SecurityService {
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
        this.masterKey = config.SECURITY.MASTER_KEY ? 
            Buffer.from(config.SECURITY.MASTER_KEY, 'hex') : 
            crypto.randomBytes(32);
            
        if (!config.SECURITY.MASTER_KEY && config.NODE_ENV === 'production') {
            logger.warn('No MASTER_KEY provided, using generated key (not recommended for production)');
        }
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
        const pepper = config.SECURITY.PIN_PEPPER;
        return await bcrypt.hash(pin + pepper, 12);
    }

    async verifyPin(pin, hash) {
        try {
            const pepper = config.SECURITY.PIN_PEPPER;
            return await bcrypt.compare(pin + pepper, hash);
        } catch (error) {
            logger.error('PIN verification error:', error);
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
            phone: /^[\+]?[0-9\s\-\(\)]{8,20}$/,
            email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
        };
        
        if (patterns[type] && !patterns[type].test(input)) {
            return { valid: false, error: `Formato de ${type} inválido` };
        }
        
        return { valid: true, sanitized: input.trim() };
    }

    // Suspicious activity tracking
    detectSuspiciousActivity(ip, action) {
        const key = `${ip}_${action}`;
        const attempts = this.failedAttempts.get(key) || { count: 0, firstAttempt: Date.now() };
        
        attempts.count++;
        attempts.lastAttempt = Date.now();
        this.failedAttempts.set(key, attempts);
        
        const timeWindow = config.RATE_LIMIT.WINDOW_MS;
        const timeSinceFirst = attempts.lastAttempt - attempts.firstAttempt;
        
        if (timeSinceFirst < timeWindow && attempts.count >= 10) {
            this.suspiciousIPs.add(ip);
            logger.medical.securityEvent('IP_BLOCKED', ip, { attempts: attempts.count });
            return 'BLOCKED';
        } else if (attempts.count >= config.RATE_LIMIT.MAX_FAILED_ATTEMPTS) {
            logger.medical.securityEvent('SUSPICIOUS_ACTIVITY', ip, { attempts: attempts.count });
            return 'SUSPICIOUS';
        }
        
        return 'NORMAL';
    }

    hashSensitiveData(data) {
        return crypto.createHash('sha256')
            .update(data + config.SECURITY.LOG_SALT)
            .digest('hex').substring(0, 12);
    }

    isIPBlocked(ip) {
        return this.suspiciousIPs.has(ip);
    }

    clearFailedAttempts(ip, action) {
        const key = `${ip}_${action}`;
        this.failedAttempts.delete(key);
    }

    // Generate secure tokens
    generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    // Validate JWT tokens
    validateJWT(token) {
        try {
            const jwt = require('jsonwebtoken');
            return jwt.verify(token, config.SECURITY.JWT_SECRET);
        } catch (error) {
            logger.warn('Invalid JWT token:', error.message);
            return null;
        }
    }

    // Generate JWT tokens
    generateJWT(payload, expiresIn = '24h') {
        const jwt = require('jsonwebtoken');
        return jwt.sign(payload, config.SECURITY.JWT_SECRET, { expiresIn });
    }
}

module.exports = new SecurityService(); 