/**
 * SECURE Configuration for AIRA Medical Bot
 * HIPAA COMPLIANT - No hardcoded secrets
 * 
 * CRITICAL: This module enforces security by default
 * System will FAIL if required security configuration is missing
 */
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const dotenv = require('dotenv');

dotenv.config();

// Security validation - system will not start without proper configuration
function validateSecurityConfig() {
  const requiredVars = [
    'JWT_SECRET',
    'ENCRYPTION_SECRET'
  ];
  
  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('🚨 CRITICAL SECURITY ERROR 🚨');
    console.error('Missing required security configuration:');
    missingVars.forEach(varName => {
      console.error(`  - ${varName}`);
    });
    console.error('\nSystem CANNOT start without proper security configuration.');
    console.error('Please configure your environment with strong secrets.');
    console.error('\nGenerate secrets with:');
    console.error('  openssl rand -base64 32');
    console.error('\nSee .env.secure.template for required configuration.');
    process.exit(1);
  }
  
  // Validate secret strength
  const jwtSecret = process.env.JWT_SECRET;
  const encryptionSecret = process.env.ENCRYPTION_SECRET;
  
  if (jwtSecret.length < 32) {
    console.error('🚨 CRITICAL: JWT_SECRET must be at least 32 characters');
    process.exit(1);
  }
  
  if (encryptionSecret.length < 32) {
    console.error('🚨 CRITICAL: ENCRYPTION_SECRET must be at least 32 characters');
    process.exit(1);
  }
  
  // Check for weak/placeholder values (but allow test secrets)
  const weakPatterns = [
    /demo/i, /example/i, /sample/i, /temp/i, /default/i,
    /your-.*-here/, /change.*this/, /placeholder/i, /dummy/i, /aira-secreto/i
  ];
  
  // Allow test secrets for testing environment
  if (process.env.NODE_ENV === 'test') {
    return; // Skip weak pattern check in test environment
  }
  
  for (const pattern of weakPatterns) {
    if (pattern.test(jwtSecret) || pattern.test(encryptionSecret)) {
      console.error('🚨 CRITICAL: Detected weak/placeholder secrets');
      console.error('Please replace with strong randomly generated secrets');
      process.exit(1);
    }
  }
}

// Run security validation immediately
validateSecurityConfig();

// Secure encryption configuration
const configCifrado = {
  algoritmo: 'aes-256-gcm',
  longitudClave: 32,
  longitudIv: 16,
  saltRounds: 12, // Increased for better security
  iterations: 100000 // PBKDF2 iterations
};

// JWT Configuration (SECURE - no defaults)
const secretoJWT = process.env.JWT_SECRET;
const duracionToken = parseInt(process.env.JWT_EXPIRES_IN_SECONDS) || 3600; // 1 hour default

// Previous secret for smooth rotation
const secretoJWTPrevious = process.env.JWT_PREVIOUS_SECRET;

// Secure encryption key derivation
const generarClaveDerivada = (contexto) => {
  const encryptionSecret = process.env.ENCRYPTION_SECRET;
  const salt = process.env.ENCRYPTION_SALT || 'aira-hipaa-salt-2024-secure';
  
  if (!encryptionSecret) {
    throw new Error('ENCRYPTION_SECRET is required for HIPAA compliance');
  }
  
  return crypto.pbkdf2Sync(
    encryptionSecret + contexto,
    salt,
    configCifrado.iterations,
    configCifrado.longitudClave,
    'sha256'
  );
};

// HIPAA compliance check
function checkHIPAACompliance() {
  const hipaaMode = process.env.HIPAA_MODE;
  const auditLog = process.env.AUDIT_LOG_ENABLED;
  const requireAuth = process.env.REQUIRE_AUTH;
  
  if (hipaaMode !== 'true') {
    console.warn('⚠️  WARNING: HIPAA compliance mode is not enabled');
  }
  
  if (auditLog !== 'true') {
    console.warn('⚠️  WARNING: Audit logging is not enabled');
  }
  
  if (requireAuth !== 'true') {
    console.error('🚨 CRITICAL: Authentication is not required');
    console.error('This violates HIPAA security requirements');
    process.exit(1);
  }
}

// Check HIPAA compliance
checkHIPAACompliance();

// Security utility functions
const securityUtils = {
  // Generate secure random token
  generateToken: (length = 32) => {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
  },
  
  // Generate secure session ID
  generateSessionId: () => {
    return crypto.randomBytes(16).toString('hex');
  },
  
  // Hash password securely
  hashPassword: async (password) => {
    const saltRounds = parseInt(process.env.PASSWORD_SALT_ROUNDS) || 12;
    return await bcrypt.hash(password, saltRounds);
  },
  
  // Verify password
  verifyPassword: async (password, hash) => {
    return await bcrypt.compare(password, hash);
  },
  
  // Generate secure encryption key for data
  generateDataKey: (dataId) => {
    return generarClaveDerivada(`data-${dataId}`);
  },
  
  // Get current configuration status
  getSecurityStatus: () => {
    return {
      encryption: {
        algorithm: configCifrado.algoritmo,
        keyLength: configCifrado.longitudClave,
        iterations: configCifrado.iterations
      },
      jwt: {
        secretConfigured: !!secretoJWT,
        previousSecretConfigured: !!secretoJWTPrevious,
        tokenDuration: duracionToken
      },
      hipaa: {
        enabled: process.env.HIPAA_MODE === 'true',
        auditLog: process.env.AUDIT_LOG_ENABLED === 'true',
        authRequired: process.env.REQUIRE_AUTH === 'true'
      },
      timestamp: new Date().toISOString()
    };
  }
};

module.exports = {
  configCifrado,
  secretoJWT,
  secretoJWTPrevious,
  duracionToken,
  generarClaveDerivada,
  securityUtils,
  validateSecurityConfig
};
