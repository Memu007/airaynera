/**
 * HIPAA COMPLIANCE VALIDATION FRAMEWORK
 * ====================================
 * Medical Compliance & Security Validation Team
 * 
 * Comprehensive HIPAA compliance validation tool that validates:
 * - HIPAA Security Rule (164.312)
 * - HIPAA Privacy Rule (164.502) 
 * - HIPAA Breach Notification Rule (164.308)
 * - HIPAA Enforcement Rule (164.500)
 * 
 * VALIDATION SCOPE:
 * 1. Administrative Safeguards
 * 2. Physical Safeguards  
 * 3. Technical Safeguards
 * 4. Organizational Requirements
 * 5. Policies and Procedures
 */

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

class HIPAAComplianceValidator {
    constructor() {
        this.validationResults = {
            securityRule: {},
            privacyRule: {},
            breachNotification: {},
            organizationalRequirements: {},
            policiesAndProcedures: {},
            overallCompliance: {
                score: 0,
                status: 'UNKNOWN',
                criticalGaps: [],
                recommendations: []
            }
        };
        this.validationDate = new Date();
    }

    /**
     * Execute comprehensive HIPAA compliance validation
     */
    async executeValidation() {
        console.log('🏥 HIPAA COMPLIANCE VALIDATION INITIATED');
        console.log('=' .repeat(60));
        console.log(`📅 Validation Date: ${this.validationDate.toISOString()}`);
        console.log(`🎯 System: AIRA Medical Bot`);
        console.log(`📋 Framework: HIPAA Security & Privacy Rules`);
        console.log('=' .repeat(60));

        try {
            await this.validateSecurityRule();
            await this.validatePrivacyRule();
            await this.validateBreachNotification();
            await this.validateOrganizationalRequirements();
            await this.validatePoliciesAndProcedures();
            await this.generateComplianceReport();

            return this.validationResults;

        } catch (error) {
            console.error('❌ HIPAA compliance validation failed:', error.message);
            throw error;
        }
    }

    /**
     * Validate HIPAA Security Rule (164.312)
     */
    async validateSecurityRule() {
        console.log('\n🔐 VALIDATING HIPAA SECURITY RULE (164.312)');
        console.log('-'.repeat(50));

        const securitySafeguards = [
            this.validateAccessControls,        // 164.312(a)(1)
            this.validateAuditControls,         // 164.312(b)
            this.validateIntegrityControls,     // 164.312(c)(1)
            this.validateEncryption,            // 164.312(d)
            this.validateTransmissionSecurity,  // 164.312(e)(1)
            this.validateAuthentication,        // 164.312(a)(2)
            this.validateAuthorization,         // 164.312(a)(3)
            this.validateSessionControls,       // 164.312(a)(4)
            this.validateEmergencyAccess,       // 164.312(a)(5)
            this.validateAutomaticLogoff        // 164.312(a)(6)
        ];

        for (const safeguard of securitySafeguards) {
            await safeguard.call(this);
        }

        this.calculateSecurityRuleScore();
    }

