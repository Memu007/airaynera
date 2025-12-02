/**
 * Tests de Integración - API AIRA
 * Pruebas end-to-end de todos los endpoints
 * @version 1.0.0
 */

const request = require('supertest');
const { spawn } = require('child_process');
const path = require('path');

describe('AIRA API Integration Tests', () => {
    let server;
    let serverProcess;
    const baseURL = 'http://localhost:8083'; // Puerto diferente para tests

    beforeAll(async () => {
        // Configurar variables de entorno para testing
        process.env.NODE_ENV = 'test';
        process.env.PORT = '8083';
        process.env.JWT_SECRET = 'test-jwt-secret-integration';
        process.env.SESSION_SECRET = 'test-session-secret';
        process.env.MOCK_MODE = 'true';
        process.env.LOG_LEVEL = 'error';

        // Iniciar el servidor en modo test
        await startTestServer();
    }, 30000);

    afterAll(async () => {
        // Cerrar el servidor
        if (serverProcess) {
            serverProcess.kill('SIGTERM');
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    });

    async function startTestServer() {
        return new Promise((resolve, reject) => {
            const serverPath = path.join(__dirname, '../../server-secure.js');
            serverProcess = spawn('node', [serverPath], {
                env: { ...process.env },
                stdio: 'pipe'
            });

            let started = false;
            const timeout = setTimeout(() => {
                if (!started) {
                    reject(new Error('Server timeout'));
                }
            }, 25000);

            serverProcess.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('Servidor iniciado') || output.includes('listening')) {
                    if (!started) {
                        started = true;
                        clearTimeout(timeout);
                        setTimeout(resolve, 2000); // Esperar un poco más
                    }
                }
            });

            serverProcess.stderr.on('data', (data) => {
                console.error('Server error:', data.toString());
            });

            serverProcess.on('error', (error) => {
                if (!started) {
                    clearTimeout(timeout);
                    reject(error);
                }
            });

            // Fallback: resolver después de 15 segundos
            setTimeout(() => {
                if (!started) {
                    started = true;
                    clearTimeout(timeout);
                    resolve();
                }
            }, 15000);
        });
    }

    // ===== TESTS DE HEALTH CHECK =====
    describe('Health Check Endpoints', () => {
        test('GET /api/health - should return healthy status', async () => {
            const response = await request(baseURL)
                .get('/api/health')
                .expect(200);

            expect(response.body).toHaveProperty('status', 'healthy');
            expect(response.body).toHaveProperty('timestamp');
            expect(response.body).toHaveProperty('uptime');
            expect(response.body).toHaveProperty('version');
        });

        test('GET /api/health/detailed - should return detailed health info', async () => {
            const response = await request(baseURL)
                .get('/api/health/detailed')
                .expect(200);

            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('services');
            expect(response.body).toHaveProperty('system');
            expect(response.body.services).toHaveProperty('database');
        });

        test('GET /api/ready - should return readiness status', async () => {
            const response = await request(baseURL)
                .get('/api/ready');

            expect([200, 503]).toContain(response.status);
            expect(response.body).toHaveProperty('status');
            expect(response.body).toHaveProperty('checks');
        });

        test('GET /api/metrics - should return Prometheus metrics', async () => {
            const response = await request(baseURL)
                .get('/api/metrics')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/text\/plain/);
            expect(response.text).toMatch(/aira_uptime_seconds/);
            expect(response.text).toMatch(/aira_memory_usage_bytes/);
        });
    });

    // ===== TESTS DE AUTENTICACIÓN =====
    describe('Authentication Endpoints', () => {
        const testUser = {
            email: 'test@aira.com',
            password: 'TestPassword123!',
            name: 'Dr. Test Usuario',
            specialty: 'Psiquiatra',
            dni: '12345678'
        };

        let authToken = '';

        test('POST /api/auth/register - should register new user', async () => {
            const response = await request(baseURL)
                .post('/api/auth/register')
                .send(testUser)
                .expect(201);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', testUser.email);
        });

        test('POST /api/auth/login - should login successfully', async () => {
            const response = await request(baseURL)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: testUser.password
                })
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('refreshToken');
            
            authToken = response.body.token;
        });

        test('POST /api/auth/login - should reject invalid credentials', async () => {
            await request(baseURL)
                .post('/api/auth/login')
                .send({
                    email: testUser.email,
                    password: 'wrong-password'
                })
                .expect(401);
        });

        test('GET /api/auth/profile - should get user profile', async () => {
            const response = await request(baseURL)
                .get('/api/auth/profile')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(response.body).toHaveProperty('success', true);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user).toHaveProperty('email', testUser.email);
        });

        test('POST /api/auth/logout - should logout successfully', async () => {
            await request(baseURL)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);
        });
    });

    // ===== TESTS DE SEGURIDAD =====
    describe('Security Tests', () => {
        test('Should reject requests without auth token', async () => {
            await request(baseURL)
                .get('/api/auth/profile')
                .expect(401);
        });

        test('Should reject malformed JSON', async () => {
            await request(baseURL)
                .post('/api/auth/login')
                .send('invalid-json')
                .set('Content-Type', 'application/json')
                .expect(400);
        });

        test('Should handle XSS attempts', async () => {
            await request(baseURL)
                .post('/api/auth/register')
                .send({
                    email: 'test@test.com',
                    password: 'Password123!',
                    name: '<script>alert("xss")</script>',
                    specialty: 'Psiquiatra',
                    dni: '87654321'
                })
                .expect(400); // Should be blocked by validation
        });

        test('Should handle NoSQL injection attempts', async () => {
            await request(baseURL)
                .post('/api/auth/login')
                .send({
                    email: { $ne: null },
                    password: 'any-password'
                })
                .expect(400); // Should be blocked by security middleware
        });

        test('Should enforce rate limiting', async () => {
            const promises = [];
            // Hacer muchas requests rápidamente
            for (let i = 0; i < 25; i++) {
                promises.push(
                    request(baseURL)
                        .post('/api/auth/login')
                        .send({
                            email: 'test@test.com',
                            password: 'wrong'
                        })
                );
            }

            const responses = await Promise.all(promises);
            const rateLimited = responses.some(res => res.status === 429);
            expect(rateLimited).toBe(true);
        }, 15000);
    });

    // ===== TESTS DE DOCUMENTACIÓN =====
    describe('Documentation', () => {
        test('GET /api-docs - should serve Swagger documentation', async () => {
            const response = await request(baseURL)
                .get('/api-docs/')
                .expect(200);

            expect(response.text).toMatch(/swagger/i);
        });

        test('GET /api-docs.json - should return OpenAPI spec', async () => {
            const response = await request(baseURL)
                .get('/api-docs.json')
                .expect(200);

            expect(response.body).toHaveProperty('openapi');
            expect(response.body).toHaveProperty('info');
            expect(response.body).toHaveProperty('paths');
        });
    });

    // ===== TESTS DE PERFORMANCE =====
    describe('Performance Tests', () => {
        test('Health check should respond quickly', async () => {
            const start = Date.now();
            
            await request(baseURL)
                .get('/api/health')
                .expect(200);
            
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(500); // Menos de 500ms
        });

        test('Should handle concurrent requests', async () => {
            const promises = [];
            for (let i = 0; i < 10; i++) {
                promises.push(
                    request(baseURL)
                        .get('/api/health')
                        .expect(200)
                );
            }

            const responses = await Promise.all(promises);
            expect(responses).toHaveLength(10);
            responses.forEach(res => {
                expect(res.body).toHaveProperty('status', 'healthy');
            });
        });
    });

    // ===== TESTS DE ENDPOINTS ESTÁTICOS =====
    describe('Static Content', () => {
        test('GET / - should serve main page', async () => {
            const response = await request(baseURL)
                .get('/')
                .expect(200);

            expect(response.headers['content-type']).toMatch(/text\/html/);
            expect(response.text).toMatch(/AIRA/i);
        });

        test('Should serve CSS files', async () => {
            await request(baseURL)
                .get('/css/styles.css')
                .expect(200);
        });

        test('Should serve JS files', async () => {
            await request(baseURL)
                .get('/js/security-utils.js')
                .expect(200);
        });
    });

    // ===== TESTS DE ERROR HANDLING =====
    describe('Error Handling', () => {
        test('Should return 404 for non-existent routes', async () => {
            await request(baseURL)
                .get('/api/non-existent-route')
                .expect(404);
        });

        test('Should handle internal errors gracefully', async () => {
            // Simular un error interno enviando datos malformados
            await request(baseURL)
                .post('/api/auth/login')
                .send({
                    email: 'a'.repeat(1000), // Email muy largo
                    password: 'test'
                })
                .expect(400);
        });
    });
}); 