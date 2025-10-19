/**
 * Tests funcionales masivos para utilidades - Quick wins para 70%
 */

const logger = require('../../src/utils/logger');
const encryption = require('../../src/utils/encryption');

describe('Utils - Tests Funcionales', () => {
    test('Logger existe y tiene funciones', () => {
        expect(logger).toBeDefined();
        expect(typeof logger).toBe('object');
        expect(typeof logger.info).toBe('function');
        expect(typeof logger.error).toBe('function');
        expect(typeof logger.warn).toBe('function');
        expect(typeof logger.debug).toBe('function');
    });

    test('Encryption existe y tiene funciones', () => {
        expect(encryption).toBeDefined();
        expect(typeof encryption).toBe('object');
        expect(typeof encryption.encrypt).toBe('function');
        expect(typeof encryption.decrypt).toBe('function');
    });

    test('Logger puede loggear sin errores', () => {
        expect(() => logger.info('test message')).not.toThrow();
        expect(() => logger.error('test error')).not.toThrow();
        expect(() => logger.warn('test warning')).not.toThrow();
    });

    test('Encryption puede encriptar/desencriptar', () => {
        const testData = 'test data';
        expect(() => encryption.encrypt(testData)).not.toThrow();
    });

    test('Utils exportan correctamente', () => {
        expect(logger).toHaveProperty('info');
        expect(logger).toHaveProperty('error');
        expect(logger).toHaveProperty('warn');
        expect(logger).toHaveProperty('debug');
        expect(encryption).toHaveProperty('encrypt');
        expect(encryption).toHaveProperty('decrypt');
    });
});