    /**
     * 164.312(a)(1) - Access Controls
     */
    async validateAccessControls() {
        console.log('\n🔑 Validating: Access Controls (164.312(a)(1))...');

        const accessControlTests = [
            {
                name: 'Unique User Identification',
                test: () => this.testUniqueUserIdentification(),
                requirement: 'Implement unique user names and/or numbers for identifying and tracking user identity',
                criticality: 'CRITICAL'
            },
            {
                name: 'Emergency Access Procedure', 
                test: () => this.testEmergencyAccessProcedure(),
                requirement: 'Establish emergency access procedures',
                criticality: 'HIGH'
            },
            {
                name: 'Automatic Logoff',
                test: () => this.testAutomaticLogoff(),
                requirement: 'Implement electronic procedures that terminate an electronic session after a predetermined time of inactivity',
                criticality: 'HIGH'
            },
            {
                name: 'Encryption and Decryption',
                test: () => this.testEncryptionDecryption(),
                requirement: 'Implement encryption and decryption for electronic protected health information',
                criticality: 'CRITICAL'
            }
        ];

        const results = [];

        for (const test of accessControlTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix access control implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.securityRule.accessControls = {
            status: results.filter(r => r.compliant).length / results.length >= 0.75 ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100,
            hipaaReference: '164.312(a)(1)'
        };
    }

    /**
     * Test unique user identification
     */
    async testUniqueUserIdentification() {
        try {
            // Check if user management system exists
            const userRoutes = fs.existsSync('./routes/users.js') || fs.existsSync('./src/routes/users.js');
            const userController = fs.existsSync('./controllers/authController.js') || fs.existsSync('./src/controllers/authController.js');
            const authMiddleware = fs.existsSync('./middleware/auth.js') || fs.existsSync('./src/middleware/auth.js');

            if (userRoutes && userController && authMiddleware) {
                // Check if user identification is implemented
                const authContent = fs.readFileSync(authMiddleware, 'utf8');
                const hasUserTracking = authContent.includes('userId') || authContent.includes('user.id');

                return {
                    compliant: hasUserTracking,
                    details: hasUserTracking ? 
                        'User identification system implemented' : 
                        'User identification tracking not found',
                    recommendation: hasUserTracking ? 
                        null : 
                        'Implement unique user identification and tracking'
                };
            }

            return {
                compliant: false,
                details: 'User management components not found',
                recommendation: 'Implement user management system with unique identification'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `User identification test failed: ${error.message}`,
                recommendation: 'Implement user identification system'
            };
        }
    }

    /**
     * Test emergency access procedure
     */
    async testEmergencyAccessProcedure() {
        try {
            // Check if emergency access is documented
            const configFiles = [
                './src/config/seguridad.js',
                './config/database.js',
                './middleware/auth.js'
            ];

            let hasEmergencyAccess = false;

            for (const file of configFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('emergency') || content.includes('break-glass')) {
                        hasEmergencyAccess = true;
                        break;
                    }
                }
            }

            return {
                compliant: hasEmergencyAccess,
                details: hasEmergencyAccess ? 
                    'Emergency access procedures documented' : 
                    'Emergency access procedures not found',
                recommendation: hasEmergencyAccess ? 
                    null : 
                    'Document and implement emergency access procedures for medical emergencies'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Emergency access test failed: ${error.message}`,
                recommendation: 'Implement emergency access procedures'
            };
        }
    }

    /**
     * Test automatic logoff
     */
    async testAutomaticLogoff() {
        try {
            // Check if session timeout is configured
            const sessionTimeout = process.env.SESSION_TIMEOUT || process.env.JWT_EXPIRES_IN;
            const hasTimeoutConfig = !!sessionTimeout;

            // Check if middleware implements timeout
            const authMiddleware = fs.existsSync('./middleware/auth.js') ? 
                './middleware/auth.js' : 
                fs.existsSync('./src/middleware/auth.js') ? './src/middleware/auth.js' : null;

            let hasTimeoutLogic = false;
            if (authMiddleware && fs.existsSync(authMiddleware)) {
                const content = fs.readFileSync(authMiddleware, 'utf8');
                hasTimeoutLogic = content.includes('timeout') || content.includes('exp');
            }

            return {
                compliant: hasTimeoutConfig && hasTimeoutLogic,
                details: hasTimeoutConfig && hasTimeoutLogic ? 
                    'Session timeout configured and implemented' : 
                    `Session timeout: ${hasTimeoutConfig ? 'Configured' : 'Not configured'}, Logic: ${hasTimeoutLogic ? 'Implemented' : 'Not implemented'}`,
                recommendation: (hasTimeoutConfig && hasTimeoutLogic) ? 
                    null : 
                    'Configure and implement session timeout/automatic logoff'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Automatic logoff test failed: ${error.message}`,
                recommendation: 'Implement automatic logoff functionality'
            };
        }
    }

    /**
     * Test encryption and decryption
     */
    async testEncryptionDecryption() {
        try {
            // Test encryption implementation
            const cryptoUtils = require('../utils/crypto');
            
            // Test PHI encryption
            const testPHI = 'Patient SSN: 123-45-6789';
            const encrypted = cryptoUtils.encryptString(testPHI);
            
            const hasRequiredFields = encrypted && encrypted.ct && encrypted.iv && encrypted.tag;
            
            // Test decryption accuracy
            let decryptionAccurate = false;
            if (hasRequiredFields) {
                const decrypted = cryptoUtils.decryptString(encrypted);
                decryptionAccurate = decrypted === testPHI;
            }

            // Check encryption algorithm
            const key = cryptoUtils.getKey();
            const usesAES256 = key && key.length === 32;

            // Check for proper key configuration
            const hasValidKey = !!process.env.ENCRYPTION_KEY && 
                !process.env.ENCRYPTION_KEY.includes('default') && 
                !process.env.ENCRYPTION_KEY.includes('temporal') &&
                process.env.ENCRYPTION_KEY.length >= 32;

            const compliant = hasRequiredFields && decryptionAccurate && usesAES256 && hasValidKey;

            return {
                compliant: compliant,
                details: compliant ? 
                    'AES-256-GCM encryption properly implemented with valid keys' : 
                    `Encryption issues: Fields=${hasRequiredFields}, Decryption=${decryptionAccurate}, AES-256=${usesAES256}, ValidKey=${hasValidKey}`,
                recommendation: compliant ? 
                    null : 
                    'Implement proper AES-256-GCM encryption with secure key management'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Encryption test failed: ${error.message}`,
                recommendation: 'Implement AES-256-GCM encryption for PHI'
            };
        }
    }

    /**
     * 164.312(b) - Audit Controls
     */
    async validateAuditControls() {
        console.log('\n📋 Validating: Audit Controls (164.312(b))...');

        const auditTests = [
            {
                name: 'Audit Record Content',
                test: () => this.testAuditRecordContent(),
                requirement: 'Implement hardware, software, and/or procedural mechanisms that record and examine activity in information systems that contain or use electronic protected health information',
                criticality: 'CRITICAL'
            },
            {
                name: 'Audit Log Integrity',
                test: () => this.testAuditLogIntegrity(),
                requirement: 'Implement audit control mechanisms to protect the integrity of audit logs',
                criticality: 'HIGH'
            },
            {
                name: 'Audit Record Review',
                test: () => this.testAuditRecordReview(),
                requirement: 'Implement procedures for the regular review of audit logs',
                criticality: 'HIGH'
            }
        ];

        const results = [];

        for (const test of auditTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix audit control implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.securityRule.auditControls = {
            status: results.filter(r => r.compliant).length / results.length >= 0.66 ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100,
            hipaaReference: '164.312(b)'
        };
    }

    /**
     * Test audit record content
     */
    async testAuditRecordContent() {
        try {
            const auditMiddleware = fs.existsSync('./middleware/audit.js') ? 
                './middleware/audit.js' : 
                fs.existsSync('./src/middleware/audit.js') ? './src/middleware/audit.js' : null;

            if (!auditMiddleware || !fs.existsSync(auditMiddleware)) {
                return {
                    compliant: false,
                    details: 'Audit middleware not found',
                    recommendation: 'Implement audit logging middleware'
                };
            }

            const content = fs.readFileSync(auditMiddleware, 'utf8');
            
            const requiredFields = [
                'timestamp',
                'userId',
                'action',
                'resource',
                'patientId',
                'success'
            ];

            const missingFields = requiredFields.filter(field => !content.includes(field));

            return {
                compliant: missingFields.length === 0,
                details: missingFields.length === 0 ? 
                    'All required audit fields implemented' : 
                    `Missing required fields: ${missingFields.join(', ')}`,
                recommendation: missingFields.length === 0 ? 
                    null : 
                    'Add missing required audit fields'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Audit record content test failed: ${error.message}`,
                recommendation: 'Implement comprehensive audit logging'
            };
        }
    }

    /**
     * Test audit log integrity
     */
    async testAuditLogIntegrity() {
        try {
            const auditMiddleware = fs.existsSync('./middleware/audit.js') ? 
                './middleware/audit.js' : 
                fs.existsSync('./src/middleware/audit.js') ? './src/middleware/audit.js' : null;

            if (!auditMiddleware || !fs.existsSync(auditMiddleware)) {
                return {
                    compliant: false,
                    details: 'Audit middleware not found',
                    recommendation: 'Implement audit logging with integrity protection'
                };
            }

            const content = fs.readFileSync(auditMiddleware, 'utf8');
            
            const integrityMeasures = [
                'hash', 'checksum', 'signature', 'integrity', 'tamper'
            ];

            const hasIntegrityProtection = integrityMeasures.some(measure => 
                content.toLowerCase().includes(measure)
            );

            return {
                compliant: hasIntegrityProtection,
                details: hasIntegrityProtection ? 
                    'Audit log integrity protection measures found' : 
                    'No audit log integrity protection detected',
                recommendation: hasIntegrityProtection ? 
                    null : 
                    'Implement audit log hashing/tamper protection'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Audit log integrity test failed: ${error.message}`,
                recommendation: 'Implement audit log integrity protection'
            };
        }
    }

    /**
     * Test audit record review
     */
    async testAuditRecordReview() {
        try {
            // Check if audit review procedures exist
            const configFiles = [
                './src/config/seguridad.js',
                './middleware/audit.js',
                './security-audit.js'
            ];

            let hasReviewProcedures = false;

            for (const file of configFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('review') || content.includes('monitor') || content.includes('analyze')) {
                        hasReviewProcedures = true;
                        break;
                    }
                }
            }

            return {
                compliant: hasReviewProcedures,
                details: hasReviewProcedures ? 
                    'Audit review procedures found' : 
                    'No automated audit review procedures detected',
                recommendation: hasReviewProcedures ? 
                    null : 
                    'Implement regular audit log review procedures'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Audit record review test failed: ${error.message}`,
                recommendation: 'Implement audit review procedures'
            };
        }
    }

    /**
     * 164.312(c)(1) - Integrity Controls
     */
    async validateIntegrityControls() {
        console.log('\n🔒 Validating: Integrity Controls (164.312(c)(1))...');

        const integrityTests = [
            {
                name: 'Data Integrity Protection',
                test: () => this.testDataIntegrityProtection(),
                requirement: 'Implement policies and procedures to protect e-PHI from improper alteration or destruction',
                criticality: 'HIGH'
            }
        ];

        const results = [];

        for (const test of integrityTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix integrity control implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.securityRule.integrityControls = {
            status: results.every(r => r.compliant) ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100,
            hipaaReference: '164.312(c)(1)'
        };
    }

    /**
     * Test data integrity protection
     */
    async testDataIntegrityProtection() {
        try {
            // Test encryption includes integrity protection
            const cryptoUtils = require('../utils/crypto');
            const testData = 'integrity test data';
            const encrypted = cryptoUtils.encryptString(testData);

            const hasAuthenticationTag = encrypted && encrypted.tag;
            
            // Check for checksum/hash mechanisms
            const integrityFiles = [
                './utils/crypto.js',
                './src/utils/encryption.js',
                './middleware/audit.js'
            ];

            let hasHashing = false;
            for (const file of integrityFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('hash') || content.includes('checksum') || content.includes('crypto.createHash')) {
                        hasHashing = true;
                        break;
                    }
                }
            }

            return {
                compliant: hasAuthenticationTag || hasHashing,
                details: hasAuthenticationTag ? 
                    'Authenticated encryption (AES-GCM) provides integrity protection' :
                    hasHashing ? 
                    'Hashing mechanisms for integrity protection found' :
                    'No integrity protection mechanisms detected',
                recommendation: (hasAuthenticationTag || hasHashing) ? 
                    null : 
                    'Implement data integrity protection (encryption with authentication tags or hashing)'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Data integrity test failed: ${error.message}`,
                recommendation: 'Implement data integrity protection mechanisms'
            };
        }
    }

    /**
     * 164.312(d) - Encryption and Decryption
     */
    async validateEncryption() {
        console.log('\n🔐 Validating: Encryption and Decryption (164.312(d))...');

        const encryptionTests = [
            {
                name: 'Encryption at Rest',
                test: () => this.testEncryptionAtRest(),
                requirement: 'Implement encryption and decryption for e-PHI at rest',
                criticality: 'CRITICAL'
            },
            {
                name: 'Encryption in Transit',
                test: () => this.testEncryptionInTransit(),
                requirement: 'Implement encryption and decryption for e-PHI in transit',
                criticality: 'CRITICAL'
            }
        ];

        const results = [];

        for (const test of encryptionTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix encryption implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.securityRule.encryption = {
            status: results.every(r => r.compliant) ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100,
            hipaaReference: '164.312(d)'
        };
    }

    /**
     * Test encryption at rest
     */
    async testEncryptionAtRest() {
        try {
            const cryptoUtils = require('../utils/crypto');
            
            // Test encryption functionality
            const testPHI = 'Patient Data: John Doe, DOB: 1980-01-01';
            const encrypted = cryptoUtils.encryptString(testPHI);
            
            const encryptionWorking = encrypted && encrypted.ct && encrypted.iv && encrypted.tag;
            
            // Test key management
            const key = cryptoUtils.getKey();
            const hasValidKey = key && key.length === 32;
            
            // Check if encryption is being used for PHI storage
            const databaseFiles = [
                './services/patientsService.js',
                './src/services/patientsService.js',
                './services/sessionService.js',
                './src/services/sessionService.js'
            ];

            let encryptionInUse = false;
            for (const file of databaseFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('encryptString') || content.includes('encrypt')) {
                        encryptionInUse = true;
                        break;
                    }
                }
            }

            return {
                compliant: encryptionWorking && hasValidKey && encryptionInUse,
                details: encryptionWorking && hasValidKey && encryptionInUse ? 
                    'AES-256-GCM encryption properly implemented and used for PHI storage' : 
                    `Encryption status: Working=${encryptionWorking}, ValidKey=${hasValidKey}, InUse=${encryptionInUse}`,
                recommendation: (encryptionWorking && hasValidKey && encryptionInUse) ? 
                    null : 
                    'Implement and use AES-256-GCM encryption for PHI at rest'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Encryption at rest test failed: ${error.message}`,
                recommendation: 'Implement proper encryption for PHI at rest'
            };
        }
    }

    /**
     * Test encryption in transit
     */
    async testEncryptionInTransit() {
        try {
            // Check HTTPS configuration
            const requireHttps = process.env.REQUIRE_HTTPS === 'true';
            const nodeEnv = process.env.NODE_ENV;
            
            // Check security headers for transport security
            const serverFiles = [
                './server.js',
                './src/server.js',
                './server-frontend.js'
            ];

            let hasTLSConfig = false;
            let hasSecurityHeaders = false;

            for (const file of serverFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('https') || content.includes('tls') || content.includes('ssl')) {
                        hasTLSConfig = true;
                    }
                    if (content.includes('helmet') || content.includes('hsts') || content.includes('strict-transport-security')) {
                        hasSecurityHeaders = true;
                    }
                }
            }

            const compliant = requireHttps || hasTLSConfig || (nodeEnv === 'production' && hasSecurityHeaders);

            return {
                compliant: compliant,
                details: compliant ? 
                    'Transport security measures implemented' : 
                    `HTTPS: ${requireHttps}, TLS Config: ${hasTLSConfig}, Security Headers: ${hasSecurityHeaders}`,
                recommendation: compliant ? 
                    null : 
                    'Implement HTTPS/TLS for all PHI transmission'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Encryption in transit test failed: ${error.message}`,
                recommendation: 'Implement TLS/HTTPS for secure data transmission'
            };
        }
    }

    /**
     * 164.312(e)(1) - Transmission Security
     */
    async validateTransmissionSecurity() {
        console.log('\n🌐 Validating: Transmission Security (164.312(e)(1))...');

        const transmissionTests = [
            {
                name: 'Access Controls on Transmissions',
                test: () => this.testAccessControlsOnTransmissions(),
                requirement: 'Implement technical security measures to guard against unauthorized access to e-PHI that is being transmitted over an electronic communications network',
                criticality: 'HIGH'
            }
        ];

        const results = [];

        for (const test of transmissionTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix transmission security implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.securityRule.transmissionSecurity = {
            status: results.every(r => r.compliant) ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100,
            hipaaReference: '164.312(e)(1)'
        };
    }

    /**
     * Test access controls on transmissions
     */
    async testAccessControlsOnTransmissions() {
        try {
            // Check CORS configuration
            const corsConfigured = !!process.env.CORS_ORIGINS;
            
            // Check authentication middleware
            const authMiddleware = fs.existsSync('./middleware/auth.js') ? 
                './middleware/auth.js' : 
                fs.existsSync('./src/middleware/auth.js') ? './src/middleware/auth.js' : null;

            let hasAuth = false;
            if (authMiddleware && fs.existsSync(authMiddleware)) {
                const content = fs.readFileSync(authMiddleware, 'utf8');
                hasAuth = content.includes('requireAuth') || content.includes('authenticate');
            }

            // Check rate limiting
            const rateLimitFiles = [
                './middleware/rateLimiter.js',
                './middleware/rate-limiter.js',
                './src/middleware/rate-limiter.js'
            ];

            let hasRateLimiting = false;
            for (const file of rateLimitFiles) {
                if (fs.existsSync(file)) {
                    hasRateLimiting = true;
                    break;
                }
            }

            const compliant = corsConfigured && hasAuth && hasRateLimiting;

            return {
                compliant: compliant,
                details: compliant ? 
                    'Transmission access controls implemented (CORS, Auth, Rate Limiting)' : 
                    `CORS: ${corsConfigured}, Auth: ${hasAuth}, Rate Limiting: ${hasRateLimiting}`,
                recommendation: compliant ? 
                    null : 
                    'Implement comprehensive transmission access controls'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Transmission access controls test failed: ${error.message}`,
                recommendation: 'Implement access controls for data transmissions'
            };
        }
    }

    /**
     * Validate HIPAA Privacy Rule (164.502)
     */
    async validatePrivacyRule() {
        console.log('\n🛡️ VALIDATING HIPAA PRIVACY RULE (164.502)');
        console.log('-'.repeat(50));

        const privacyTests = [
            {
                name: 'Uses and Disclosures',
                test: () => this.testUsesAndDisclosures(),
                requirement: 'Implement appropriate administrative, technical, and physical safeguards to protect the privacy of protected health information',
                criticality: 'CRITICAL'
            },
            {
                name: 'Minimum Necessary',
                test: () => this.testMinimumNecessary(),
                requirement: 'Implement reasonable policies and procedures that limit the use, disclosure of, and requests for PHI to the minimum necessary',
                criticality: 'HIGH'
            },
            {
                name: 'Patient Consent',
                test: () => this.testPatientConsent(),
                requirement: 'Implement proper patient consent management for uses and disclosures of PHI',
                criticality: 'CRITICAL'
            }
        ];

        const results = [];

        for (const test of privacyTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix privacy rule implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.privacyRule = {
            status: results.filter(r => r.compliant).length / results.length >= 0.66 ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100,
            hipaaReference: '164.502'
        };
    }

    /**
     * Test uses and disclosures
     */
    async testUsesAndDisclosures() {
        try {
            // Check if privacy policies exist
            const policyFiles = [
                './docs/privacy-policy.md',
                './docs/hipaa-privacy.md',
                './PRIVACY.md'
            ];

            let hasPrivacyPolicy = false;
            for (const file of policyFiles) {
                if (fs.existsSync(file)) {
                    hasPrivacyPolicy = true;
                    break;
                }
            }

            // Check if consent management is implemented
            const consentFiles = [
                './services/consentService.js',
                './src/services/consentService.js',
                './models/consent.js',
                './src/models/consent.js'
            ];

            let hasConsentManagement = false;
            for (const file of consentFiles) {
                if (fs.existsSync(file)) {
                    hasConsentManagement = true;
                    break;
                }
            }

            return {
                compliant: hasPrivacyPolicy || hasConsentManagement,
                details: hasPrivacyPolicy ? 
                    'Privacy policy documentation found' :
                    hasConsentManagement ? 
                    'Consent management system implemented' :
                    'No privacy policies or consent management found',
                recommendation: (hasPrivacyPolicy || hasConsentManagement) ? 
                    null : 
                    'Implement privacy policies and consent management'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Uses and disclosures test failed: ${error.message}`,
                recommendation: 'Implement privacy policies for PHI uses and disclosures'
            };
        }
    }

    /**
     * Test minimum necessary principle
     */
    async testMinimumNecessary() {
        try {
            // Check if data filtering is implemented
            const serviceFiles = [
                './services/patientsService.js',
                './src/services/patientsService.js',
                './controllers/patientsController.js',
                './src/controllers/patientsController.js'
            ];

            let hasDataFiltering = false;
            for (const file of serviceFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('select') || content.includes('filter') || content.includes('project')) {
                        hasDataFiltering = true;
                        break;
                    }
                }
            }

            return {
                compliant: hasDataFiltering,
                details: hasDataFiltering ? 
                    'Data filtering mechanisms found' : 
                    'No minimum necessary data filtering detected',
                recommendation: hasDataFiltering ? 
                    null : 
                    'Implement minimum necessary principle for PHI access'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Minimum necessary test failed: ${error.message}`,
                recommendation: 'Implement minimum necessary data access principles'
            };
        }
    }

    /**
     * Test patient consent
     */
    async testPatientConsent() {
        try {
            // Check if consent tracking is implemented
            const consentFiles = [
                './models/consent.js',
                './src/models/consent.js',
                './services/consentService.js',
                './src/services/consentService.js'
            ];

            let hasConsentSystem = false;
            for (const file of consentFiles) {
                if (fs.existsSync(file)) {
                    hasConsentSystem = true;
                    break;
                }
            }

            // Check database schema for consent
            const dbFiles = [
                './data/aira.db',
                './models/patient.js',
                './src/models/patient.js'
            ];

            let hasConsentInDB = false;
            for (const file of dbFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('consent') || content.includes('authorization')) {
                        hasConsentInDB = true;
                        break;
                    }
                }
            }

            return {
                compliant: hasConsentSystem || hasConsentInDB,
                details: hasConsentSystem ? 
                    'Consent management system implemented' :
                    hasConsentInDB ? 
                    'Consent tracking in database found' :
                    'No patient consent management detected',
                recommendation: (hasConsentSystem || hasConsentInDB) ? 
                    null : 
                    'Implement patient consent management system'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Patient consent test failed: ${error.message}`,
                recommendation: 'Implement patient consent management'
            };
        }
    }

    /**
     * Validate HIPAA Breach Notification Rule (164.308)
     */
    async validateBreachNotification() {
        console.log('\n🚨 VALIDATING BREACH NOTIFICATION RULE (164.308)');
        console.log('-'.repeat(50));

        const breachTests = [
            {
                name: 'Breach Detection',
                test: () => this.testBreachDetection(),
                requirement: 'Implement procedures to detect breaches of unsecured PHI',
                criticality: 'HIGH'
            },
            {
                name: 'Breach Notification',
                test: () => this.testBreachNotification(),
                requirement: 'Implement procedures for breach notification to individuals and authorities',
                criticality: 'HIGH'
            },
            {
                name: 'Incident Response',
                test: () => this.testIncidentResponse(),
                requirement: 'Implement incident response procedures for security incidents',
                criticality: 'HIGH'
            }
        ];

        const results = [];

        for (const test of breachTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix breach notification implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.breachNotification = {
            status: results.filter(r => r.compliant).length / results.length >= 0.66 ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100,
            hipaaReference: '164.308(a)(6)'
        };
    }

    /**
     * Test breach detection
     */
    async testBreachDetection() {
        try {
            // Check if monitoring is implemented
            const monitoringFiles = [
                './middleware/audit.js',
                './src/middleware/audit.js',
                './services/monitoringService.js',
                './src/services/monitoringService.js'
            ];

            let hasMonitoring = false;
            for (const file of monitoringFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('monitor') || content.includes('alert') || content.includes('detect')) {
                        hasMonitoring = true;
                        break;
                    }
                }
            }

            // Check for anomaly detection
            const hasAnomalyDetection = process.env.ANOMALY_DETECTION === 'true';

            return {
                compliant: hasMonitoring || hasAnomalyDetection,
                details: hasMonitoring ? 
                    'Security monitoring implemented' :
                    hasAnomalyDetection ? 
                    'Anomaly detection configured' :
                    'No breach detection mechanisms found',
                recommendation: (hasMonitoring || hasAnomalyDetection) ? 
                    null : 
                    'Implement breach detection and monitoring systems'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Breach detection test failed: ${error.message}`,
                recommendation: 'Implement breach detection mechanisms'
            };
        }
    }

    /**
     * Test breach notification
     */
    async testBreachNotification() {
        try {
            // Check if notification procedures exist
            const notificationFiles = [
                './services/notificationService.js',
                './src/services/notificationService.js',
                './docs/breach-notification-procedure.md'
            ];

            let hasNotificationProcedures = false;
            for (const file of notificationFiles) {
                if (fs.existsSync(file)) {
                    hasNotificationProcedures = true;
                    break;
                }
            }

            // Check for alert configuration
            const hasAlertConfig = process.env.ALERT_EMAIL || process.env.BREACH_NOTIFICATION_EMAIL;

            return {
                compliant: hasNotificationProcedures || hasAlertConfig,
                details: hasNotificationProcedures ? 
                    'Breach notification procedures documented' :
                    hasAlertConfig ? 
                    'Breach notification email configured' :
                    'No breach notification procedures found',
                recommendation: (hasNotificationProcedures || hasAlertConfig) ? 
                    null : 
                    'Implement breach notification procedures'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Breach notification test failed: ${error.message}`,
                recommendation: 'Implement breach notification procedures'
            };
        }
    }

    /**
     * Test incident response
     */
    async testIncidentResponse() {
        try {
            // Check if incident response plan exists
            const irpFiles = [
                './docs/incident-response-plan.md',
                './docs/security-incident-response.md',
                './INCIDENT-RESPONSE.md'
            ];

            let hasIRP = false;
            for (const file of irpFiles) {
                if (fs.existsSync(file)) {
                    hasIRP = true;
                    break;
                }
            }

            // Check for error handling and logging
            const errorHandling = fs.existsSync('./middleware/error.js') || fs.existsSync('./src/middleware/error.js');

            return {
                compliant: hasIRP || errorHandling,
                details: hasIRP ? 
                    'Incident response plan documented' :
                    errorHandling ? 
                    'Error handling implemented' :
                    'No incident response procedures found',
                recommendation: (hasIRP || errorHandling) ? 
                    null : 
                    'Implement incident response procedures'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Incident response test failed: ${error.message}`,
                recommendation: 'Implement incident response procedures'
            };
        }
    }

    /**
     * Validate Organizational Requirements
     */
    async validateOrganizationalRequirements() {
        console.log('\n🏢 VALIDATING ORGANIZATIONAL REQUIREMENTS');
        console.log('-'.repeat(50));

        const orgTests = [
            {
                name: 'Security Officer',
                test: () => this.testSecurityOfficer(),
                requirement: 'Designate a security officer responsible for developing and implementing security policies',
                criticality: 'HIGH'
            },
            {
                name: 'Workforce Training',
                test: () => this.testWorkforceTraining(),
                requirement: 'Implement security awareness and training program for all workforce members',
                criticality: 'HIGH'
            },
            {
                name: 'Business Associate Agreements',
                test: () => this.testBusinessAssociateAgreements(),
                requirement: 'Implement business associate agreements with third-party service providers',
                criticality: 'MEDIUM'
            }
        ];

        const results = [];

        for (const test of orgTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix organizational requirement implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.organizationalRequirements = {
            status: results.filter(r => r.compliant).length / results.length >= 0.66 ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100
        };
    }

    /**
     * Test security officer designation
     */
    async testSecurityOfficer() {
        try {
            // Check if security officer is designated
            const securityOfficer = process.env.SECURITY_OFFICER || process.env.SECURITY_CONTACT;
            
            // Check documentation for security officer role
            const docFiles = [
                './docs/security-roles.md',
                './docs/organization.md',
                './README.md'
            ];

            let hasDoc = false;
            for (const file of docFiles) {
                if (fs.existsSync(file)) {
                    const content = fs.readFileSync(file, 'utf8');
                    if (content.includes('security officer') || content.includes('security contact')) {
                        hasDoc = true;
                        break;
                    }
                }
            }

            return {
                compliant: !!securityOfficer || hasDoc,
                details: securityOfficer ? 
                    'Security officer designated in environment' :
                    hasDoc ? 
                    'Security officer role documented' :
                    'No security officer designation found',
                recommendation: (!!securityOfficer || hasDoc) ? 
                    null : 
                    'Designate a security officer and document responsibilities'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Security officer test failed: ${error.message}`,
                recommendation: 'Designate security officer'
            };
        }
    }

    /**
     * Test workforce training
     */
    async testWorkforceTraining() {
        try {
            // Check if training documentation exists
            const trainingFiles = [
                './docs/security-training.md',
                './docs/hipaa-training.md',
                './docs/workforce-training.md'
            ];

            let hasTrainingDocs = false;
            for (const file of trainingFiles) {
                if (fs.existsSync(file)) {
                    hasTrainingDocs = true;
                    break;
                }
            }

            return {
                compliant: hasTrainingDocs,
                details: hasTrainingDocs ? 
                    'Workforce training documentation found' : 
                    'No workforce training documentation found',
                recommendation: hasTrainingDocs ? 
                    null : 
                    'Develop and document security awareness training program'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Workforce training test failed: ${error.message}`,
                recommendation: 'Implement workforce training program'
            };
        }
    }

    /**
     * Test business associate agreements
     */
    async testBusinessAssociateAgreements() {
        try {
            // Check if BAA documentation exists
            const baaFiles = [
                './docs/business-associate-agreement.md',
                './docs/baa-template.md',
                './docs/third-party-vendors.md'
            ];

            let hasBAADocs = false;
            for (const file of baaFiles) {
                if (fs.existsSync(file)) {
                    hasBAADocs = true;
                    break;
                }
            }

            // Check if third-party services are documented
            const thirdPartyServices = [
                process.env.GEMINI_API_KEY,
                process.env.MP_ACCESS_TOKEN,
                process.env.WHATSAPP_TOKEN
            ];

            const hasThirdParties = thirdPartyServices.some(service => !!service);

            return {
                compliant: hasBAADocs || !hasThirdParties,
                details: hasBAADocs ? 
                    'Business associate agreement documentation found' :
                    hasThirdParties ? 
                    'Third-party services used but no BAA documentation found' :
                    'No third-party services requiring BAA',
                recommendation: (hasBAADocs || !hasThirdParties) ? 
                    null : 
                    'Document business associate agreements for third-party service providers'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Business associate agreement test failed: ${error.message}`,
                recommendation: 'Document business associate agreements'
            };
        }
    }

    /**
     * Validate Policies and Procedures
     */
    async validatePoliciesAndProcedures() {
        console.log('\n📋 VALIDATING POLICIES AND PROCEDURES');
        console.log('-'.repeat(50));

        const policyTests = [
            {
                name: 'Security Policies',
                test: () => this.testSecurityPolicies(),
                requirement: 'Implement comprehensive security policies and procedures',
                criticality: 'HIGH'
            },
            {
                name: 'Contingency Planning',
                test: () => this.testContingencyPlanning(),
                requirement: 'Implement contingency planning including data backup and disaster recovery',
                criticality: 'HIGH'
            },
            {
                name: 'Documentation Review',
                test: () => this.testDocumentationReview(),
                requirement: 'Implement regular review and update of security policies and procedures',
                criticality: 'MEDIUM'
            }
        ];

        const results = [];

        for (const test of policyTests) {
            try {
                const result = await test.test();
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    ...result
                });

                const status = result.compliant ? '✅ COMPLIANT' : '❌ NON-COMPLIANT';
                console.log(`   ${status} - ${test.name}: ${result.details}`);

            } catch (error) {
                results.push({
                    name: test.name,
                    requirement: test.requirement,
                    criticality: test.criticality,
                    compliant: false,
                    details: `Test failed: ${error.message}`,
                    recommendation: 'Fix policy implementation'
                });

                console.log(`   ❌ ERROR - ${test.name}: ${error.message}`);
            }
        }

        this.validationResults.policiesAndProcedures = {
            status: results.filter(r => r.compliant).length / results.length >= 0.66 ? 'COMPLIANT' : 'PARTIALLY_COMPLIANT',
            tests: results,
            score: (results.filter(r => r.compliant).length / results.length) * 100
        };
    }

    /**
     * Test security policies
     */
    async testSecurityPolicies() {
        try {
            // Check for security policy documentation
            const policyFiles = [
                './docs/security-policy.md',
                './docs/security-procedures.md',
                './docs/hipaa-security-policy.md'
            ];

            let hasSecurityPolicies = false;
            for (const file of policyFiles) {
                if (fs.existsSync(file)) {
                    hasSecurityPolicies = true;
                    break;
                }
            }

            return {
                compliant: hasSecurityPolicies,
                details: hasSecurityPolicies ? 
                    'Security policies documented' : 
                    'No security policy documentation found',
                recommendation: hasSecurityPolicies ? 
                    null : 
                    'Develop comprehensive security policies and procedures'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Security policies test failed: ${error.message}`,
                recommendation: 'Implement security policies'
            };
        }
    }

    /**
     * Test contingency planning
     */
    async testContingencyPlanning() {
        try {
            // Check for backup procedures
            const backupFiles = [
                './scripts/backup-service.js',
                './scripts/backup.js',
                './docs/backup-procedures.md'
            ];

            let hasBackupProcedures = false;
            for (const file of backupFiles) {
                if (fs.existsSync(file)) {
                    hasBackupProcedures = true;
                    break;
                }
            }

            // Check for disaster recovery planning
            const drFiles = [
                './docs/disaster-recovery.md',
                './docs/contingency-plan.md'
            ];

            let hasDRPlan = false;
            for (const file of drFiles) {
                if (fs.existsSync(file)) {
                    hasDRPlan = true;
                    break;
                }
            }

            return {
                compliant: hasBackupProcedures || hasDRPlan,
                details: hasBackupProcedures ? 
                    'Backup procedures implemented' :
                    hasDRPlan ? 
                    'Disaster recovery plan documented' :
                    'No contingency planning found',
                recommendation: (hasBackupProcedures || hasDRPlan) ? 
                    null : 
                    'Implement contingency planning procedures'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Contingency planning test failed: ${error.message}`,
                recommendation: 'Implement contingency planning'
            };
        }
    }

    /**
     * Test documentation review
     */
    async testDocumentationReview() {
        try {
            // Check if documentation has recent updates
            const docFiles = [
                './docs/security-policy.md',
                './docs/hipaa-compliance.md',
                './SECURITY.md'
            ];

            let recentDocs = false;
            const oneYearAgo = new Date();
            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

            for (const file of docFiles) {
                if (fs.existsSync(file)) {
                    const stats = fs.statSync(file);
                    if (stats.mtime > oneYearAgo) {
                        recentDocs = true;
                        break;
                    }
                }
            }

            return {
                compliant: recentDocs,
                details: recentDocs ? 
                    'Documentation has been updated within the last year' : 
                    'Documentation may be outdated',
                recommendation: recentDocs ? 
                    null : 
                    'Review and update security documentation'
            };

        } catch (error) {
            return {
                compliant: false,
                details: `Documentation review test failed: ${error.message}`,
                recommendation: 'Implement regular documentation review process'
            };
        }
    }

    /**
     * Calculate security rule score
     */
    calculateSecurityRuleScore() {
        const scores = Object.values(this.validationResults.securityRule)
            .filter(rule => rule && rule.score)
            .map(rule => rule.score);

        const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

        this.validationResults.securityRule.overallScore = Math.round(averageScore);
        this.validationResults.securityRule.status = averageScore >= 80 ? 'COMPLIANT' : 
                                                     averageScore >= 60 ? 'PARTIALLY_COMPLIANT' : 'NON_COMPLIANT';
    }

    /**
     * Generate comprehensive compliance report
     */
    async generateComplianceReport() {
        console.log('\n📊 GENERATING HIPAA COMPLIANCE REPORT');
        console.log('-'.repeat(50));

        // Calculate overall scores
        const securityScore = this.validationResults.securityRule.overallScore || 0;
        const privacyScore = this.validationResults.privacyRule.score || 0;
        const breachScore = this.validationResults.breachNotification.score || 0;
        const orgScore = this.validationResults.organizationalRequirements.score || 0;
        const policyScore = this.validationResults.policiesAndProcedures.score || 0;

        const overallScore = Math.round((securityScore + privacyScore + breachScore + orgScore + policyScore) / 5);

        // Determine compliance status
        let complianceStatus = 'NON_COMPLIANT';
        if (overallScore >= 90) complianceStatus = 'FULLY_COMPLIANT';
        else if (overallScore >= 70) complianceStatus = 'SUBSTANTIALLY_COMPLIANT';
        else if (overallScore >= 50) complianceStatus = 'PARTIALLY_COMPLIANT';

        // Identify critical gaps
        const criticalGaps = this.identifyCriticalGaps();

        // Generate recommendations
        const recommendations = this.generateHIPAARecommendations();

        this.validationResults.overallCompliance = {
            score: overallScore,
            status: complianceStatus,
            securityRuleScore: securityScore,
            privacyRuleScore: privacyScore,
            breachNotificationScore: breachScore,
            organizationalScore: orgScore,
            policyScore: policyScore,
            criticalGaps: criticalGaps,
            recommendations: recommendations,
            validationDate: this.validationDate.toISOString(),
            nextReviewDate: new Date(this.validationDate.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString() // 1 year
        };

        console.log(`   Overall HIPAA Compliance Score: ${overallScore}%`);
        console.log(`   Compliance Status: ${complianceStatus}`);
        console.log(`   Critical Gaps: ${criticalGaps.length}`);
        console.log(`   Recommendations: ${recommendations.length}`);
    }

    /**
     * Identify critical compliance gaps
     */
    identifyCriticalGaps() {
        const gaps = [];

        // Check for critical security rule gaps
        if (this.validationResults.securityRule.accessControls && 
            this.validationResults.securityRule.accessControls.score < 80) {
            gaps.push({
                area: 'Access Controls',
                severity: 'CRITICAL',
                issue: 'Access controls are insufficient for HIPAA compliance',
                recommendation: 'Implement comprehensive access control system'
            });
        }

        if (this.validationResults.securityRule.encryption && 
            this.validationResults.securityRule.encryption.score < 80) {
            gaps.push({
                area: 'Encryption',
                severity: 'CRITICAL',
                issue: 'Encryption implementation does not meet HIPAA requirements',
                recommendation: 'Implement AES-256-GCM encryption for all PHI'
            });
        }

        // Check for critical privacy rule gaps
        if (this.validationResults.privacyRule && 
            this.validationResults.privacyRule.score < 70) {
            gaps.push({
                area: 'Privacy Rule',
                severity: 'HIGH',
                issue: 'Privacy rule implementation needs improvement',
                recommendation: 'Enhance privacy controls and consent management'
            });
        }

        // Check for critical breach notification gaps
        if (this.validationResults.breachNotification && 
            this.validationResults.breachNotification.score < 70) {
            gaps.push({
                area: 'Breach Notification',
                severity: 'HIGH',
                issue: 'Breach detection and notification procedures inadequate',
                recommendation: 'Implement comprehensive breach detection and notification system'
            });
        }

        return gaps;
    }

    /**
     * Generate HIPAA compliance recommendations
     */
    generateHIPAARecommendations() {
        const recommendations = [];

        // Immediate actions (critical gaps)
        this.validationResults.overallCompliance.criticalGaps.forEach(gap => {
            recommendations.push({
                priority: gap.severity === 'CRITICAL' ? 'IMMEDIATE' : 'HIGH',
                category: gap.area,
                issue: gap.issue,
                recommendation: gap.recommendation,
                timeframe: gap.severity === 'CRITICAL' ? '30 days' : '60 days',
                hipaaRequirement: this.getHIPAARequirement(gap.area)
            });
        });

        // System improvements
        if (this.validationResults.securityRule.auditControls && 
            this.validationResults.securityRule.auditControls.score < 100) {
            recommendations.push({
                priority: 'HIGH',
                category: 'Audit Controls',
                issue: 'Audit logging system needs enhancement',
                recommendation: 'Implement comprehensive audit logging with integrity protection and regular review procedures',
                timeframe: '45 days',
                hipaaRequirement: '164.312(b) - Audit Controls'
            });
        }

        if (this.validationResults.organizationalRequirements.score < 80) {
            recommendations.push({
                priority: 'MEDIUM',
                category: 'Organizational Requirements',
                issue: 'Organizational requirements need attention',
                recommendation: 'Complete security officer designation, workforce training program, and business associate agreements',
                timeframe: '90 days',
                hipaaRequirement: '164.308 - Organizational Requirements'
            });
        }

        // Policy improvements
        recommendations.push({
            priority: 'MEDIUM',
            category: 'Documentation',
            issue: 'Security policies and procedures need regular review',
            recommendation: 'Implement annual review cycle for all security policies and procedures',
            timeframe: '120 days',
            hipaaRequirement: '164.306 - Security Policies and Procedures'
        });

        return recommendations;
    }

    /**
     * Get HIPAA requirement reference
     */
    getHIPAARequirement(area) {
        const requirements = {
            'Access Controls': '164.312(a) - Access Controls',
            'Encryption': '164.312(d) - Encryption and Decryption',
            'Audit Controls': '164.312(b) - Audit Controls',
            'Privacy Rule': '164.502 - Uses and Disclosures of PHI',
            'Breach Notification': '164.308(a)(6) - Breach Notification'
        };

        return requirements[area] || 'HIPAA Security Rule';
    }
}

module.exports = HIPAAComplianceValidator;

// Execute validation if run directly
if (require.main === module) {
    console.log('🏥 Starting HIPAA Compliance Validation...');
    
    const validator = new HIPAAComplianceValidator();
    
    validator.executeValidation()
        .then(results => {
            console.log('\n📋 HIPAA COMPLIANCE VALIDATION SUMMARY');
            console.log('='.repeat(60));
            
            console.log(`\n🎯 Overall Compliance Score: ${results.overallCompliance.score}%`);
            console.log(`📊 Compliance Status: ${results.overallCompliance.status}`);
            console.log(`📅 Validation Date: ${results.overallCompliance.validationDate}`);
            console.log(`🔄 Next Review Date: ${results.overallCompliance.nextReviewDate}`);
            
            console.log(`\n📈 Compliance Breakdown:`);
            console.log(`   Security Rule: ${results.overallCompliance.securityRuleScore}%`);
            console.log(`   Privacy Rule: ${results.overallCompliance.privacyRuleScore}%`);
            console.log(`   Breach Notification: ${results.overallCompliance.breachNotificationScore}%`);
            console.log(`   Organizational: ${results.overallCompliance.organizationalScore}%`);
            console.log(`   Policies: ${results.overallCompliance.policyScore}%`);
            
            if (results.overallCompliance.criticalGaps.length > 0) {
                console.log(`\n🚨 CRITICAL COMPLIANCE GAPS:`);
                results.overallCompliance.criticalGaps.forEach((gap, index) => {
                    console.log(`   ${index + 1}. ${gap.area}: ${gap.issue}`);
                    console.log(`      Recommendation: ${gap.recommendation}`);
                    console.log(`      Severity: ${gap.severity}`);
                });
            }
            
            // Save detailed report
            const reportPath = `./hipaa-compliance-report-${Date.now()}.json`;
            fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
            console.log(`\n📄 Detailed report saved to: ${reportPath}`);
            
            console.log('\n✅ HIPAA compliance validation completed successfully!');
        })
        .catch(error => {
            console.error('\n❌ HIPAA compliance validation failed:', error.message);
            process.exit(1);
        });
}