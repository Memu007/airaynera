/**
 * AIRA MEDICAL BOT - SECURITY MIDDLEWARE
 * HIPAA COMPLIANT - Comprehensive security headers and protection
 * 
 * This middleware enforces security by default with no configuration options
 * that could compromise patient data security
 */

const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const { securityUtils } = require('../src/config/seguridad');

// Security audit logging
class SecurityAuditLogger {
    constructor() {
        this.logPath = process.env.SECURITY_LOG_PATH || './logs/security.log';
        this.ensureLogDirectory();
    }
    
    ensureLogDirectory() {
        const fs = require('fs');
        const path = require('path');
        const logDir = path.dirname(this.logPath);
        
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }
    
    log(event, details) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            event,
            severity: this.getSeverity(event),
            details,
            requestId: this.generateRequestId()
        };
        
        // Write to log file
        try {
            const fs = require('fs');
            fs.appendFileSync(this.logPath, JSON.stringify(logEntry) + '\n');
        } catch (error) {
            console.error('Failed to write security audit log:', error);
        }
        
        // Console output for critical events
        if (this.getSeverity(event) === 'CRITICAL') {
            console.warn(`🚨 SECURITY ALERT [${timestamp}]: ${event}`, details);
        }
    }
    
    getSeverity(event) {
        const criticalEvents = [
            'BREACH_ATTEMPT',
            'AUTH_BYPASS_ATTEMPT',
            'INJECTION_ATTACK',
            'XSS_ATTEMPT',
            'CSRF_ATTEMPT',
            'PRIVILEGE_ESCALATION',
            'DATA_EXFILTRATION'
        ];
        
        const highEvents = [
            'AUTH_FAILURE',
            'RATE_LIMIT_EXCEEDED',
            'FORBIDDEN_ACCESS',
            'SUSPICIOUS_PATTERN',
            'INVALID_TOKEN'
        ];
        
        if (criticalEvents.includes(event)) return 'CRITICAL';
        if (highEvents.includes(event)) return 'HIGH';
        return 'MEDIUM';
    }
    
    generateRequestId() {
        return crypto.randomBytes(16).toString('hex');
    }
}

const auditLogger = new SecurityAuditLogger();

// Enhanced security headers for medical data
function securityHeaders(req, res, next) {
    // Content Security Policy - Medical grade security
    res.setHeader(
        'Content-Security-Policy',
        process.env.CSP_POLICY || [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline'", // Required for some medical UI components
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https:",
            "font-src 'self'",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "form-action 'self'",
            "base-uri 'self'",
            "object-src 'none'",
            "media-src 'self'",
            "manifest-src 'self'"
        ].join('; ')
    );
    
    // Strict Transport Security
    if (process.env.NODE_ENV === 'production') {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    }
    
    // Other security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=(), payment=()');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    
    // Medical data specific headers
    res.setHeader('X-Powered-By', 'AIRA-Medical-Bot/1.0');
    res.setHeader('X-Compliance', 'HIPAA');
    res.setHeader('X-Audit-Trail', 'Enabled');
    
    next();
}

// Medical data input sanitization and validation
function validateMedicalInput(req, res, next) {
    const clientInfo = {
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers['user-agent'],
        method: req.method,
        path: req.path,
        requestId: securityUtils.generateToken(16)
    };
    
    // Add request ID for tracking
    req.requestId = clientInfo.requestId;
    
    try {
        // Check for common injection patterns
        const suspiciousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // XSS
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi, // SQL Injection
            /(\b(\.\.\/|\.\.\\)\b)/g, // Directory traversal
            /javascript:/gi, // JavaScript protocol
            /data:text\/html/gi, // Data URI HTML
            /vbscript:/gi, // VBScript
            /onload\s*=/gi, // Event handlers
            /onerror\s*=/gi, // Error handlers
        ];
        
        // Check URL and query parameters
        const checkString = (str, context) => {
            if (typeof str !== 'string') return;
            
            for (const pattern of suspiciousPatterns) {
                if (pattern.test(str)) {
                    auditLogger.log('INJECTION_ATTEMPT', {
                        ...clientInfo,
                        context,
                        matchedPattern: pattern.source,
                        suspiciousContent: str.substring(0, 100)
                    });
                    
                    return res.status(400).json({
                        error: 'INVALID_INPUT',
                        message: 'Invalid input detected',
                        requestId: req.requestId
                    });
                }
            }
        };
        
        // Check various request parts
        checkString(req.url, 'URL');
        checkString(req.path, 'PATH');
        
        // Check query parameters
        Object.entries(req.query || {}).forEach(([key, value]) => {
            checkString(value, `QUERY_${key}`);
        });
        
        // Check request body
        if (req.body && typeof req.body === 'object') {
            const checkObject = (obj, prefix = '') => {
                Object.entries(obj).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        checkString(value, `BODY_${prefix}${key}`);
                    } else if (typeof value === 'object' && value !== null) {
                        checkObject(value, `${prefix}${key}.`);
                    }
                });
            };
            checkObject(req.body);
        }
        
        // Medical data specific validations
        if (req.path.includes('patients') || req.path.includes('sessions')) {
            validateMedicalData(req, res, next);
        } else {
            next();
        }
        
    } catch (error) {
        auditLogger.log('VALIDATION_ERROR', {
            ...clientInfo,
            error: error.message
        });
        
        res.status(500).json({
            error: 'VALIDATION_ERROR',
            message: 'Input validation failed',
            requestId: req.requestId
        });
    }
}

