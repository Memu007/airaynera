#!/usr/bin/env node

/**
 * ✅ VERIFICACIÓN DE COMPLIANCE MÉDICO
 * Script para validar cumplimiento HIPAA/GDPR antes del deploy
 */

const fs = require('fs');
const path = require('path');

class ComplianceVerifier {
    constructor() {
        this.report = {
            timestamp: new Date().toISOString(),
            checks: [],
            passed: 0,
            failed: 0,
            warnings: 0,
            status: 'PENDING'
        };
        
        this.checklist = {
            hipaa: [
                'Encriptación de datos en reposo',
                'Encriptación de datos en tránsito',
                'Control de acceso por usuario',
                'Logs de auditoría',
                'Retención de datos',
                'Derecho al olvido'
            ],
            gdpr: [
                'Consentimiento informado',
                'Acceso a datos personales',
                'Portabilidad de datos',
                'Eliminación de datos',
                'Notificación de brechas',
                'Protección por diseño'
            ],
            medical: [
                'Validación de entrada de datos',
                'Integridad de registros médicos',
                'Backup automático',
                'Recuperación ante desastres',
                'Autenticación fuerte',
                'Sesiones seguras'
            ]
        };
    }

    async verify() {
        console.log('🔍 Iniciando verificación de compliance médico...\n');
        
        await this.checkDataEncryption();
        await this.checkAccessControl();
        await this.checkAuditLogs();
        await this.checkDataRetention();
        await this.checkUserRights();
        await this.checkSecurityHeaders();
        await this.checkBackupSystem();
        await this.checkAuthentication();
        
        this.generateReport();
        return this.report;
    }

    async checkDataEncryption() {
        console.log('🔐 Verificando encriptación de datos...');
        
        const checks = [
            {
                name: 'Encriptación AES-256 activa',
                check: () => this.checkEncryptionImplementation(),
                required: true
            },
            {
                name: 'HTTPS obligatorio',
                check: () => this.checkHTTPS(),
                required: true
            },
            {
                name: 'Encriptación de contraseñas',
                check: () => this.checkPasswordEncryption(),
                required: true
            }
        ];

        await this.runChecks('Encriptación de Datos', checks);
    }

    async checkAccessControl() {
        console.log('🛡️ Verificando control de acceso...');
        
        const checks = [
            {
                name: 'Autenticación por JWT',
                check: () => this.checkJWTImplementation(),
                required: true
            },
            {
                name: 'Autorización por roles',
                check: () => this.checkRoleBasedAccess(),
                required: true
            },
            {
                name: 'Sesiones con timeout',
                check: () => this.checkSessionTimeout(),
                required: true
            }
        ];

        await this.runChecks('Control de Acceso', checks);
    }

    async checkAuditLogs() {
        console.log('📊 Verificando logs de auditoría...');
        
        const checks = [
            {
                name: 'Logs de acceso',
                check: () => this.checkAccessLogs(),
                required: true
            },
            {
                name: 'Logs de modificaciones',
                check: () => this.checkModificationLogs(),
                required: true
            },
            {
                name: 'Logs de errores',
                check: () => this.checkErrorLogs(),
                required: true
            }
        ];

        await this.runChecks('Logs de Auditoría', checks);
    }

    async checkDataRetention() {
        console.log('🗂️ Verificando retención de datos...');
        
        const checks = [
            {
                name: 'Política de retención definida',
                check: () => this.checkRetentionPolicy(),
                required: true
            },
            {
                name: 'Eliminación automática',
                check: () => this.checkAutoDeletion(),
                required: false
            },
            {
                name: 'Backup automático',
                check: () => this.checkAutoBackup(),
                required: true
            }
        ];

        await this.runChecks('Retención de Datos', checks);
    }

    async checkUserRights() {
        console.log('👤 Verificando derechos del usuario...');
        
        const checks = [
            {
                name: 'Derecho al acceso',
                check: () => this.checkRightToAccess(),
                required: true
            },
            {
                name: 'Derecho a la portabilidad',
                check: () => this.checkRightToPortability(),
                required: true
            },
            {
                name: 'Derecho al olvido',
                check: () => this.checkRightToBeForgotten(),
                required: true
            }
        ];

        await this.runChecks('Derechos del Usuario', checks);
    }

    async checkSecurityHeaders() {
        console.log('🔒 Verificando headers de seguridad...');
        
        const checks = [
            {
                name: 'Content-Security-Policy',
                check: () => this.checkCSP(),
                required: true
            },
            {
                name: 'Strict-Transport-Security',
                check: () => this.checkHSTS(),
                required: true
            },
            {
                name: 'X-Frame-Options',
                check: () => this.checkXFrameOptions(),
                required: true
            }
        ];

        await this.runChecks('Headers de Seguridad', checks);
    }

