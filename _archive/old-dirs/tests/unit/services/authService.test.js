const authService = require('../../../src/services/authService');

describe('AuthService', () => {
    beforeEach(() => {
        // Resetear datos de Firestore antes de cada test
        global.__resetFirestoreData();
    });

    describe('register', () => {
        test('should register a new user successfully', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User',
                role: 'user'
            };

            const result = await authService.register(userData);

            expect(result).toHaveProperty('id');
            expect(result.email).toBe(userData.email);
            expect(result.name).toBe(userData.name);
            expect(result.role).toBe(userData.role);
            expect(result.isActive).toBe(true);
            expect(result).not.toHaveProperty('password');
        });

        test('should throw error when email is missing', async () => {
            const userData = {
                password: 'password123',
                name: 'Test User'
            };

            await expect(authService.register(userData))
                .rejects.toThrow('Email, password, and name are required');
        });

        test('should throw error when password is missing', async () => {
            const userData = {
                email: 'test@example.com',
                name: 'Test User'
            };

            await expect(authService.register(userData))
                .rejects.toThrow('Email, password, and name are required');
        });

        test('should throw error when name is missing', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123'
            };

            await expect(authService.register(userData))
                .rejects.toThrow('Email, password, and name are required');
        });

        test('should throw error when user already exists', async () => {
            const userData = {
                email: 'existing@example.com',
                password: 'password123',
                name: 'Existing User'
            };

            // Primero registrar el usuario
            await authService.register(userData);

            // Intentar registrar de nuevo
            await expect(authService.register(userData))
                .rejects.toThrow('User already exists');
        });

        test('should use default role when not provided', async () => {
            const userData = {
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            };

            const result = await authService.register(userData);

            expect(result.role).toBe('user');
        });
    });

    describe('login', () => {
        beforeEach(async () => {
            // Crear un usuario de prueba
            await authService.register({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });
        });

        test('should login successfully with valid credentials', async () => {
            const result = await authService.login('test@example.com', 'password123', '127.0.0.1');

            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('tokens');
            expect(result.user.email).toBe('test@example.com');
            expect(result.tokens).toHaveProperty('accessToken');
            expect(result.tokens).toHaveProperty('refreshToken');
        });

        test('should throw error when email is missing', async () => {
            await expect(authService.login(null, 'password123'))
                .rejects.toThrow('Email and password are required');
        });

        test('should throw error when password is missing', async () => {
            await expect(authService.login('test@example.com', null))
                .rejects.toThrow('Email and password are required');
        });

        test('should throw error with invalid credentials', async () => {
            await expect(authService.login('test@example.com', 'wrongpassword'))
                .rejects.toThrow('Invalid credentials');
        });

        test('should throw error when user does not exist', async () => {
            await expect(authService.login('nonexistent@example.com', 'password123'))
                .rejects.toThrow('Invalid credentials');
        });

        test('should throw error when account is deactivated', async () => {
            // Desactivar el usuario
            const user = await authService.findByEmail('test@example.com');
            await authService.deactivateUser(user.id);

            await expect(authService.login('test@example.com', 'password123'))
                .rejects.toThrow('Account is deactivated');
        });

        test('should throw error when account is locked', async () => {
            // Bloquear el usuario
            const user = await authService.findByEmail('test@example.com');
            await authService.lockUser(user.id);

            await expect(authService.login('test@example.com', 'password123'))
                .rejects.toThrow('Account is locked');
        });

        test('should record failed login attempts', async () => {
            const user = await authService.findByEmail('test@example.com');
            
            // Intentar login con contraseña incorrecta
            await expect(authService.login('test@example.com', 'wrongpassword'))
                .rejects.toThrow('Invalid credentials');

            // Verificar que se incrementó el contador
            const updatedUser = await authService.findById(user.id);
            expect(updatedUser.failedLoginAttempts).toBe(1);
        });

        test('should lock account after 5 failed attempts', async () => {
            const user = await authService.findByEmail('test@example.com');
            
            // Intentar login 5 veces con contraseña incorrecta
            for (let i = 0; i < 5; i++) {
                try {
                    await authService.login('test@example.com', 'wrongpassword');
                } catch (error) {
                    // Expected to fail
                }
            }

            // Verificar que la cuenta está bloqueada
            const updatedUser = await authService.findById(user.id);
            expect(updatedUser.isLocked).toBe(true);
        });
    });

    describe('findByEmail', () => {
        test('should return user when exists', async () => {
            await authService.register({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });

            const user = await authService.findByEmail('test@example.com');
            
            expect(user).not.toBeNull();
            expect(user.email).toBe('test@example.com');
            expect(user.name).toBe('Test User');
        });

        test('should return null when user does not exist', async () => {
            const user = await authService.findByEmail('nonexistent@example.com');
            expect(user).toBeNull();
        });
    });

    describe('findById', () => {
        test('should return user when exists', async () => {
            const registered = await authService.register({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });

            const user = await authService.findById(registered.id);
            
            expect(user).not.toBeNull();
            expect(user.id).toBe(registered.id);
            expect(user.email).toBe('test@example.com');
        });

        test('should return null when user does not exist', async () => {
            const user = await authService.findById('nonexistent-id');
            expect(user).toBeNull();
        });
    });

    describe('refreshToken', () => {
        let refreshToken;
        let userId;

        beforeEach(async () => {
            const registered = await authService.register({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });
            userId = registered.id;

            const loginResult = await authService.login('test@example.com', 'password123');
            refreshToken = loginResult.tokens.refreshToken;
        });

        test('should refresh token successfully', async () => {
            const newTokens = await authService.refreshToken(refreshToken);
            
            expect(newTokens).toHaveProperty('accessToken');
            expect(newTokens).toHaveProperty('refreshToken');
            expect(newTokens.accessToken).not.toBe(refreshToken);
        });

        test('should throw error when refresh token is missing', async () => {
            await expect(authService.refreshToken(null))
                .rejects.toThrow('Refresh token is required');
        });

        test('should throw error with invalid refresh token', async () => {
            await expect(authService.refreshToken('invalid-token'))
                .rejects.toThrow('Invalid refresh token');
        });

        test('should invalidate old refresh token after refresh', async () => {
            await authService.refreshToken(refreshToken);
            
            // Intentar usar el token viejo debería fallar
            await expect(authService.refreshToken(refreshToken))
                .rejects.toThrow('Invalid refresh token');
        });
    });

    describe('verifyToken', () => {
        let accessToken;
        let userId;

        beforeEach(async () => {
            const registered = await authService.register({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });
            userId = registered.id;

            const loginResult = await authService.login('test@example.com', 'password123');
            accessToken = loginResult.tokens.accessToken;
        });

        test('should verify valid token', async () => {
            const decoded = await authService.verifyToken(accessToken);
            
            expect(decoded).toHaveProperty('id');
            expect(decoded).toHaveProperty('email');
            expect(decoded.email).toBe('test@example.com');
        });

        test('should throw error with invalid token', async () => {
            await expect(authService.verifyToken('invalid-token'))
                .rejects.toThrow('Invalid token');
        });
    });

    describe('user management', () => {
        let userId;

        beforeEach(async () => {
            const registered = await authService.register({
                email: 'test@example.com',
                password: 'password123',
                name: 'Test User'
            });
            userId = registered.id;
        });

        describe('deactivateUser', () => {
            test('should deactivate user successfully', async () => {
                await authService.deactivateUser(userId);
                
                const user = await authService.findById(userId);
                expect(user.isActive).toBe(false);
            });
        });

        describe('activateUser', () => {
            test('should activate user successfully', async () => {
                await authService.deactivateUser(userId);
                await authService.activateUser(userId);
                
                const user = await authService.findById(userId);
                expect(user.isActive).toBe(true);
                expect(user.isLocked).toBe(false);
                expect(user.failedLoginAttempts).toBe(0);
            });
        });

        describe('lockUser', () => {
            test('should lock user successfully', async () => {
                await authService.lockUser(userId);
                
                const user = await authService.findById(userId);
                expect(user.isLocked).toBe(true);
            });
        });

        describe('unlockUser', () => {
            test('should unlock user successfully', async () => {
                await authService.lockUser(userId);
                await authService.unlockUser(userId);
                
                const user = await authService.findById(userId);
                expect(user.isLocked).toBe(false);
                expect(user.failedLoginAttempts).toBe(0);
            });
        });

        describe('changePassword', () => {
            test('should change password successfully', async () => {
                await authService.changePassword(userId, 'newpassword123');
                
                // Verificar que el login funciona con la nueva contraseña
                const loginResult = await authService.login('test@example.com', 'newpassword123');
                expect(loginResult).toHaveProperty('tokens');
            });
        });

        describe('getUserSessions', () => {
            test('should return active sessions for user', async () => {
                await authService.login('test@example.com', 'password123', '127.0.0.1');
                
                const sessions = await authService.getUserSessions(userId);
                expect(sessions).toHaveLength(1);
                expect(sessions[0]).toHaveProperty('userId', userId);
                expect(sessions[0]).toHaveProperty('isActive', true);
            });

            test('should return empty array when no active sessions', async () => {
                const sessions = await authService.getUserSessions(userId);
                expect(sessions).toHaveLength(0);
            });
        });

        describe('invalidateAllSessions', () => {
            test('should invalidate all sessions for user', async () => {
                // Crear múltiples sesiones
                await authService.login('test@example.com', 'password123', '127.0.0.1');
                await authService.login('test@example.com', 'password123', '192.168.1.1');
                
                // Verificar que hay sesiones activas
                let sessions = await authService.getUserSessions(userId);
                expect(sessions).toHaveLength(2);

                // Invalidar todas las sesiones
                await authService.invalidateAllSessions(userId);

                // Verificar que no hay sesiones activas
                sessions = await authService.getUserSessions(userId);
                expect(sessions).toHaveLength(0);
            });
        });
    });
});
