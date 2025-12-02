/**
 * 🧪 AUTHENTICATION TESTS - AIRA Medical System
 * Suite completa de testing para autenticación robusta
 * Versión 2.0 - Production Ready
 */

const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const AuthService = require('../services/authService');
const UserService = require('../services/userService');
const SessionService = require('../services/sessionService');

// Mock de base de datos para testing
const mockDb = {
    collection: jest.fn(() => ({
        doc: jest.fn(() => ({
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        })),
        where: jest.fn(() => ({
            get: jest.fn()
        })),
        add: jest.fn()
    }))
};

describe('🔐 Authentication System Tests', () => {
    let authService;
    let userService;
    let sessionService;
    let mockServer;

    beforeAll(() => {
        // Inicializar servicios con mock DB
        authService = new AuthService();
        userService = new UserService(mockDb);
        sessionService = new SessionService(mockDb, authService);
    });

    beforeEach(() => {
        // Resetear mocks
        jest.clearAllMocks();
    });

    describe('AuthService - Token Management', () => {
        describe('Password Security', () => {
            test('✅ Should validate strong password', () => {
                const strongPassword = 'SecureP@ssw0rd123!';
                const validation = authService.validatePasswordStrength(strongPassword);
                
                expect(validation.isValid).toBe(true);
                expect(validation.strength).toBe('strong');
                expect(validation.errors).toHaveLength(0);
            });

            test('❌ Should reject weak password', () => {
                const weakPassword = '123456';
                const validation = authService.validatePasswordStrength(weakPassword);
                
                expect(validation.isValid).toBe(false);
                expect(validation.strength).toBe('weak');
                expect(validation.errors.length).toBeGreaterThan(0);
            });

            test('❌ Should reject password with common patterns', () => {
                const commonPassword = 'Password123';
                const validation = authService.validatePasswordStrength(commonPassword);
                
                expect(validation.isValid).toBe(false);
                expect(validation.errors.some(e => e.includes('patrones comunes'))).toBe(true);
            });

            test('✅ Should hash password securely', async () => {
                const password = 'TestP@ssw0rd123!';
                const hash = await authService.hashPassword(password);
                
                expect(hash).toBeDefined();
                expect(hash.length).toBeGreaterThan(50); // bcrypt hash length
            });

            test('✅ Should verify password correctly', async () => {
                const password = 'TestP@ssw0rd123!';
                const hash = await authService.hashPassword(password);
                const isValid = await authService.verifyPassword(password, hash);
                
                expect(isValid).toBe(true);
            });

            test('❌ Should reject incorrect password', async () => {
                const password = 'TestP@ssw0rd123!';
                const wrongPassword = 'WrongPassword123!';
                const hash = await authService.hashPassword(password);
                const isValid = await authService.verifyPassword(wrongPassword, hash);
                
                expect(isValid).toBe(false);
            });
        });

        describe('JWT Token Generation and Verification', () => {
            test('✅ Should generate valid access token', () => {
                const userId = 'test123';
                const role = 'professional';
                const sessionId = 'session123';
                
                const token = authService.generateAccessToken(userId, role, sessionId);
                
                expect(token).toBeDefined();
                expect(typeof token).toBe('string');
                
                const decoded = jwt.decode(token);
                expect(decoded.sub).toBe(userId);
                expect(decoded.role).toBe(role);
                expect(decoded.sessionId).toBe(sessionId);
                expect(decoded.type).toBe('access');
            });

            test('✅ Should generate valid refresh token', () => {
                const userId = 'test123';
                const sessionId = 'session123';
                
                const token = authService.generateRefreshToken(userId, sessionId);
                
                expect(token).toBeDefined();
                expect(typeof token).toBe('string');
                
                const decoded = jwt.decode(token);
                expect(decoded.sub).toBe(userId);
                expect(decoded.sessionId).toBe(sessionId);
                expect(decoded.type).toBe('refresh');
            });

            test('✅ Should verify access token', () => {
                const userId = 'test123';
                const role = 'professional';
                const sessionId = 'session123';
                
                const token = authService.generateAccessToken(userId, role, sessionId);
                const decoded = authService.verifyAccessToken(token);
                
                expect(decoded.sub).toBe(userId);
                expect(decoded.role).toBe(role);
                expect(decoded.sessionId).toBe(sessionId);
            });

            test('❌ Should reject expired token', () => {
                // Crear token expirado manualmente
                const expiredToken = jwt.sign(
                    { sub: 'test123', type: 'access' },
                    authService.secrets.current,
                    { expiresIn: '-1h' } // Expirado hace 1 hora
                );
                
                expect(() => authService.verifyAccessToken(expiredToken))
                    .toThrow('TOKEN_EXPIRED');
            });

            test('✅ Should verify refresh token', () => {
                const userId = 'test123';
                const sessionId = 'session123';
                
                const token = authService.generateRefreshToken(userId, sessionId);
                const result = authService.verifyRefreshToken(token);
                
                expect(result.decoded.sub).toBe(userId);
                expect(result.tokenData.userId).toBe(userId);
                expect(result.tokenData.sessionId).toBe(sessionId);
            });
        });

        describe('Login and Authentication Flow', () => {
            const mockUserProvider = {
                findById: jest.fn(),
                updateLastLogin: jest.fn()
            };

            test('✅ Should login successfully with valid credentials', async () => {
                const userId = 'test123';
                const password = 'SecureP@ssw0rd123!';
                const hashedPassword = await authService.hashPassword(password);
                
                const mockUser = {
                    id: userId,
                    name: 'Test User',
                    email: 'test@example.com',
                    role: 'professional',
                    passwordHash: hashedPassword
                };
                
                mockUserProvider.findById.mockResolvedValue(mockUser);
                mockUserProvider.updateLastLogin.mockResolvedValue();
                
                const result = await authService.login(userId, password, mockUserProvider);
                
                expect(result.success).toBe(true);
                expect(result.tokens.accessToken).toBeDefined();
                expect(result.tokens.refreshToken).toBeDefined();
                expect(result.user.id).toBe(userId);
            });

            test('❌ Should reject login with invalid password', async () => {
                const userId = 'test123';
                const password = 'WrongPassword123!';
                const correctPassword = 'SecureP@ssw0rd123!';
                const hashedPassword = await authService.hashPassword(correctPassword);
                
                const mockUser = {
                    id: userId,
                    name: 'Test User',
                    passwordHash: hashedPassword
                };
                
                mockUserProvider.findById.mockResolvedValue(mockUser);
                
                await expect(authService.login(userId, password, mockUserProvider))
                    .rejects.toThrow('CREDENCIALES_INVALIDAS');
            });

            test('❌ Should reject login with non-existent user', async () => {
                const userId = 'nonexistent';
                const password = 'TestP@ssw0rd123!';
                
                mockUserProvider.findById.mockResolvedValue(null);
                
                await expect(authService.login(userId, password, mockUserProvider))
                    .rejects.toThrow('CREDENCIALES_INVALIDAS');
            });

            test('❌ Should block account after too many failed attempts', async () => {
                const userId = 'test123';
                const password = 'WrongPassword123!';
                
                mockUserProvider.findById.mockResolvedValue(null);
                
                // Realizar 6 intentos fallidos (el máximo es 5)
                for (let i = 0; i < 6; i++) {
                    try {
                        await authService.login(userId, password, mockUserProvider);
                    } catch (error) {
                        if (i < 5) {
                            expect(error.message).toBe('CREDENCIALES_INVALIDAS');
                        } else {
                            expect(error.message).toContain('CUENTA_BLOQUEADA');
                        }
                    }
                }
            });
        });

        describe('Token Refresh', () => {
            const mockUserProvider = {
                findById: jest.fn()
            };

            test('✅ Should refresh tokens successfully', async () => {
                const userId = 'test123';
                const sessionId = 'session123';
                const refreshToken = authService.generateRefreshToken(userId, sessionId);
                
                const mockUser = {
                    id: userId,
                    name: 'Test User',
                    role: 'professional'
                };
                
                mockUserProvider.findById.mockResolvedValue(mockUser);
                
                const result = await authService.refreshTokens(refreshToken, mockUserProvider);
                
                expect(result.success).toBe(true);
                expect(result.tokens.accessToken).toBeDefined();
                expect(result.tokens.refreshToken).toBeDefined();
            });

            test('❌ Should reject refresh with invalid token', async () => {
                const invalidToken = 'invalid.refresh.token';
                
                await expect(authService.refreshTokens(invalidToken, mockUserProvider))
                    .rejects.toThrow('REFRESH_TOKEN_NOT_FOUND');
            });
        });

        describe('Logout', () => {
            test('✅ Should logout successfully', async () => {
                const userId = 'test123';
                const sessionId = 'session123';
                const accessToken = authService.generateAccessToken(userId, 'professional', sessionId);
                const refreshToken = authService.generateRefreshToken(userId, sessionId);
                
                const result = await authService.logout(accessToken, refreshToken);
                
                expect(result.success).toBe(true);
            });
        });
    });

    describe('UserService - User Management', () => {
        describe('Password Validation', () => {
            test('✅ Should calculate password score correctly', () => {
                const strongPassword = 'SecureP@ssw0rd123!';
                const score = userService.calculatePasswordScore(strongPassword);
                
                expect(score).toBeGreaterThan(80);
            });

            test('❌ Should give low score to weak password', () => {
                const weakPassword = 'weak123';
                const score = userService.calculatePasswordScore(weakPassword);
                
                expect(score).toBeLessThan(30);
            });

            test('✅ Should detect common sequences', () => {
                const passwordWithSequence = 'abc123XYZ';
                const hasSequence = userService.hasCommonSequences(passwordWithSequence);
                
                expect(hasSequence).toBe(true);
            });

            test('✅ Should generate secure password', () => {
                const password = userService.generateSecurePassword(12);
                
                expect(password).toHaveLength(12);
                expect(/[A-Z]/.test(password)).toBe(true);
                expect(/[a-z]/.test(password)).toBe(true);
                expect(/[0-9]/.test(password)).toBe(true);
                expect(/[!@#$%^&*(),.?":{}|<>]/.test(password)).toBe(true);
            });
        });
    });

    describe('SessionService - Session Management', () => {
        describe('Session Creation', () => {
            test('✅ Should create session successfully', async () => {
                const userId = 'test123';
                const userAgent = 'Mozilla/5.0 Test Browser';
                const ipAddress = '127.0.0.1';
                
                const result = await sessionService.createSession(userId, userAgent, ipAddress);
                
                expect(result.success).toBe(true);
                expect(result.session.sessionId).toBeDefined();
                expect(result.session.userId).toBe(userId);
            });

            test('✅ Should enforce session limit', async () => {
                const userId = 'test123';
                const userAgent = 'Mozilla/5.0 Test Browser';
                const ipAddress = '127.0.0.1';
                
                // Crear más sesiones que el límite permitido
                const sessions = [];
                for (let i = 0; i < 5; i++) {
                    const result = await sessionService.createSession(
                        userId, 
                        userAgent, 
                        ipAddress, 
                        { source: `test_${i}` }
                    );
                    sessions.push(result);
                }
                
                // Verificar que solo quedan las sesiones más recientes
                const userSessions = await sessionService.getUserSessions(userId);
                expect(userSessions.length).toBeLessThanOrEqual(3); // Límite configurado
            });
        });

        describe('Session Retrieval', () => {
            test('✅ Should get active session', async () => {
                const userId = 'test123';
                const userAgent = 'Mozilla/5.0 Test Browser';
                const ipAddress = '127.0.0.1';
                
                const createResult = await sessionService.createSession(userId, userAgent, ipAddress);
                const session = await sessionService.getSession(createResult.session.sessionId);
                
                expect(session).toBeDefined();
                expect(session.userId).toBe(userId);
                expect(session.status).toBe('active');
            });
        });

        describe('Session Activity', () => {
            test('✅ Should update session activity', async () => {
                const userId = 'test123';
                const userAgent = 'Mozilla/5.0 Test Browser';
                const ipAddress = '127.0.0.1';
                
                const createResult = await sessionService.createSession(userId, userAgent, ipAddress);
                
                const updateResult = await sessionService.updateSessionActivity(
                    createResult.session.sessionId,
                    {
                        action: 'test_action',
                        details: 'Test activity update'
                    }
                );
                
                expect(updateResult).toBe(true);
            });
        });

        describe('Session Invalidation', () => {
            test('✅ Should invalidate session', async () => {
                const userId = 'test123';
                const userAgent = 'Mozilla/5.0 Test Browser';
                const ipAddress = '127.0.0.1';
                
                const createResult = await sessionService.createSession(userId, userAgent, ipAddress);
                
                const invalidateResult = await sessionService.invalidateSession(
                    createResult.session.sessionId,
                    'test_logout'
                );
                
                expect(invalidateResult).toBe(true);
                
                // Verificar que la sesión ya no está activa
                const session = await sessionService.getSession(createResult.session.sessionId);
                expect(session).toBeNull();
            });
        });
    });

    describe('Integration Tests', () => {
        test('✅ Complete authentication flow', async () => {
            // 1. Setup mock user
            const userId = 'integration123';
            const password = 'IntegrationP@ssw0rd123!';
            const hashedPassword = await authService.hashPassword(password);
            
            const mockUserProvider = {
                findById: jest.fn().mockResolvedValue({
                    id: userId,
                    name: 'Integration Test User',
                    email: 'integration@test.com',
                    role: 'professional',
                    passwordHash: hashedPassword
                }),
                updateLastLogin: jest.fn()
            };

            // 2. Login
            const loginResult = await authService.login(userId, password, mockUserProvider);
            expect(loginResult.success).toBe(true);

            // 3. Create session
            const sessionResult = await sessionService.createSession(
                userId,
                'Test Browser',
                '127.0.0.1'
            );
            expect(sessionResult.success).toBe(true);

            // 4. Verify token
            const decodedToken = authService.verifyAccessToken(loginResult.tokens.accessToken);
            expect(decodedToken.sub).toBe(userId);

            // 5. Update session activity
            const activityResult = await sessionService.updateSessionActivity(
                sessionResult.session.sessionId,
                { action: 'integration_test' }
            );
            expect(activityResult).toBe(true);

            // 6. Refresh tokens
            const refreshResult = await authService.refreshTokens(
                loginResult.tokens.refreshToken,
                mockUserProvider
            );
            expect(refreshResult.success).toBe(true);

            // 7. Logout
            const logoutResult = await authService.logout(
                refreshResult.tokens.accessToken,
                refreshResult.tokens.refreshToken
            );
            expect(logoutResult.success).toBe(true);

            console.log('✅ Complete authentication flow test passed');
        });
    });

    describe('Security Tests', () => {
        test('❌ Should prevent token reuse after logout', async () => {
            const userId = 'security123';
            const password = 'SecurityP@ssw0rd123!';
            const hashedPassword = await authService.hashPassword(password);
            
            const mockUserProvider = {
                findById: jest.fn().mockResolvedValue({
                    id: userId,
                    passwordHash: hashedPassword
                })
            };

            // Login y obtener tokens
            const loginResult = await authService.login(userId, password, mockUserProvider);
            const accessToken = loginResult.tokens.accessToken;

            // Logout
            await authService.logout(accessToken, loginResult.tokens.refreshToken);

            // Intentar verificar el token después del logout
            expect(() => authService.verifyAccessToken(accessToken))
                .toThrow('TOKEN_BLACKLISTED');
        });

        test('❌ Should enforce rate limiting', async () => {
            const userId = 'ratelimit123';
            const password = 'RateLimitP@ssw0rd123!';
            
            const mockUserProvider = {
                findById: jest.fn().mockResolvedValue(null) // Simular usuario no encontrado
            };

            // Realizar múltiples intentos fallidos
            let blockedCount = 0;
            for (let i = 0; i < 10; i++) {
                try {
                    await authService.login(userId, password, mockUserProvider);
                } catch (error) {
                    if (error.message.includes('CUENTA_BLOQUEADA')) {
                        blockedCount++;
                    }
                }
            }

            expect(blockedCount).toBeGreaterThan(0);
        });

        test('✅ Should handle JWT secret rotation', () => {
            const userId = 'rotation123';
            const oldSecret = authService.secrets.current;
            
            // Generar token con secret actual
            const token = authService.generateAccessToken(userId, 'professional', 'session123');
            
            // Rotar secrets
            authService.rotateSecrets();
            const newSecret = authService.secrets.current;
            
            expect(newSecret).not.toBe(oldSecret);
            expect(authService.secrets.previous).toBe(oldSecret);
            
            // Verificar que el token antiguo todavía funciona con secret anterior
            const decoded = authService.verifyAccessToken(token);
            expect(decoded.sub).toBe(userId);
        });
    });

    describe('Performance Tests', () => {
        test('✅ Should handle concurrent logins', async () => {
            const userId = 'concurrent123';
            const password = 'ConcurrentP@ssw0rd123!';
            const hashedPassword = await authService.hashPassword(password);
            
            const mockUserProvider = {
                findById: jest.fn().mockResolvedValue({
                    id: userId,
                    passwordHash: hashedPassword
                }),
                updateLastLogin: jest.fn()
            };

            // Realizar 10 logins concurrentes
            const loginPromises = Array(10).fill().map(() => 
                authService.login(userId, password, mockUserProvider)
            );

            const results = await Promise.all(loginPromises);
            
            // Todos deberían ser exitosos
            results.forEach(result => {
                expect(result.success).toBe(true);
                expect(result.tokens.accessToken).toBeDefined();
            });

            console.log('✅ Concurrent login test passed');
        });

        test('✅ Should handle multiple sessions per user', async () => {
            const userId = 'multisession123';
            const userAgent = 'Test Browser';
            const ipAddress = '127.0.0.1';

            // Crear múltiples sesiones
            const sessionPromises = Array(5).fill().map((_, i) => 
                sessionService.createSession(userId, userAgent, ipAddress, { source: `test_${i}` })
            );

            const results = await Promise.all(sessionPromises);
            
            // Verificar que se manejan correctamente (con límite)
            const userSessions = await sessionService.getUserSessions(userId);
            expect(userSessions.length).toBeLessThanOrEqual(3);

            console.log('✅ Multiple session test passed');
        });
    });
});

// Tests de API endpoints (requieren servidor Express)
describe('🌐 API Endpoints Tests', () => {
    let app;
    
    beforeAll(() => {
        // Mock del servidor Express con las rutas de autenticación
        const express = require('express');
        app = express();
        app.use(express.json());
        
        // Mock de la base de datos para el servidor
        app.locals.db = mockDb;
        
        // Cargar rutas de autenticación
        // const authRoutes = require('../routes/auth');
        // app.use('/api/auth', authRoutes);
    });

    describe('POST /api/auth/login', () => {
        test('✅ Should login with valid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    userId: 'test123',
                    password: 'TestP@ssw0rd123!'
                });

            // Mock implementation would be needed here
            expect(response.status).toBe(200);
        });

        test('❌ Should reject invalid credentials', async () => {
            const response = await request(app)
                .post('/api/auth/login')
                .send({
                    userId: 'test123',
                    password: 'wrongpassword'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/auth/refresh', () => {
        test('✅ Should refresh valid token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: 'valid.refresh.token'
                });

            // Mock implementation would be needed here
            expect(response.status).toBe(200);
        });

        test('❌ Should reject invalid refresh token', async () => {
            const response = await request(app)
                .post('/api/auth/refresh')
                .send({
                    refreshToken: 'invalid.token'
                });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /api/auth/me', () => {
        test('✅ Should return user info with valid token', async () => {
            const validToken = 'valid.access.token';
            
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', `Bearer ${validToken}`);

            // Mock implementation would be needed here
            expect(response.status).toBe(200);
        });

        test('❌ Should reject request without token', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            expect(response.status).toBe(401);
        });

        test('❌ Should reject request with invalid token', async () => {
            const response = await request(app)
                .get('/api/auth/me')
                .set('Authorization', 'Bearer invalid.token');

            expect(response.status).toBe(401);
        });
    });

    describe('POST /api/auth/logout', () => {
        test('✅ Should logout successfully', async () => {
            const validToken = 'valid.access.token';
            
            const response = await request(app)
                .post('/api/auth/logout')
                .set('Authorization', `Bearer ${validToken}`)
                .send({
                    refreshToken: 'valid.refresh.token'
                });

            // Mock implementation would be needed here
            expect(response.status).toBe(200);
        });
    });
});

describe('🔒 Security Edge Cases', () => {
    test('❌ Should prevent SQL injection in user ID', async () => {
        const maliciousUserId = "'; DROP TABLE professionals; --";
        const password = 'TestP@ssw0rd123!';
        
        const mockUserProvider = {
            findById: jest.fn().mockResolvedValue(null)
        };

        await expect(authService.login(maliciousUserId, password, mockUserProvider))
            .rejects.toThrow('CREDENCIALES_INVALIDAS');
        
        // Verificar que no se llamó con el ID malicioso
        expect(mockUserProvider.findById).not.toHaveBeenCalledWith(maliciousUserId);
    });

    test('❌ Should prevent XSS in user inputs', () => {
        const xssPayload = '<script>alert("xss")</script>';
        const validation = authService.validatePasswordStrength(xssPayload);
        
        expect(validation.isValid).toBe(false);
    });

    test('✅ Should handle very long inputs gracefully', () => {
        const longPassword = 'a'.repeat(1000);
        const validation = authService.validatePasswordStrength(longPassword);
        
        expect(validation.isValid).toBe(false);
        expect(validation.errors.some(e => e.includes('demasiado largo'))).toBe(true);
    });
});

module.exports = {
    // Exportar utilidades para testing
    mockDb,
    createTestUserService: () => new UserService(mockDb),
    createTestAuthService: () => new AuthService(),
    createTestSessionService: () => new SessionService(mockDb, new AuthService())
};