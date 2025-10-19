/**
 * Tests Unitarios - AuthController
 * @version 1.0.0
 */

const authController = require('../authController');
const authService = require('../../services/authService');
const { generateToken } = require('../../middleware/security');

// Mocks
jest.mock('../../services/authService', () => ({
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
    resetPassword: jest.fn()
}));
jest.mock('../../middleware/security');
jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
}));

describe('AuthController', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            body: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('test-user-agent'),
            user: { id: 'user123', email: 'test@test.com' }
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();

        // Limpiar mocks
        jest.clearAllMocks();
    });

    describe('login', () => {
        beforeEach(() => {
            req.body = {
                email: 'test@example.com',
                password: 'password123'
            };
        });

        it('should login successfully with valid credentials', async () => {
            const mockUser = {
                id: 'user123',
                email: 'test@example.com',
                name: 'Test User',
                role: 'doctor',
                status: 'active'
            };

            const mockTokens = {
                token: 'jwt-token',
                refreshToken: 'refresh-token'
            };

            authService.findUserByEmail.mockResolvedValue(mockUser);
            authService.updateLoginSuccess.mockResolvedValue();
            generateToken.mockReturnValue(mockTokens);

            await authController.login(req, res);

            expect(authService.findUserByEmail).toHaveBeenCalledWith('test@example.com');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                token: mockTokens.token,
                refreshToken: mockTokens.refreshToken,
                user: {
                    id: mockUser.id,
                    email: mockUser.email,
                    name: mockUser.name,
                    role: mockUser.role
                }
            });
        });

        it('should reject login with non-existent email', async () => {
            authService.findUserByEmail.mockResolvedValue(null);

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(401);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Credenciales inválidas',
                code: 'INVALID_CREDENTIALS'
            });
        });

        it('should reject login with locked account', async () => {
            const mockUser = {
                id: 'user123',
                email: 'test@example.com',
                status: 'locked'
            };

            authService.findUserByEmail.mockResolvedValue(mockUser);

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Cuenta bloqueada. Contacte al administrador.',
                code: 'ACCOUNT_LOCKED'
            });
        });

        it('should handle database errors gracefully', async () => {
            authService.findUserByEmail.mockRejectedValue(new Error('Database error'));

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Error al procesar la solicitud',
                code: 'INTERNAL_ERROR'
            });
        });

        it('should validate required fields', async () => {
            req.body = { email: 'test@test.com' }; // Falta password

            await authController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('register', () => {
        beforeEach(() => {
            req.body = {
                email: 'new@example.com',
                password: 'Password123!',
                name: 'New User',
                specialty: 'Psiquiatra',
                dni: '12345678'
            };
        });

        it('should register new user successfully', async () => {
            const mockNewUser = {
                id: 'newuser123',
                ...req.body
            };

            const mockTokens = {
                token: 'jwt-token',
                refreshToken: 'refresh-token'
            };

            authService.findUserByEmail.mockResolvedValue(null);
            authService.findUserByDNI.mockResolvedValue(null);
            authService.createUser.mockResolvedValue(mockNewUser);
            generateToken.mockReturnValue(mockTokens);

            await authController.register(req, res);

            expect(authService.createUser).toHaveBeenCalledWith(
                expect.objectContaining({
                    email: req.body.email,
                    name: req.body.name,
                    specialty: req.body.specialty,
                    dni: req.body.dni,
                    role: 'doctor',
                    status: 'active'
                })
            );

            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                token: mockTokens.token,
                refreshToken: mockTokens.refreshToken,
                user: {
                    id: mockNewUser.id,
                    email: req.body.email,
                    name: req.body.name,
                    role: 'doctor'
                }
            });
        });

        it('should reject registration with existing email', async () => {
            const existingUser = { id: 'existing123', email: 'new@example.com' };
            authService.findUserByEmail.mockResolvedValue(existingUser);

            await authController.register(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                error: 'El email ya está registrado',
                code: 'EMAIL_EXISTS'
            });
        });

        it('should reject registration with existing DNI', async () => {
            const existingUser = { id: 'existing123', dni: '12345678' };
            authService.findUserByEmail.mockResolvedValue(null);
            authService.findUserByDNI.mockResolvedValue(existingUser);

            await authController.register(req, res);

            expect(res.status).toHaveBeenCalledWith(409);
            expect(res.json).toHaveBeenCalledWith({
                error: 'El DNI ya está registrado',
                code: 'DNI_EXISTS'
            });
        });
    });

    describe('refreshToken', () => {
        beforeEach(() => {
            req.body = {
                refreshToken: 'valid-refresh-token'
            };
        });

        it('should refresh token successfully', async () => {
            const mockResult = {
                success: true,
                token: 'new-jwt-token',
                refreshToken: 'new-refresh-token'
            };

            authService.refreshUserToken.mockResolvedValue(mockResult);

            await authController.refreshToken(req, res);

            expect(authService.refreshUserToken).toHaveBeenCalledWith('valid-refresh-token');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                token: mockResult.token,
                refreshToken: mockResult.refreshToken
            });
        });

        it('should reject invalid refresh token', async () => {
            const mockResult = {
                success: false,
                error: 'Token inválido',
                code: 'INVALID_TOKEN'
            };

            authService.refreshUserToken.mockResolvedValue(mockResult);

            await authController.refreshToken(req, res);

            expect(res.status).toHaveBeenCalledWith(403);
            expect(res.json).toHaveBeenCalledWith({
                error: mockResult.error,
                code: mockResult.code
            });
        });
    });

    describe('logout', () => {
        it('should logout successfully', async () => {
            authService.logoutUser.mockResolvedValue();

            await authController.logout(req, res);

            expect(authService.logoutUser).toHaveBeenCalledWith(req.user.id);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Sesión cerrada correctamente'
            });
        });

        it('should handle logout errors', async () => {
            authService.logoutUser.mockRejectedValue(new Error('Logout error'));

            await authController.logout(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Error al cerrar sesión',
                code: 'INTERNAL_ERROR'
            });
        });
    });

    describe('getProfile', () => {
        it('should get user profile successfully', async () => {
            const mockUser = {
                id: 'user123',
                email: 'test@test.com',
                name: 'Test User',
                specialty: 'Psiquiatra',
                role: 'doctor',
                settings: {},
                lastLogin: new Date()
            };

            authService.getUserProfile.mockResolvedValue(mockUser);

            await authController.getProfile(req, res);

            expect(authService.getUserProfile).toHaveBeenCalledWith(req.user.id);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                user: mockUser
            });
        });

        it('should handle user not found', async () => {
            authService.getUserProfile.mockResolvedValue(null);

            await authController.getProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Usuario no encontrado',
                code: 'USER_NOT_FOUND'
            });
        });
    });

    describe('updateProfile', () => {
        beforeEach(() => {
            req.body = {
                name: 'Updated Name',
                specialty: 'Psicólogo/a'
            };
        });

        it('should update profile successfully', async () => {
            const mockResult = {
                success: true,
                user: {
                    id: 'user123',
                    name: 'Updated Name',
                    specialty: 'Psicólogo/a'
                }
            };

            authService.updateUserProfile.mockResolvedValue(mockResult);

            await authController.updateProfile(req, res);

            expect(authService.updateUserProfile).toHaveBeenCalledWith(req.user.id, req.body);
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Perfil actualizado correctamente',
                user: mockResult.user
            });
        });

        it('should handle update errors', async () => {
            const mockResult = {
                success: false,
                error: 'Error de validación',
                code: 'VALIDATION_ERROR'
            };

            authService.updateUserProfile.mockResolvedValue(mockResult);

            await authController.updateProfile(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: mockResult.error,
                code: mockResult.code
            });
        });
    });

    describe('changePassword', () => {
        beforeEach(() => {
            req.body = {
                currentPassword: 'oldPassword123',
                newPassword: 'newPassword456!'
            };
        });

        it('should change password successfully', async () => {
            const mockResult = { success: true };
            authService.changeUserPassword.mockResolvedValue(mockResult);

            await authController.changePassword(req, res);

            expect(authService.changeUserPassword).toHaveBeenCalledWith(
                req.user.id,
                req.body.currentPassword,
                req.body.newPassword
            );

            expect(res.json).toHaveBeenCalledWith({
                success: true,
                message: 'Contraseña actualizada correctamente'
            });
        });

        it('should reject wrong current password', async () => {
            const mockResult = {
                success: false,
                error: 'Contraseña actual incorrecta',
                code: 'INVALID_PASSWORD'
            };

            authService.changeUserPassword.mockResolvedValue(mockResult);

            await authController.changePassword(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: mockResult.error,
                code: mockResult.code
            });
        });
    });
}); 