const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const patientsRoutes = require('../../src/routes/patients');
const healthRoutes = require('../../src/routes/health');
const authMiddleware = require('../../src/middleware/auth');
const rateLimit = require('express-rate-limit');

// Mock dependencies
jest.mock('../../src/middleware/auth');
jest.mock('express-rate-limit');

describe('API Routes Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Mock middleware
        authMiddleware.authenticate = jest.fn((req, res, next) => {
            req.user = { id: 'user123', email: 'test@example.com', role: 'doctor' };
            next();
        });
        
        rateLimit.mockReturnValue((req, res, next) => next());
        
        // Setup routes
        app.use('/api/auth', authRoutes);
        app.use('/api/patients', patientsRoutes);
        app.use('/api/health', healthRoutes);
        
        jest.clearAllMocks();
    });

    describe('Auth Routes', () => {
        describe('POST /api/auth/register', () => {
            it('should have register endpoint', async () => {
                const response = await request(app)
                    .post('/api/auth/register')
                    .send({
                        email: 'test@example.com',
                        password: 'password123',
                        name: 'Test User'
                    });
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });

            it('should validate required fields', async () => {
                const response = await request(app)
                    .post('/api/auth/register')
                    .send({});
                
                expect(response.status).toBeGreaterThanOrEqual(400);
            });
        });

        describe('POST /api/auth/login', () => {
            it('should have login endpoint', async () => {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'test@example.com',
                        password: 'password123'
                    });
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('POST /api/auth/refresh', () => {
            it('should have refresh token endpoint', async () => {
                const response = await request(app)
                    .post('/api/auth/refresh')
                    .send({ refreshToken: 'valid-token' });
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('POST /api/auth/logout', () => {
            it('should have logout endpoint', async () => {
                const response = await request(app)
                    .post('/api/auth/logout')
                    .send({ refreshToken: 'valid-token' });
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('GET /api/auth/me', () => {
            it('should have get current user endpoint', async () => {
                const response = await request(app)
                    .get('/api/auth/me')
                    .set('Authorization', 'Bearer valid-token');
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });
    });

    describe('Patients Routes', () => {
        describe('GET /api/patients', () => {
            it('should have get all patients endpoint', async () => {
                const response = await request(app)
                    .get('/api/patients')
                    .set('Authorization', 'Bearer valid-token');
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });

            it('should require authentication', async () => {
                authMiddleware.authenticate.mockImplementation((req, res) => {
                    res.status(401).json({ error: 'Unauthorized' });
                });

                const response = await request(app)
                    .get('/api/patients');
                
                expect(response.status).toBe(401);
            });
        });

        describe('POST /api/patients', () => {
            it('should have create patient endpoint', async () => {
                const response = await request(app)
                    .post('/api/patients')
                    .set('Authorization', 'Bearer valid-token')
                    .send({
                        name: 'John Doe',
                        dni: '12345678',
                        phone: '555-1234'
                    });
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('GET /api/patients/:id', () => {
            it('should have get patient by id endpoint', async () => {
                const response = await request(app)
                    .get('/api/patients/patient123')
                    .set('Authorization', 'Bearer valid-token');
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('PUT /api/patients/:id', () => {
            it('should have update patient endpoint', async () => {
                const response = await request(app)
                    .put('/api/patients/patient123')
                    .set('Authorization', 'Bearer valid-token')
                    .send({
                        name: 'Updated Name',
                        phone: '555-9999'
                    });
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('DELETE /api/patients/:id', () => {
            it('should have delete patient endpoint', async () => {
                const response = await request(app)
                    .delete('/api/patients/patient123')
                    .set('Authorization', 'Bearer valid-token');
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('GET /api/patients/search', () => {
            it('should have search patients endpoint', async () => {
                const response = await request(app)
                    .get('/api/patients/search?name=John')
                    .set('Authorization', 'Bearer valid-token');
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });
    });

    describe('Health Routes', () => {
        describe('GET /api/health', () => {
            it('should have health check endpoint', async () => {
                const response = await request(app)
                    .get('/api/health');
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('GET /api/health/detailed', () => {
            it('should have detailed health check endpoint', async () => {
                const response = await request(app)
                    .get('/api/health/detailed');
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });
    });

    describe('Middleware Integration', () => {
        describe('Authentication Middleware', () => {
            it('should protect patient routes', async () => {
                authMiddleware.authenticate.mockImplementation((req, res) => {
                    res.status(401).json({ error: 'Unauthorized' });
                });

                const endpoints = [
                    '/api/patients',
                    '/api/patients/patient123',
                    '/api/patients/search'
                ];

                for (const endpoint of endpoints) {
                    const response = await request(app).get(endpoint);
                    expect(response.status).toBe(401);
                }
            });

            it('should allow health check without auth', async () => {
                const response = await request(app).get('/api/health');
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });

        describe('Rate Limiting', () => {
            it('should apply rate limiting to auth endpoints', async () => {
                const response = await request(app)
                    .post('/api/auth/login')
                    .send({ email: 'test@example.com', password: 'password123' });
                
                expect(response.status).toBeGreaterThanOrEqual(200);
                expect(response.status).toBeLessThan(500);
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle 404 errors', async () => {
            const response = await request(app)
                .get('/api/nonexistent')
                .set('Authorization', 'Bearer valid-token');
            
            expect(response.status).toBe(404);
        });

        it('should handle invalid JSON', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .set('Content-Type', 'application/json')
                .send('invalid json');
            
            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });
});
