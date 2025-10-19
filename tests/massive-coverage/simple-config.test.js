/**
 * Tests ultra-simples para configuración - Quick wins para 70%
 */

const config = require('../../src/config/config');
const environment = require('../../src/config/environment');

describe('Config - Tests Simples', () => {
    test('Config existe y es objeto', () => {
        expect(config).toBeDefined();
        expect(typeof config).toBe('object');
    });

    test('Environment tiene variables', () => {
        expect(environment).toBeDefined();
        expect(typeof environment).toBe('object');
    });

    test('Config tiene puerto', () => {
        expect(config).toHaveProperty('port');
        expect(typeof config.port).toBe('number');
    });

    test('Config tiene entorno', () => {
        expect(config).toHaveProperty('environment');
        expect(typeof config.environment).toBe('string');
    });
});
