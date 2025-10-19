const request = require('supertest');
const express = require('express');
const authController = require('../../controllers/authController');
const authService = require('../../services/authService');
const { mockRequest, mockResponse } = require('../utils/mocks');

// Mock del authService with all required methods
jest.mock('../../src/services/authService', () => ({
    findUserByEmail: jest.fn(),
    validatePassword: jest.fn(),
    updateLoginSuccess: jest.fn(),
    updateLoginFailure: jest.fn(),
    createUser: jest.fn(),
    generateTokens: jest.fn(),
    findSessionByToken: jest.fn(),
    revokeSession: jest.fn(),
    refreshTokens: jest.fn(),
    findUserById: jest.fn(),
    updatePassword: jest.fn(),
    createPasswordResetToken: jest.fn(),
    resetPassword: jest.fn(),
    verifyToken: jest.fn()
}));
jest.mock('../../src/utils/logger');

describe('AuthController', () => {
    let app;
    let mockReq, mockRes;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Setup básico de rutas para testing
        app.post('/auth/register', authController.register);
        app.post('/auth/login', authController.login);
        app.post('/auth/logout', authController.logout);
        app.post('/auth/refresh', authController.refreshToken);
        app.get('/auth/profile', authController.getProfile);
        app.put('/auth/profile', authController.updateProfile);
        app.post('/auth/change-password', authController.changePassword);

        // Mock objects
        mockReq = {
            body: {},
            user: { id: 'user-123', email: 'test@example.com' },
            headers: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
            clearCookie: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
    });

    describe('POST /auth/register', () => {
        test('should register user successfully', async () => {
            const userData = {
                email: 'new@example.com',
                password: 'securePassword123!',
                name: 'Test User'
            };

            authService.register.mockResolvedValue({
                user: { id: 'user-123', email: userData.email, name: userData.name },
                token: 'jwt-token',
                refreshToken: 'refresh-token'
            });

            const response = await request(app)
                .post('/auth/register')
                .send(userData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe(userData.email);
            expect(response.body.token).toBe('jwt-token');
            expect(authService.register).toHaveBeenCalledWith(userData);
        });

        test('should handle registration validation errors', async () => {
            const invalidData = {
                email: 'invalid-email',
                password: '123' // Too short
            };

            authService.register.mockRejectedValue(new Error('Invalid email format'));

            const response = await request(app)
                .post('/auth/register')
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid email format');
        });

        test('should handle duplicate email error', async () => {
            const userData = {
                email: 'existing@example.com',
                password: 'securePassword123!',
                name: 'Test User'
            };

            authService.register.mockRejectedValue(new Error('Email already exists'));

            const response = await request(app)
                .post('/auth/register')
                .send(userData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Email already exists');
        });

        test('should handle missing required fields', async () => {
            const response = await request(app)
                .post('/auth/register')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /auth/login', () => {
        test('should login user successfully', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'correctPassword'
            };

            authService.login.mockResolvedValue({
                user: { id: 'user-123', email: credentials.email },
                token: 'jwt-token',
                refreshToken: 'refresh-token'
            });

            const response = await request(app)
                .post('/auth/login')
                .send(credentials)
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.user.email).toBe(credentials.email);
            expect(response.body.token).toBe('jwt-token');
            expect(authService.login).toHaveBeenCalledWith(credentials.email, credentials.password);
        });

        test('should handle invalid credentials', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'wrongPassword'
            };

            authService.login.mockRejectedValue(new Error('Invalid credentials'));

            const response = await request(app)
                .post('/auth/login')
                .send(credentials)
                .expect(401);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Invalid credentials');
        });

        test('should handle account locked error', async () => {
            const credentials = {
                email: 'locked@example.com',
                password: 'password123'
            };

            authService.login.mockRejectedValue(new Error('Account temporarily locked'));

            const response = await request(app)
                .post('/auth/login')
                .send(credentials)
                .expect(423);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Account temporarily locked');
        });

        test('should handle missing credentials', async () => {
            const response = await request(app)
                .post('/auth/login')
                .send({})
                .expect(400);

            expect(response.body.success).toBe(false);
        });
    });

    describe('POST /auth/logout', () => {
        test('should logout user successfully', async () => {
            authService.logout.mockResolvedValue({ success: true });

            mockReq.body = { refreshToken: 'valid-refresh-token' };

            await authController.logout(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ success: true });
            expect(mockRes.clearCookie).toHaveBeenCalledWith('token');
            expect(authService.logout).toHaveBeenCalledWith('valid-refresh-token');
        });

        test('should handle logout without refresh token', async () => {
            mockReq.body = {};

            await authController.logout(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({ success: true });
            expect(mockRes.clearCookie).toHaveBeenCalledWith('token');
        });
    });

    describe('POST /auth/refresh', () => {
        test('should refresh token successfully', async () => {
            authService.refreshToken.mockResolvedValue({
                token: 'new-jwt-token',
                refreshToken: 'new-refresh-token'
            });

            mockReq.body = { refreshToken: 'valid-refresh-token' };

            await authController.refreshToken(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                token: 'new-jwt-token',
                refreshToken: 'new-refresh-token'
            });
            expect(authService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
        });

        test('should handle invalid refresh token', async () => {
            authService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

            mockReq.body = { refreshToken: 'invalid-token' };

            await authController.refreshToken(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid refresh token'
            });
        });

        test('should handle missing refresh token', async () => {
            mockReq.body = {};

            await authController.refreshToken(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Refresh token required'
            });
        });
    });

    describe('GET /auth/profile', () => {
        test('should get user profile successfully', async () => {
            const userProfile = {
                id: 'user-123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'therapist'
            };

            authService.getProfile.mockResolvedValue(userProfile);

            await authController.getProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                user: userProfile
            });
            expect(authService.getProfile).toHaveBeenCalledWith('user-123');
        });

        test('should handle profile not found', async () => {
            authService.getProfile.mockRejectedValue(new Error('Profile not found'));

            await authController.getProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Profile not found'
            });
        });
    });

    describe('PUT /auth/profile', () => {
        test('should update profile successfully', async () => {
            const updateData = {
                name: 'Updated Name',
                phone: '+1234567890'
            };

            const updatedProfile = {
                id: 'user-123',
                email: 'test@example.com',
                ...updateData
            };

            authService.updateProfile.mockResolvedValue(updatedProfile);

            mockReq.body = updateData;

            await authController.updateProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                user: updatedProfile
            });
            expect(authService.updateProfile).toHaveBeenCalledWith('user-123', updateData);
        });

        test('should handle validation errors on update', async () => {
            const invalidData = {
                email: 'invalid-email-format'
            };

            authService.updateProfile.mockRejectedValue(new Error('Invalid email format'));

            mockReq.body = invalidData;

            await authController.updateProfile(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid email format'
            });
        });
    });

    describe('POST /auth/change-password', () => {
        test('should change password successfully', async () => {
            const passwordData = {
                currentPassword: 'oldPassword123',
                newPassword: 'newSecurePassword456!'
            };

            authService.changePassword.mockResolvedValue({ success: true });

            mockReq.body = passwordData;

            await authController.changePassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Password changed successfully'
            });
            expect(authService.changePassword).toHaveBeenCalledWith(
                'user-123',
                passwordData.currentPassword,
                passwordData.newPassword
            );
        });

        test('should handle incorrect current password', async () => {
            const passwordData = {
                currentPassword: 'wrongPassword',
                newPassword: 'newSecurePassword456!'
            };

            authService.changePassword.mockRejectedValue(new Error('Current password is incorrect'));

            mockReq.body = passwordData;

            await authController.changePassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Current password is incorrect'
            });
        });

        test('should handle weak new password', async () => {
            const passwordData = {
                currentPassword: 'oldPassword123',
                newPassword: '123' // Too weak
            };

            authService.changePassword.mockRejectedValue(new Error('Password too weak'));

            mockReq.body = passwordData;

            await authController.changePassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Password too weak'
            });
        });

        test('should handle missing password fields', async () => {
            mockReq.body = { currentPassword: 'oldPassword123' }; // Missing newPassword

            await authController.changePassword(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Current password and new password are required'
            });
        });
    });

    describe('Error handling', () => {
        test('should handle unexpected errors gracefully', async () => {
            authService.login.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com', password: 'password' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Internal server error');
        });

        test('should not expose sensitive error details', async () => {
            authService.register.mockRejectedValue(new Error('SENSITIVE_DB_ERROR: Connection string exposed'));

            const response = await request(app)
                .post('/auth/register')
                .send({ email: 'test@example.com', password: 'password', name: 'Test' })
                .expect(500);

            expect(response.body.error).toBe('Internal server error');
            expect(response.body.error).not.toContain('SENSITIVE_DB_ERROR');
        });
    });

    describe('Rate limiting behavior', () => {
        test('should handle rate limiting gracefully', async () => {
            authService.login.mockRejectedValue(new Error('Too many requests'));

            const response = await request(app)
                .post('/auth/login')
                .send({ email: 'test@example.com', password: 'password' })
                .expect(429);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Too many requests');
        });
    });

    describe('Input sanitization', () => {
        test('should handle malicious input safely', async () => {
            const maliciousData = {
                email: '<script>alert("xss")</script>@example.com',
                password: 'password',
                name: '<img src=x onerror=alert("xss")>'
            };

            authService.register.mockResolvedValue({
                user: { id: 'user-123', email: 'safe@example.com', name: 'Safe Name' },
                token: 'jwt-token'
            });

            const response = await request(app)
                .post('/auth/register')
                .send(maliciousData)
                .expect(201);

            // Verificar que no se devuelven scripts
            expect(response.body.user.email).not.toContain('<script>');
            expect(response.body.user.name).not.toContain('<img');
        });
    });
}); 

