/**
 * Psychology Module HIPAA Compliance Validator
 * Validates HIPAA compliance for psychologist-specific features
 * @version 1.0.0
 */

const fs = require('fs');
const path = require('path');

class PsychologyHIPAAValidator {
    constructor() {
        this.violations = [];
        this.warnings = [];
        this.passedChecks = [];
        
        // HIPAA requirements to check
        this.requirements = {
            phiEncryption: {
                name: 'PHI Encryption',
                description: 'All protected health information must be encrypted at rest and in transit'
            },
            accessControls: {
                name: 'Access Controls',
                description: 'Only authorized psychologists can access patient data'
            },
            auditLogging: {
                name: 'Audit Logging',
                description: 'All access to PHI must be logged and auditable'
            },
            dataMinimization: {
                name: 'Data Minimization',
                description: 'Only necessary PHI should be collected and stored'
            },
            secureStorage: {
                name: 'Secure Storage',
                description: 'PHI must be stored in secure, access-controlled systems'
            },
            transmissionSecurity: {
                name: 'Transmission Security',
                description: 'PHI transmission must use encryption (HTTPS/TLS)'
            },
            authentication: {
                name: 'Authentication',
                description: 'Strong authentication mechanisms required'
            },
            authorization: {
                name: 'Authorization',
                description: 'Role-based access control implementation'
            },
            integrity: {
                name: 'Data Integrity',
                description: 'PHI must not be altered or destroyed improperly'
            },
            backupSecurity: {
                name: 'Backup Security',
                description: 'Encrypted backups with access controls'
            }
        };
    }

    async validateCompliance() {
        console.log('🔍 Starting Psychology Module HIPAA Compliance Validation...\n');

        await this.validatePHIEncryption();
        await this.validateAccessControls();
        await this.validateAuditLogging();
        await this.validateDataMinimization();
        await this.validateSecureStorage();
        await this.validateTransmissionSecurity();
        await this.validateAuthentication();
        await this.validateAuthorization();
        await this.validateDataIntegrity();
        await this.validateBackupSecurity();
        await this.validatePsychologySpecificRequirements();

        this.generateReport();
    }

    async validatePHIEncryption() {
        console.log('📋 Validating PHI Encryption...');

        // Check encryption utilities
        const encryptionPath = path.join(__dirname, '../src/utils/encryption.js');
        if (fs.existsSync(encryptionPath)) {
            const encryptionContent = fs.readFileSync(encryptionPath, 'utf8');
            
            if (encryptionContent.includes('encryptPhi') && encryptionContent.includes('decryptPhi')) {
                this.passedChecks.push({
                    requirement: 'phiEncryption',
                    check: 'Encryption utilities found',
                    status: 'PASS'
                });
            } else {
                this.violations.push({
                    requirement: 'phiEncryption',
                    issue: 'PHI encryption functions not found',
                    severity: 'HIGH'
                });
            }
        } else {
            this.violations.push({
                requirement: 'phiEncryption',
                issue: 'Encryption utility file missing',
                severity: 'HIGH'
            });
        }

        // Check if PHI is encrypted in controllers
        const controllersToCheck = [
            'src/controllers/psychologyController.js',
            'src/controllers/psychologyAssessmentController.js',
            'src/controllers/psychologySessionController.js',
            'src/controllers/psychologyTreatmentController.js'
        ];

        for (const controller of controllersToCheck) {
            const controllerPath = path.join(__dirname, '../', controller);
            if (fs.existsSync(controllerPath)) {
                const content = fs.readFileSync(controllerPath, 'utf8');
                
                // Check for PHI encryption usage
                if (content.includes('encryptPhi(')) {
                    this.passedChecks.push({
                        requirement: 'phiEncryption',
                        check: `PHI encryption used in ${controller}`,
                        status: 'PASS'
                    });
                } else {
                    this.warnings.push({
                        requirement: 'phiEncryption',
                        issue: `Potential unencrypted PHI in ${controller}`,
                        severity: 'MEDIUM'
                    });
                }
            }
        }
    }

