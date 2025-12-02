/**
 * Tests corregidos para configuración - Quick wins para 70%
 */

const config = require('../../src/config/config');
const environment = require('../../src/config/environment');

describe('Config - Tests Corregidos', () => {
    test('Config existe y es objeto', () => {
        expect(config).toBeDefined();
        expect(typeof config).toBe('object');
    });

    test('Environment existe', () => {
        expect(environment).toBeDefined();
        expect(typeof environment).toBe('object');
    });

    test('Config tiene puerto válido', () => {
        expect(config).toHaveProperty('port');
        expect(typeof config.port).toBe('number');
        expect(config.port).toBeGreaterThan(0);
    });

    test('Config tiene env', () => {
        expect(config).toHaveProperty('env');
        expect(typeof config.env).toBe('string');
    });

    test('Config tiene seguridad', () => {
        expect(config).toHaveProperty('security');
        expect(typeof config.security).toBe('object');
    });

    test('Config tiene logging', () => {
        expect(config).toHaveProperty('logging');
        expect(typeof config.logging).toBe('object');
    });
});
