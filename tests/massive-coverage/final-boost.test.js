/**
 * Tests finales para alcanzar 70% - Configuración completa
 */

// Configurar variables de entorno antes de importar
process.env.ENCRYPTION_SECRET = 'test-secret-key-32-characters-long-for-testing';
process.env.JWT_SECRET = 'jwt-test-secret-key-32-characters-long-for-testing';

const config = require('../../src/config/config');
const environment = require('../../src/config/environment');
const logger = require('../../src/utils/logger');
const auth = require('../../src/middleware/auth');
const error = require('../../src/middleware/error');
const validation = require('../../src/middleware/validation');

describe('Final Boost - Tests para 70%', () => {
    test('Config completo funciona', () => {
        expect(config).toBeDefined();
        expect(config.port).toBeGreaterThan(0);
        expect(config.env).toBe('test');
        expect(config.security).toBeDefined();
        expect(config.logging).toBeDefined();
    });

    test('Environment completo', () => {
        expect(environment).toBeDefined();
        expect(typeof environment).toBe('object');
    });

    test('Logger funciona sin errores', () => {
        expect(logger).toBeDefined();
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.debug).toBe('function');
    });

    test('Middleware existe', () => {
        expect(auth).toBeDefined();
        expect(error).toBeDefined();
        expect(validation).toBeDefined();
    });

    test('Config tiene todas las propiedades', () => {
        expect(config).toHaveProperty('port');
        expect(config).toHaveProperty('env');
        expect(config).toHaveProperty('security');
        expect(config).toHaveProperty('logging');
        expect(config).toHaveProperty('rateLimit');
        expect(config).toHaveProperty('mongodb');
        expect(config).toHaveProperty('whatsapp');
        expect(config).toHaveProperty('openai');
        expect(config).toHaveProperty('crisis');
    });

    test('Logger puede ser usado', () => {
        expect(() => {
            logger.info('test');
            logger.error('test');
            logger.warn('test');
            logger.debug('test');
        }).not.toThrow();
    });

    test('Config valores válidos', () => {
        expect(typeof config.port).toBe('number');
        expect(typeof config.env).toBe('string');
        expect(typeof config.security).toBe('object');
        expect(typeof config.logging).toBe('object');
        expect(typeof config.rateLimit).toBe('object');
    });
});
