/**
 * HIPAA COMPLIANT AUDIT TRAIL MIDDLEWARE
 *
 * Middleware para logging completo de eventos del sistema
 * Cumple con HIPAA Security Rule §164.312(a)(2)
 *
 * Features:
 * - Audit logging de todos los accesos a datos médicos (PHI)
 * - PII masking en logs para cumplir con HIPAA
 * - Event tracking para acciones críticas
 * - Session activity monitoring
 * - Security event logging
 * - Timestamps en formato UTC
 * - Structured logging para fácil análisis
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Constants for HIPAA compliance
const HIPAA_EVENT_TYPES = {
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  DATA_ACCESS: 'DATA_ACCESS',
  DATA_MODIFICATION: 'DATA_MODIFICATION',
  DATA_EXPORT: 'DATA_EXPORT',
  SECURITY_VIOLATION: 'SECURITY_VIOLATION',
  SYSTEM_ERROR: 'SYSTEM_ERROR',
  SESSION_MANAGEMENT: 'SESSION_MANAGEMENT',
  BACKUP_OPERATION: 'BACKUP_OPERATION',
  DATA_DELETION: 'DATA_DELETION'
};

const HIPAA_ROLES = {
  ADMIN: 'ADMIN',
  PROFESSIONAL: 'PROFESSIONAL',
  SYSTEM: 'SYSTEM',
  ANONYMOUS: 'ANONYMOUS'
};

/**
 * Ensure audit directory exists
 */
