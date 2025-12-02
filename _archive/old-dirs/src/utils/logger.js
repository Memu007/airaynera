/**
 * Logger Centralizado - AIRA
 * Manejo de logs con niveles y formato consistente
 * @version 1.0.0
 */

const winston = require('winston');
const path = require('path');

// Crear directorio de logs si no existe
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Configuración del logger
const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp({
            format: 'YYYY-MM-DD HH:mm:ss'
        }),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(info => {
            // Remover información sensible de los logs
            const sanitized = { ...info };
            
            // Campos sensibles a eliminar
            const sensitiveFields = [
                'password', 
                'passwordHash', 
                'token', 
                'refreshToken',
                'dni',
                'sessionContent',
                'medicationDetails',
                'personalData'
            ];

            // Función recursiva para limpiar objetos
            const cleanSensitiveData = (obj) => {
                if (typeof obj !== 'object' || obj === null) return obj;
                
                const cleaned = Array.isArray(obj) ? [] : {};
                
                for (const [key, value] of Object.entries(obj)) {
                    if (sensitiveFields.some(field => 
                        key.toLowerCase().includes(field.toLowerCase())
                    )) {
                        cleaned[key] = '[REDACTED]';
                    } else if (typeof value === 'object' && value !== null) {
                        cleaned[key] = cleanSensitiveData(value);
                    } else {
                        cleaned[key] = value;
                    }
                }
                
                return cleaned;
            };

            return JSON.stringify(cleanSensitiveData(sanitized));
        })
    ),
    defaultMeta: { 
        service: 'aira-backend',
        environment: process.env.NODE_ENV || 'development'
    },
    transports: [
        // Logs de error en archivo separado
        new winston.transports.File({ 
            filename: path.join(logsDir, 'error.log'), 
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5,
            tailable: true
        }),
        
        // Logs combinados
        new winston.transports.File({ 
            filename: path.join(logsDir, 'combined.log'),
            maxsize: 10485760, // 10MB
            maxFiles: 10,
            tailable: true
        }),
        
        // Logs de auditoría (separados)
        new winston.transports.File({
            filename: path.join(logsDir, 'audit.log'),
            level: 'info',
            maxsize: 10485760, // 10MB
            maxFiles: 50, // Mantener más logs de auditoría
            tailable: true,
            format: winston.format.combine(
                winston.format.timestamp(),
                winston.format.json(),
                winston.format.printf(info => {
                    // Solo logs de auditoría
                    if (info.audit || info.event) {
                        return JSON.stringify(info);
                    }
                    return false;
                })
            )
        })
    ],
    
    // Manejo de excepciones no capturadas
    exceptionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'exceptions.log'),
            maxsize: 10485760,
            maxFiles: 5
        })
    ],
    
    // Manejo de rechazos de promesas
    rejectionHandlers: [
        new winston.transports.File({ 
            filename: path.join(logsDir, 'rejections.log'),
            maxsize: 10485760,
            maxFiles: 5
        })
    ]
});

// En desarrollo, también mostrar en consola
if (process.env.NODE_ENV !== 'production') {
    logger.add(new winston.transports.Console({
        format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
            winston.format.printf(info => {
                const { timestamp, level, message, service, ...rest } = info;
                const restString = Object.keys(rest).length ? JSON.stringify(rest, null, 2) : '';
                return `${timestamp} [${service}] ${level}: ${message} ${restString}`;
            })
        )
    }));
}

// Métodos específicos para diferentes tipos de eventos

/**
 * Log de auditoría médica
 */
logger.audit = (event, details = {}) => {
    logger.info('AUDIT', {
        audit: true,
        event,
        timestamp: new Date().toISOString(),
        ...details
    });
};

/**
 * Log de eventos de seguridad
 */
logger.security = (event, details = {}) => {
    logger.warn('SECURITY', {
        security: true,
        event,
        timestamp: new Date().toISOString(),
        ...details
    });
};

/**
 * Log de operaciones de base de datos
 */
logger.database = (operation, collection, details = {}) => {
    logger.info('DATABASE', {
        database: true,
        operation,
        collection,
        timestamp: new Date().toISOString(),
        ...details
    });
};

/**
 * Log de integraciones externas (WhatsApp, Gemini, etc.)
 */
logger.integration = (service, operation, details = {}) => {
    logger.info('INTEGRATION', {
        integration: true,
        service,
        operation,
        timestamp: new Date().toISOString(),
        ...details
    });
};

/**
 * Log de métricas de performance
 */
logger.performance = (metric, value, details = {}) => {
    logger.info('PERFORMANCE', {
        performance: true,
        metric,
        value,
        timestamp: new Date().toISOString(),
        ...details
    });
};

/**
 * Middleware de logging para Express
 */
logger.requestMiddleware = (req, res, next) => {
    const start = Date.now();
    
    // Log de request
    logger.info('HTTP Request', {
        method: req.method,
        url: req.url,
        ip: req.ip,
        userAgent: req.get('user-agent'),
        userId: req.user?.id
    });
    
    // Interceptar response para log de duración
    const originalSend = res.send;
    res.send = function(data) {
        const duration = Date.now() - start;
        
        logger.info('HTTP Response', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            userId: req.user?.id
        });
        
        // Si es error 4xx o 5xx, log adicional
        if (res.statusCode >= 400) {
            logger.warn('HTTP Error Response', {
                method: req.method,
                url: req.url,
                statusCode: res.statusCode,
                userId: req.user?.id,
                responseBody: data ? JSON.parse(data) : null
            });
        }
        
        originalSend.call(this, data);
    };
    
    next();
};

/**
 * Crear contexto de logging para una operación
 */
logger.createContext = (operation, userId = null) => {
    const correlationId = require('crypto').randomUUID();
    
    return {
        info: (message, meta = {}) => logger.info(message, { 
            operation, 
            userId, 
            correlationId, 
            ...meta 
        }),
        warn: (message, meta = {}) => logger.warn(message, { 
            operation, 
            userId, 
            correlationId, 
            ...meta 
        }),
        error: (message, meta = {}) => logger.error(message, { 
            operation, 
            userId, 
            correlationId, 
            ...meta 
        }),
        audit: (event, meta = {}) => logger.audit(event, { 
            operation, 
            userId, 
            correlationId, 
            ...meta 
        })
    };
};

module.exports = logger; 