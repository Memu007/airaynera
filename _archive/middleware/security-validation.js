/**
 * SECURITY VALIDATION - Critical Environment Variables
 * ================================================
 * This module validates that all required security environment variables are present
 * and properly configured before the application starts.
 *
 * SECURITY: Application will NOT start without proper security configuration
 */

const crypto = require('crypto');

class SecurityValidator {
    constructor() {
        this.errors = [];
        this.warnings = [];
    }

    /**
     * Validates all critical security environment variables
     * @returns {boolean} True if all validations pass
     */
    validateAll() {
        console.log('🔐 Starting Security Validation...');

        this.validateJWTSecrets();
        this.validateEncryptionKeys();
        this.validateAuthSettings();
        this.validateApiKeys();
        this.validateDatabaseConfig();
        this.validateSecurityHeaders();

        return this.reportResults();
    }

    /**
     * Validates JWT secrets are present and meet security requirements
     */
    validateJWTSecrets() {
        const jwtSecret = process.env.JWT_SECRET;
        const refreshSecret = process.env.JWT_REFRESH_SECRET;

        if (!jwtSecret) {
            this.errors.push('❌ JWT_SECRET is required for authentication security');
        } else if (jwtSecret.length < 32) {
            this.errors.push('❌ JWT_SECRET must be at least 32 characters long');
        } else if (jwtSecret.includes('fallback') || jwtSecret.includes('default')) {
            this.errors.push('❌ JWT_SECRET cannot contain "fallback" or "default" - use a unique secret');
        }

        if (!refreshSecret) {
            this.errors.push('❌ JWT_REFRESH_SECRET is required for token rotation security');
        } else if (refreshSecret.length < 32) {
            this.errors.push('❌ JWT_REFRESH_SECRET must be at least 32 characters long');
        } else if (refreshSecret === jwtSecret) {
            this.errors.push('❌ JWT_REFRESH_SECRET must be different from JWT_SECRET');
        }
    }

    /**
     * Validates encryption keys are present and secure
     */
    validateEncryptionKeys() {
        const encryptionKey = process.env.ENCRYPTION_KEY;
        const masterKey = process.env.MASTER_KEY;
        const pinPepper = process.env.PIN_PEPPER;
        const logSalt = process.env.LOG_SALT;

        if (!encryptionKey) {
            this.errors.push('❌ ENCRYPTION_KEY is required for data encryption');
        } else if (encryptionKey.length < 32) {
            this.errors.push('❌ ENCRYPTION_KEY must be at least 32 characters long');
        }

        if (!masterKey) {
            this.errors.push('❌ MASTER_KEY is required for sensitive data encryption');
        } else if (masterKey.length < 32) {
            this.errors.push('❌ MASTER_KEY must be at least 32 characters long');
        }

        if (!pinPepper) {
            this.warnings.push('⚠️ PIN_PEPPER is recommended for additional PIN security');
        }

        if (!logSalt) {
            this.warnings.push('⚠️ LOG_SALT is recommended for audit log security');
        }
    }

    /**
     * Validates authentication settings
     */
    validateAuthSettings() {
        const requireAuth = process.env.REQUIRE_AUTH;

        if (!requireAuth || requireAuth.toLowerCase() !== 'true') {
            this.warnings.push('⚠️ REQUIRE_AUTH is not set to true - authentication will be disabled');
        }

        const jwtExpiresIn = process.env.JWT_EXPIRES_IN;
        if (jwtExpiresIn && !this.isValidJwtExpiry(jwtExpiresIn)) {
            this.errors.push('❌ JWT_EXPIRES_IN format is invalid. Use format like "24h", "7d", etc.');
        }
    }

