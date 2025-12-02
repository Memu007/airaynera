/**
 * Tests para Middleware de Seguridad
 * @version 1.0.0
 */

const {
    sanitizeInputs,
    preventNoSQLInjection,
    detectAttacks,
    hashPassword,
    verifyPassword,
    generateToken
} = require('../security');

describe('Security Middleware', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            body: {},
            query: {},
            params: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('test-user-agent')
        };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        next = jest.fn();
    });

    describe('sanitizeInputs', () => {
        it('should sanitize dangerous HTML characters', () => {
            req.body = {
                name: 'John<script>alert("xss")</script>',
                email: 'test@example.com'
            };

            sanitizeInputs(req, res, next);

            expect(req.body.name).toBe('Johnscriptalert("xss")/script');
            expect(req.body.email).toBe('test@example.com');
            expect(next).toHaveBeenCalled();
        });

        it('should trim whitespace', () => {
            req.body = {
                name: '  John Doe  ',
                description: '\n\nTest description\n\n'
            };

            sanitizeInputs(req, res, next);

            expect(req.body.name).toBe('John Doe');
            expect(req.body.description).toBe('Test description');
            expect(next).toHaveBeenCalled();
        });

        it('should handle nested objects', () => {
            req.body = {
                user: {
                    name: '<script>bad</script>',
                    profile: {
                        bio: '  Clean bio  '
                    }
                }
            };

            sanitizeInputs(req, res, next);

            expect(req.body.user.name).toBe('scriptbad/script');
            expect(req.body.user.profile.bio).toBe('Clean bio');
            expect(next).toHaveBeenCalled();
        });
    });

    describe('preventNoSQLInjection', () => {
        it('should block NoSQL injection attempts', () => {
            req.body = {
                email: { $ne: null },
                password: 'test'
            };

            preventNoSQLInjection(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Solicitud inválida',
                code: 'INVALID_REQUEST'
            });
            expect(next).not.toHaveBeenCalled();
        });

        it('should block queries with dot notation', () => {
            req.query = {
                'user.password': 'test'
            };

            preventNoSQLInjection(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(next).not.toHaveBeenCalled();
        });

        it('should allow safe queries', () => {
            req.body = {
                email: 'test@example.com',
                password: 'safepassword'
            };

            preventNoSQLInjection(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('detectAttacks', () => {
        it('should detect XSS attempts', () => {
            req.body = {
                comment: '<script>alert("xss")</script>'
            };

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Solicitud inválida',
                code: 'SUSPICIOUS_REQUEST'
            });
        });

        it('should detect SQL injection attempts', () => {
            req.body = {
                search: "'; DROP TABLE users; --"
            };

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should detect path traversal attempts', () => {
            req.query = {
                file: '../../../etc/passwd'
            };

            detectAttacks(req, res, next);

            expect(res.status).toHaveBeenCalledWith(400);
        });

        it('should allow safe content', () => {
            req.body = {
                name: 'John Doe',
                comment: 'This is a safe comment'
            };

            detectAttacks(req, res, next);

            expect(next).toHaveBeenCalled();
            expect(res.status).not.toHaveBeenCalled();
        });
    });

    describe('Password Hashing', () => {
        it('should hash password correctly', async () => {
            const password = 'testPassword123!';
            const hash = await hashPassword(password);

            expect(hash).toBeDefined();
            expect(hash).not.toBe(password);
            expect(hash.length).toBeGreaterThan(50);
        });

        it('should verify password correctly', async () => {
            const password = 'testPassword123!';
            const hash = await hashPassword(password);

            const isValid = await verifyPassword(password, hash);
            expect(isValid).toBe(true);

            const isInvalid = await verifyPassword('wrongPassword', hash);
            expect(isInvalid).toBe(false);
        });

        it('should handle empty passwords safely', async () => {
            await expect(hashPassword('')).rejects.toThrow();
        });
    });

    describe('Token Generation', () => {
        it('should generate valid JWT tokens', () => {
            const user = {
                id: 'user123',
                email: 'test@example.com',
                role: 'doctor'
            };

            const { token, refreshToken } = generateToken(user);

            expect(token).toBeDefined();
            expect(refreshToken).toBeDefined();
            expect(typeof token).toBe('string');
            expect(typeof refreshToken).toBe('string');
        });

        it('should generate different tokens for different users', () => {
            const user1 = { id: 'user1', email: 'user1@test.com', role: 'doctor' };
            const user2 = { id: 'user2', email: 'user2@test.com', role: 'doctor' };

            const tokens1 = generateToken(user1);
            const tokens2 = generateToken(user2);

            expect(tokens1.token).not.toBe(tokens2.token);
            expect(tokens1.refreshToken).not.toBe(tokens2.refreshToken);
        });
    });
});

describe('Security Utils Integration', () => {
    it('should protect against combined attack vectors', () => {
        const req = {
            body: {
                email: { $ne: null },
                comment: '<script>evil()</script>',
                search: '../../../etc/passwd'
            },
            query: {},
            params: {},
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('test-agent')
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        // Should be blocked by NoSQL injection detection
        preventNoSQLInjection(req, res, next);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(next).not.toHaveBeenCalled();
    });

    it('should allow clean requests through all security layers', () => {
        const req = {
            body: {
                name: 'Dr. Juan Pérez',
                email: 'juan.perez@hospital.com',
                specialty: 'Psiquiatra'
            },
            query: { limit: '10' },
            params: { id: 'patient123' },
            ip: '127.0.0.1',
            get: jest.fn().mockReturnValue('test-agent')
        };
        const res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };
        const next = jest.fn();

        // Should pass all security checks
        sanitizeInputs(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);

        preventNoSQLInjection(req, res, next);
        expect(next).toHaveBeenCalledTimes(2);

        detectAttacks(req, res, next);
        expect(next).toHaveBeenCalledTimes(3);

        expect(res.status).not.toHaveBeenCalled();
    });
}); 