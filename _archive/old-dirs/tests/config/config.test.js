const config = require('../../src/config/config');

describe('Config Tests', () => {
    beforeEach(() => {
        // Set up environment variables for testing
        process.env.NODE_ENV = 'test';
        process.env.JWT_SECRET = 'test-jwt-secret';
        process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32-chars!!';
    });

    describe('Configuration loading', () => {
        test('should load configuration', () => {
            expect(config).toBeDefined();
            expect(typeof config).toBe('object');
        });

        test('should have security config', () => {
            expect(config.security).toBeDefined();
            expect(config.security.jwtSecret).toBeDefined();
        });

        test('should have database config', () => {
            expect(config.database).toBeDefined();
        });

        test('should have server config', () => {
            expect(config.server).toBeDefined();
        });
    });

    describe('Environment handling', () => {
        test('should handle test environment', () => {
            expect(config.environment).toBe('test');
        });

        test('should validate required secrets', () => {
            expect(config.security.jwtSecret).toBeTruthy();
        });
    });

    describe('Rate limiting config', () => {
        test('should have rate limit settings', () => {
            expect(config.rateLimit).toBeDefined();
            expect(config.rateLimit.windowMs).toBeGreaterThan(0);
            expect(config.rateLimit.max).toBeGreaterThan(0);
        });
    });
}); 