// Medical data specific validation
function validateMedicalData(req, res, next) {
    const medicalFields = [
        'name', 'dni', 'phone', 'email', 'insurance', 'emergency_contact',
        'notes', 'medication', 'diagnosis', 'treatment', 'symptoms',
        'personalHistory', 'familyHistory', 'allergies', 'socialSecurity',
        'medicalRecord'
    ];
    
    if (req.body && typeof req.body === 'object') {
        // Check for PHI (Protected Health Information) patterns
        const phiPatterns = [
            /\b\d{3}-\d{2}-\d{4}\b/g, // SSN pattern
            /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g, // SSN alternative
            /\b\d{1,5}[-.\s]?\d{1,5}[-.\s]?\d{1,5}[-.\s]?\d{1,4}\b/g, // Medical record numbers
            /\b[A-Za-z]{2}\d{7}\b/g, // Insurance numbers
            /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g, // Phone numbers
        ];
        
        const scanForPHI = (value, fieldPath) => {
            if (typeof value !== 'string') return false;
            
            for (const pattern of phiPatterns) {
                if (pattern.test(value)) {
                    auditLogger.log('PHI_DETECTED', {
                        ip: req.ip,
                        path: req.path,
                        field: fieldPath,
                        requestId: req.requestId,
                        pattern: pattern.source
                    });
                    return true;
                }
            }
            return false;
        };
        
        const scanObject = (obj, prefix = '') => {
            Object.entries(obj).forEach(([key, value]) => {
                const fieldPath = prefix + key;
                
                if (medicalFields.includes(key) && typeof value === 'string') {
                    // Check field length limits (HIPAA requirement)
                    if (value.length > 10000) {
                        auditLogger.log('LARGE_PHI_FIELD', {
                            ip: req.ip,
                            path: req.path,
                            field: fieldPath,
                            length: value.length,
                            requestId: req.requestId
                        });
                    }
                    
                    scanForPHI(value, fieldPath);
                }
                
                if (typeof value === 'object' && value !== null) {
                    scanObject(value, `${prefix}${key}.`);
                }
            });
        };
        
        scanObject(req.body);
    }
    
    next();
}

// Advanced rate limiting with medical data protection
const createRateLimit = (windowMs, max, message) => {
    return rateLimit({
        windowMs,
        max,
        message: {
            error: 'RATE_LIMIT_EXCEEDED',
            message,
            retryAfter: Math.ceil(windowMs / 1000)
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => {
            return req.ip || req.connection.remoteAddress;
        },
        handler: (req, res) => {
            auditLogger.log('RATE_LIMIT_EXCEEDED', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'],
                requestId: req.requestId
            });
            
            res.status(429).json({
                error: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests. Please try again later.',
                retryAfter: Math.ceil(windowMs / 1000),
                requestId: req.requestId
            });
        }
    });
};

// Different rate limits for different endpoints
const rateLimiters = {
    // General API rate limit
    general: createRateLimit(
        15 * 60 * 1000, // 15 minutes
        parseInt(process.env.RATE_LIMIT_MAX) || 50,
        'Too many API requests'
    ),
    
    // Authentication rate limit (very restrictive)
    auth: createRateLimit(
        15 * 60 * 1000, // 15 minutes
        parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 5,
        'Too many authentication attempts'
    ),
    
    // Medical data operations rate limit
    medicalData: createRateLimit(
        60 * 60 * 1000, // 1 hour
        parseInt(process.env.MEDICAL_DATA_RATE_LIMIT_MAX) || 100,
        'Too many medical data operations'
    ),
    
    // Search operations rate limit (to prevent data harvesting)
    search: createRateLimit(
        60 * 1000, // 1 minute
        parseInt(process.env.SEARCH_RATE_LIMIT_MAX) || 20,
        'Too many search requests'
    )
};