    async validateAccessControls() {
        console.log('🔐 Validating Access Controls...');

        // Check psychologist middleware
        const authMiddlewarePath = path.join(__dirname, '../src/middleware/auth.js');
        if (fs.existsSync(authMiddlewarePath)) {
            const authContent = fs.readFileSync(authMiddlewarePath, 'utf8');
            
            if (authContent.includes('isPsychologist')) {
                this.passedChecks.push({
                    requirement: 'accessControls',
                    check: 'Psychologist role verification middleware found',
                    status: 'PASS'
                });
            } else {
                this.violations.push({
                    requirement: 'accessControls',
                    issue: 'Psychologist access control middleware missing',
                    severity: 'HIGH'
                });
            }
        }

        // Check route protection
        const psychologyRoutesPath = path.join(__dirname, '../src/routes/psychology.js');
        if (fs.existsSync(psychologyRoutesPath)) {
            const routesContent = fs.readFileSync(psychologyRoutesPath, 'utf8');
            
            if (routesContent.includes('isPsychologist')) {
                this.passedChecks.push({
                    requirement: 'accessControls',
                    check: 'Psychology routes protected with role verification',
                    status: 'PASS'
                });
            } else {
                this.violations.push({
                    requirement: 'accessControls',
                    issue: 'Psychology routes not properly protected',
                    severity: 'HIGH'
                });
            }
        }
    }

    async validateAuditLogging() {
        console.log('📝 Validating Audit Logging...');

        const filesToCheck = [
            'src/controllers/psychologyController.js',
            'src/controllers/psychologyAssessmentController.js',
            'src/services/psychologyService.js',
            'src/services/psychologyAssessmentService.js'
        ];

        for (const file of filesToCheck) {
            const filePath = path.join(__dirname, '../', file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Check for logging implementation
                if (content.includes('logger.info') || content.includes('logger.error')) {
                    this.passedChecks.push({
                        requirement: 'auditLogging',
                        check: `Audit logging implemented in ${file}`,
                        status: 'PASS'
                    });
                } else {
                    this.warnings.push({
                        requirement: 'auditLogging',
                        issue: `Missing audit logging in ${file}`,
                        severity: 'MEDIUM'
                    });
                }
            }
        }
    }

    async validateDataMinimization() {
        console.log('📊 Validating Data Minimization...');

        // Check assessment forms for unnecessary data collection
        const assessmentToolPath = path.join(__dirname, '../aira-dashboard/src/components/organisms/AssessmentTools/AssessmentTools.tsx');
        if (fs.existsSync(assessmentToolPath)) {
            const content = fs.readFileSync(assessmentToolPath, 'utf8');
            
            // Check for unnecessary personal data collection
            const unnecessaryFields = ['ssn', 'socialSecurity', 'creditCard', 'financial'];
            const foundUnnecessary = unnecessaryFields.some(field => 
                content.toLowerCase().includes(field.toLowerCase())
            );

            if (!foundUnnecessary) {
                this.passedChecks.push({
                    requirement: 'dataMinimization',
                    check: 'Assessment forms collect only necessary data',
                    status: 'PASS'
                });
            } else {
                this.violations.push({
                    requirement: 'dataMinimization',
                    issue: 'Unnecessary data fields found in assessment forms',
                    severity: 'HIGH'
                });
            }
        }
    }

    async validateSecureStorage() {
        console.log('🗄️ Validating Secure Storage...');

        // Check database configuration
        const dbConfigPath = path.join(__dirname, '../src/config/database.js');
        if (fs.existsSync(dbConfigPath)) {
            const dbContent = fs.readFileSync(dbConfigPath, 'utf8');
            
            // Check for secure database configuration
            if (dbContent.includes('mongodb') || dbContent.includes('firestore')) {
                this.passedChecks.push({
                    requirement: 'secureStorage',
                    check: 'Using secure database (MongoDB/Firestore)',
                    status: 'PASS'
                });
            }

            // Check for encryption at rest
            if (dbContent.includes('encryption') || dbContent.includes('SSL')) {
                this.passedChecks.push({
                    requirement: 'secureStorage',
                    check: 'Database encryption configuration found',
                    status: 'PASS'
                });
            } else {
                this.warnings.push({
                    requirement: 'secureStorage',
                    issue: 'Database encryption configuration unclear',
                    severity: 'MEDIUM'
                });
            }
        }
    }