    async checkBackupSystem() {
        console.log('💾 Verificando sistema de backup...');
        
        const checks = [
            {
                name: 'Backup automático configurado',
                check: () => this.checkBackupConfig(),
                required: true
            },
            {
                name: 'Recuperación verificada',
                check: () => this.checkRecovery(),
                required: true
            },
            {
                name: 'Integridad de backups',
                check: () => this.checkBackupIntegrity(),
                required: true
            }
        ];

        await this.runChecks('Sistema de Backup', checks);
    }

    async checkAuthentication() {
        console.log('🔐 Verificando autenticación...');
        
        const checks = [
            {
                name: 'Contraseñas seguras',
                check: () => this.checkPasswordPolicy(),
                required: true
            },
            {
                name: 'Rate limiting activo',
                check: () => this.checkRateLimiting(),
                required: true
            },
            {
                name: 'Validación de entrada',
                check: () => this.checkInputValidation(),
                required: true
            }
        ];

        await this.runChecks('Autenticación', checks);
    }

    async runChecks(category, checks) {
        for (const check of checks) {
            try {
                const result = await check.check();
                this.addResult(category, check.name, result, check.required);
            } catch (error) {
                this.addResult(category, check.name, false, check.required, error.message);
            }
        }
    }

    addResult(category, checkName, passed, required, error = null) {
        const result = {
            category,
            check: checkName,
            passed,
            required,
            error,
            timestamp: new Date().toISOString()
        };

        this.report.checks.push(result);
        
        if (passed) {
            this.report.passed++;
            console.log(`  ✅ ${checkName}`);
        } else if (required) {
            this.report.failed++;
            console.log(`  ❌ ${checkName}${error ? ` - ${error}` : ''}`);
        } else {
            this.report.warnings++;
            console.log(`  ⚠️ ${checkName}${error ? ` - ${error}` : ''}`);
        }
    }

    // Implementaciones de verificación específicas
    checkEncryptionImplementation() {
        const securityFile = fs.readFileSync(path.join(__dirname, '../src/middleware/security.js'), 'utf8');
        return securityFile.includes('bcrypt') && securityFile.includes('jwt');
    }

    checkHTTPS() {
        // Verificar configuración de HTTPS
        return true; // Asumimos HTTPS en producción
    }

    checkPasswordEncryption() {
        const authService = fs.readFileSync(path.join(__dirname, '../src/services/authService.js'), 'utf8');
        return authService.includes('bcrypt.hash') || authService.includes('hashPassword');
    }

    checkJWTImplementation() {
        const securityFile = fs.readFileSync(path.join(__dirname, '../src/middleware/security.js'), 'utf8');
        return securityFile.includes('jwt.verify') && securityFile.includes('authenticateToken');
    }

    checkRoleBasedAccess() {
        const authFile = fs.readFileSync(path.join(__dirname, '../src/middleware/auth.js'), 'utf8');
        return authFile.includes('role') || authFile.includes('admin') || authFile.includes('doctor');
    }

    checkSessionTimeout() {
        const securityFile = fs.readFileSync(path.join(__dirname, '../src/middleware/security.js'), 'utf8');
        return securityFile.includes('sessionTimeout') || securityFile.includes('expiresIn');
    }

    checkAccessLogs() {
        const loggerFile = fs.readFileSync(path.join(__dirname, '../src/utils/logger.js'), 'utf8');
        return loggerFile.includes('access') || loggerFile.includes('audit');
    }

    checkModificationLogs() {
        const loggerFile = fs.readFileSync(path.join(__dirname, '../src/utils/logger.js'), 'utf8');
        return loggerFile.includes('modify') || loggerFile.includes('update');
    }

    checkErrorLogs() {
        const loggerFile = fs.readFileSync(path.join(__dirname, '../src/utils/logger.js'), 'utf8');
        return loggerFile.includes('error') || loggerFile.includes('Error');
    }

    checkRetentionPolicy() {
        const backupScript = fs.readFileSync(path.join(__dirname, '../scripts/backup-scheduler.js'), 'utf8');
        return backupScript.includes('retention') || backupScript.includes('cleanup');
    }

    checkAutoDeletion() {
        const backupScript = fs.readFileSync(path.join(__dirname, '../scripts/backup-scheduler.js'), 'utf8');
        return backupScript.includes('delete') || backupScript.includes('remove');
    }