    /**
     * Validates API keys are properly configured (if used)
     */
    validateApiKeys() {
        // WhatsApp API
        const whatsappToken = process.env.WHATSAPP_TOKEN;
        const enableWhatsapp = process.env.ENABLE_WHATSAPP_WEBHOOK || process.env.ENABLE_WHATSAPP_INGEST;

        if (enableWhatsapp === 'true' && !whatsappToken) {
            this.warnings.push('⚠️ WhatsApp features enabled but WHATSAPP_TOKEN is not configured');
        }

        // AI Services
        const geminiKey = process.env.GEMINI_API_KEY;
        if (!geminiKey) {
            this.warnings.push('⚠️ GEMINI_API_KEY not configured - AI features will be disabled');
        }

        // Payment Processing
        const mpToken = process.env.MP_ACCESS_TOKEN;
        const enableMp = process.env.ENABLE_MP;

        if (enableMp === 'true' && !mpToken) {
            this.warnings.push('⚠️ MercadoPago enabled but MP_ACCESS_TOKEN is not configured');
        }
    }

    /**
     * Validates database configuration
     */
    validateDatabaseConfig() {
        const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID;
        const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;

        if (!projectId && !process.env.USE_SQLITE) {
            this.warnings.push('⚠️ No database configuration found (GOOGLE_CLOUD_PROJECT_ID or USE_SQLITE)');
        }

        if (projectId && !credentials) {
            this.warnings.push('⚠️ GOOGLE_CLOUD_PROJECT_ID set but GOOGLE_APPLICATION_CREDENTIALS not configured');
        }
    }

    /**
     * Validates security headers configuration
     */
    validateSecurityHeaders() {
        const corsOrigins = process.env.CORS_ORIGINS;
        const cspMode = process.env.CSP_MODE;
        const requireHttps = process.env.REQUIRE_HTTPS;

        if (!corsOrigins) {
            this.warnings.push('⚠️ CORS_ORIGINS not configured - using default localhost only');
        }

        if (cspMode && !['strict', 'relaxed'].includes(cspMode.toLowerCase())) {
            this.errors.push('❌ CSP_MODE must be either "strict" or "relaxed"');
        }

        if (requireHttps === 'true' && process.env.NODE_ENV !== 'production') {
            this.warnings.push('⚠️ REQUIRE_HTTPS enabled in non-production environment');
        }
    }

    /**
     * Validates JWT expiry format
     */
    isValidJwtExpiry(expiresIn) {
        const validPatterns = [
            /^\d+[smhd]$/,  // e.g., 24h, 7d, 30m, 60s
            /^\d+$/          // seconds only
        ];
        return validPatterns.some(pattern => pattern.test(expiresIn));
    }

    /**
     * Reports validation results and decides whether to continue
     */
    reportResults() {
        let hasErrors = false;

        if (this.errors.length > 0) {
            hasErrors = true;
            console.error('\n🚨 SECURITY VALIDATION FAILED:');
            console.error('The following CRITICAL security issues must be resolved:');
            this.errors.forEach(error => console.error(`  ${error}`));
            console.error('\n❌ Application CANNOT start without fixing these security issues\n');
        }

        if (this.warnings.length > 0) {
            console.warn('\n⚠️ SECURITY WARNINGS:');
            console.warn('The following issues should be addressed for optimal security:');
            this.warnings.forEach(warning => console.warn(`  ${warning}`));
            console.warn();
        }

        if (!hasErrors) {
            console.log('✅ All critical security validations passed');
            console.log('🔒 System is configured securely\n');
        }

        return !hasErrors;
    }

    /**
     * Generates secure secrets for development
     * WARNING: Never use in production!
     */
    static generateSecrets() {
        console.warn('\n⚠️ DEVELOPMENT SECRETS GENERATED - NEVER USE IN PRODUCTION!\n');

        return {
            JWT_SECRET: crypto.randomBytes(64).toString('base64'),
            JWT_REFRESH_SECRET: crypto.randomBytes(64).toString('base64'),
            ENCRYPTION_KEY: crypto.randomBytes(32).toString('base64'),
            MASTER_KEY: crypto.randomBytes(32).toString('base64'),
            PIN_PEPPER: crypto.randomBytes(32).toString('base64'),
            LOG_SALT: crypto.randomBytes(32).toString('base64')
        };
    }
}

module.exports = SecurityValidator;

// Auto-validate if this file is run directly
if (require.main === module) {
    const validator = new SecurityValidator();
    const isValid = validator.validateAll();

    if (!isValid) {
        process.exit(1);
    }
}