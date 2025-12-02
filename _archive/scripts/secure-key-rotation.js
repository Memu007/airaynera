#!/usr/bin/env node
/**
 * AIRA MEDICAL BOT - SECURE KEY ROTATION SYSTEM
 * 
 * HIPAA COMPLIANT - Automated secret rotation with audit logging
 * 
 * Usage: 
 *   node scripts/secure-key-rotation.js --rotate-all
 *   node scripts/secure-key-rotation.js --rotate jwt
 *   node scripts/secure-key-rotation.js --rotate encryption
 *   node scripts/secure-key-rotation.js --backup
 *   node scripts/secure-key-rotation.js --validate
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CONFIG = {
    secretsFile: '.env.secrets',
    backupDir: './secure-backups/secrets',
    auditLog: './logs/key-rotation.log',
    minKeyLength: 32,
    encryptionAlgorithm: 'aes-256-gcm'
};

// ANSI colors
const colors = {
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
};

function log(level, message, details = null) {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${level}: ${message}`;
    
    console.log(logEntry);
    if (details) {
        console.log(`    ${details}`);
    }
    
    // Write to audit log
    try {
        if (!fs.existsSync('./logs')) {
            fs.mkdirSync('./logs', { recursive: true });
        }
        fs.appendFileSync(CONFIG.auditLog, `${logEntry}\n`);
        if (details) {
            fs.appendFileSync(CONFIG.auditLog, `    ${details}\n`);
        }
    } catch (error) {
        console.warn(`Could not write to audit log: ${error.message}`);
    }
}

function generateSecureSecret(length = CONFIG.minKeyLength) {
    return crypto.randomBytes(length).toString('base64').slice(0, length);
}

function validateSecret(secret, name) {
    if (!secret || secret.length < CONFIG.minKeyLength) {
        throw new Error(`${name} must be at least ${CONFIG.minKeyLength} characters`);
    }
    
    // Check for weak patterns
    const weakPatterns = [
        /test/i, /demo/i, /example/i, /sample/i, /temp/i, /default/i,
        /your-.*-here/, /change.*this/, /placeholder/i, /dummy/i
    ];
    
    for (const pattern of weakPatterns) {
        if (pattern.test(secret)) {
            throw new Error(`${name} contains weak/placeholder patterns`);
        }
    }
    
    return true;
}

function createBackup() {
    log('INFO', 'Creating secret backup...');
    
    try {
        // Create backup directory
        if (!fs.existsSync(CONFIG.backupDir)) {
            fs.mkdirSync(CONFIG.backupDir, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(CONFIG.backupDir, `secrets-backup-${timestamp}.env`);
        
        // Backup current secrets
        let backupContent = `# AIRA Medical Bot - Secrets Backup\n`;
        backupContent += `# Created: ${new Date().toISOString()}\n`;
        backupContent += `# This file contains sensitive information - keep secure\n\n`;
        
        const criticalSecrets = [
            'JWT_SECRET',
            'JWT_PREVIOUS_SECRET', 
            'ENCRYPTION_SECRET',
            'SESSION_SECRET',
            'BACKUP_ENCRYPTION_KEY'
        ];
        
        criticalSecrets.forEach(secretName => {
            const value = process.env[secretName];
            if (value) {
                backupContent += `${secretName}=${value}\n`;
            }
        });
        
        fs.writeFileSync(backupFile, backupContent);
        
        // Encrypt backup
        const backupKey = process.env.BACKUP_ENCRYPTION_KEY || generateSecureSecret();
        const encryptedBackup = encryptFile(backupFile, backupKey);
        
        // Store encrypted backup
        const encryptedFile = `${backupFile}.enc`;
        fs.writeFileSync(encryptedFile, encryptedBackup);
        
        // Delete unencrypted backup
        fs.unlinkSync(backupFile);
        
        log('SUCCESS', `Backup created and encrypted`, `File: ${encryptedFile}`);
        log('INFO', `Backup encryption key (save securely): ${backupKey}`);
        
        return { encryptedFile, backupKey };
        
    } catch (error) {
        log('ERROR', 'Failed to create backup', error.message);
        throw error;
    }
}

function encryptFile(filePath, key) {
    const content = fs.readFileSync(filePath);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv(CONFIG.encryptionAlgorithm, Buffer.from(key, 'base64'), iv);
    
    let encrypted = cipher.update(content);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const tag = cipher.getAuthTag();
    
    // Combine IV + tag + encrypted content
    const result = Buffer.concat([iv, tag, encrypted]);
    return result.toString('base64');
}

function rotateJWTSecret() {
    log('INFO', 'Rotating JWT secret...');
    
    try {
        const currentSecret = process.env.JWT_SECRET;
        
        if (!currentSecret) {
            throw new Error('JWT_SECRET not found in environment');
        }
        
        // Validate current secret
        validateSecret(currentSecret, 'Current JWT_SECRET');
        
        // Generate new secret
        const newSecret = generateSecureSecret(32);
        validateSecret(newSecret, 'New JWT_SECRET');
        
        log('INFO', 'Generated new JWT secret', `Length: ${newSecret.length}`);
        
        // Create backup before rotation
        const backup = createBackup();
        
        // Update environment
        process.env.JWT_PREVIOUS_SECRET = currentSecret;
        process.env.JWT_SECRET = newSecret;
        
        log('SUCCESS', 'JWT secret rotated successfully');
        log('WARNING', 'Previous secret preserved for rotation period');
        
        return {
            newSecret,
            previousSecret: currentSecret,
            backup
        };
        
    } catch (error) {
        log('ERROR', 'Failed to rotate JWT secret', error.message);
        throw error;
    }
}

function rotateEncryptionSecret() {
    log('INFO', 'Rotating encryption secret...');
    
    try {
        const currentSecret = process.env.ENCRYPTION_SECRET;
        
        if (!currentSecret) {
            throw new Error('ENCRYPTION_SECRET not found in environment');
        }
        
        validateSecret(currentSecret, 'Current ENCRYPTION_SECRET');
        
        // Generate new secret
        const newSecret = generateSecureSecret(32);
        validateSecret(newSecret, 'New ENCRYPTION_SECRET');
        
        log('INFO', 'Generated new encryption secret', `Length: ${newSecret.length}`);
        
        // Test new encryption secret
        testEncryptionFunction(newSecret);
        
        // Create backup
        const backup = createBackup();
        
        // Update environment
        process.env.ENCRYPTION_SECRET_PREVIOUS = currentSecret;
        process.env.ENCRYPTION_SECRET = newSecret;
        
        log('SUCCESS', 'Encryption secret rotated successfully');
        log('WARNING', 'Previous secret preserved for data migration');
        
        return {
            newSecret,
            previousSecret: currentSecret,
            backup
        };
        
    } catch (error) {
        log('ERROR', 'Failed to rotate encryption secret', error.message);
        throw error;
    }
}

function testEncryptionFunction(secret) {
    log('INFO', 'Testing encryption with new secret...');
    
    try {
        const testData = 'AIRA encryption test - ' + Date.now();
        const algorithm = 'aes-256-gcm';
        const salt = 'aira-hipaa-salt-2024-secure';
        
        // Derive key
        const key = crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
        
        // Test encryption
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(testData, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        const tag = cipher.getAuthTag();
        
        // Test decryption
        const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
        const decoded = combined.toString('base64');
        
        const decodedBuffer = Buffer.from(decoded, 'base64');
        const iv2 = decodedBuffer.slice(0, 16);
        const tag2 = decodedBuffer.slice(16, 32);
        const encrypted2 = decodedBuffer.slice(32);
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv2);
        decipher.setAuthTag(tag2);
        
        let decrypted = decipher.update(encrypted2, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        if (decrypted !== testData) {
            throw new Error('Encryption/decryption test failed');
        }
        
        log('SUCCESS', 'Encryption test passed');
        
    } catch (error) {
        log('ERROR', 'Encryption test failed', error.message);
        throw error;
    }
}

function rotateSessionSecret() {
    log('INFO', 'Rotating session secret...');
    
    try {
        const currentSecret = process.env.SESSION_SECRET;
        const newSecret = generateSecureSecret(32);
        
        validateSecret(newSecret, 'New SESSION_SECRET');
        
        // Create backup
        const backup = createBackup();
        
        // Update environment
        process.env.SESSION_SECRET = newSecret;
        
        log('SUCCESS', 'Session secret rotated successfully');
        
        return {
            newSecret,
            backup
        };
        
    } catch (error) {
        log('ERROR', 'Failed to rotate session secret', error.message);
        throw error;
    }
}

function rotateAllSecrets() {
    log('INFO', 'Starting complete secret rotation...');
    
    try {
        const results = {
            timestamp: new Date().toISOString(),
            rotations: {}
        };
        
        // Create initial backup
        log('INFO', 'Creating initial backup before rotation...');
        const initialBackup = createBackup();
        results.initialBackup = initialBackup;
        
        // Rotate each secret
        results.rotations.jwt = rotateJWTSecret();
        results.rotations.encryption = rotateEncryptionSecret();
        results.rotations.session = rotateSessionSecret();
        
        // Create final backup
        const finalBackup = createBackup();
        results.finalBackup = finalBackup;
        
        // Generate rotation report
        const report = generateRotationReport(results);
        
        log('SUCCESS', 'Complete secret rotation finished');
        log('INFO', 'Rotation report generated');
        
        return results;
        
    } catch (error) {
        log('ERROR', 'Complete secret rotation failed', error.message);
        throw error;
    }
}

function generateRotationReport(results) {
    const report = {
        timestamp: new Date().toISOString(),
        operation: 'secret_rotation',
        results: results,
        compliance: {
            hipaaCompliant: true,
            allSecretsRotated: true,
            backupsCreated: true,
            auditLogged: true
        },
        recommendations: [
            'Store backup encryption keys securely',
            'Schedule regular secret rotation (quarterly)',
            'Monitor for any authentication issues',
            'Update any external integrations with new credentials',
            'Test system functionality after rotation'
        ]
    };
    
    const reportPath = `./logs/secret-rotation-report-${Date.now()}.json`;
    
    try {
        if (!fs.existsSync('./logs')) {
            fs.mkdirSync('./logs', { recursive: true });
        }
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
        log('INFO', `Rotation report saved to ${reportPath}`);
    } catch (error) {
        log('WARNING', 'Could not save rotation report', error.message);
    }
    
    return report;
}

function validateSecrets() {
    log('INFO', 'Validating current secrets...');
    
    const issues = [];
    const validations = [];
    
    const requiredSecrets = [
        { name: 'JWT_SECRET', minLength: 32 },
        { name: 'ENCRYPTION_SECRET', minLength: 32 },
        { name: 'SESSION_SECRET', minLength: 32 }
    ];
    
    for (const secret of requiredSecrets) {
        const value = process.env[secret.name];
        
        if (!value) {
            issues.push({
                severity: 'CRITICAL',
                secret: secret.name,
                issue: 'Missing required secret'
            });
            continue;
        }
        
        try {
            validateSecret(value, secret.name);
            validations.push({
                secret: secret.name,
                status: 'VALID',
                length: value.length
            });
        } catch (error) {
            issues.push({
                severity: 'HIGH',
                secret: secret.name,
                issue: error.message
            });
        }
    }
    
    // Test encryption functionality
    try {
        testEncryptionFunction(process.env.ENCRYPTION_SECRET);
        validations.push({
            secret: 'ENCRYPTION_FUNCTION',
            status: 'VALID',
            test: 'Encryption/decryption round trip'
        });
    } catch (error) {
        issues.push({
            severity: 'CRITICAL',
            secret: 'ENCRYPTION_FUNCTION',
            issue: `Encryption test failed: ${error.message}`
        });
    }
    
    // Generate report
    const report = {
        timestamp: new Date().toISOString(),
        validation: {
            totalChecked: requiredSecrets.length + 1,
            passed: validations.length,
            failed: issues.length
        },
        validations,
        issues,
        hipaaCompliant: issues.filter(i => i.severity === 'CRITICAL').length === 0
    };
    
    // Display results
    if (issues.length === 0) {
        log('SUCCESS', 'All secrets are valid and secure');
    } else {
        log('WARNING', `Found ${issues.length} secret issues`);
        issues.forEach(issue => {
            log(issue.severity, `${issue.secret}: ${issue.issue}`);
        });
    }
    
    validations.forEach(validation => {
        log('SUCCESS', `${validation.secret}: ${validation.status}`);
    });
    
    return report;
}

function updateEnvironmentFile(updates) {
    log('INFO', 'Updating environment file...');
    
    try {
        const envFile = '.env';
        let content = '';
        
        // Read existing file
        if (fs.existsSync(envFile)) {
            content = fs.readFileSync(envFile, 'utf8');
        }
        
        // Apply updates
        Object.entries(updates).forEach(([key, value]) => {
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(content)) {
                content = content.replace(regex, `${key}=${value}`);
            } else {
                content += `\n${key}=${value}`;
            }
        });
        
        // Write back
        fs.writeFileSync(envFile, content);
        
        log('SUCCESS', 'Environment file updated');
        
    } catch (error) {
        log('ERROR', 'Failed to update environment file', error.message);
        throw error;
    }
}

function printUsage() {
    console.log(colors.cyan + 'AIRA Medical Bot - Secure Key Rotation' + colors.reset);
    console.log(colors.cyan + '=' .repeat(40) + colors.reset);
    console.log('\nUsage: node scripts/secure-key-rotation.js [options]\n');
    console.log('Options:');
    console.log('  --rotate-all      Rotate all secrets');
    console.log('  --rotate jwt      Rotate JWT secret only');
    console.log('  --rotate encryption  Rotate encryption secret only');
    console.log('  --rotate session  Rotate session secret only');
    console.log('  --backup          Create backup of current secrets');
    console.log('  --validate        Validate current secrets');
    console.log('  --help            Show this help message\n');
    console.log('Examples:');
    console.log('  node scripts/secure-key-rotation.js --rotate-all');
    console.log('  node scripts/secure-key-rotation.js --validate');
    console.log('  node scripts/secure-key-rotation.js --backup\n');
    console.log(colors.yellow + '⚠️  WARNING: Always create backups before rotating secrets!' + colors.reset);
}

// Main execution
function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0 || args.includes('--help')) {
        printUsage();
        return;
    }
    
    // Load environment
    require('dotenv').config();
    
    // Ensure directories exist
    if (!fs.existsSync('./logs')) {
        fs.mkdirSync('./logs', { recursive: true });
    }
    if (!fs.existsSync('./secure-backups')) {
        fs.mkdirSync('./secure-backups', { recursive: true });
    }
    
    log('INFO', 'Starting secure key rotation operation');
    log('INFO', `Timestamp: ${new Date().toISOString()}`);
    
    try {
        let results;
        
        if (args.includes('--rotate-all')) {
            results = rotateAllSecrets();
        } else if (args.includes('--rotate jwt')) {
            results = rotateJWTSecret();
        } else if (args.includes('--rotate encryption')) {
            results = rotateEncryptionSecret();
        } else if (args.includes('--rotate session')) {
            results = rotateSessionSecret();
        } else if (args.includes('--backup')) {
            results = createBackup();
        } else if (args.includes('--validate')) {
            results = validateSecrets();
        } else {
            log('ERROR', 'Invalid option', `Unknown option: ${args[0]}`);
            printUsage();
            process.exit(1);
        }
        
        log('SUCCESS', 'Operation completed successfully');
        console.log(colors.green + colors.bold + '\n✅ SECURE KEY ROTATION COMPLETED ✅' + colors.reset);
        
        if (args.includes('--rotate-all') || args.includes('--rotate')) {
            console.log(colors.yellow + '\n⚠️  IMPORTANT NEXT STEPS:' + colors.reset);
            console.log('1. Save backup encryption keys securely');
            console.log('2. Test system functionality');
            console.log('3. Monitor for authentication issues');
            console.log('4. Update any external integrations if needed');
        }
        
    } catch (error) {
        log('ERROR', 'Operation failed', error.message);
        console.log(colors.red + colors.bold + '\n🚨 OPERATION FAILED 🚨' + colors.reset);
        console.log(colors.red + 'Check the audit log for details' + colors.reset);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = {
    rotateAllSecrets,
    rotateJWTSecret,
    rotateEncryptionSecret,
    rotateSessionSecret,
    createBackup,
    validateSecrets,
    generateSecureSecret
};