function ensureLogsDir() {
  const logDir = path.join(__dirname, '..', 'logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Create daily log files
  const today = new Date().toISOString().split('T')[0];
  const dailyLogFile = path.join(logDir, `audit-${today}.log`);

  // Check if daily log exists, if not create it with header
  if (!fs.existsSync(dailyLogFile)) {
    const header = '# HIPAA Compliant Audit Trail - AIRA Medical System\n' +
                    `# Created: ${new Date().toISOString()}\n` +
                    `# Event Format: JSON | Date: ${today}\n` +
                    '# Field Descriptions:\n' +
                    '# - timestamp: ISO 8601 UTC\n' +
                    '# - eventId: Unique identifier for audit event\n' +
                    '# - eventType: Type of HIPAA event\n' +
                    '# - user: User information (PII masked)\n' +
                    '# - patient: Patient data (PII masked)\n' +
                    '# - action: Action performed\n' +
                    '# - resource: Resource accessed\n' +
                    '# - method: HTTP method\n' +
                    '# - endpoint: API endpoint\n' +
                    '# - ip: Client IP (masked)\n' +
                    '# - success: Success status\n' +
                    '# - responseTime: Response time in ms\n' +
                    '# - sessionId: Session identifier\n' +
                    '# - requestId: Request identifier\n' +
                    '# - metadata: Additional event metadata\n\n';

    fs.writeFileSync(dailyLogFile, header);
  }

  return { logDir, dailyLogFile };
}

/**
 * Enhanced PII masking for HIPAA compliance
 */
function maskPII(data, fieldType) {
  if (!data) return '[REDACTED]';

  const dataString = String(data);

  switch(fieldType) {
    case 'dni':
      return dataString.length > 3 ?
        `${dataString.substring(0, 2)}***${dataString.substring(dataString.length - 2)}` :
        '[REDACTED]';

    case 'phone':
      return dataString.length > 4 ?
        `${dataString.substring(0, 3)}***${dataString.substring(dataString.length - 2)}` :
        '[REDACTED]';

    case 'email':
      const [username, domain] = dataString.split('@');
      if (!username || !domain) return '[REDACTED]';
      return `${username.substring(0, 2)}***@${domain}`;

    case 'name':
      return dataString.length > 4 ?
        `${dataString.substring(0, 2)}***${dataString.substring(dataString.length - 2)}` :
        '[REDACTED]';

    case 'id':
      return dataString.length > 8 ?
        dataString.substring(0, 4) + '****' :
        '[REDACTED]';

    default:
      return '[REDACTED]';
  }
}

/**
 * Generate SHA-256 hash for data identification
 */
function generateDataHash(data) {
  if (!data) return null;
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex').substring(0, 8);
}

/**
 * Create standardized audit log entry
 */
function createAuditLogEntry(eventType, details) {
  const timestamp = new Date().toISOString();
  const eventId = crypto.randomUUID();

  // Extract user information safely
  const user = details.user || {};
  const maskedUser = {
    id: maskPII(user.id, 'id'),
    dni: maskPII(user.dni, 'dni'),
    name: maskPII(user.name, 'name'),
    email: maskPII(user.email, 'email'),
    role: user.role || HIPAA_ROLES.ANONYMOUS
  };

  // Extract patient information safely for medical events
  const patient = details.patient || {};
  const maskedPatient = {};
  if (patient.id) {
    maskedPatient.id = maskPII(patient.id, 'id');
    maskedPatient.dataHash = generateDataHash(patient);
  }

  // Extract IP information safely
  const clientIP = details.ip || '0.0.0.0';
  const maskedIP = clientIP.split('.').length === 4 ?
    `${clientIP.split('.')[0]}.${clientIP.split('.')[1]}.*.*` :
    '0.0.0.0';

  // Build audit entry
  const auditEntry = {
    eventId,
    timestamp,
    eventType: HIPAA_EVENT_TYPES[eventType] || eventType,
    user: maskedUser,
    patient: Object.keys(maskedPatient).length > 0 ? maskedPatient : undefined,
    action: details.action,
    resource: details.resource,
    method: details.method,
    endpoint: details.endpoint,
    userAgent: details.userAgent ?
      details.userAgent.substring(0, 50) + (details.userAgent.length > 50 ? '...' : '') :
      undefined,
    ip: maskedIP,
    success: details.success,
    errorMessage: details.errorMessage ?
      details.errorMessage.substring(0, 200) + (details.errorMessage.length > 200 ? '...' : '') :
      undefined,
    responseTime: details.responseTime,
    sessionId: details.sessionId,
    requestId: details.requestId,
    metadata: {
      ...details.metadata,
      auditVersion: '1.0',
      system: 'AIRA-MEDICAL-SYSTEM',
      compliance: 'HIPAA'
    }
  };

  // Remove undefined values to keep logs clean
  Object.keys(auditEntry).forEach(key => {
    if (auditEntry[key] === undefined) {
      delete auditEntry[key];
    }
  });

  return auditEntry;
}

/**
 * Write audit log to daily log file with proper formatting
 */
function writeAuditLog(auditEntry) {
  try {
    const { logDir, dailyLogFile } = ensureLogsDir();

    // Format log entry for human readability
    const logMessage = `[${auditEntry.eventType}] ${auditEntry.action} - User:${auditEntry.user.id || 'anonymous'} - ${auditEntry.timestamp}`;

    // Write to console for immediate visibility
    if (auditEntry.eventType === HIPAA_EVENT_TYPES.SECURITY_VIOLATION ||
        auditEntry.eventType === HIPAA_EVENT_TYPES.SYSTEM_ERROR) {
      console.error(`[AUDIT-ERROR] ${logMessage}`, auditEntry);
    } else if (auditEntry.eventType === HIPAA_EVENT_TYPES.DATA_DELETION ||
             auditEntry.eventType === HIPAA_EVENT_TYPES.DATA_MODIFICATION) {
      console.warn(`[AUDIT-WARN] ${logMessage}`, auditEntry);
    } else {
      console.log(`[AUDIT-INFO] ${logMessage}`, auditEntry);
    }

    // Write to daily log file for archival
    fs.appendFileSync(dailyLogFile, JSON.stringify(auditEntry) + '\n');

  } catch (error) {
    // Ensure audit logging doesn't break the application
    console.error('[AUDIT-SYSTEM-ERROR] Failed to write audit log:', error.message);
  }
}

/**
 * Check if audit logging is enabled
 */
function isAuditEnabled() {
  return String(process.env.AUDIT_LOG_ENABLED || 'true').toLowerCase() === 'true';
}

/**
 * Main audit middleware function
 */
function auditTrail(options = {}) {
  return (req, res, next) => {
    // Skip if audit logging is disabled
    if (!isAuditEnabled()) return next();

    const startTime = Date.now();

    // Store original res.json to intercept responses
    const originalJson = res.json;
    const originalSend = res.send;
    const originalEnd = res.end;

    // Intercept responses to capture data
    let responseData = null;
    let statusCode = 200;

    res.json = function(data) {
      responseData = data;
      statusCode = 200;
      return originalJson.call(this, data);
    };

    res.send = function(data) {
      responseData = data;
      return originalSend.call(this, data);
    };

    res.end = function(data) {
      responseData = data;
      statusCode = res.statusCode || 200;
      return originalEnd.call(this, data);
    };

    // Continue to next middleware
    res.on('finish', () => {
      try {
        const responseTime = Date.now() - startTime;

        // Determine if this is a PHI access
        const isPHIAccess = req.originalUrl && (
          req.originalUrl.includes('/api/pacientes') ||
          req.originalUrl.includes('/api/sesiones') ||
          req.originalUrl.includes('/patients') ||
          req.originalUrl.includes('/sessions')
        );

        // Log successful PHI access
        if (isPHIAccess && statusCode >= 200 && statusCode < 300) {
          const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.DATA_ACCESS, {
            user: req.user,
            patient: req.patient,
            action: 'Access PHI Data',
            resource: req.originalUrl,
            method: req.method,
            endpoint: req.originalUrl,
            userAgent: req.get('user-agent'),
            ip: req.ip || req.connection.remoteAddress,
            success: true,
            responseTime,
            sessionId: req.sessionID,
            requestId: req.requestID,
            metadata: {
              statusCode,
              responseSize: JSON.stringify(responseData || {}).length
            }
          });

          writeAuditLog(auditEntry);
        }

        // Log authentication events
        if (req.originalUrl && req.originalUrl.includes('/api/auth/')) {
          const action = req.originalUrl.includes('/login') ? 'Login Attempt' :
                      req.originalUrl.includes('/logout') ? 'Logout' :
                      req.originalUrl.includes('/refresh') ? 'Token Refresh' : 'Auth Action';

          const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.AUTHENTICATION, {
            user: req.user,
            action,
            resource: req.originalUrl,
            method: req.method,
            endpoint: req.originalUrl,
            userAgent: req.get('user-agent'),
            ip: req.ip || req.connection.remoteAddress,
            success: statusCode >= 200 && statusCode < 300,
            responseTime,
            sessionId: req.sessionID,
            requestId: req.requestID,
            metadata: {
              statusCode
            }
          });

          writeAuditLog(auditEntry);
        }

        // Log failed requests with errors
        if (statusCode >= 400) {
          const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.SYSTEM_ERROR, {
            user: req.user,
            action: 'Request Failed',
            resource: req.originalUrl,
            method: req.method,
            endpoint: req.originalUrl,
            userAgent: req.get('user-agent'),
            ip: req.ip || req.connection.remoteAddress,
            success: false,
            errorMessage: responseData?.message || responseData?.error || 'Request failed',
            responseTime,
            sessionId: req.sessionID,
            requestId: req.requestID,
            metadata: {
              statusCode,
              errorType: responseData?.error || 'Unknown'
            }
          });

          writeAuditLog(auditEntry);
        }

        // Log security violations (rate limiting, blocked requests, etc.)
        if (req.securityViolation) {
          const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.SECURITY_VIOLATION, {
            user: req.user,
            action: req.securityViolation.type || 'Security Violation',
            resource: req.originalUrl,
            method: req.method,
            endpoint: req.originalUrl,
            userAgent: req.get('user-agent'),
            ip: req.ip || req.connection.remoteAddress,
            success: false,
            errorMessage: req.securityViolation.message,
            responseTime,
            sessionId: req.sessionID,
            requestId: req.requestID,
            metadata: {
              violationType: req.securityViolation.type,
              blocked: req.securityViolation.blocked || false
            }
          });

          writeAuditLog(auditEntry);
        }

      } catch (error) {
        // Ensure audit logging doesn't break the application
        console.error('[AUDIT-SYSTEM-ERROR] Failed to create audit log:', error.message);
      }
    });

    next();
  };
}

