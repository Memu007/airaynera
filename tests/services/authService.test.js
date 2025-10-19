const authService = require('../../src/services/authService');

// Mock del logger
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    audit: jest.fn()
}));

// Mock del encryption
jest.mock('../../src/utils/encryption', () => ({
    encrypt: jest.fn((data) => `encrypted_${JSON.stringify(data)}`),
    decrypt: jest.fn((data) => {
        try {
            return JSON.parse(data.replace('encrypted_', ''));
        } catch {
            return data.replace('encrypted_', '');
        }
    }),
    encryptSensitiveFields: jest.fn((obj) => obj)
}));

const bcrypt = require('bcryptjs');
const { getDb } = require('../../config/database');
const authService = require('../../services/authService');
const { generateTokens } = require('../../utils/jwt');

jest.mock('bcryptjs');
jest.mock('../../config/database');
jest.mock('../../utils/jwt');

describe('Auth Service - login scenarios', () => {
    const mockDb = {
        collection: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        get: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        getDb.mockReturnValue(mockDb);
    });

    test('should return tokens for valid credentials', async () => {
        const user = { id: 'user123', email: 'test@example.com', password: 'hashedpassword' };
        mockDb.get.mockResolvedValue({
            empty: false,
            docs: [{ id: user.id, data: () => user }]
        });
        bcrypt.compare.mockResolvedValue(true);
        generateTokens.mockReturnValue({ accessToken: 'newAccessToken', refreshToken: 'newRefreshToken' });

        const tokens = await authService.login('test@example.com', 'correctpassword');

        expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', 'hashedpassword');
        expect(tokens).toHaveProperty('accessToken', 'newAccessToken');
    });

    test('should throw an error for invalid password', async () => {
        const user = { id: 'user123', email: 'test@example.com', password: 'hashedpassword' };
        mockDb.get.mockResolvedValue({
            empty: false,
            docs: [{ id: user.id, data: () => user }]
        });
        bcrypt.compare.mockResolvedValue(false);

        await expect(authService.login('test@example.com', 'wrongpassword'))
            .rejects.toThrow('Invalid credentials');
    });

    test('should throw an error for a non-existent user', async () => {
        mockDb.get.mockResolvedValue({ empty: true });

        await expect(authService.login('nouser@example.com', 'anypassword'))
            .rejects.toThrow('Invalid credentials');
    });

    test('should throw a generic error if database lookup fails', async () => {
        mockDb.get.mockRejectedValue(new Error('DB connection failed'));

        await expect(authService.login('test@example.com', 'anypassword'))
            .rejects.toThrow('DB connection failed');
    });
});

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-jwt-secret';
        process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
    });

    describe('findUserByEmail', () => {
        test('should find user by email', async () => {
            const user = await authService.findUserByEmail('test@example.com');
            
            expect(user).toBeDefined();
            expect(user.email).toBe('test@example.com');
            expect(user.role).toBe('professional');
        });

        test('should return null for non-existent email', async () => {
            const user = await authService.findUserByEmail('nonexistent@example.com');
            
            expect(user).toBeNull();
        });
    });

    describe('generateTokens', () => {
        test('should generate access and refresh tokens', async () => {
            const user = { id: 'test-user-1', email: 'test@example.com', role: 'professional' };
            const tokens = await authService.generateTokens(user);
            
            expect(tokens).toHaveProperty('token'); // authService usa 'token' no 'accessToken'
            expect(tokens).toHaveProperty('refreshToken');
            expect(typeof tokens.token).toBe('string');
            expect(typeof tokens.refreshToken).toBe('string');
        });
    });

    describe('register', () => {
        test('should create a new user', async () => {
            const userData = {
                email: 'newuser@example.com',
                password: 'password123',
                name: 'New User',
                role: 'professional'
            };

            // Mock bcrypt for password hashing
            const bcrypt = require('bcryptjs');
            const originalHash = bcrypt.hash;
            bcrypt.hash = jest.fn().mockResolvedValue('hashed-password');

            const user = await authService.register(userData);
            
            expect(user).toBeDefined();
            expect(user.email).toBe('newuser@example.com');
            expect(user.name).toBe('New User');
            expect(user.role).toBe('professional');

            // Restore original
            bcrypt.hash = originalHash;
        });

        test('should throw error for duplicate email', async () => {
            const userData = {
                email: 'test@example.com', // Este email ya existe en los datos de prueba
                password: 'password123',
                name: 'Duplicate User',
                role: 'professional'
            };

            await expect(authService.register(userData)).rejects.toThrow();
        });
    });

    describe('refreshToken', () => {
        test('should refresh access token with valid refresh token', async () => {
            // Mock jwt.verify
            const jwt = require('jsonwebtoken');
            const originalVerify = jwt.verify;
            jwt.verify = jest.fn().mockReturnValue({ id: 'test-user-1', email: 'test@example.com' });

            const result = await authService.refreshToken('test-refresh-token');
            
            expect(result).toHaveProperty('token'); // Cambiado de accessToken a token
            expect(typeof result.token).toBe('string');

            // Restore original
            jwt.verify = originalVerify;
        });

        test('should throw error for invalid refresh token', async () => {
            const jwt = require('jsonwebtoken');
            const originalVerify = jwt.verify;
            jwt.verify = jest.fn().mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await expect(authService.refreshToken('invalid-token')).rejects.toThrow();

            // Restore original
            jwt.verify = originalVerify;
        });
    });

    describe('updateLastLogin', () => {
        test('should update last login info', async () => {
            const result = await authService.updateLastLogin('test-user-1', '127.0.0.1');
            
            // Este método puede no devolver nada, solo verificar que no lance error
            expect(() => result).not.toThrow();
        });
    });

    describe('recordFailedAttempt', () => {
        test('should record failed login attempt', async () => {
            const result = await authService.recordFailedAttempt('test-user-1');
            
            // Este método puede no devolver nada, solo verificar que no lance error
            expect(() => result).not.toThrow();
        });
    });

    describe('invalidateSession', () => {
        test('should invalidate a session', async () => {
            const result = await authService.invalidateSession('test-refresh-token');
            
            // Este método puede no devolver nada, solo verificar que no lance error
            expect(() => result).not.toThrow();
        });
    });

    describe('findUserById', () => {
        test('should find user by ID', async () => {
            const user = await authService.findUserById('test-user-1');
            
            expect(user).toBeDefined();
            expect(user.id).toBe('test-user-1');
            expect(user.email).toBe('test@example.com');
        });

        test('should return null for non-existent ID', async () => {
            const user = await authService.findUserById('non-existent-id');
            
            expect(user).toBeNull();
        });
    });

    describe('login', () => {
        test('should authenticate user with valid credentials', async () => {
            // Mock bcrypt
            const bcrypt = require('bcryptjs');
            const originalCompare = bcrypt.compare;
            bcrypt.compare = jest.fn().mockResolvedValue(true);

            const result = await authService.login('test@example.com', 'password123', '127.0.0.1');
            
            expect(result).toBeDefined();
            expect(result).toHaveProperty('user');
            expect(result).toHaveProperty('token'); // Cambiado de accessToken a token
            expect(result).toHaveProperty('refreshToken');

            // Restore original
            bcrypt.compare = originalCompare;
        });

        test('should throw error for invalid credentials', async () => {
            const bcrypt = require('bcryptjs');
            const originalCompare = bcrypt.compare;
            bcrypt.compare = jest.fn().mockResolvedValue(false);

            await expect(authService.login('test@example.com', 'wrongpassword', '127.0.0.1')).rejects.toThrow();

            // Restore original
            bcrypt.compare = originalCompare;
        });
    });

    describe('verifyToken', () => {
        test('should verify valid JWT token', () => {
            const jwt = require('jsonwebtoken');
            const originalVerify = jwt.verify;
            jwt.verify = jest.fn().mockReturnValue({ id: 'test-user-1', email: 'test@example.com' });

            const result = authService.verifyToken('valid-jwt-token');
            
            expect(result).toBeDefined();
            expect(result.id).toBe('test-user-1');

            // Restore original
            jwt.verify = originalVerify;
        });

        test('should throw error for invalid token', () => {
            const jwt = require('jsonwebtoken');
            const originalVerify = jwt.verify;
            jwt.verify = jest.fn().mockImplementation(() => {
                throw new Error('Invalid token');
            });

            expect(() => authService.verifyToken('invalid-token')).toThrow();

            // Restore original
            jwt.verify = originalVerify;
        });
    });
}); 