describe('Auth Controller - Login Scenarios', () => {
    beforeEach(() => {
        authService.login.mockClear();
    });

    test('should return 200 and tokens on successful login', async () => {
        const req = mockRequest({ body: { email: 'test@example.com', password: 'password123' } });
        const res = mockResponse();
        const tokens = { accessToken: 'mockAccessToken', refreshToken: 'mockRefreshToken' };
        authService.login.mockResolvedValue(tokens);

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(tokens);
    });

    test('should return 401 on failed login due to invalid credentials', async () => {
        const req = mockRequest({ body: { email: 'test@example.com', password: 'wrongpassword' } });
        const res = mockResponse();
        const error = new Error('Invalid credentials');
        error.statusCode = 401;
        authService.login.mockRejectedValue(error);

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(401);
        expect(res.json).toHaveBeenCalledWith({ message: 'Invalid credentials' });
    });

    test('should return 400 on login with missing email', async () => {
        const req = mockRequest({ body: { password: 'password123' } });
        const res = mockResponse();
        
        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: 'Email and password are required' });
    });

    test('should return 500 on unexpected server error', async () => {
        const req = mockRequest({ body: { email: 'test@example.com', password: 'password123' } });
        const res = mockResponse();
        authService.login.mockRejectedValue(new Error('Unexpected server error'));

        await authController.login(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: 'Internal Server Error' });
    });
}); 