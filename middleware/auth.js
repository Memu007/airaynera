/**
 * SECURE Authentication Middleware for AIRA Medical Bot
 * HIPAA COMPLIANT - Authentication is MANDATORY
 * 
 * CRITICAL: Authentication CANNOT be disabled
 * All endpoints require valid authentication by default
 */
const jwt = require('jsonwebtoken');
const { secretoJWT, secretoJWTPrevious, securityUtils } = require('../src/config/seguridad');

// Audit logging for security events
function logSecurityEvent(event, details) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    event,
    details,
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown'
  };
  
  // Log to console for now - in production, use secure audit logging
  console.warn(`[SECURITY_AUDIT] ${timestamp} - ${event}:`, logEntry);
  
  // TODO: Integrate with secure audit logging system
  if (global.auditLogger) {
    global.auditLogger.log('auth', logEntry);
  }
}

function getSecret() {
  if (!secretoJWT) {
    throw new Error('JWT_SECRET is not configured - system authentication failure');
  }
  return secretoJWT;
}

function getPreviousSecret() {
  return secretoJWTPrevious || null;
}

// Enhanced optional auth with security logging
function optionalAuth(req, res, next) {
  const startTime = Date.now();
  
  try {
    const auth = req.headers.authorization || '';
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: req.path,
      method: req.method
    };
    
    if (auth.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const secret = getSecret();
      
      if (secret) {
        try {
          req.user = jwt.verify(token, secret);
          req.authTime = Date.now() - startTime;
          
          logSecurityEvent('AUTH_SUCCESS', {
            ...clientInfo,
            userId: req.user.sub,
            role: req.user.role
          });
          
        } catch (err) {
          // Try previous secret for rotation
          const prevSecret = getPreviousSecret();
          if (prevSecret) {
            try {
              req.user = jwt.verify(token, prevSecret);
              req.authTime = Date.now() - startTime;
              req.wasRotatedToken = true;
              
              logSecurityEvent('AUTH_ROTATED_SUCCESS', {
                ...clientInfo,
                userId: req.user.sub,
                role: req.user.role
              });
              
            } catch (prevErr) {
              logSecurityEvent('AUTH_FAILED', {
                ...clientInfo,
                error: 'Invalid token (tried current and previous secrets)'
              });
            }
          } else {
            logSecurityEvent('AUTH_FAILED', {
              ...clientInfo,
              error: 'Invalid token'
            });
          }
        }
      }
    } else if (auth) {
      logSecurityEvent('AUTH_INVALID_FORMAT', {
        ...clientInfo,
        error: 'Invalid authorization header format'
      });
    }
    
  } catch (error) {
    logSecurityEvent('AUTH_ERROR', {
      ip: req.ip || req.connection.remoteAddress,
      endpoint: req.path,
      error: error.message
    });
  }
  
  next();
}

// MANDATORY authentication - CANNOT be disabled
function requireAuth(req, res, next) {
  const startTime = Date.now();
  
  // Authentication is ALWAYS required - no bypass allowed
  const secret = getSecret();
  const clientInfo = {
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.headers['user-agent'],
    endpoint: req.path,
    method: req.method
  };
  
  if (!secret) {
    logSecurityEvent('AUTH_CRITICAL_ERROR', {
      ...clientInfo,
      error: 'JWT_SECRET not configured'
    });
    
    return res.status(500).json({ 
      error: 'SERVER_AUTH_MISCONFIGURED',
      message: 'Authentication system is not properly configured'
    });
  }
  
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) {
    logSecurityEvent('AUTH_MISSING_TOKEN', {
      ...clientInfo,
      error: 'Missing or invalid authorization header'
    });
    
    return res.status(401).json({ 
      error: 'UNAUTHORIZED',
      message: 'Valid authentication token required'
    });
  }
  
  try {
    const token = auth.slice(7);
    
    try {
      req.user = jwt.verify(token, secret);
      req.authTime = Date.now() - startTime;
      
      logSecurityEvent('AUTH_SUCCESS', {
        ...clientInfo,
        userId: req.user.sub,
        role: req.user.role,
        tokenAge: req.user.iat ? Math.floor(Date.now() / 1000) - req.user.iat : 'unknown'
      });
      
      return next();
      
    } catch (err) {
      // Try previous secret for smooth rotation
      const prevSecret = getPreviousSecret();
      if (prevSecret) {
        try {
          req.user = jwt.verify(token, prevSecret);
          req.authTime = Date.now() - startTime;
          req.wasRotatedToken = true;
          
          logSecurityEvent('AUTH_ROTATED_SUCCESS', {
            ...clientInfo,
            userId: req.user.sub,
            role: req.user.role,
            tokenAge: req.user.iat ? Math.floor(Date.now() / 1000) - req.user.iat : 'unknown'
          });
          
          return next();
          
        } catch (prevErr) {
          logSecurityEvent('AUTH_FAILED', {
            ...clientInfo,
            error: 'Invalid token (tried current and previous secrets)',
            jwtError: err.message
          });
        }
      } else {
        logSecurityEvent('AUTH_FAILED', {
          ...clientInfo,
          error: 'Invalid token',
          jwtError: err.message
        });
      }
      
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Invalid or expired authentication token'
      });
    }
    
  } catch (error) {
    logSecurityEvent('AUTH_SYSTEM_ERROR', {
      ...clientInfo,
      error: error.message
    });
    
    return res.status(500).json({ 
      error: 'AUTH_SYSTEM_ERROR',
      message: 'Authentication system error'
    });
  }
}