/**
 * Legacy function for backward compatibility
 */
function auditLog(action) {
  return (req, res, next) => {
    // Try to extract user info from JWT or session
    const user = req.user || (req.session && req.session.user);
    const patient = req.patient || (req.params && req.params.patientId && { id: req.params.patientId });

    const auditEntry = createAuditLogEntry('DATA_ACCESS', {
      user,
      patient,
      action,
      resource: req.originalUrl || req.path,
      method: req.method,
      endpoint: req.originalUrl,
      userAgent: req.get('user-agent'),
      ip: req.ip || req.connection.remoteAddress,
      success: true,
      responseTime: 0,
      sessionId: req.sessionID,
      requestId: req.requestID,
      metadata: {
        legacy: true
      }
    });

    writeAuditLog(auditEntry);
    next();
  };
}

/**
 * Log medical data access for HIPAA compliance
 */
function logDataAccess(user, patient, action, resource, details = {}) {
  const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.DATA_ACCESS, {
    user,
    patient,
    action,
    resource,
    method: details.method || 'SYSTEM',
    endpoint: details.endpoint,
    userAgent: details.userAgent,
    ip: details.ip || 'SYSTEM',
    success: true,
    responseTime: details.responseTime || 0,
    sessionId: details.sessionId,
    requestId: details.requestId,
    metadata: {
      ...details.metadata,
      initiatedBy: 'SYSTEM'
    }
  });

  writeAuditLog(auditEntry);
}

