#!/usr/bin/env node

/**
 * Demo Test - AIRA
 * Demuestra todas las funcionalidades implementadas
 * @version 1.0.0
 */

const axios = require('axios').default;

const BASE_URL = 'http://localhost:8082';

class AiraDemo {
    constructor() {
        this.authToken = null;
        this.results = [];
    }

    async runDemo() {
        console.log('🚀 DEMO COMPLETO DE AIRA - SISTEMA MÉDICO INTELIGENTE\n');
        
        try {
            await this.testHealthChecks();
            await this.testSecurityFeatures();
            await this.testDocumentation();
            await this.testPerformanceFeatures();
            
            this.showResults();
            
        } catch (error) {
            console.error('❌ Error en demo:', error.message);
        }
    }

    async testHealthChecks() {
        console.log('❤️ PROBANDO HEALTH CHECKS Y MONITOREO...');
        
        try {
            // Health check básico
            const health = await axios.get(`${BASE_URL}/api/health`);
            this.logResult('Health Check', health.status === 200, {
                status: health.data.status,
                version: health.data.version
            });

            // Health check detallado
            const detailed = await axios.get(`${BASE_URL}/api/health/detailed`);
            this.logResult('Health Detailed', detailed.status === 200, {
                services: Object.keys(detailed.data.services || {}),
                memory: detailed.data.system?.memory?.usage + '%'
            });

            // Readiness probe
            const ready = await axios.get(`${BASE_URL}/api/ready`);
            this.logResult('Readiness Probe', [200, 503].includes(ready.status), {
                status: ready.data.status
            });

            // Métricas Prometheus
            const metrics = await axios.get(`${BASE_URL}/api/metrics`);
            this.logResult('Prometheus Metrics', metrics.status === 200, {
                hasMetrics: metrics.data.includes('aira_uptime_seconds'),
                format: 'Prometheus'
            });

        } catch (error) {
            this.logResult('Health Checks', false, { error: error.message });
        }
        
        console.log('');
    }

    async testSecurityFeatures() {
        console.log('🔒 PROBANDO CARACTERÍSTICAS DE SEGURIDAD...');
        
        try {
            // Test XSS Protection
            const xssPayload = {
                email: 'test@test.com',
                password: process.env.TEST_PASSWORD || 'TestSecurePass2025!',
                name: '<script>alert("xss")</script>',
                specialty: 'Psiquiatra',
                dni: '12345678'
            };

            try {
                await axios.post(`${BASE_URL}/api/auth/register`, xssPayload);
                this.logResult('XSS Protection', false, { note: 'XSS no fue bloqueado' });
            } catch (error) {
                this.logResult('XSS Protection', error.response?.status === 400, {
                    blocked: true,
                    status: error.response?.status
                });
            }

            // Test NoSQL Injection Protection
            const injectionPayload = {
                email: { $ne: null },
                password: process.env.TEST_PASSWORD || 'TestSecurePass2025!'
            };

            try {
                await axios.post(`${BASE_URL}/api/auth/login`, injectionPayload);
                this.logResult('NoSQL Injection Protection', false, { note: 'Injection no fue bloqueada' });
            } catch (error) {
                this.logResult('NoSQL Injection Protection', error.response?.status === 400, {
                    blocked: true,
                    status: error.response?.status
                });
            }

            // Test Rate Limiting
            console.log('   📊 Probando Rate Limiting...');
            let rateLimitHit = false;
            
            for (let i = 0; i < 25; i++) {
                try {
                    await axios.post(`${BASE_URL}/api/auth/login`, {
                        email: 'test@test.com',
                        password: 'wrongpassword123'
                    });
                } catch (error) {
                    if (error.response?.status === 429) {
                        rateLimitHit = true;
                        break;
                    }
                }
            }
            
            this.logResult('Rate Limiting', rateLimitHit, {
                triggered: rateLimitHit,
                limit: '25 requests'
            });

        } catch (error) {
            this.logResult('Security Features', false, { error: error.message });
        }
        
        console.log('');
    }