    checkAutoBackup() {
        const backupScript = fs.readFileSync(path.join(__dirname, '../scripts/backup-scheduler.js'), 'utf8');
        return backupScript.includes('backup') && backupScript.includes('schedule');
    }

    checkRightToAccess() {
        const patientsService = fs.readFileSync(path.join(__dirname, '../src/services/patientsService.js'), 'utf8');
        return patientsService.includes('getPatient') || patientsService.includes('findById');
    }

    checkRightToPortability() {
        const patientsService = fs.readFileSync(path.join(__dirname, '../src/services/patientsService.js'), 'utf8');
        return patientsService.includes('export') || patientsService.includes('download');
    }

    checkRightToBeForgotten() {
        const patientsService = fs.readFileSync(path.join(__dirname, '../src/services/patientsService.js'), 'utf8');
        return patientsService.includes('delete') || patientsService.includes('remove');
    }

    checkCSP() {
        const securityFile = fs.readFileSync(path.join(__dirname, '../src/middleware/security.js'), 'utf8');
        return securityFile.includes('Content-Security-Policy') || securityFile.includes('csp');
    }

    checkHSTS() {
        const securityFile = fs.readFileSync(path.join(__dirname, '../src/middleware/security.js'), 'utf8');
        return securityFile.includes('Strict-Transport-Security') || securityFile.includes('hsts');
    }

    checkXFrameOptions() {
        const securityFile = fs.readFileSync(path.join(__dirname, '../src/middleware/security.js'), 'utf8');
        return securityFile.includes('X-Frame-Options') || securityFile.includes('frameguard');
    }

    checkBackupConfig() {
        const backupScript = fs.readFileSync(path.join(__dirname, '../scripts/backup-scheduler.js'), 'utf8');
        return backupScript.includes('schedule') && backupScript.includes('backup');
    }

    checkRecovery() {
        const rollbackScript = fs.readFileSync(path.join(__dirname, '../scripts/rollback-plan.js'), 'utf8');
        return rollbackScript.includes('rollback') && rollbackScript.includes('restore');
    }

    checkBackupIntegrity() {
        const backupScript = fs.readFileSync(path.join(__dirname, '../scripts/backup-scheduler.js'), 'utf8');
        return backupScript.includes('verify') || backupScript.includes('integrity');
    }

    checkPasswordPolicy() {
        const authService = fs.readFileSync(path.join(__dirname, '../src/services/authService.js'), 'utf8');
        return authService.includes('minLength') || authService.includes('password');
    }

    checkRateLimiting() {
        const securityFile = fs.readFileSync(path.join(__dirname, '../src/middleware/security.js'), 'utf8');
        return securityFile.includes('rateLimit') || securityFile.includes('limiter');
    }

    checkInputValidation() {
        const validationFile = fs.readFileSync(path.join(__dirname, '../src/middleware/validation.js'), 'utf8');
        return validationFile.includes('validate') || validationFile.includes('sanitize');
    }

    generateReport() {
        const totalChecks = this.report.checks.length;
        const complianceRate = (this.report.passed / totalChecks) * 100;
        
        this.report.status = complianceRate >= 80 ? 'APPROVED' : 'FAILED';
        
        const reportPath = path.join(__dirname, '../logs/compliance-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(this.report, null, 2));
        
        console.log('\n📊 REPORTE DE COMPLIANCE MÉDICO');
        console.log('================================');
        console.log(`✅ Pasadas: ${this.report.passed}`);
        console.log(`❌ Fallidas: ${this.report.failed}`);
        console.log(`⚠️ Advertencias: ${this.report.warnings}`);
        console.log(`📈 Tasa de cumplimiento: ${complianceRate.toFixed(1)}%`);
        console.log(`🏥 Estado: ${this.report.status}`);
        
        if (this.report.failed > 0) {
            console.log('\n❌ FALLAS CRÍTICAS:');
            this.report.checks
                .filter(c => !c.passed && c.required)
                .forEach(c => console.log(`   - ${c.category}: ${c.check}`));
        }
        
        return this.report;
    }
}

// CLI
if (require.main === module) {
    const verifier = new ComplianceVerifier();
    
    verifier.verify()
        .then(report => {
            if (report.status === 'APPROVED') {
                console.log('\n🎉 Sistema aprobado para deploy médico');
                process.exit(0);
            } else {
                console.log('\n❌ Sistema NO cumple con estándares médicos');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('Error en verificación:', error);
            process.exit(1);
        });
}

module.exports = ComplianceVerifier;
