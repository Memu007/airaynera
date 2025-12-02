const authController = require('../../src/controllers/authController');
const authService = require('../../src/services/authService');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../src/services/authService');
jest.mock('express-validator');

describe('AuthController', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            query: {},
            user: { id: 'user123' },
            ip: '192.168.1.1',
            headers: { 'user-agent': 'test-agent' }
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn(),
            cookie: jest.fn()
        };
        
        // Reset mocks
        jest.clearAllMocks();
    });

    describe('register', () => {
        it('should register user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
                role: 'doctor'
            };

            req.body = userData;
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.register.mockResolvedValue({
                id: 'user123',
                email: userData.email,
                name: userData.name,
                role: userData.role
            });

            await authController.register(req, res);

            expect(authService.register).toHaveBeenCalledWith(userData);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                id: 'user123',
                email: 'test@example.com'
            }));
        });

        it('should handle validation errors', async () => {
            req.body = { email: 'invalid' };
            validationResult.mockReturnValue({
                isEmpty: () => false,
                array: () => [{ msg: 'Invalid email format' }]
            });

            await authController.register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Validation failed',
                details: [{ msg: 'Invalid email format' }]
            });
            expect(authService.register).not.toHaveBeenCalled();
        });

        it('should handle duplicate user error', async () => {
            req.body = { email: 'test@example.com', password: 'pass', name: 'Test' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.register.mockRejectedValue(new Error('User already exists'));

            await authController.register(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({ error: 'User already exists' });
        });
    });

    describe('login', () => {
        it('should login user successfully', async () => {
            const credentials = {
                email: 'test@example.com',
                password: 'password123'
            };

            req.body = credentials;
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.login.mockResolvedValue({
                user: { id: 'user123', email: 'test@example.com' },
                token: 'jwt-token',
                refreshToken: 'refresh-token'
            });

            await authController.login(req, res);

            expect(authService.login).toHaveBeenCalledWith(credentials.email, credentials.password);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                token: 'jwt-token',
                refreshToken: 'refresh-token',
                user: { id: 'user123', email: 'test@example.com' }
            });
        });

        it('should handle invalid credentials', async () => {
            req.body = { email: 'test@example.com', password: 'wrong' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.login.mockRejectedValue(new Error('Invalid credentials'));

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid credentials' });
        });

        it('should handle locked account', async () => {
            req.body = { email: 'test@example.com', password: 'password123' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.login.mockRejectedValue(new Error('Account locked'));

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(423);
            expect(res.json).toHaveBeenCalledWith({ error: 'Account locked' });
        });
    });

    describe('refreshToken', () => {
        it('should refresh token successfully', async () => {
            req.body = { refreshToken: 'valid-refresh-token' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.refreshToken.mockResolvedValue({
                token: 'new-jwt-token',
                user: { id: 'user123', email: 'test@example.com' }
            });

            await authController.refreshToken(req, res);

            expect(authService.refreshToken).toHaveBeenCalledWith('valid-refresh-token');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                token: 'new-jwt-token',
                user: { id: 'user123', email: 'test@example.com' }
            });
        });

        it('should handle invalid refresh token', async () => {
            req.body = { refreshToken: 'invalid-token' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.refreshToken.mockRejectedValue(new Error('Invalid refresh token'));

            await authController.refreshToken(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid refresh token' });
        });
    });

    describe('logout', () => {
        it('should logout successfully', async () => {
            req.body = { refreshToken: 'valid-token' };
            authService.logout.mockResolvedValue(true);

            await authController.logout(req, res);

            expect(authService.logout).toHaveBeenCalledWith('valid-token');
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('should handle logout without token', async () => {
            req.body = {};
            authService.logout.mockResolvedValue(true);

            await authController.logout(req, res);

            expect(res.json).toHaveBeenCalledWith({ success: true });
        });
    });

    describe('getCurrentUser', () => {
        it('should return current user profile', async () => {
            req.user = { id: 'user123' };
            authService.findUserById.mockResolvedValue({
                id: 'user123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'doctor'
            });

            await authController.getCurrentUser(req, res);

            expect(authService.findUserById).toHaveBeenCalledWith('user123');
            expect(res.json).toHaveBeenCalledWith({
                id: 'user123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'doctor'
            });
        });

        it('should handle user not found', async () => {
            req.user = { id: 'nonexistent' };
            authService.findUserById.mockResolvedValue(null);

            await authController.getCurrentUser(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
        });
    });

    describe('changePassword', () => {
        it('should change password successfully', async () => {
            req.body = {
                currentPassword: 'oldpass',
                newPassword: 'newpass123'
            };
            req.user = { id: 'user123' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.changePassword.mockResolvedValue(true);

            await authController.changePassword(req, res);

            expect(authService.changePassword).toHaveBeenCalledWith('user123', 'oldpass', 'newpass123');
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('should handle validation errors', async () => {
            req.body = { currentPassword: 'short', newPassword: 'weak' };
            validationResult.mockReturnValue({
                isEmpty: () => false,
                array: () => [{ msg: 'Password too weak' }]
            });

            await authController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Validation failed',
                details: [{ msg: 'Password too weak' }]
            });
        });

        it('should handle incorrect current password', async () => {
            req.body = { currentPassword: 'wrong', newPassword: 'newpass123' };
            req.user = { id: 'user123' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.changePassword.mockRejectedValue(new Error('Current password is incorrect'));

            await authController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Current password is incorrect' });
        });
    });

    describe('forgotPassword', () => {
        it('should send reset email successfully', async () => {
            req.body = { email: 'test@example.com' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.forgotPassword.mockResolvedValue(true);

            await authController.forgotPassword(req, res);

            expect(authService.forgotPassword).toHaveBeenCalledWith('test@example.com');
            expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Reset email sent' });
        });

        it('should handle user not found', async () => {
            req.body = { email: 'nonexistent@example.com' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.forgotPassword.mockRejectedValue(new Error('User not found'));

            await authController.forgotPassword(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'User not found' });
        });
    });

    describe('resetPassword', () => {
        it('should reset password successfully', async () => {
            req.body = {
                token: 'reset-token',
                newPassword: 'newpass123'
            };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.resetPassword.mockResolvedValue(true);

            await authController.resetPassword(req, res);

            expect(authService.resetPassword).toHaveBeenCalledWith('reset-token', 'newpass123');
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('should handle invalid reset token', async () => {
            req.body = { token: 'invalid-token', newPassword: 'newpass123' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            authService.resetPassword.mockRejectedValue(new Error('Invalid or expired token'));

            await authController.resetPassword(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired token' });
        });
    });
});
