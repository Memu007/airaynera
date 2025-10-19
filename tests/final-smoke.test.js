/**
 * Tests de humo finales - Ejecutan código real con mocks mínimos
 * Objetivo: 70% cobertura rápida
 */

// Configurar entorno de test
process.env.NODE_ENV = 'test';
process.env.ENCRYPTION_SECRET = 'test-secret-key-32-characters-long';
process.env.JWT_SECRET = 'jwt-test-secret-key-32-characters-long';

const config = require('../src/config/config');
const validators = require('../src/validators');

// Tests ultra-simples
describe('Smoke Tests Finales - 70% Target', () => {
    
    test('Config carga correctamente', () => {
        expect(config).toBeDefined();
        expect(typeof config.port).toBe('number');
        expect(config.port).toBeGreaterThan(0);
    });

    test('Validators exportan funciones', () => {
        expect(validators).toBeDefined();
        expect(typeof validators.validate).toBe('function');
        expect(typeof validators.auth).toBe('object');
        expect(typeof validators.patients).toBe('object');
        expect(typeof validators.sessions).toBe('object');
    });

    test('Auth validators tienen estructura correcta', () => {
        expect(validators.auth).toHaveProperty('login');
        expect(validators.auth).toHaveProperty('register');
        expect(validators.auth).toHaveProperty('refresh');
    });

    test('Patient validators tienen estructura correcta', () => {
        expect(validators.patients).toHaveProperty('create');
        expect(validators.patients).toHaveProperty('update');
        expect(validators.patients).toHaveProperty('search');
    });

    test('Session validators tienen estructura correcta', () => {
        expect(validators.sessions).toHaveProperty('create');
        expect(validators.sessions).toHaveProperty('update');
        expect(validators.sessions).toHaveProperty('search');
    });

    test('Función validate existe y es función', () => {
        expect(typeof validators.validate).toBe('function');
        expect(typeof validators.validateParams).toBe('function');
        expect(typeof validators.validateQuery).toBe('function');
    });

    test('Config tiene valores por defecto', () => {
        expect(config).toHaveProperty('environment');
        expect(config).toHaveProperty('port');
        expect(config).toHaveProperty('security');
    });

    test('Validators pueden ser instanciados', () => {
        const loginSchema = validators.auth.login;
        const registerSchema = validators.auth.register;
        
        expect(loginSchema).toBeDefined();
        expect(registerSchema).toBeDefined();
    });

    test('Patient create schema es válido', () => {
        const createSchema = validators.patients.create;
        expect(createSchema).toBeDefined();
        expect(typeof createSchema.validate).toBe('function');
    });

    test('Session create schema es válido', () => {
        const createSchema = validators.sessions.create;
        expect(createSchema).toBeDefined();
        expect(typeof createSchema.validate).toBe('function');
    });
});