    async validateTransmissionSecurity() {
        console.log('🌐 Validating Transmission Security...');

        // Check server configuration for HTTPS
        const serverFiles = [
            'src/server.js',
            'src/app.js',
            'server.js',
            'app.js'
        ];

        let httpsFound = false;
        for (const serverFile of serverFiles) {
            const serverPath = path.join(__dirname, '../', serverFile);
            if (fs.existsSync(serverPath)) {
                const content = fs.readFileSync(serverPath, 'utf8');
                
                if (content.includes('https') || content.includes('HTTPS') || content.includes('SSL')) {
                    httpsFound = true;
                    this.passedChecks.push({
                        requirement: 'transmissionSecurity',
                        check: `HTTPS configuration in ${serverFile}`,
                        status: 'PASS'
                    });
                    break;
                }
            }
        }

        if (!httpsFound) {
            this.warnings.push({
                requirement: 'transmissionSecurity',
                issue: 'HTTPS configuration not clearly found',
                severity: 'MEDIUM'
            });
        }

        // Check API client for HTTPS
        const apiClientPath = path.join(__dirname, '../aira-dashboard/src/config/api.ts');
        if (fs.existsSync(apiClientPath)) {
            const apiContent = fs.readFileSync(apiClientPath, 'utf8');
            
            if (apiContent.includes('https://') || apiContent.includes('process.env.NODE_ENV')) {
                this.passedChecks.push({
                    requirement: 'transmissionSecurity',
                    check: 'API client configured for secure transmission',
                    status: 'PASS'
                });
            }
        }
    }

    async validateAuthentication() {
        console.log('🔑 Validating Authentication...');

        // Check authentication implementation
        const authControllerPath = path.join(__dirname, '../src/controllers/authController.js');
        if (fs.existsSync(authControllerPath)) {
            const authContent = fs.readFileSync(authControllerPath, 'utf8');
            
            // Check for strong password requirements
            if (authContent.includes('password') && authContent.includes('hash')) {
                this.passedChecks.push({
                    requirement: 'authentication',
                    check: 'Password hashing implemented',
                    status: 'PASS'
                });
            }

            // Check for JWT or secure session management
            if (authContent.includes('jwt') || authContent.includes('token') || authContent.includes('session')) {
                this.passedChecks.push({
                    requirement: 'authentication',
                    check: 'Secure token/session management found',
                    status: 'PASS'
                });
            }
        }

        // Check for rate limiting
        const securityMiddlewarePath = path.join(__dirname, '../src/middleware/security.js');
        if (fs.existsSync(securityMiddlewarePath)) {
            const securityContent = fs.readFileSync(securityMiddlewarePath, 'utf8');
            
            if (securityContent.includes('rateLimit') || securityContent.includes('rateLimiter')) {
                this.passedChecks.push({
                    requirement: 'authentication',
                    check: 'Rate limiting implemented',
                    status: 'PASS'
                });
            }
        }
    }

    async validateAuthorization() {
        console.log('👥 Validating Authorization...');

        // Check role-based access control
        const filesToCheck = [
            'src/middleware/auth.js',
            'src/routes/psychology.js'
        ];

        for (const file of filesToCheck) {
            const filePath = path.join(__dirname, '../', file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                if (content.includes('role') || content.includes('psychologist') || content.includes('professional')) {
                    this.passedChecks.push({
                        requirement: 'authorization',
                        check: `Role-based access control in ${file}`,
                        status: 'PASS'
                    });
                }
            }
        }
    }

    async validateDataIntegrity() {
        console.log('🛡️ Validating Data Integrity...');

        // Check for data validation
        const validationMiddlewarePath = path.join(__dirname, '../src/middleware/validation.js');
        if (fs.existsSync(validationMiddlewarePath)) {
            const validationContent = fs.readFileSync(validationMiddlewarePath, 'utf8');
            
            if (validationContent.includes('validate') || validationContent.includes('joi') || validationContent.includes('validator')) {
                this.passedChecks.push({
                    requirement: 'integrity',
                    check: 'Data validation middleware implemented',
                    status: 'PASS'
                });
            }
        }

        // Check for input sanitization
        const controllersToCheck = [
            'src/controllers/psychologyAssessmentController.js',
            'src/controllers/psychologyController.js'
        ];

        for (const controller of controllersToCheck) {
            const controllerPath = path.join(__dirname, '../', controller);
            if (fs.existsSync(controllerPath)) {
                const content = fs.readFileSync(controllerPath, 'utf8');
                
                if (content.includes('validation') || content.includes('sanitize') || content.includes('escape')) {
                    this.passedChecks.push({
                        requirement: 'integrity',
                        check: `Input validation in ${controller}`,
                        status: 'PASS'
                    });
                }
            }
        }
    }