    async testDocumentation() {
        console.log('📚 PROBANDO DOCUMENTACIÓN API...');
        
        try {
            // Swagger UI
            const swaggerUI = await axios.get(`${BASE_URL}/api-docs/`);
            this.logResult('Swagger UI', swaggerUI.status === 200, {
                hasSwagger: swaggerUI.data.includes('swagger'),
                interactive: true
            });

            // OpenAPI Spec
            const apiSpec = await axios.get(`${BASE_URL}/api-docs.json`);
            const spec = apiSpec.data;
            this.logResult('OpenAPI Spec', apiSpec.status === 200 && spec.openapi, {
                version: spec.openapi,
                endpoints: Object.keys(spec.paths || {}).length,
                schemas: Object.keys(spec.components?.schemas || {}).length
            });

        } catch (error) {
            this.logResult('Documentation', false, { error: error.message });
        }
        
        console.log('');
    }

    async testPerformanceFeatures() {
        console.log('⚡ PROBANDO CARACTERÍSTICAS DE PERFORMANCE...');
        
        try {
            // Test de tiempo de respuesta
            const start = Date.now();
            await axios.get(`${BASE_URL}/api/health`);
            const responseTime = Date.now() - start;
            
            this.logResult('Response Time', responseTime < 500, {
                time: responseTime + 'ms',
                target: '<500ms'
            });

            // Test de contenido estático
            const cssResponse = await axios.get(`${BASE_URL}/css/styles.css`);
            this.logResult('Static Assets', cssResponse.status === 200, {
                cached: cssResponse.headers['cache-control'] !== undefined,
                size: cssResponse.data.length + ' chars'
            });

            // Test de compresión
            const jsResponse = await axios.get(`${BASE_URL}/js/security-utils.js`);
            this.logResult('JavaScript Assets', jsResponse.status === 200, {
                compressed: jsResponse.headers['content-encoding'] !== undefined,
                size: jsResponse.data.length + ' chars'
            });

        } catch (error) {
            this.logResult('Performance Features', false, { error: error.message });
        }
        
        console.log('');
    }

    logResult(test, success, details = {}) {
        const status = success ? '✅' : '❌';
        const result = { test, success, details };
        this.results.push(result);
        
        console.log(`   ${status} ${test}`);
        if (Object.keys(details).length > 0) {
            console.log(`      ${JSON.stringify(details, null, 0)}`);
        }
    }

    showResults() {
        const total = this.results.length;
        const passed = this.results.filter(r => r.success).length;
        const failed = total - passed;
        
        console.log('=' .repeat(60));
        console.log('📋 RESUMEN DEL DEMO - AIRA');
        console.log('=' .repeat(60));
        console.log(`📊 Tests ejecutados: ${total}`);
        console.log(`✅ Exitosos: ${passed}`);
        console.log(`❌ Fallidos: ${failed}`);
        console.log(`📈 Tasa de éxito: ${Math.round((passed/total)*100)}%`);
        console.log('');
        
        console.log('🎯 FUNCIONALIDADES DEMOSTRADAS:');
        console.log('  🔐 Sistema de seguridad robusto');
        console.log('  ❤️ Health checks y monitoreo');
        console.log('  📚 Documentación API interactiva');
        console.log('  ⚡ Performance optimizada');
        console.log('  🛡️ Protección contra ataques');
        console.log('  📊 Métricas de Prometheus');
        console.log('');
        
        if (passed === total) {
            console.log('🎉 ¡DEMO COMPLETAMENTE EXITOSO!');
            console.log('✨ AIRA está listo para producción');
        } else if (passed >= total * 0.8) {
            console.log('🚀 ¡DEMO MAYORMENTE EXITOSO!');
            console.log('✨ AIRA está casi listo para producción');
        } else {
            console.log('⚠️ Demo con algunos problemas');
            console.log('🔧 Revisar configuración del servidor');
        }
        
        console.log('=' .repeat(60));
    }
}

// Verificar si axios está disponible
const checkDependencies = () => {
    try {
        require('axios');
        return true;
    } catch {
        console.log('📦 Instalando axios para el demo...');
        require('child_process').execSync('npm install axios', { stdio: 'inherit' });
        return true;
    }
};

// Ejecutar demo
if (require.main === module) {
    if (checkDependencies()) {
        const demo = new AiraDemo();
        demo.runDemo().catch(console.error);
    }
}

module.exports = AiraDemo; 