/**
 * Log data modifications for HIPAA compliance
 */
function logDataModification(user, patient, action, resource, oldValue, newValue, details = {}) {
  const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.DATA_MODIFICATION, {
    user,
    patient,
    action,
    resource,
    method: details.method || 'SYSTEM',
    endpoint: details.endpoint,
    userAgent: details.userAgent,
    ip: details.ip || 'SYSTEM',
    success: true,
    responseTime: details.responseTime || 0,
    sessionId: details.sessionId,
    requestId: details.requestID,
    metadata: {
      ...details.metadata,
      oldValueHash: generateDataHash(oldValue),
      newValueHash: generateDataHash(newValue),
      initiatedBy: 'SYSTEM'
    }
  });

  writeAuditLog(auditEntry);
}

/**
 * Log data export for HIPAA compliance
 */
function logDataExport(user, resource, exportFormat, recordCount, details = {}) {
  const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.DATA_EXPORT, {
    user,
    action: `Export ${resource}`,
    resource,
    method: details.method || 'SYSTEM',
    endpoint: details.endpoint,
    userAgent: details.userAgent,
    ip: details.ip || 'SYSTEM',
    success: true,
    responseTime: details.responseTime || 0,
    sessionId: details.sessionId,
    requestId: details.requestID,
    metadata: {
      ...details.metadata,
      exportFormat,
      recordCount,
      initiatedBy: 'SYSTEM'
    }
  });

  writeAuditLog(auditEntry);
}

/**
 * Log data deletion for HIPAA compliance
 */
function logDataDeletion(user, resource, deletedCount, details = {}) {
  const auditEntry = createAuditLogEntry(HIPAA_EVENT_TYPES.DATA_DELETION, {
    user,
    action: `Delete ${resource}`,
    resource,
    method: details.method || 'SYSTEM',
    endpoint: details.endpoint,
    userAgent: details.userAgent,
    ip: details.ip || 'SYSTEM',
    success: true,
    responseTime: details.responseTime || 0,
    sessionId: details.sessionId,
    requestId: details.requestID,
    metadata: {
      ...details.metadata,
      deletedCount,
      initiatedBy: 'SYSTEM'
    }
  });

  writeAuditEntry(auditEntry);
}

/**
 * Enhanced sanitize function for legacy compatibility
 */
function sanitizeForAudit(data) {
  const clone = { ...(data || {}) };
  const sensitiveFields = ['password', 'token', 'secret'];

  // Use enhanced PII masking
  sensitiveFields.forEach((k) => {
    if (k in clone) clone[k] = '[REDACTED]';
  });

  // Use enhanced masking for medical fields
  if ('dni' in clone) clone.dni = maskPII(clone.dni, 'dni');
  if ('documento' in clone) clone.documento = maskPII(clone.documento, 'dni');
  if ('phone' in clone) clone.phone = maskPII(clone.phone, 'phone');
  if ('telefono' in clone) clone.telefono = maskPII(clone.telefono, 'phone');
  if ('email' in clone) clone.email = maskPII(clone.email, 'email');
  if ('name' in clone) clone.name = maskPII(clone.name, 'name');
  if ('paciente' in clone) clone.paciente = maskPII(clone.paciente, 'name');

  return clone;
}

module.exports = {
  auditTrail,
  auditLog, // Legacy function for backward compatibility
  HIPAA_EVENT_TYPES,
  HIPAA_ROLES,
  logDataAccess,
  logDataModification,
  logDataExport,
  logDataDeletion,
  sanitizeForAudit,
  maskPII,
  generateDataHash,
  isAuditEnabled
};