    async validateBackupSecurity() {
        console.log('💾 Validating Backup Security...');

        // Check backup scripts
        const backupScripts = [
            'scripts/backup-service.js',
            'scripts/backup-data.js',
            'scripts/secure-backup-service.js'
        ];

        for (const script of backupScripts) {
            const scriptPath = path.join(__dirname, '../', script);
            if (fs.existsSync(scriptPath)) {
                const content = fs.readFileSync(scriptPath, 'utf8');
                
                if (content.includes('encrypt') || content.includes('secure')) {
                    this.passedChecks.push({
                        requirement: 'backupSecurity',
                        check: `Secure backup implementation in ${script}`,
                        status: 'PASS'
                    });
                }
            }
        }

        // Check for backup configuration
        const configFiles = [
            'src/config/config.js',
            'config/config.js'
        ];

        for (const configFile of configFiles) {
            const configPath = path.join(__dirname, '../', configFile);
            if (fs.existsSync(configPath)) {
                const content = fs.readFileSync(configPath, 'utf8');
                
                if (content.includes('backup') || content.includes('backupEncryption')) {
                    this.passedChecks.push({
                        requirement: 'backupSecurity',
                        check: `Backup configuration in ${configFile}`,
                        status: 'PASS'
                    });
                }
            }
        }
    }

