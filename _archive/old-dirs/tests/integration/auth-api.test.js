const request = require('supertest');
const express = require('express');
const authRoutes = require('../../src/routes/auth');
const authController = require('../../src/controllers/authController');

// Mock dependencies
jest.mock('../../src/controllers/authController');

describe('Auth API Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/auth', authRoutes);
        
        // Reset mocks
        jest.clearAllMocks();
    });

    describe('POST /api/auth/register', () => {
        it('should register a new user successfully', async () => {
            const newUser = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
                role: 'doctor'
            };

            authController.register.mockImplementation((req, res) => {
                res.status(201).json({
                    id: 'user123',
                    email: newUser.email,
                    name: newUser.name,
                    role: newUser.role
                });
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send(newUser)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.email).toBe('test@example.com');
            expect(response.body.password).toBeUndefined();
        });

        it('should validate required fields', async () => {
            authController.register.mockImplementation((req, res) => {
                res.status(400).json({ error: 'Email, password and name are required' });
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send({})
                .expect(400);

            expect(response.body).toEqual({ error: 'Email, password and name are required' });
        });

        it('should handle duplicate email', async () => {
            authController.register.mockImplementation((req, res) => {
                res.status(409).json({ error: 'User already exists' });
            });

            const response = await request(app)
                .post('/api/auth/register')
                .send({ email: 'existing@example.com', password: 'pass', name: 'Test' })
                .expect(409);

            expect(response.body).toEqual({ error: 'User already exists' });
        });
    });

    describe('POST /api/auth/login', () => {
        it('should login user successfully', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'password123'
            };

            authController.login.mockImplementation((req, res) => {
                res.json({
                    success: true,
                    token: 'jwt-token',
                    refreshToken: 'refresh-token',
                    user: {
                        id: 'user123',
                        email: credentials.email,
                        name: 'Test User'
                    }
                });
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send(credentials)
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body).toHaveProperty('refreshToken');
            expect(response.body.user.email).toBe('test@example.com');
        });

        it('should handle invalid credentials', async () => {
            authController.login.mockImplementation((req, res) => {
                res.status(401).json({ error: 'Invalid credentials' });
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({ email: 'test@example.com', password: 'wrong' })
                .expect(401);

            expect(response.body).toEqual({ error: 'Invalid credentials' });
        });

        it('should handle missing credentials', async () => {
            authController.login.mockImplementation((req, res) => {
                res.status(400).json({ error: 'Email and password are required' });
            });

            const response = await request(app)
                .post('/api/auth/login')
                .send({})
                .expect(400);

            expect(response.body).toEqual({ error: 'Email and password are required' });
        });
    });

    describe('POST /api/auth/refresh', () => {
        it('should refresh token successfully', async () => {
            authController.refreshToken.mockImplementation((req, res) => {
                res.json({
                    success: true,
                    token: 'new-jwt-token',
                    user: {
                        id: 'user123',
                        email: 'test@example.com'
                    }
                });
            });

            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'valid-refresh-token' })
                .expect(200);

            expect(response.body).toHaveProperty('token');
            expect(response.body.success).toBe(true);
        });

        it('should handle invalid refresh token', async () => {
            authController.refreshToken.mockImplementation((req, res) => {
                res.status(401).json({ error: 'Invalid or expired refresh token' });
            });

            const response = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken: 'invalid-token' })
                .expect(401);

            expect(response.body).toEqual({ error: 'Invalid or expired refresh token' });
        });
    });

    describe('POST /api/auth/logout', () => {
        it('should logout successfully', async () => {
            authController.logout.mockImplementation((req, res) => {
                res.json({ success: true });
            });

            const response = await request(app)
                .post('/api/auth/logout')
                .send({ refreshToken: 'valid-token' })
                .expect(200);

            expect(response.body).toEqual({ success: true });
        });

        it('should handle logout without token', async () => {
            authController.logout.mockImplementation((req, res) => {
                res.json({ success: true });
            });

            const response = await request(app)
                .post('/api/auth/logout')
                .send({})
                .expect(200);

            expect(response.body).toEqual({ success: true });
        });
    });

    describe('GET /api/auth/me', () => {
        it('should return current user profile', async () => {
            authController.getCurrentUser.mockImplementation((req, res) => {
                res.json({
                    id: 'user123',
                    email: 'test@example.com',
                    name: 'Test User',
                    role: 'doctor'
                });
            });

            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body).toHaveProperty('id');
            expect(response.body.email).toBe('test@example.com');
        });

        it('should handle unauthorized access', async () => {
            authController.getCurrentUser.mockImplementation((req, res) => {
                res.status(401).json({ error: 'Unauthorized' });
            });

            const response = await request(app)
                .get('/api/auth/me')
                .expect(401);

            expect(response.body).toEqual({ error: 'Unauthorized' });
        });
    });
});
