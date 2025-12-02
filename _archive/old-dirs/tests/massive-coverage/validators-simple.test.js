/**
 * Tests simples para validadores - Último esfuerzo
 */

const { validateEmail, validatePassword, validatePhone } = require('../../validators');

describe('Validators - Simple Functional Tests', () => {
    test('Validator functions should be defined', () => {
        expect(validateEmail).toBeDefined();
        expect(typeof validateEmail).toBe('function');
        expect(validatePassword).toBeDefined();
        expect(typeof validatePassword).toBe('function');
        expect(validatePhone).toBeDefined();
        expect(typeof validatePhone).toBe('function');
    });

    test('Email validation works with valid and invalid inputs', () => {
        expect(validateEmail('test@example.com')).toBe(true);
        expect(validateEmail('invalid')).toBe(false);
    });

    test('Password validation works with valid and invalid inputs', () => {
        expect(validatePassword('SecurePass123!')).toBe(true);
        expect(validatePassword('weak')).toBe(false);
    });

    test('Phone validation works with valid and invalid inputs', () => {
        expect(validatePhone('+1234567890')).toBe(true);
        expect(validatePhone('invalid')).toBe(false);
    });
});