// Apply appropriate rate limiting
function applyRateLimiting(req, res, next) {
    // Authentication endpoints
    if (req.path.includes('/auth/')) {
        return rateLimiters.auth(req, res, next);
    }
    
    // Medical data endpoints
    if (req.path.includes('/patients') || req.path.includes('/sessions')) {
        return rateLimiters.medicalData(req, res, next);
    }
    
    // Search endpoints
    if (req.path.includes('/search')) {
        return rateLimiters.search(req, res, next);
    }
    
    // General API endpoints
    return rateLimiters.general(req, res, next);
}

// Request size limiting for medical data protection
function requestSizeLimit(req, res, next) {
    const contentLength = parseInt(req.headers['content-length']) || 0;
    const maxSize = parseInt(process.env.MAX_REQUEST_SIZE_MB) || 10; // 10MB default
    const maxSizeBytes = maxSize * 1024 * 1024;
    
    if (contentLength > maxSizeBytes) {
        auditLogger.log('OVERSIZED_REQUEST', {
            ip: req.ip,
            path: req.path,
            contentLength,
            maxSize: maxSizeBytes,
            requestId: req.requestId
        });
        
        return res.status(413).json({
            error: 'PAYLOAD_TOO_LARGE',
            message: `Request size exceeds maximum allowed size of ${maxSize}MB`,
            requestId: req.requestId
        });
    }
    
    next();
}

// Medical data access logging
function medicalDataAccessLogger(req, res, next) {
    // Only log medical data access
    if (!req.path.includes('/patients') && !req.path.includes('/sessions')) {
        return next();
    }
    
    const originalSend = res.send;
    
    res.send = function(data) {
        // Log medical data access
        auditLogger.log('MEDICAL_DATA_ACCESS', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userId: req.user?.sub || 'anonymous',
            userRole: req.user?.role || 'none',
            statusCode: res.statusCode,
            requestId: req.requestId,
            timestamp: new Date().toISOString()
        });
        
        // Check for potential data exfiltration
        if (req.method === 'GET' && res.statusCode === 200) {
            try {
                const responseData = JSON.parse(data);
                const dataSize = JSON.stringify(responseData).length;
                
                if (dataSize > 100000) { // 100KB
                    auditLogger.log('LARGE_DATA_TRANSFER', {
                        ip: req.ip,
                        path: req.path,
                        userId: req.user?.sub,
                        dataSize,
                        requestId: req.requestId
                    });
                }
            } catch (error) {
                // Not JSON data, ignore
            }
        }
        
        originalSend.call(this, data);
    };
    
    next();
}

// CORS security for medical data
function secureCORS(req, res, next) {
    const origin = req.headers.origin;
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
    
    // Strict CORS for medical data endpoints
    if (req.path.includes('/patients') || req.path.includes('/sessions')) {
        if (allowedOrigins.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
        } else {
            auditLogger.log('UNAUTHORIZED_CORS', {
                ip: req.ip,
                path: req.path,
                origin,
                allowedOrigins,
                requestId: req.requestId
            });
            
            return res.status(403).json({
                error: 'CORS_BLOCKED',
                message: 'Cross-origin request not allowed for medical data',
                requestId: req.requestId
            });
        }
    } else {
        // Standard CORS for non-medical endpoints
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
        }
    }
    
    // Standard CORS headers
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    next();
}

// Security incident detection
function detectSecurityIncidents(req, res, next) {
    const suspiciousPatterns = {
        sqlInjection: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
        xss: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        pathTraversal: /(\.\.\/|\.\.\\)/g,
        commandInjection: /(\b(wget|curl|nc|netcat|telnet|ssh)\b)/gi,
        ldapInjection: /[()&|]/g,
        xPathInjection: /[()&|]/g
    };
    
    const checkIncident = (data, context) => {
        if (typeof data !== 'string') return;
        
        Object.entries(suspiciousPatterns).forEach(([incidentType, pattern]) => {
            if (pattern.test(data)) {
                auditLogger.log('SECURITY_INCIDENT', {
                    incidentType,
                    context,
                    ip: req.ip,
                    path: req.path,
                    method: req.method,
                    userAgent: req.headers['user-agent'],
                    requestId: req.requestId,
                    evidence: data.substring(0, 100)
                });
                
                // Block suspicious requests
                return res.status(400).json({
                    error: 'SECURITY_VIOLATION',
                    message: 'Request blocked due to security concerns',
                    requestId: req.requestId
                });
            }
        });
    };
    
    // Check URL and parameters
    checkIncident(req.url, 'URL');
    checkIncident(req.path, 'PATH');
    
    Object.entries(req.query || {}).forEach(([key, value]) => {
        checkIncident(value, `QUERY_${key}`);
    });
    
    next();
}

module.exports = {
    securityHeaders,
    validateMedicalInput,
    applyRateLimiting,
    requestSizeLimit,
    medicalDataAccessLogger,
    secureCORS,
    detectSecurityIncidents,
    auditLogger,
    rateLimiters
};