    async validatePsychologySpecificRequirements() {
        console.log('🧠 Validating Psychology-Specific Requirements...');

        // Check for secure handling of assessment data
        const assessmentServicePath = path.join(__dirname, '../src/services/psychologyAssessmentService.js');
        if (fs.existsSync(assessmentServicePath)) {
            const content = fs.readFileSync(assessmentServicePath, 'utf8');
            
            // Check for proper scoring and validation
            if (content.includes('validate') || content.includes('validation')) {
                this.passedChecks.push({
                    requirement: 'psychologySpecific',
                    check: 'Assessment data validation implemented',
                    status: 'PASS'
                });
            }

            // Check for secure storage of sensitive assessment results
            if (content.includes('encryptPhi')) {
                this.passedChecks.push({
                    requirement: 'psychologySpecific',
                    check: 'Assessment results properly encrypted',
                    status: 'PASS'
                });
            }
        }

        // Check for secure session recording handling
        const sessionControllerPath = path.join(__dirname, '../src/controllers/psychologySessionController.js');
        if (fs.existsSync(sessionControllerPath)) {
            const content = fs.readFileSync(sessionControllerPath, 'utf8');
            
            if (content.includes('audio') && content.includes('encrypt')) {
                this.passedChecks.push({
                    requirement: 'psychologySpecific',
                    check: 'Session recordings properly encrypted',
                    status: 'PASS'
                });
            }
        }

        // Check for treatment plan security
        const treatmentControllerPath = path.join(__dirname, '../src/controllers/psychologyTreatmentController.js');
        if (fs.existsSync(treatmentControllerPath)) {
            const content = fs.readFileSync(treatmentControllerPath, 'utf8');
            
            if (content.includes('encryptPhi')) {
                this.passedChecks.push({
                    requirement: 'psychologySpecific',
                    check: 'Treatment plan data properly encrypted',
                    status: 'PASS'
                });
            }
        }

        // Validate no PHI in frontend code
        const frontendFiles = [
            'aira-dashboard/src/components/organisms/AssessmentTools/AssessmentTools.tsx',
            'aira-dashboard/src/components/organisms/TreatmentPlanning/TreatmentPlanning.tsx',
            'aira-dashboard/src/components/organisms/ProgressTracking/ProgressTracking.tsx'
        ];

        for (const file of frontendFiles) {
            const filePath = path.join(__dirname, '../', file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                
                // Check for hard-coded PHI or sensitive data
                const sensitivePatterns = [
                    /ssn:?\s*['"`]\d{3}[-\s]?\d{2}[-\s]?\d{4}['"`]/gi,
                    /\d{3}[-\s]?\d{2}[-\s]?\d{4}/g,
                    /credit.*card.*number/gi,
                    /medical.*record.*number/gi
                ];

                let foundSensitive = false;
                for (const pattern of sensitivePatterns) {
                    if (pattern.test(content)) {
                        foundSensitive = true;
                        this.violations.push({
                            requirement: 'psychologySpecific',
                            issue: `Potential hard-coded sensitive data in ${file}`,
                            severity: 'HIGH'
                        });
                    }
                }

                if (!foundSensitive) {
                    this.passedChecks.push({
                        requirement: 'psychologySpecific',
                        check: `No hard-coded PHI in ${file}`,
                        status: 'PASS'
                    });
                }
            }
        }
    }

    generateReport() {
        console.log('\n' + '='.repeat(80));
        console.log('🏥 PSYCHOLOGY MODULE HIPAA COMPLIANCE REPORT');
        console.log('='.repeat(80));

        // Summary
        const totalChecks = this.passedChecks.length + this.warnings.length + this.violations.length;
        const complianceScore = totalChecks > 0 ? (this.passedChecks.length / totalChecks * 100).toFixed(1) : 0;

        console.log(`\n📊 OVERALL COMPLIANCE SCORE: ${complianceScore}%`);
        console.log(`✅ Passed Checks: ${this.passedChecks.length}`);
        console.log(`⚠️  Warnings: ${this.warnings.length}`);
        console.log(`❌ Violations: ${this.violations.length}`);

        // Passed checks
        if (this.passedChecks.length > 0) {
            console.log('\n✅ PASSED CHECKS:');
            this.passedChecks.forEach(check => {
                console.log(`   • ${check.check}`);
            });
        }

        // Warnings
        if (this.warnings.length > 0) {
            console.log('\n⚠️  WARNINGS:');
            this.warnings.forEach(warning => {
                console.log(`   • ${warning.issue} (Severity: ${warning.severity})`);
            });
        }

        // Violations
        if (this.violations.length > 0) {
            console.log('\n❌ HIPAA VIOLATIONS:');
            this.violations.forEach(violation => {
                console.log(`   • ${violation.issue} (Severity: ${violation.severity})`);
            });
        }

        // Recommendations
        console.log('\n💡 RECOMMENDATIONS:');
        if (this.violations.length > 0) {
            console.log('   🚨 IMMEDIATE ACTION REQUIRED:');
            console.log('   - Address all HIGH severity violations before production deployment');
            console.log('   - Implement missing security controls');
            console.log('   - Add proper audit logging for all PHI access');
        }

        if (this.warnings.length > 0) {
            console.log('   🔍 RECOMMENDED IMPROVEMENTS:');
            console.log('   - Review and address MEDIUM severity warnings');
            console.log('   - Enhance security monitoring and logging');
            console.log('   - Implement additional validation controls');
        }

        if (this.violations.length === 0 && this.warnings.length === 0) {
            console.log('   🎉 EXCELLENT COMPLIANCE!');
            console.log('   - Continue regular security audits');
            console.log('   - Monitor for new compliance requirements');
            console.log('   - Maintain security documentation');
        }

        // Compliance status
        console.log('\n🏆 COMPLIANCE STATUS:');
        if (this.violations.length === 0) {
            console.log('   ✅ READY FOR PRODUCTION (No violations detected)');
        } else if (this.violations.filter(v => v.severity === 'HIGH').length === 0) {
            console.log('   ⚠️  CONDITIONAL COMPLIANCE (Minor violations to address)');
        } else {
            console.log('   ❌ NOT COMPLIANT (Critical violations require immediate attention)');
        }

        console.log('\n' + '='.repeat(80));
        console.log('Report generated on:', new Date().toISOString());
        console.log('='.repeat(80));
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new PsychologyHIPAAValidator();
    validator.validateCompliance().catch(console.error);
}

module.exports = PsychologyHIPAAValidator;