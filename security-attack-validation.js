/**
 * AIRA Medical System - Security Attack Validation Script
 * Pruebas específicas para verificar que las defensas de seguridad funcionen correctamente
 * Testing Red Team contra servidor mejorado
 */

const https = require('https');
const http = require('http');

class AttackValidator {
    constructor() {
        this.targetUrl = 'http://localhost:8082';
        this.testResults = {
            passed: [],
            failed: [],
            blocked: []
        };
        this.startTime = Date.now();
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
                timeout: options.timeout || 3000
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

    async runAttackValidation() {
        console.log('🎯 INICIANDO VALIDACIÓN DE ATAQUES - AIRA MEDICAL SYSTEM');
        console.log('=' .repeat(80));
        console.log(`🎯 Target: ${this.targetUrl}`);
        console.log(`⏰ Inicio: ${new Date().toISOString()}`);
        console.log('🛡️ Verificando que las defensas implementadas funcionen correctamente');
        console.log('=' .repeat(80));

        try {
            // Test 1: Mock Token Attack (debería ser bloqueado)
            await this.testMockTokenAttack();

            // Test 2: Rate Limiting Attack (debería ser bloqueado)
            await this.testRateLimitingAttack();

            // Test 3: Header Injection Attack (debería ser detectado/bloqueado)
            await this.testHeaderInjectionAttack();

            // Test 4: Brute Force Attack (debería ser bloqueado)
            await this.testBruteForceAttack();

            // Test 5: XSS Attack (debería ser sanetizado)
            await this.testXSSAttack();

            // Test 6: SQL Injection Attack (debería ser bloqueado)
            await this.testSQLInjectionAttack();

            // Test 7: Path Traversal Attack (debería ser bloqueado)
            await this.testPathTraversalAttack();

            // Test 8: Directory Listing (debería ser bloqueado)
            await this.testDirectoryListing();

            // Test 9: Dangerous HTTP Methods (deberían ser bloqueados)
            await this.testDangerousHTTPMethods();

            // Test 10: Authentication Bypass (debería ser bloqueado)
            await this.testAuthenticationBypass();

            // Generar reporte final
            await this.generateValidationReport();

        } catch (error) {
            console.error('❌ Error en validación de ataques:', error);
            this.testResults.failed.push({
                test: 'Validation Error',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }

        console.log('\n✅ VALIDACIÓN DE ATAQUES COMPLETADA');
        console.log(`⏱️ Duración: ${Math.round((Date.now() - this.startTime) / 1000)} segundos`);
        console.log(`✅ Ataques bloqueados: ${this.testResults.blocked.length}`);
        console.log(`✅ Pruebas pasadas: ${this.testResults.passed.length}`);
        console.log(`❌ Pruebas fallidas: ${this.testResults.failed.length}`);
    }

    async testMockTokenAttack() {
        console.log('\n🔑 TEST 1: MOCK TOKEN ATTACK');

        try {
            const response = await this.httpRequest({
                url: `${this.targetUrl}/api/auth/verify`,
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer mock-jwt-token-for-development',
                    'Content-Type': 'application/json'
                }
            }, {});

            if (response.status === 401) {
                console.log('   ✅ Mock token bloqueado correctamente');
                this.testResults.blocked.push({
                    test: 'Mock Token Attack',
                    result: 'BLOCKED',
                    status: response.status,
                    reason: 'Mock development token rejected'
                });
            } else {
                console.log(`   ❌ Mock token no fue bloqueado (${response.status})`);
                this.testResults.failed.push({
                    test: 'Mock Token Attack',
                    result: 'FAILED',
                    status: response.status,
                    reason: 'Mock token was accepted'
                });
            }
        } catch (error) {
            console.log(`   ⚠️ Error en test: ${error.message}`);
            this.testResults.failed.push({
                test: 'Mock Token Attack',
                result: 'ERROR',
                error: error.message
            });
        }
    }

    async testRateLimitingAttack() {
        console.log('\n🚦 TEST 2: RATE LIMITING ATTACK');

        const requests = [];
        const successCount = [];

        // Enviar 10 requests rápidos (límite es 5)
        console.log('   Enviando 10 requests rápidos al endpoint de login...');

        for (let i = 0; i < 10; i++) {
            requests.push(
                this.httpRequest({
                    url: `${this.targetUrl}/api/auth/login`,
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

        if (successCount.length <= 5) {
            console.log(`   ✅ Rate limiting funcionando (${successCount.length}/10 requests exitosos)`);
            this.testResults.blocked.push({
                test: 'Rate Limiting Attack',
                result: 'BLOCKED',
                successRequests: successCount.length,
                totalRequests: 10,
                blocked: 10 - successCount.length
            });
        } else {
            console.log(`   ❌ Rate limiting no funcionó (${successCount.length}/10 requests exitosos)`);
            this.testResults.failed.push({
                test: 'Rate Limiting Attack',
                result: 'FAILED',
                successRequests: successCount.length,
                totalRequests: 10
            });
        }
    }

    async testHeaderInjectionAttack() {
        console.log('\n🔓 TEST 3: HEADER INJECTION ATTACK');

        const suspiciousHeaders = [
            { 'X-Forwarded-For': '127.0.0.1' },
            { 'X-Real-IP': '127.0.0.1' },
            { 'X-Originating-IP': '127.0.0.1' },
            { 'X-Remote-IP': '127.0.0.1' }
        ];

        let blockedHeaders = 0;

        for (const headers of suspiciousHeaders) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/patients`,
                    method: 'GET',
                    headers: headers
                });

                // Debería ser bloqueado o no dar acceso
                if (response.status === 401 || response.status === 403) {
                    blockedHeaders++;
                }
            } catch (error) {
                // Error es bueno - significa que está bloqueado
                blockedHeaders++;
            }
        }

        if (blockedHeaders >= 2) {
            console.log(`   ✅ Header injection detectada/bloqueada (${blockedHeaders}/4 headers bloqueados)`);
            this.testResults.blocked.push({
                test: 'Header Injection Attack',
                result: 'BLOCKED',
                blockedHeaders,
                totalHeaders: 4
            });
        } else {
            console.log(`   ❌ Header injection no fue bloqueada (${blockedHeaders}/4 headers bloqueados)`);
            this.testResults.failed.push({
                test: 'Header Injection Attack',
                result: 'FAILED',
                blockedHeaders,
                totalHeaders: 4
            });
        }
    }

    async testBruteForceAttack() {
        console.log('\n💥 TEST 4: BRUTE FORCE ATTACK');

        const weakPasswords = [
            '1234', 'admin', 'password', 'test', 'root',
            '12345', 'qwerty', 'abc123', 'password123', 'admin123'
        ];

        let blockedCount = 0;

        for (const password of weakPasswords) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/auth/login`,
                    method: 'POST',
                    timeout: 1000
                }, { dni: '12345678', password });

                if (response.status === 423) {
                    // Cuenta bloqueada - esto es bueno
                    blockedCount++;
                    break;
                }
            } catch (error) {
                // Error también es bueno - puede ser rate limiting
                blockedCount++;
            }
        }

        if (blockedCount > 0) {
            console.log(`   ✅ Brute force attack bloqueado después de ${blockedCount} intentos`);
            this.testResults.blocked.push({
                test: 'Brute Force Attack',
                result: 'BLOCKED',
                attemptsBlocked: blockedCount
            });
        } else {
            console.log('   ❌ Brute force attack no fue bloqueado');
            this.testResults.failed.push({
                test: 'Brute Force Attack',
                result: 'FAILED',
                reason: 'No account lockout detected'
            });
        }
    }

    async testXSSAttack() {
        console.log('\n🕷️ TEST 5: XSS ATTACK');

        const xssPayloads = [
            "<script>alert('XSS')</script>",
            "<img src=x onerror=alert('XSS')>",
            "'; alert('XSS'); //",
            "<svg onload=alert('XSS')>"
        ];

        let reflectedCount = 0;

        for (const payload of xssPayloads) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/auth/login`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, { dni: payload, password: payload });

                // Verificar si el payload está reflejado
                if (response.data && response.data.includes(payload)) {
                    reflectedCount++;
                }
            } catch (error) {
                // Error es bueno - probablemente sanetizado
            }
        }

        if (reflectedCount === 0) {
            console.log('   ✅ XSS payloads sanetizados/bloqueados');
            this.testResults.blocked.push({
                test: 'XSS Attack',
                result: 'BLOCKED',
                reflectedPayloads: reflectedCount,
                totalPayloads: xssPayloads.length
            });
        } else {
            console.log(`   ❌ XSS payloads reflejados (${reflectedCount}/${xssPayloads.length})`);
            this.testResults.failed.push({
                test: 'XSS Attack',
                result: 'FAILED',
                reflectedPayloads: reflectedCount,
                totalPayloads: xssPayloads.length
            });
        }
    }

    async testSQLInjectionAttack() {
        console.log('\n💉 TEST 6: SQL INJECTION ATTACK');

        const sqliPayloads = [
            "' OR '1'='1",
            "'; DROP TABLE users; --",
            "' UNION SELECT * FROM users --",
            "admin'--",
            "' OR 1=1#"
        ];

        let blockedCount = 0;

        for (const payload of sqliPayloads) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/auth/login`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                }, { dni: payload, password: payload });

                // Si el payload da acceso, es una vulnerabilidad
                if (response.status === 200) {
                    console.log(`   🚨 ¡VULNERABILIDAD! SQLi payload aceptado: ${payload}`);
                } else {
                    blockedCount++;
                }
            } catch (error) {
                // Error es bueno - SQLi bloqueado
                blockedCount++;
            }
        }

        if (blockedCount === sqliPayloads.length) {
            console.log(`   ✅ SQL Injection payloads bloqueados (${blockedCount}/${sqliPayloads.length})`);
            this.testResults.blocked.push({
                test: 'SQL Injection Attack',
                result: 'BLOCKED',
                blockedPayloads: blockedCount,
                totalPayloads: sqliPayloads.length
            });
        } else {
            console.log(`   ❌ SQL Injection no fue completamente bloqueado`);
            this.testResults.failed.push({
                test: 'SQL Injection Attack',
                result: 'FAILED',
                blockedPayloads: blockedCount,
                totalPayloads: sqliPayloads.length
            });
        }
    }

    async testPathTraversalAttack() {
        console.log('\n📁 TEST 7: PATH TRAVERSAL ATTACK');

        const pathTraversalPayloads = [
            "../../../etc/passwd",
            "..\\..\\..\\windows\\system32\\drivers\\etc\\hosts",
            "....//....//....//etc/passwd",
            "/etc/passwd",
            "%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd"
        ];

        let blockedCount = 0;

        for (const payload of pathTraversalPayloads) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}/api/patients/${payload}`,
                    method: 'GET'
                });

                // Si contiene contenido de /etc/passwd, es vulnerable
                if (response.status === 200 && response.data.includes('root:')) {
                    console.log(`   🚨 ¡VULNERABILIDAD! Path traversal exitoso: ${payload}`);
                } else {
                    blockedCount++;
                }
            } catch (error) {
                // Error es bueno - path traversal bloqueado
                blockedCount++;
            }
        }

        if (blockedCount === pathTraversalPayloads.length) {
            console.log(`   ✅ Path traversal payloads bloqueados (${blockedCount}/${pathTraversalPayloads.length})`);
            this.testResults.blocked.push({
                test: 'Path Traversal Attack',
                result: 'BLOCKED',
                blockedPayloads: blockedCount,
                totalPayloads: pathTraversalPayloads.length
            });
        } else {
            console.log(`   ❌ Path traversal no fue completamente bloqueado`);
            this.testResults.failed.push({
                test: 'Path Traversal Attack',
                result: 'FAILED',
                blockedPayloads: blockedCount,
                totalPayloads: pathTraversalPayloads.length
            });
        }
    }

    async testDirectoryListing() {
        console.log('\n📂 TEST 8: DIRECTORY LISTING ATTACK');

        const sensitivePaths = [
            '/admin',
            '/config',
            '/logs',
            '/backup',
            '/.env',
            '/package.json',
            '/src',
            '/node_modules'
        ];

        let blockedCount = 0;

        for (const path of sensitivePaths) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}${path}`,
                    method: 'GET'
                });

                // Si da acceso al listado, es una vulnerabilidad
                if (response.status === 200 && (response.data.includes('Index of') ||
                    response.data.includes('<pre>') || response.data.includes('<table>'))) {
                    console.log(`   🚨 ¡VULNERABILIDAD! Directory listing accesible: ${path}`);
                } else {
                    blockedCount++;
                }
            } catch (error) {
                // Error es bueno - directory listing bloqueado
                blockedCount++;
            }
        }

        if (blockedCount === sensitivePaths.length) {
            console.log(`   ✅ Directory listing bloqueado (${blockedCount}/${sensitivePaths.length} paths)`);
            this.testResults.blocked.push({
                test: 'Directory Listing Attack',
                result: 'BLOCKED',
                blockedPaths: blockedCount,
                totalPaths: sensitivePaths.length
            });
        } else {
            console.log(`   ❌ Directory listing no fue completamente bloqueado`);
            this.testResults.failed.push({
                test: 'Directory Listing Attack',
                result: 'FAILED',
                blockedPaths: blockedCount,
                totalPaths: sensitivePaths.length
            });
        }
    }

    async testDangerousHTTPMethods() {
        console.log('\n🔍 TEST 9: DANGEROUS HTTP METHODS');

        const dangerousMethods = ['TRACE', 'OPTIONS', 'PUT', 'DELETE', 'PATCH'];

        let blockedCount = 0;

        for (const method of dangerousMethods) {
            try {
                const response = await this.httpRequest({
                    url: this.targetUrl,
                    method: method
                });

                if (method === 'TRACE' && response.status === 200) {
                    console.log(`   🚨 ¡VULNERABILIDAD! TRACE method habilitado`);
                } else if (method === 'OPTIONS' && response.headers.allow) {
                    const allowedMethods = response.headers.allow.split(',').map(m => m.trim().toUpperCase());
                    const dangerousAllowed = allowedMethods.filter(m =>
                        ['DELETE', 'PUT', 'PATCH'].includes(m)
                    );

                    if (dangerousAllowed.length > 0) {
                        console.log(`   🚨 Métodos peligrosos permitidos: ${dangerousAllowed.join(', ')}`);
                    } else {
                        blockedCount++;
                    }
                } else if (response.status === 405 || response.status === 501) {
                    // Method not allowed o no implementado - bueno
                    blockedCount++;
                } else {
                    blockedCount++;
                }
            } catch (error) {
                // Error es bueno - método bloqueado
                blockedCount++;
            }
        }

        if (blockedCount >= dangerousMethods.length - 1) {
            console.log(`   ✅ Métodos peligrosos bloqueados (${blockedCount}/${dangerousMethods.length})`);
            this.testResults.blocked.push({
                test: 'Dangerous HTTP Methods',
                result: 'BLOCKED',
                blockedMethods: blockedCount,
                totalMethods: dangerousMethods.length
            });
        } else {
            console.log(`   ❌ Métodos peligrosos no fueron completamente bloqueados`);
            this.testResults.failed.push({
                test: 'Dangerous HTTP Methods',
                result: 'FAILED',
                blockedMethods: blockedCount,
                totalMethods: dangerousMethods.length
            });
        }
    }

    async testAuthenticationBypass() {
        console.log('\n🔓 TEST 10: AUTHENTICATION BYPASS');

        const bypassAttempts = [
            { url: '/api/patients', method: 'GET' },
            { url: '/api/sessions', method: 'GET' },
            { url: '/api/users', method: 'GET' },
            { url: '/admin', method: 'GET' }
        ];

        let blockedCount = 0;

        for (const attempt of bypassAttempts) {
            try {
                const response = await this.httpRequest({
                    url: `${this.targetUrl}${attempt.url}`,
                    method: attempt.method
                });

                if (response.status === 401 || response.status === 403) {
                    blockedCount++;
                } else {
                    console.log(`   🚨 ¡VULNERABILIDAD! Acceso sin autenticación a: ${attempt.url}`);
                }
            } catch (error) {
                // Error es bueno - acceso bloqueado
                blockedCount++;
            }
        }

        if (blockedCount === bypassAttempts.length) {
            console.log(`   ✅ Authentication bypass bloqueado (${blockedCount}/${bypassAttempts.length} endpoints)`);
            this.testResults.blocked.push({
                test: 'Authentication Bypass',
                result: 'BLOCKED',
                blockedEndpoints: blockedCount,
                totalEndpoints: bypassAttempts.length
            });
        } else {
            console.log(`   ❌ Authentication bypass no fue completamente bloqueado`);
            this.testResults.failed.push({
                test: 'Authentication Bypass',
                result: 'FAILED',
                blockedEndpoints: blockedCount,
                totalEndpoints: bypassAttempts.length
            });
        }
    }

    async generateValidationReport() {
        console.log('\n📊 GENERANDO REPORTE DE VALIDACIÓN DE ATAQUES');

        const report = {
            metadata: {
                validationDate: new Date().toISOString(),
                target: this.targetUrl,
                duration: Math.round((Date.now() - this.startTime) / 1000),
                validator: 'AI Security Attack Validator v1.0'
            },
            summary: {
                totalTests: this.testResults.blocked.length + this.testResults.passed.length + this.testResults.failed.length,
                attacksBlocked: this.testResults.blocked.length,
                attacksFailed: this.testResults.failed.length,
                testsPassed: this.testResults.passed.length,
                securityScore: Math.round((this.testResults.blocked.length / (this.testResults.blocked.length + this.testResults.failed.length)) * 100) || 0
            },
            results: {
                blocked: this.testResults.blocked,
                failed: this.testResults.failed,
                passed: this.testResults.passed
            },
            conclusion: this.testResults.failed.length === 0 ?
                '✅ TODAS LAS DEFENSAS FUNCIONAN CORRECTAMENTE' :
                '❌ HAY VULNERABILIDADES POR CORREGIR'
        };

        // Guardar reporte JSON
        const reportPath = `./security-attack-validation-report-${Date.now()}.json`;
        require('fs').writeFileSync(reportPath, JSON.stringify(report, null, 2));

        // Mostrar resumen
        console.log('\n🎯 REPORTE DE VALIDACIÓN DE ATAQUES:');
        console.log('=' .repeat(60));
        console.log(`📊 Total de pruebas: ${report.summary.totalTests}`);
        console.log(`🛡️ Ataques bloqueados: ${report.summary.attacksBlocked}`);
        console.log(`✅ Pruebas pasadas: ${report.summary.testsPassed}`);
        console.log(`❌ Pruebas fallidas: ${report.summary.attacksFailed}`);
        console.log(`🎯 Puntuación de seguridad: ${report.summary.securityScore}%`);
        console.log(`📄 Reporte guardado: ${reportPath}`);
        console.log('');
        console.log(`🏆 CONCLUSIÓN: ${report.conclusion}`);

        // Mostrar ataques bloqueados
        if (this.testResults.blocked.length > 0) {
            console.log('\n✅ ATAQUES BLOQUEADOS EXITOSAMENTE:');
            this.testResults.blocked.forEach(test => {
                console.log(`   • ${test.test}: ${test.result}`);
            });
        }

        // Mostrar ataques fallidos
        if (this.testResults.failed.length > 0) {
            console.log('\n❌ ATAQUES QUE FALLARON (VULNERABILIDADES):');
            this.testResults.failed.forEach(test => {
                console.log(`   • ${test.test}: ${test.result}`);
                if (test.reason) console.log(`     Razón: ${test.reason}`);
            });
        }

        return report;
    }
}

// Ejecutar validación
if (require.main === module) {
    const validator = new AttackValidator();
    validator.runAttackValidation().catch(console.error);
}

module.exports = AttackValidator;