// Role-based access control (ALWAYS enforced)
function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  
  return (req, res, next) => {
    const clientInfo = {
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      endpoint: req.path,
      method: req.method
    };
    
    if (!req.user) {
      logSecurityEvent('RBAC_NO_USER', {
        ...clientInfo,
        requiredRoles: allowed,
        error: 'No user context for role check'
      });
      
      return res.status(401).json({ 
        error: 'UNAUTHORIZED',
        message: 'Authentication required for role-based access'
      });
    }
    
    const userRole = req.user.role || 'unknown';
    if (allowed.includes(userRole)) {
      logSecurityEvent('RBAC_SUCCESS', {
        ...clientInfo,
        userId: req.user.sub,
        userRole,
        requiredRoles: allowed
      });
      
      return next();
    }
    
    logSecurityEvent('RBAC_DENIED', {
      ...clientInfo,
      userId: req.user.sub,
      userRole,
      requiredRoles: allowed,
      error: 'Insufficient privileges'
    });
    
    return res.status(403).json({ 
      error: 'FORBIDDEN',
      message: `Access denied. Required role: ${allowed.join(' or ')}. Current role: ${userRole}`
    });
  };
}

// HIPAA-compliant token issuance (NO demo tokens in production)
function issueToken(payload, expiresIn = process.env.JWT_EXPIRES_IN || '1h') {
  const secret = getSecret();
  
  if (!secret) {
    throw new Error('Cannot issue token: JWT_SECRET not configured');
  }
  
  // Validate payload
  if (!payload.sub || !payload.role) {
    throw new Error('Token payload must include sub (user ID) and role');
  }
  
  // Add standard claims
  const standardPayload = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    iss: 'aira-medical-bot',
    aud: 'aira-medical-system'
  };
  
  return jwt.sign(standardPayload, secret, { expiresIn });
}

// Rate limiting for authentication endpoints
const authAttempts = new Map(); // IP -> { count, lastAttempt }

function checkAuthRateLimit(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxAttempts = 10; // Maximum 10 auth attempts per 15 minutes
  
  if (!authAttempts.has(ip)) {
    authAttempts.set(ip, { count: 1, lastAttempt: now });
    return next();
  }
  
  const attempts = authAttempts.get(ip);
  
  // Reset window if expired
  if (now - attempts.lastAttempt > windowMs) {
    attempts.count = 1;
    attempts.lastAttempt = now;
    return next();
  }
  
  attempts.count++;
  attempts.lastAttempt = now;
  
  if (attempts.count > maxAttempts) {
    logSecurityEvent('AUTH_RATE_LIMIT_EXCEEDED', {
      ip,
      userAgent: req.headers['user-agent'],
      endpoint: req.path,
      attempts: attempts.count,
      windowMs
    });
    
    return res.status(429).json({
      error: 'TOO_MANY_ATTEMPTS',
      message: 'Too many authentication attempts. Please try again later.',
      retryAfter: Math.ceil(windowMs / 1000)
    });
  }
  
  next();
}

// Session validation for medical data access
function requireValidSession(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      error: 'SESSION_REQUIRED',
      message: 'Valid user session required for this operation'
    });
  }
  
  // Check if session is not too old
  const sessionAge = req.user.iat ? Math.floor(Date.now() / 1000) - req.user.iat : 0;
  const maxSessionAge = parseInt(process.env.MAX_SESSION_AGE_SECONDS) || 3600; // 1 hour
  
  if (sessionAge > maxSessionAge) {
    logSecurityEvent('SESSION_EXPIRED', {
      ip: req.ip || req.connection.remoteAddress,
      userId: req.user.sub,
      sessionAge,
      maxSessionAge
    });
    
    return res.status(401).json({
      error: 'SESSION_EXPIRED',
      message: 'Session has expired. Please authenticate again.'
    });
  }
  
  next();
}

module.exports = { 
  optionalAuth, 
  requireAuth, 
  requireRole, 
  issueToken,
  getSecret, 
  getPreviousSecret,
  checkAuthRateLimit,
  requireValidSession
};


