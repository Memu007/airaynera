#!/usr/bin/env node

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../src/utils/logger');

class SecretRotationService {
    constructor() {
        this.secretsConfig = {
            JWT_SECRET: {
                length: 64,
                type: 'base64',
                rotationPeriod: '30d',
                critical: true
            },
            SESSION_SECRET: {
                length: 64,
                type: 'base64',
                rotationPeriod: '30d',
                critical: true
            },
            ENCRYPTION_SECRET: {
                length: 64,
                type: 'base64',
                rotationPeriod: '90d',
                critical: true
            },
            BACKUP_ENCRYPTION_SECRET: {
                length: 64,
                type: 'base64',
                rotationPeriod: '90d',
                critical: false
            },
            API_KEY: {
                length: 32,
                type: 'hex',
                rotationPeriod: '60d',
                critical: false
            }
        };

        this.backupPath = process.env.SECRETS_BACKUP_PATH || './secrets-backup';
        this.envFile = process.env.ENV_FILE || '.env';
    }

    /**
     * Generar nuevo secret
     * @param {Object} config - Configuración del secret
     * @returns {string} - Nuevo secret generado
     */
    generateSecret(config) {
        const randomBytes = crypto.randomBytes(config.length);
        
        switch (config.type) {
            case 'base64':
                return randomBytes.toString('base64');
            case 'hex':
                return randomBytes.toString('hex');
            case 'base64url':
                return randomBytes.toString('base64url');
            default:
                return randomBytes.toString('base64');
        }
    }

