/**
 * Controlador de Autenticación - AIRA
 * Maneja todas las operaciones de login, registro y gestión de tokens
 * @version 1.0.0
 */

const { hashPassword, verifyPassword, generateToken } = require('../middleware/security');
const { validate } = require('../validators');
const authService = require('../services/authService');
const logger = require('../utils/logger');

class AuthController {
    /**
     * Login de usuario
     */
    async login(req, res) {
        try {
            const { email, password } = req.body;

            // Buscar usuario
            const user = await authService.findUserByEmail(email);
            
            if (!user) {
                logger.warn('Login attempt with non-existent email:', { email, ip: req.ip });
                return res.status(401).json({
                    error: 'Credenciales inválidas',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Verificar contraseña
            const isValidPassword = await verifyPassword(password, user.passwordHash);
            
            if (!isValidPassword) {
                // Incrementar contador de intentos fallidos
                await authService.incrementFailedAttempts(user.id);
                
                logger.warn('Failed login attempt:', { 
                    email, 
                    ip: req.ip,
                    failedAttempts: user.failedLoginAttempts + 1
                });
                
                return res.status(401).json({
                    error: 'Credenciales inválidas',
                    code: 'INVALID_CREDENTIALS'
                });
            }

            // Verificar si la cuenta está bloqueada
            if (user.status === 'locked') {
                return res.status(403).json({
                    error: 'Cuenta bloqueada. Contacte al administrador.',
                    code: 'ACCOUNT_LOCKED'
                });
            }

            // Login exitoso
            await authService.updateLoginSuccess(user.id);

            // Generar tokens
            const userTokenData = {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role || 'doctor'
            };

            const { token, refreshToken } = generateToken(userTokenData);

            // Log de auditoría
            logger.info('Successful login:', {
                userId: user.id,
                email: user.email,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });

            res.json({
                success: true,
                token,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    role: user.role
                }
            });

        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({
                error: 'Error al procesar la solicitud',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Registro de nuevo usuario
     */
    async register(req, res) {
        try {
            const { email, password, name, specialty, dni } = req.body;

            // Verificar si el usuario ya existe
            const existingUser = await authService.findUserByEmail(email);
            
            if (existingUser) {
                return res.status(409).json({
                    error: 'El email ya está registrado',
                    code: 'EMAIL_EXISTS'
                });
            }

            // Verificar DNI único
            const existingDNI = await authService.findUserByDNI(dni);
            if (existingDNI) {
                return res.status(409).json({
                    error: 'El DNI ya está registrado',
                    code: 'DNI_EXISTS'
                });
            }

            // Hash de contraseña
            const passwordHash = await hashPassword(password);

            // Crear usuario
            const userData = {
                email,
                passwordHash,
                name,
                specialty,
                dni,
                role: 'doctor',
                status: 'active',
                createdAt: new Date(),
                failedLoginAttempts: 0,
                settings: {
                    notifications: true,
                    twoFactorEnabled: false,
                    language: 'es',
                    timezone: 'America/Argentina/Buenos_Aires'
                }
            };

            const newUser = await authService.createUser(userData);

            // Generar tokens
            const userTokenData = {
                id: newUser.id,
                email,
                name,
                role: 'doctor'
            };

            const { token, refreshToken } = generateToken(userTokenData);

            // Log de auditoría
            logger.info('New user registered:', {
                userId: newUser.id,
                email,
                specialty,
                ip: req.ip
            });

            res.status(201).json({
                success: true,
                token,
                refreshToken,
                user: {
                    id: newUser.id,
                    email,
                    name,
                    role: 'doctor'
                }
            });

        } catch (error) {
            logger.error('Registration error:', error);
            res.status(500).json({
                error: 'Error al registrar usuario',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Refresh token
     */
    async refreshToken(req, res) {
        try {
            const { refreshToken } = req.body;

            const result = await authService.refreshTokens(refreshToken);
            
            if (!result.success) {
                return res.status(403).json({
                    error: result.error,
                    code: 'INVALID_REFRESH_TOKEN'
                });
            }

            res.json({
                success: true,
                token: result.token,
                refreshToken: result.refreshToken
            });

        } catch (error) {
            logger.error('Refresh token error:', error);
            res.status(500).json({
                error: 'Error al refrescar token',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Logout
     */
    async logout(req, res) {
        try {
            // Log de auditoría
            logger.info('User logout:', {
                userId: req.user.id,
                email: req.user.email,
                ip: req.ip
            });

            // En producción, aquí se invalidaría el token en una blacklist
            await authService.logoutUser(req.user.id);
            
            res.json({
                success: true,
                message: 'Sesión cerrada correctamente'
            });

        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({
                error: 'Error al cerrar sesión',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Cambiar contraseña
     */
    async changePassword(req, res) {
        try {
            const { currentPassword, newPassword } = req.body;
            const userId = req.user.id;

            const result = await authService.changeUserPassword(userId, currentPassword, newPassword);
            
            if (!result.success) {
                return res.status(400).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Password changed:', {
                userId,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'Contraseña actualizada correctamente'
            });

        } catch (error) {
            logger.error('Change password error:', error);
            res.status(500).json({
                error: 'Error al cambiar contraseña',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Solicitar reset de contraseña
     */
    async requestPasswordReset(req, res) {
        try {
            const { email } = req.body;

            const result = await authService.requestPasswordReset(email);
            
            // Siempre devolver éxito para no filtrar información
            res.json({
                success: true,
                message: 'Si el email existe, recibirás instrucciones para restablecer la contraseña'
            });

            if (result.emailSent) {
                logger.info('Password reset requested:', { email, ip: req.ip });
            } else {
                logger.warn('Password reset for non-existent email:', { email, ip: req.ip });
            }

        } catch (error) {
            logger.error('Password reset request error:', error);
            res.status(500).json({
                error: 'Error al procesar solicitud',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Confirmar reset de contraseña
     */
    async confirmPasswordReset(req, res) {
        try {
            const { token, newPassword } = req.body;

            const result = await authService.confirmPasswordReset(token, newPassword);
            
            if (!result.success) {
                return res.status(400).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Password reset completed:', {
                userId: result.userId,
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'Contraseña restablecida correctamente'
            });

        } catch (error) {
            logger.error('Password reset confirmation error:', error);
            res.status(500).json({
                error: 'Error al restablecer contraseña',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Obtener perfil del usuario actual
     */
    async getProfile(req, res) {
        try {
            const user = await authService.getUserProfile(req.user.id);
            
            if (!user) {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                    code: 'USER_NOT_FOUND'
                });
            }

            res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    name: user.name,
                    specialty: user.specialty,
                    role: user.role,
                    settings: user.settings,
                    lastLogin: user.lastLogin
                }
            });

        } catch (error) {
            logger.error('Get profile error:', error);
            res.status(500).json({
                error: 'Error al obtener perfil',
                code: 'INTERNAL_ERROR'
            });
        }
    }

    /**
     * Actualizar perfil
     */
    async updateProfile(req, res) {
        try {
            const userId = req.user.id;
            const updates = req.body;

            const result = await authService.updateUserProfile(userId, updates);
            
            if (!result.success) {
                return res.status(400).json({
                    error: result.error,
                    code: result.code
                });
            }

            logger.info('Profile updated:', {
                userId,
                updatedFields: Object.keys(updates),
                ip: req.ip
            });

            res.json({
                success: true,
                message: 'Perfil actualizado correctamente',
                user: result.user
            });

        } catch (error) {
            logger.error('Update profile error:', error);
            res.status(500).json({
                error: 'Error al actualizar perfil',
                code: 'INTERNAL_ERROR'
            });
        }
    }
}

module.exports = new AuthController(); 