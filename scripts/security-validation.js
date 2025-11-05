#!/usr/bin/env node
/**
 * AIRA MEDICAL BOT - SECURITY VALIDATION SCRIPT
 * 
 * CRITICAL: This script validates HIPAA compliance and security configuration
 * System will NOT start if security requirements are not met
 * 
 * Usage: node scripts/security-validation.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Security validation results
let validationResults = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    passed: 0,
    failed: 0,
    total: 0
};

// ANSI color codes for console output
const colors = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
};

function log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    let color;
    
    switch(level) {
        case 'CRITICAL':
            color = colors.red + colors.bold;
            break;
        case 'HIGH':
            color = colors.red;
            break;
        case 'MEDIUM':
            color = colors.yellow;
            break;
        case 'LOW':
            color = colors.blue;
            break;
        case 'PASS':
            color = colors.green;
            break;
        case 'INFO':
            color = colors.cyan;
            break;
        default:
            color = colors.white;
    }
    
    console.log(`${color}[${level}]${colors.reset} ${message}`);
    if (details) {
        console.log(`${colors.gray}    ${details}${colors.reset}`);
    }
}

function addIssue(severity, title, description, recommendation) {
    validationResults[severity.toLowerCase()].push({
        title,
        description,
        recommendation,
        timestamp: new Date().toISOString()
    });
    validationResults.failed++;
}

function addPass(title) {
    validationResults.passed++;
    log('PASS', title);
}

// ===== SECURITY VALIDATION FUNCTIONS =====

function validateSecretStrength(secret, name, minLength = 32) {
    if (!secret) {
        addIssue('CRITICAL', `Missing ${name}`, 
            `${name} is not configured`, 
            `Generate a strong secret: openssl rand -base64 ${minLength}`);
        return false;
    }
    
    if (secret.length < minLength) {
        addIssue('HIGH', `Weak ${name}`, 
            `${name} is too short (${secret.length} < ${minLength} bytes)`, 
            `Generate a stronger secret with at least ${minLength} bytes`);
        return false;
    }
    
    // Check for common weak patterns
    const weakPatterns = [
        /test/i, /demo/i, /example/i, /sample/i, /temp/i, /default/i,
        /your-.*-here/, /change.*this/, /placeholder/i, /dummy/i
    ];
    
    for (const pattern of weakPatterns) {
        if (pattern.test(secret)) {
            addIssue('CRITICAL', `Insecure ${name}`, 
                `${name} contains placeholder/weak patterns`, 
                `Replace with a randomly generated secret`);
            return false;
        }
    }
    
    return true;
}

function validateEnvironmentVariables() {
    log('INFO', 'Validating environment variables...');
    
    const criticalVars = [
        'ENCRYPTION_SECRET',
        'JWT_SECRET',
        'GOOGLE_APPLICATION_CREDENTIALS'
    ];
    
    const requiredVars = [
        'NODE_ENV',
        'PORT',
        'GOOGLE_CLOUD_PROJECT_ID',
        'GEMINI_API_KEY',
        'HIPAA_MODE',
        'REQUIRE_AUTH',
        'AUDIT_LOG_ENABLED'
    ];
    
    let allCriticalValid = true;
    
    // Check critical variables
    for (const varName of criticalVars) {
        const value = process.env[varName];
        if (!validateSecretStrength(value, varName)) {
            allCriticalValid = false;
        }
    }
    
    // Check required variables
    for (const varName of requiredVars) {
        const value = process.env[varName];
        if (!value) {
            addIssue('HIGH', `Missing required variable`, 
                `${varName} is not configured`, 
                `Set ${varName} in your environment`);
        }
    }
    
    // Validate specific critical configurations
    if (process.env.REQUIRE_AUTH !== 'true') {
        addIssue('CRITICAL', 'Authentication disabled', 
            'REQUIRE_AUTH is not set to true', 
            'Authentication MUST be enabled for HIPAA compliance');
        allCriticalValid = false;
    }
    
    if (process.env.HIPAA_MODE !== 'true') {
        addIssue('CRITICAL', 'HIPAA compliance disabled', 
            'HIPAA_MODE is not set to true', 
            'HIPAA compliance mode MUST be enabled for medical data');
        allCriticalValid = false;
    }
    
    if (process.env.NODE_ENV === 'production' && process.env.REQUIRE_HTTPS !== 'true') {
        addIssue('HIGH', 'HTTPS not enforced in production', 
            'REQUIRE_HTTPS should be true in production', 
            'Enable HTTPS enforcement for production');
    }
    
    return allCriticalValid;
}

function validateEncryptionConfiguration() {
    log('INFO', 'Validating encryption configuration...');
    
    const encryptionSecret = process.env.ENCRYPTION_SECRET;
    if (!encryptionSecret) {
        addIssue('CRITICAL', 'No encryption secret', 
            'ENCRYPTION_SECRET is required for PHI protection', 
            'Generate a strong encryption secret');
        return false;
    }
    
    // Test encryption/decryption
    try {
        const testData = 'AIRA Medical Test Data - ' + Date.now();
        const algorithm = 'aes-256-gcm';
        const key = crypto.pbkdf2Sync(encryptionSecret, 'aira-health-salt-2024', 100000, 32, 'sha256');
        
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(testData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        
        const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
        const encoded = combined.toString('base64');
        
        // Test decryption
        const decoded = Buffer.from(encoded, 'base64');
        const iv2 = decoded.slice(0, 16);
        const tag2 = decoded.slice(16, 32);
        const encrypted2 = decoded.slice(32);
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv2);
        decipher.setAuthTag(tag2);
        
        let decrypted = decipher.update(encrypted2, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        if (decrypted === testData) {
            addPass('Encryption/decryption test passed');
            return true;
        } else {
            addIssue('CRITICAL', 'Encryption test failed', 
                'Encryption/decryption round trip failed', 
                'Check ENCRYPTION_SECRET configuration');
            return false;
        }
        
    } catch (error) {
        addIssue('CRITICAL', 'Encryption system error', 
            `Encryption test failed: ${error.message}`, 
            'Verify encryption configuration and dependencies');
        return false;
    }
}

function validateFilePermissions() {
    log('INFO', 'Validating file permissions...');
    
    const sensitiveFiles = [
        '.env',
        '.env.production',
        'service-account-key.json',
        './logs/audit.log',
        './data/patients.json',
        './data/sessions.json'
    ];
    
    for (const file of sensitiveFiles) {
        try {
            if (fs.existsSync(file)) {
                const stats = fs.statSync(file);
                const mode = stats.mode;
                
                // Check if file is readable by others (world-readable)
                if (mode & 0o004) {  // Others read permission
                    addIssue('HIGH', `Insecure file permissions`, 
                        `${file} is readable by others`, 
                        `Restrict permissions: chmod 600 ${file}`);
                }
                
                // Check if file is writable by others
                if (mode & 0o002) {  // Others write permission
                    addIssue('CRITICAL', `Dangerous file permissions`, 
                        `${file} is writable by others`, 
                        `Restrict permissions: chmod 600 ${file}`);
                }
            }
        } catch (error) {
            log('INFO', `Could not check permissions for ${file}`);
        }
    }
}

function validateDatabaseSecurity() {
    log('INFO', 'Validating database security...');
    
    const mongoUri = process.env.MONGODB_URI;
    if (mongoUri) {
        if (!mongoUri.includes('ssl=true') && !mongoUri.includes('tls=true')) {
            addIssue('HIGH', 'Database connection not encrypted', 
                'MongoDB connection should use SSL/TLS', 
                'Add ssl=true to MongoDB connection string');
        }
        
        if (mongoUri.includes('localhost') || mongoUri.includes('127.0.0.1')) {
            if (process.env.NODE_ENV === 'production') {
                addIssue('HIGH', 'Production database on localhost', 
                    'Production should not use localhost database', 
                    'Use a production MongoDB cluster with SSL');
            }
        }
    }
}

function validateRateLimiting() {
    log('INFO', 'Validating rate limiting configuration...');
    
    const rateLimitMax = parseInt(process.env.RATE_LIMIT_MAX) || 100;
    const rateLimitWindow = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000;
    
    if (rateLimitMax > 1000) {
        addIssue('MEDIUM', 'Permissive rate limiting', 
            `Rate limit is very high (${rateLimitMax} requests)`, 
            'Consider more restrictive rate limiting for security');
    }
    
    if (rateLimitWindow > 3600000) {  // 1 hour
        addIssue('MEDIUM', 'Long rate limit window', 
            `Rate limit window is very long (${rateLimitWindow/1000/60} minutes)`, 
            'Consider shorter windows for better protection');
    }
    
    const authRateLimit = parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 30;
    if (authRateLimit > 10) {
        addIssue('MEDIUM', 'Permissive auth rate limiting', 
            `Auth rate limit is high (${authRateLimit} attempts per minute)`, 
            'Consider stricter authentication rate limiting');
    }
}

function validateHIPAACompliance() {
    log('INFO', 'Validating HIPAA compliance...');
    
    const hipaaRequired = [
        { var: 'HIPAA_MODE', expected: 'true', description: 'HIPAA compliance mode' },
        { var: 'AUDIT_LOG_ENABLED', expected: 'true', description: 'Audit logging' },
        { var: 'REQUIRE_AUTH', expected: 'true', description: 'Authentication requirement' },
        { var: 'PHI_ENCRYPTION_MANDATORY', expected: 'true', description: 'PHI encryption' }
    ];
    
    for (const requirement of hipaaRequired) {
        const actual = process.env[requirement.var];
        if (actual !== requirement.expected) {
            addIssue('CRITICAL', `HIPAA compliance violation`, 
                `${requirement.description} is not enabled (${actual})`, 
                `Set ${requirement.var}=${requirement.expected} for HIPAA compliance`);
        }
    }
    
    // Check data retention
    const retentionDays = parseInt(process.env.DATA_RETENTION_DAYS) || 2555;
    if (retentionDays < 2555) {  // 7 years
        addIssue('MEDIUM', 'Data retention period too short', 
            `HIPAA requires 7 years retention, current: ${retentionDays} days`, 
            'Set DATA_RETENTION_DAYS to at least 2555 (7 years)');
    }
}

function validateServiceAccountSecurity() {
    log('INFO', 'Validating service account security...');
    
    const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
        try {
            const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
            
            // Check for test/example credentials
            if (serviceAccount.project_id && serviceAccount.project_id.includes('test')) {
                addIssue('HIGH', 'Test service account in use', 
                    'Service account appears to be for testing', 
                    'Use production service account credentials');
            }
            
            // Check file permissions
            const stats = fs.statSync(serviceAccountPath);
            const mode = stats.mode;
            
            if (mode & 0o077) {  // Permissions for group/others
                addIssue('CRITICAL', 'Service account file permissions too open', 
                    'Service account file should be readable only by owner', 
                    `Restrict permissions: chmod 600 ${serviceAccountPath}`);
            }
            
        } catch (error) {
            addIssue('HIGH', 'Invalid service account file', 
                `Cannot read service account file: ${error.message}`, 
                'Verify service account file format and permissions');
        }
    }
}

function generateSecurityReport() {
    log('INFO', 'Generating security validation report...');
    
    const report = {
        timestamp: new Date().toISOString(),
        summary: {
            total_checks: validationResults.total,
            passed: validationResults.passed,
            failed: validationResults.failed,
            critical_issues: validationResults.critical.length,
            high_issues: validationResults.high.length,
            medium_issues: validationResults.medium.length,
            low_issues: validationResults.low.length
        },
        issues: {
            critical: validationResults.critical,
            high: validationResults.high,
            medium: validationResults.medium,
            low: validationResults.low
        },
        recommendations: generateRecommendations(),
        hipaa_status: generateHIPAAStatus()
    };
    
    // Save report
    const reportPath = './logs/security-validation-report.json';
    try {
        if (!fs.existsSync('./logs')) {
            fs.mkdirSync('./logs', { recursive: true });
        }
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        log('INFO', `Security report saved to ${reportPath}`);
    } catch (error) {
        log('HIGH', `Could not save security report: ${error.message}`);
    }
    
    return report;
}

function generateRecommendations() {
    const recommendations = [];
    
    if (validationResults.critical.length > 0) {
        recommendations.push({
            priority: 'IMMEDIATE',
            action: 'Fix all CRITICAL security issues before deployment',
            reason: 'Critical vulnerabilities pose immediate risk to patient data'
        });
    }
    
    if (validationResults.high.length > 0) {
        recommendations.push({
            priority: 'HIGH',
            action: 'Address all HIGH severity issues',
            reason: 'High severity issues could lead to security breaches'
        });
    }
    
    recommendations.push({
        priority: 'ONGOING',
        action: 'Implement regular security audits and monitoring',
        reason: 'Continuous security monitoring is essential for HIPAA compliance'
    });
    
    recommendations.push({
        priority: 'COMPLIANCE',
        action: 'Schedule quarterly HIPAA compliance reviews',
        reason: 'Regular compliance reviews ensure ongoing adherence to regulations'
    });
    
    return recommendations;
}

function generateHIPAAStatus() {
    const hipaaMode = process.env.HIPAA_MODE === 'true';
    const auditLog = process.env.AUDIT_LOG_ENABLED === 'true';
    const authRequired = process.env.REQUIRE_AUTH === 'true';
    const encryptionEnabled = !!process.env.ENCRYPTION_SECRET;
    
    return {
        compliant: hipaaMode && auditLog && authRequired && encryptionEnabled,
        hipaa_mode_enabled: hipaaMode,
        audit_logging_enabled: auditLog,
        authentication_required: authRequired,
        encryption_configured: encryptionEnabled,
        critical_issues_block_compliance: validationResults.critical.length > 0
    };
}

function printSummary(results) {
    console.log('\n' + colors.bold + colors.cyan + '=' .repeat(60) + colors.reset);
    console.log(colors.bold + colors.cyan + 'AIRA MEDICAL BOT - SECURITY VALIDATION SUMMARY' + colors.reset);
    console.log(colors.bold + colors.cyan + '=' .repeat(60) + colors.reset + '\n');
    
    console.log(colors.white + 'Validation Results:' + colors.reset);
    console.log(`  Total Checks: ${results.total}`);
    console.log(`  ${colors.green}Passed: ${results.passed}${colors.reset}`);
    console.log(`  ${colors.red}Failed: ${results.failed}${colors.reset}\n`);
    
    console.log(colors.white + 'Issues by Severity:' + colors.reset);
    console.log(`  ${colors.red + colors.bold}CRITICAL: ${results.critical.length}${colors.reset}`);
    console.log(`  ${colors.red}HIGH: ${results.high.length}${colors.reset}`);
    console.log(`  ${colors.yellow}MEDIUM: ${results.medium.length}${colors.reset}`);
    console.log(`  ${colors.blue}LOW: ${results.low.length}${colors.reset}\n`);
    
    // HIPAA Status
    const hipaaStatus = generateHIPAAStatus();
    console.log(colors.white + 'HIPAA Compliance Status:' + colors.reset);
    if (hipaaStatus.compliant) {
        console.log(`  ${colors.green}✓ COMPLIANT${colors.reset}`);
    } else {
        console.log(`  ${colors.red + colors.bold}✗ NON-COMPLIANT${colors.reset}`);
    }
    
    console.log(`  HIPAA Mode: ${hipaaStatus.hipaa_mode_enabled ? colors.green + 'Enabled' + colors.reset : colors.red + 'Disabled' + colors.reset}`);
    console.log(`  Audit Logging: ${hipaaStatus.audit_logging_enabled ? colors.green + 'Enabled' + colors.reset : colors.red + 'Disabled' + colors.reset}`);
    console.log(`  Authentication: ${hipaaStatus.authentication_required ? colors.green + 'Required' + colors.reset : colors.red + 'Not Required' + colors.reset}`);
    console.log(`  Encryption: ${hipaaStatus.encryption_configured ? colors.green + 'Configured' + colors.reset : colors.red + 'Not Configured' + colors.reset}\n`);
    
    // Critical Issues Warning
    if (results.critical.length > 0) {
        console.log(colors.red + colors.bold + '🚨 CRITICAL SECURITY ISSUES DETECTED 🚨' + colors.reset);
        console.log(colors.red + 'System deployment is BLOCKED until critical issues are resolved' + colors.reset + '\n');
        
        console.log(colors.white + colors.bold + 'Critical Issues:' + colors.reset);
        results.critical.forEach((issue, index) => {
            console.log(`${colors.red}${index + 1}. ${issue.title}${colors.reset}`);
            console.log(`   ${colors.gray}${issue.description}${colors.reset}`);
            console.log(`   ${colors.cyan}→ ${issue.recommendation}${colors.reset}\n`);
        });
    }
    
    if (results.high.length > 0) {
        console.log(colors.yellow + colors.bold + 'High Priority Issues:' + colors.reset);
        results.high.slice(0, 3).forEach((issue, index) => {
            console.log(`${colors.yellow}${index + 1}. ${issue.title}${colors.reset}`);
            console.log(`   ${colors.gray}${issue.recommendation}${colors.reset}`);
        });
        if (results.high.length > 3) {
            console.log(`   ${colors.gray}... and ${results.high.length - 3} more high priority issues${colors.reset}`);
        }
        console.log('');
    }
    
    console.log(colors.cyan + 'Next Steps:' + colors.reset);
    if (results.critical.length > 0) {
        console.log('1. Fix all CRITICAL security issues immediately');
        console.log('2. Regenerate all secrets and encryption keys');
        console.log('3. Enable all HIPAA compliance features');
        console.log('4. Run validation again: node scripts/security-validation.js');
    } else if (results.high.length > 0) {
        console.log('1. Address all HIGH priority issues');
        console.log('2. Review and fix MEDIUM priority issues');
        console.log('3. Implement ongoing security monitoring');
    } else {
        console.log(colors.green + '✓ All critical security requirements met' + colors.reset);
        console.log('1. Continue with deployment preparation');
        console.log('2. Implement regular security monitoring');
        console.log('3. Schedule periodic security audits');
    }
    
    console.log('\n' + colors.bold + colors.cyan + '=' .repeat(60) + colors.reset);
}

// ===== MAIN VALIDATION FUNCTION =====

function runSecurityValidation() {
    console.log(colors.bold + colors.cyan + 'AIRA MEDICAL BOT - SECURITY VALIDATION' + colors.reset);
    console.log(colors.cyan + 'HIPAA Compliance & Security Configuration Check' + colors.reset);
    console.log(colors.gray + `Started at: ${new Date().toISOString()}` + colors.reset);
    console.log(colors.gray + '=' .repeat(60) + colors.reset + '\n');
    
    let criticalIssuesExist = false;
    
    try {
        // Run all validation checks
        log('INFO', 'Starting comprehensive security validation...');
        
        if (!validateEnvironmentVariables()) {
            criticalIssuesExist = true;
        }
        
        if (!validateEncryptionConfiguration()) {
            criticalIssuesExist = true;
        }
        
        validateFilePermissions();
        validateDatabaseSecurity();
        validateRateLimiting();
        validateHIPAACompliance();
        validateServiceAccountSecurity();
        
        // Generate and display results
        const report = generateSecurityReport();
        validationResults.total = validationResults.passed + validationResults.failed;
        
        printSummary(validationResults);
        
        // Exit with appropriate code
        if (criticalIssuesExist || validationResults.critical.length > 0) {
            console.log('\n' + colors.red + colors.bold + '🚨 SECURITY VALIDATION FAILED 🚨' + colors.reset);
            console.log(colors.red + 'CRITICAL security issues must be resolved before deployment' + colors.reset);
            process.exit(1);
        } else if (validationResults.high.length > 0) {
            console.log('\n' + colors.yellow + colors.bold + '⚠️  SECURITY WARNINGS EXIST ⚠️' + colors.reset);
            console.log(colors.yellow + 'High priority issues should be addressed before production deployment' + colors.reset);
            process.exit(2);
        } else {
            console.log('\n' + colors.green + colors.bold + '✅ SECURITY VALIDATION PASSED ✅' + colors.reset);
            console.log(colors.green + 'System is ready for secure deployment' + colors.reset);
            process.exit(0);
        }
        
    } catch (error) {
        console.error(colors.red + colors.bold + 'SECURITY VALIDATION ERROR:' + colors.reset, error);
        console.error(colors.red + 'Unable to complete security validation' + colors.reset);
        process.exit(3);
    }
}

// Run validation if this file is executed directly
if (require.main === module) {
    runSecurityValidation();
}

module.exports = {
    runSecurityValidation,
    validateEnvironmentVariables,
    validateEncryptionConfiguration,
    validateHIPAACompliance,
    generateSecurityReport
};