    /**
     * Leer archivo .env actual
     * @returns {Object} - Variables de entorno actuales
     */
    async readCurrentEnv() {
        try {
            const envContent = await fs.readFile(this.envFile, 'utf8');
            const envVars = {};
            
            envContent.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        envVars[key.trim()] = valueParts.join('=').trim();
                    }
                }
            });

            return envVars;
        } catch (error) {
            logger.error('Failed to read .env file', { error: error.message });
            return {};
        }
    }

    /**
     * Escribir archivo .env actualizado
     * @param {Object} envVars - Variables de entorno a escribir
     */
    async writeEnvFile(envVars) {
        try {
            const envLines = [];
            envLines.push('# AIRA Health Environment Variables');
            envLines.push(`# Last updated: ${new Date().toISOString()}`);
            envLines.push('');

            // Agrupar variables por categoría
            const categories = {
                'Application': ['NODE_ENV', 'PORT', 'LOG_LEVEL'],
                'Security': ['JWT_SECRET', 'SESSION_SECRET', 'ENCRYPTION_SECRET'],
                'Database': ['GOOGLE_CLOUD_PROJECT_ID', 'FIRESTORE_EMULATOR_HOST'],
                'External APIs': ['GEMINI_API_KEY', 'SLACK_WEBHOOK_URL'],
                'Backup': ['BACKUP_BUCKET', 'BACKUP_ENCRYPTION_SECRET'],
                'SSL': ['DOMAIN', 'SSL_EMAIL'],
                'Monitoring': ['ADMIN_EMAIL', 'SMS_ENDPOINT'],
                'Features': ['MOCK_MODE', 'ENABLE_ENCRYPTION', 'ENABLE_BACKUP']
            };

            for (const [category, keys] of Object.entries(categories)) {
                envLines.push(`# ${category}`);
                
                keys.forEach(key => {
                    if (envVars[key] !== undefined) {
                        envLines.push(`${key}=${envVars[key]}`);
                    }
                });
                
                envLines.push('');
            }

            // Agregar cualquier variable no categorizada
            for (const [key, value] of Object.entries(envVars)) {
                const isKnown = Object.values(categories).flat().includes(key);
                if (!isKnown) {
                    envLines.push(`${key}=${value}`);
                }
            }

            await fs.writeFile(this.envFile, envLines.join('\n'));
            
            logger.audit('Environment file updated', { 
                envFile: this.envFile,
                variablesCount: Object.keys(envVars).length
            });

        } catch (error) {
            logger.error('Failed to write .env file', { error: error.message });
            throw error;
        }
    }

    /**
     * Crear backup de secrets actuales
     * @param {Object} currentSecrets - Secrets actuales
     */
    async backupCurrentSecrets(currentSecrets) {
        try {
            // Crear directorio de backup si no existe
            await fs.mkdir(this.backupPath, { recursive: true });

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = path.join(this.backupPath, `secrets-backup-${timestamp}.json`);

            const backupData = {
                timestamp: new Date().toISOString(),
                secrets: {},
                metadata: {
                    rotationType: 'manual',
                    backupVersion: '1.0'
                }
            };

            // Solo hacer backup de secrets críticos
            Object.keys(this.secretsConfig).forEach(key => {
                if (currentSecrets[key] && this.secretsConfig[key].critical) {
                    // Encriptar el backup para seguridad adicional
                    backupData.secrets[key] = this.encryptBackupValue(currentSecrets[key]);
                }
            });

            await fs.writeFile(backupFile, JSON.stringify(backupData, null, 2));

            logger.audit('Secrets backup created', {
                backupFile,
                secretsCount: Object.keys(backupData.secrets).length
            });

            return backupFile;

        } catch (error) {
            logger.error('Failed to create secrets backup', { error: error.message });
            throw error;
        }
    }

    /**
     * Encriptar valor para backup
     * @param {string} value - Valor a encriptar
     * @returns {string} - Valor encriptado
     */
    encryptBackupValue(value) {
        const algorithm = 'aes-256-gcm';
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipheriv(algorithm, key, iv);
        
        let encrypted = cipher.update(value, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();
        
        // Combinar key, iv, tag y datos encriptados
        return Buffer.concat([key, iv, tag, Buffer.from(encrypted, 'hex')]).toString('base64');
    }

    /**
     * Desencriptar valor de backup
     * @param {string} encryptedValue - Valor encriptado
     * @returns {string} - Valor desencriptado
     */
    decryptBackupValue(encryptedValue) {
        const algorithm = 'aes-256-gcm';
        const buffer = Buffer.from(encryptedValue, 'base64');
        
        const key = buffer.slice(0, 32);
        const iv = buffer.slice(32, 48);
        const tag = buffer.slice(48, 64);
        const encrypted = buffer.slice(64);
        
        const decipher = crypto.createDecipheriv(algorithm, key, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Rotar un secret específico
     * @param {string} secretName - Nombre del secret a rotar
     * @param {Object} currentEnv - Variables de entorno actuales
     * @returns {string} - Nuevo valor del secret
     */
    rotateSecret(secretName, currentEnv) {
        const config = this.secretsConfig[secretName];
        if (!config) {
            throw new Error(`Unknown secret: ${secretName}`);
        }

        const oldValue = currentEnv[secretName];
        const newValue = this.generateSecret(config);

        logger.audit('Secret rotated', {
            secretName,
            hasOldValue: !!oldValue,
            newValueLength: newValue.length,
            secretType: config.type
        });

        return newValue;
    }

    /**
     * Rotar todos los secrets
     * @param {Array} secretNames - Nombres de secrets a rotar (opcional)
     * @returns {Object} - Resultado de la rotación
     */
    async rotateSecrets(secretNames = null) {
        try {
            logger.audit('Starting secrets rotation', { 
                targetSecrets: secretNames || 'all',
                timestamp: new Date().toISOString()
            });

            // Leer configuración actual
            const currentEnv = await this.readCurrentEnv();

            // Crear backup
            const backupFile = await this.backupCurrentSecrets(currentEnv);

            // Determinar qué secrets rotar
            const secretsToRotate = secretNames || Object.keys(this.secretsConfig);

            const rotationResults = {
                success: [],
                failed: [],
                backupFile
            };

            // Rotar cada secret
            for (const secretName of secretsToRotate) {
                try {
                    const newValue = this.rotateSecret(secretName, currentEnv);
                    currentEnv[secretName] = newValue;
                    
                    rotationResults.success.push({
                        name: secretName,
                        rotatedAt: new Date().toISOString()
                    });

                } catch (error) {
                    logger.error('Failed to rotate secret', {
                        secretName,
                        error: error.message
                    });
                    
                    rotationResults.failed.push({
                        name: secretName,
                        error: error.message
                    });
                }
            }

            // Escribir nuevo archivo .env solo si hay éxitos
            if (rotationResults.success.length > 0) {
                await this.writeEnvFile(currentEnv);
            }

            logger.audit('Secrets rotation completed', {
                successCount: rotationResults.success.length,
                failedCount: rotationResults.failed.length,
                backupFile
            });

            return rotationResults;

        } catch (error) {
            logger.error('Secrets rotation failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Verificar si los secrets necesitan rotación
     * @returns {Object} - Estado de rotación de secrets
     */
    async checkRotationNeeded() {
        try {
            const currentEnv = await this.readCurrentEnv();
            const results = {
                needsRotation: [],
                upToDate: [],
                missing: []
            };

            for (const [secretName, config] of Object.entries(this.secretsConfig)) {
                if (!currentEnv[secretName]) {
                    results.missing.push({
                        name: secretName,
                        critical: config.critical
                    });
                    continue;
                }

                // En una implementación real, verificaríamos la edad del secret
                // Por ahora, asumimos que todos los secrets críticos necesitan rotación
                if (config.critical) {
                    results.needsRotation.push({
                        name: secretName,
                        rotationPeriod: config.rotationPeriod,
                        critical: config.critical
                    });
                } else {
                    results.upToDate.push({
                        name: secretName,
                        rotationPeriod: config.rotationPeriod
                    });
                }
            }

            logger.audit('Rotation check completed', {
                needsRotation: results.needsRotation.length,
                upToDate: results.upToDate.length,
                missing: results.missing.length
            });

            return results;

        } catch (error) {
            logger.error('Failed to check rotation status', { error: error.message });
            throw error;
        }
    }

    /**
     * Restaurar secrets desde backup
     * @param {string} backupFile - Archivo de backup
     * @param {Array} secretNames - Secrets específicos a restaurar (opcional)
     */
    async restoreFromBackup(backupFile, secretNames = null) {
        try {
            logger.audit('Starting secrets restoration', {
                backupFile,
                targetSecrets: secretNames || 'all'
            });

            // Leer backup
            const backupContent = await fs.readFile(backupFile, 'utf8');
            const backupData = JSON.parse(backupContent);

            // Leer configuración actual
            const currentEnv = await this.readCurrentEnv();

            const restoredSecrets = [];

            // Restaurar secrets especificados o todos
            const secretsToRestore = secretNames || Object.keys(backupData.secrets);

            for (const secretName of secretsToRestore) {
                if (backupData.secrets[secretName]) {
                    const decryptedValue = this.decryptBackupValue(backupData.secrets[secretName]);
                    currentEnv[secretName] = decryptedValue;
                    restoredSecrets.push(secretName);
                }
            }

            // Escribir archivo .env actualizado
            if (restoredSecrets.length > 0) {
                await this.writeEnvFile(currentEnv);
            }

            logger.audit('Secrets restoration completed', {
                backupFile,
                restoredCount: restoredSecrets.length,
                restoredSecrets
            });

            return {
                restored: restoredSecrets,
                backupTimestamp: backupData.timestamp
            };

        } catch (error) {
            logger.error('Failed to restore secrets from backup', {
                backupFile,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Listar backups disponibles
     * @returns {Array} - Lista de backups
     */
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupPath);
            const backups = [];

            for (const file of files) {
                if (file.startsWith('secrets-backup-') && file.endsWith('.json')) {
                    const filePath = path.join(this.backupPath, file);
                    const stats = await fs.stat(filePath);
                    
                    backups.push({
                        filename: file,
                        path: filePath,
                        size: stats.size,
                        createdAt: stats.birthtime.toISOString()
                    });
                }
            }

            return backups.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        } catch (error) {
            logger.error('Failed to list backups', { error: error.message });
            return [];
        }
    }

    /**
     * Limpiar backups antiguos
     * @param {number} retentionDays - Días de retención
     */
    async cleanupOldBackups(retentionDays = 90) {
        try {
            const backups = await this.listBackups();
            const cutoffDate = new Date(Date.now() - (retentionDays * 24 * 60 * 60 * 1000));

            let deletedCount = 0;

            for (const backup of backups) {
                if (new Date(backup.createdAt) < cutoffDate) {
                    await fs.unlink(backup.path);
                    deletedCount++;
                }
            }

            logger.audit('Old backups cleaned up', {
                retentionDays,
                deletedCount,
                totalBackups: backups.length
            });

            return deletedCount;

        } catch (error) {
            logger.error('Failed to cleanup old backups', { error: error.message });
            throw error;
        }
    }

    /**
     * Validar secrets actuales
     * @returns {Object} - Resultado de validación
     */
    async validateSecrets() {
        try {
            const currentEnv = await this.readCurrentEnv();
            const validation = {
                valid: [],
                invalid: [],
                missing: []
            };

            for (const [secretName, config] of Object.entries(this.secretsConfig)) {
                const value = currentEnv[secretName];

                if (!value) {
                    validation.missing.push({
                        name: secretName,
                        critical: config.critical
                    });
                    continue;
                }

                // Validar longitud y formato
                const isValid = this.validateSecretFormat(value, config);
                
                if (isValid) {
                    validation.valid.push({
                        name: secretName,
                        length: value.length
                    });
                } else {
                    validation.invalid.push({
                        name: secretName,
                        reason: 'Invalid format or length'
                    });
                }
            }

            logger.audit('Secrets validation completed', {
                valid: validation.valid.length,
                invalid: validation.invalid.length,
                missing: validation.missing.length
            });

            return validation;

        } catch (error) {
            logger.error('Failed to validate secrets', { error: error.message });
            throw error;
        }
    }

    /**
     * Validar formato de secret
     * @param {string} value - Valor del secret
     * @param {Object} config - Configuración esperada
     * @returns {boolean} - True si es válido
     */
    validateSecretFormat(value, config) {
        if (!value || typeof value !== 'string') {
            return false;
        }

        // Verificar longitud mínima
        const minLength = Math.floor(config.length * 0.8); // 80% de la longitud esperada
        if (value.length < minLength) {
            return false;
        }

        // Verificar formato según tipo
        switch (config.type) {
            case 'base64':
                return /^[A-Za-z0-9+/]+=*$/.test(value);
            case 'hex':
                return /^[a-fA-F0-9]+$/.test(value);
            case 'base64url':
                return /^[A-Za-z0-9_-]+$/.test(value);
            default:
                return true;
        }
    }

    /**
     * Generar reporte de estado de secrets
     * @returns {Object} - Reporte completo
     */
    async generateSecurityReport() {
        try {
            const validation = await this.validateSecrets();
            const rotationCheck = await this.checkRotationNeeded();
            const backups = await this.listBackups();

            const report = {
                timestamp: new Date().toISOString(),
                validation,
                rotation: rotationCheck,
                backups: {
                    total: backups.length,
                    latest: backups[0]?.createdAt || null
                },
                recommendations: []
            };

            // Generar recomendaciones
            if (validation.missing.length > 0) {
                report.recommendations.push({
                    priority: 'high',
                    action: 'Add missing secrets',
                    details: validation.missing
                });
            }

            if (validation.invalid.length > 0) {
                report.recommendations.push({
                    priority: 'medium',
                    action: 'Fix invalid secrets',
                    details: validation.invalid
                });
            }

            if (rotationCheck.needsRotation.length > 0) {
                report.recommendations.push({
                    priority: 'medium',
                    action: 'Rotate expired secrets',
                    details: rotationCheck.needsRotation
                });
            }

            logger.audit('Security report generated', {
                totalSecrets: Object.keys(this.secretsConfig).length,
                recommendationsCount: report.recommendations.length
            });

            return report;

        } catch (error) {
            logger.error('Failed to generate security report', { error: error.message });
            throw error;
        }
    }
}

// Si se ejecuta directamente
if (require.main === module) {
    const service = new SecretRotationService();
    
    const command = process.argv[2];
    const args = process.argv.slice(3);
    
    async function executeCommand() {
        try {
            switch (command) {
                case 'rotate':
                    const secrets = args.length > 0 ? args : null;
                    const result = await service.rotateSecrets(secrets);
                    console.log('Rotation Result:', JSON.stringify(result, null, 2));
                    break;
                    
                case 'check':
                    const status = await service.checkRotationNeeded();
                    console.log('Rotation Status:', JSON.stringify(status, null, 2));
                    break;
                    
                case 'validate':
                    const validation = await service.validateSecrets();
                    console.log('Validation Result:', JSON.stringify(validation, null, 2));
                    break;
                    
                case 'backup':
                    const currentEnv = await service.readCurrentEnv();
                    const backupFile = await service.backupCurrentSecrets(currentEnv);
                    console.log('Backup created:', backupFile);
                    break;
                    
                case 'restore':
                    if (args.length === 0) {
                        console.error('Please provide backup file path');
                        process.exit(1);
                    }
                    const restored = await service.restoreFromBackup(args[0]);
                    console.log('Restore Result:', JSON.stringify(restored, null, 2));
                    break;
                    
                case 'list-backups':
                    const backups = await service.listBackups();
                    console.log('Available Backups:', JSON.stringify(backups, null, 2));
                    break;
                    
                case 'cleanup':
                    const days = args[0] ? parseInt(args[0]) : 90;
                    const deleted = await service.cleanupOldBackups(days);
                    console.log(`Cleaned up ${deleted} old backups`);
                    break;
                    
                case 'report':
                    const report = await service.generateSecurityReport();
                    console.log('Security Report:', JSON.stringify(report, null, 2));
                    break;
                    
                default:
                    console.log(`
Usage: node rotate-secrets.js <command> [options]

Commands:
  rotate [secret1 secret2...]  - Rotate specific secrets or all secrets
  check                        - Check which secrets need rotation
  validate                     - Validate current secrets format
  backup                       - Create backup of current secrets
  restore <backup-file>        - Restore secrets from backup
  list-backups                 - List available backup files
  cleanup [days]               - Clean up old backups (default: 90 days)
  report                       - Generate complete security report

Examples:
  node rotate-secrets.js rotate JWT_SECRET SESSION_SECRET
  node rotate-secrets.js check
  node rotate-secrets.js backup
  node rotate-secrets.js restore ./secrets-backup/secrets-backup-2024-01-01.json
                    `);
                    process.exit(1);
            }
        } catch (error) {
            console.error('Command failed:', error.message);
            process.exit(1);
        }
    }
    
    executeCommand();
}

module.exports = SecretRotationService; 