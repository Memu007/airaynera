// Mock authService ANTES de importar el controller
jest.mock('../../src/services/authService', () => ({
    login: jest.fn(),
    register: jest.fn(),
    refreshTokens: jest.fn(),
    logout: jest.fn(),
    updateLastLogin: jest.fn()
}));

jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    audit: jest.fn()
}));

const authController = require('../../src/controllers/authController');
const authService = require('../../src/services/authService');

describe('AuthController Simple Tests', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            user: { id: 'test-user', email: 'test@test.com' },
            ip: '127.0.0.1',
            headers: { 'user-agent': 'test-agent' }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            cookie: jest.fn().mockReturnThis(),
            clearCookie: jest.fn().mockReturnThis()
        };
        jest.clearAllMocks();
    });

    describe('login', () => {
        test('should login successfully', async () => {
            req.body = { email: 'test@test.com', password: 'password123' };
            authService.login.mockResolvedValue({
                user: { id: 'user-1', email: 'test@test.com' },
                token: 'jwt-token',
                refreshToken: 'refresh-token'
            });

            await authController.login(req, res);

            expect(authService.login).toHaveBeenCalledWith('test@test.com', 'password123', '127.0.0.1');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                token: 'jwt-token',
                refreshToken: 'refresh-token',
                user: { id: 'user-1', email: 'test@test.com' }
            });
        });

        test('should handle login errors', async () => {
            req.body = { email: 'test@test.com', password: 'wrong' };
            authService.login.mockRejectedValue(new Error('Invalid credentials'));

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Invalid credentials',
                code: 'INVALID_CREDENTIALS'
            });
        });
    });

    describe('register', () => {
        test('should register successfully', async () => {
            req.body = { email: 'new@test.com', password: 'password123', name: 'New User' };
            authService.register.mockResolvedValue({
                id: 'user-2',
                email: 'new@test.com',
                name: 'New User'
            });

            await authController.register(req, res);

            expect(authService.register).toHaveBeenCalledWith(req.body);
            expect(res.status).toHaveBeenCalledWith(201);
        });

        test('should handle registration errors', async () => {
            req.body = { email: 'existing@test.com', password: 'password123' };
            authService.register.mockRejectedValue(new Error('User already exists'));

            await authController.register(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('getProfile', () => {
        test('should return user profile', async () => {
            await authController.getProfile(req, res);

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                user: { id: 'test-user', email: 'test@test.com' }
            });
        });
    });

    describe('logout', () => {
        test('should logout successfully', async () => {
            req.body = { refreshToken: 'refresh-token' };
            authService.logout.mockResolvedValue();

            await authController.logout(req, res);

            expect(authService.logout).toHaveBeenCalledWith('refresh-token');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Logout successful'
            });
        });
    });
}); 