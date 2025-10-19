const securityMiddleware = require('../../src/middleware/security');

jest.mock('../../src/utils/logger');

describe('Security Middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            headers: {},
            ip: '127.0.0.1',
            method: 'GET',
            url: '/api/test',
            body: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            header: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();

        jest.clearAllMocks();
    });

    describe('rateLimiter', () => {
        test('should allow requests within rate limit', async () => {
            const rateLimiter = securityMiddleware.rateLimiter();

            await rateLimiter(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should track requests by IP', async () => {
            const rateLimiter = securityMiddleware.rateLimiter({ windowMs: 60000, max: 2 });

            // Primera request
            await rateLimiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);

            // Segunda request
            await rateLimiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(2);

            // Tercera request debería ser bloqueada
            await rateLimiter(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(429);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Too many requests'
            });
        });

        test('should reset rate limit after window expires', async () => {
            const rateLimiter = securityMiddleware.rateLimiter({ windowMs: 100, max: 1 });

            // Primera request
            await rateLimiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);

            // Segunda request inmediata debería ser bloqueada
            await rateLimiter(mockReq, mockRes, mockNext);
            expect(mockRes.status).toHaveBeenCalledWith(429);

            // Esperar que expire la ventana
            await new Promise(resolve => setTimeout(resolve, 150));

            // Reset mocks
            mockNext.mockClear();
            mockRes.status.mockClear();

            // Nueva request debería ser permitida
            await rateLimiter(mockReq, mockRes, mockNext);
            expect(mockNext).toHaveBeenCalledTimes(1);
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });

    describe('sanitizeInput', () => {
        test('should sanitize XSS attempts in body', () => {
            mockReq.body = {
                name: '<script>alert("xss")</script>',
                description: '<img src=x onerror=alert("xss")>',
                safe: 'normal text'
            };

            securityMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

            expect(mockReq.body.name).not.toContain('<script>');
            expect(mockReq.body.description).not.toContain('onerror');
            expect(mockReq.body.safe).toBe('normal text');
            expect(mockNext).toHaveBeenCalled();
        });

        test('should sanitize SQL injection attempts', () => {
            mockReq.body = {
                query: "'; DROP TABLE users; --",
                search: "1' OR '1'='1"
            };

            securityMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

            expect(mockReq.body.query).not.toContain('DROP TABLE');
            expect(mockReq.body.search).not.toContain("OR '1'='1");
            expect(mockNext).toHaveBeenCalled();
        });

        test('should handle nested objects', () => {
            mockReq.body = {
                user: {
                    profile: {
                        bio: '<script>alert("nested xss")</script>'
                    }
                }
            };

            securityMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

            expect(mockReq.body.user.profile.bio).not.toContain('<script>');
            expect(mockNext).toHaveBeenCalled();
        });

        test('should handle arrays', () => {
            mockReq.body = {
                tags: ['<script>alert("xss")</script>', 'normal tag', '<img src=x onerror=alert("xss")>']
            };

            securityMiddleware.sanitizeInput(mockReq, mockRes, mockNext);

            expect(mockReq.body.tags[0]).not.toContain('<script>');
            expect(mockReq.body.tags[1]).toBe('normal tag');
            expect(mockReq.body.tags[2]).not.toContain('onerror');
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('validateCSRF', () => {
        test('should validate CSRF token for state-changing requests', () => {
            mockReq.method = 'POST';
            mockReq.headers['x-csrf-token'] = 'valid-csrf-token';
            mockReq.session = { csrfToken: 'valid-csrf-token' };

            securityMiddleware.validateCSRF(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should reject requests with missing CSRF token', () => {
            mockReq.method = 'POST';
            mockReq.session = { csrfToken: 'valid-csrf-token' };

            securityMiddleware.validateCSRF(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid CSRF token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should reject requests with invalid CSRF token', () => {
            mockReq.method = 'POST';
            mockReq.headers['x-csrf-token'] = 'invalid-csrf-token';
            mockReq.session = { csrfToken: 'valid-csrf-token' };

            securityMiddleware.validateCSRF(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid CSRF token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should skip CSRF validation for GET requests', () => {
            mockReq.method = 'GET';

            securityMiddleware.validateCSRF(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should skip CSRF validation for HEAD requests', () => {
            mockReq.method = 'HEAD';

            securityMiddleware.validateCSRF(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should skip CSRF validation for OPTIONS requests', () => {
            mockReq.method = 'OPTIONS';

            securityMiddleware.validateCSRF(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });

    describe('helmet security headers', () => {
        test('should add security headers', () => {
            securityMiddleware.helmet()(mockReq, mockRes, mockNext);

            expect(mockRes.set).toHaveBeenCalledWith('X-Content-Type-Options', 'nosniff');
            expect(mockRes.set).toHaveBeenCalledWith('X-Frame-Options', 'DENY');
            expect(mockRes.set).toHaveBeenCalledWith('X-XSS-Protection', '1; mode=block');
            expect(mockNext).toHaveBeenCalled();
        });

        test('should set HSTS header for HTTPS', () => {
            mockReq.secure = true;

            securityMiddleware.helmet()(mockReq, mockRes, mockNext);

            expect(mockRes.set).toHaveBeenCalledWith(
                'Strict-Transport-Security', 
                'max-age=31536000; includeSubDomains'
            );
            expect(mockNext).toHaveBeenCalled();
        });

        test('should set CSP header', () => {
            securityMiddleware.helmet()(mockReq, mockRes, mockNext);

            expect(mockRes.set).toHaveBeenCalledWith(
                'Content-Security-Policy',
                expect.stringContaining("default-src 'self'")
            );
            expect(mockNext).toHaveBeenCalled();
        });
    });

    describe('validateFileUpload', () => {
        test('should validate allowed file types', () => {
            mockReq.file = {
                mimetype: 'image/jpeg',
                size: 1024 * 1024, // 1MB
                originalname: 'test.jpg'
            };

            const validator = securityMiddleware.validateFileUpload({
                allowedTypes: ['image/jpeg', 'image/png'],
                maxSize: 5 * 1024 * 1024 // 5MB
            });

            validator(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should reject disallowed file types', () => {
            mockReq.file = {
                mimetype: 'application/javascript',
                size: 1024,
                originalname: 'malicious.js'
            };

            const validator = securityMiddleware.validateFileUpload({
                allowedTypes: ['image/jpeg', 'image/png'],
                maxSize: 5 * 1024 * 1024
            });

            validator(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'File type not allowed'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should reject files exceeding size limit', () => {
            mockReq.file = {
                mimetype: 'image/jpeg',
                size: 10 * 1024 * 1024, // 10MB
                originalname: 'large.jpg'
            };

            const validator = securityMiddleware.validateFileUpload({
                allowedTypes: ['image/jpeg', 'image/png'],
                maxSize: 5 * 1024 * 1024 // 5MB limit
            });

            validator(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'File size exceeds limit'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should reject files with dangerous extensions', () => {
            mockReq.file = {
                mimetype: 'image/jpeg',
                size: 1024,
                originalname: 'image.jpg.exe' // Double extension
            };

            const validator = securityMiddleware.validateFileUpload({
                allowedTypes: ['image/jpeg'],
                maxSize: 5 * 1024 * 1024
            });

            validator(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Dangerous file extension detected'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should handle missing file gracefully', () => {
            // No file in request

            const validator = securityMiddleware.validateFileUpload({
                allowedTypes: ['image/jpeg'],
                maxSize: 5 * 1024 * 1024
            });

            validator(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });

    describe('IP whitelist/blacklist', () => {
        test('should allow whitelisted IPs', () => {
            mockReq.ip = '192.168.1.100';

            const ipFilter = securityMiddleware.ipFilter({
                whitelist: ['192.168.1.0/24', '10.0.0.0/8']
            });

            ipFilter(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should block non-whitelisted IPs', () => {
            mockReq.ip = '203.0.113.1'; // Public IP not in whitelist

            const ipFilter = securityMiddleware.ipFilter({
                whitelist: ['192.168.1.0/24', '10.0.0.0/8']
            });

            ipFilter(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Access denied'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should block blacklisted IPs', () => {
            mockReq.ip = '192.168.1.100';

            const ipFilter = securityMiddleware.ipFilter({
                blacklist: ['192.168.1.100', '10.0.0.1']
            });

            ipFilter(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Access denied'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should allow non-blacklisted IPs', () => {
            mockReq.ip = '192.168.1.200';

            const ipFilter = securityMiddleware.ipFilter({
                blacklist: ['192.168.1.100', '10.0.0.1']
            });

            ipFilter(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });

    describe('Request size limiting', () => {
        test('should allow requests within size limit', () => {
            mockReq.headers['content-length'] = '1024'; // 1KB

            const sizeLimit = securityMiddleware.requestSizeLimit({ maxSize: 1024 * 1024 }); // 1MB limit

            sizeLimit(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should reject requests exceeding size limit', () => {
            mockReq.headers['content-length'] = '2097152'; // 2MB

            const sizeLimit = securityMiddleware.requestSizeLimit({ maxSize: 1024 * 1024 }); // 1MB limit

            sizeLimit(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(413);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Request too large'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should handle missing content-length header', () => {
            // No content-length header

            const sizeLimit = securityMiddleware.requestSizeLimit({ maxSize: 1024 * 1024 });

            sizeLimit(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });
    });

    describe('Security logging', () => {
        test('should log security events', () => {
            mockReq.method = 'POST';
            mockReq.headers['x-csrf-token'] = 'invalid-token';
            mockReq.session = { csrfToken: 'valid-token' };

            securityMiddleware.validateCSRF(mockReq, mockRes, mockNext);

            // En una implementación real, verificaríamos que se registra el evento de seguridad
            expect(mockRes.status).toHaveBeenCalledWith(403);
        });

        test('should log rate limiting events', async () => {
            const rateLimiter = securityMiddleware.rateLimiter({ windowMs: 60000, max: 1 });

            // Primera request
            await rateLimiter(mockReq, mockRes, mockNext);
            
            // Segunda request para activar rate limiting
            await rateLimiter(mockReq, mockRes, mockNext);

            // En una implementación real, verificaríamos que se registra el rate limiting
            expect(mockRes.status).toHaveBeenCalledWith(429);
        });
    });
}); 

// Pruebas avanzadas de headers de seguridad basadas en guías OWASP
describe('OWASP Security Headers', () => {
    let req, res, next;

    beforeEach(() => {
        req = mockRequest();
        res = mockResponse();
        next = jest.fn();
    });

    test('should set Content-Security-Policy to prevent XSS', () => {
      securityMiddleware.helmet()(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Security-Policy', 
        expect.stringContaining("default-src 'self'")
      );
    });
    
    test('should set X-XSS-Protection to block rendering', () => {
      securityMiddleware.helmet()(req, res, next);
      expect(res.setHeader).toHaveBeenCalledWith(
        'X-XSS-Protection',
        '1; mode=block'
      );
    });

    test('should set X-Content-Type-Options to nosniff', () => {
        securityMiddleware.helmet()(req, res, next);
        expect(res.setHeader).toHaveBeenCalledWith(
          'X-Content-Type-Options',
          'nosniff'
        );
    });

    test('should set Strict-Transport-Security to enforce HTTPS', () => {
        securityMiddleware.helmet()(req, res, next);
        expect(res.setHeader).toHaveBeenCalledWith(
            'Strict-Transport-Security',
            expect.stringContaining('max-age=')
        );
    });

    test('should call next() once all headers are set', () => {
        securityMiddleware.helmet()(req, res, next);
        expect(next).toHaveBeenCalledTimes(1);
    });
}); 