const { validateEmail, validatePassword, validateRequired, sanitizeInput } = require('../validators/simple-validator');

describe('Validators', () => {
    describe('Email validation', () => {
        test('should validate correct email', () => {
            expect(validateEmail('test@example.com')).toBe(true);
        });

        test('should reject invalid email', () => {
            expect(validateEmail('invalid-email')).toBe(false);
        });
    });

    describe('Password validation', () => {
        test('should validate strong password', () => {
            expect(validatePassword('StrongPass123!')).toBe(true);
        });

        test('should reject weak password', () => {
            expect(validatePassword('weak')).toBe(false);
        });
    });

    describe('Required fields validation', () => {
        test('should validate required fields', () => {
            const data = { name: 'Test', email: 'test@example.com' };
            const required = ['name', 'email'];
            expect(validateRequired(data, required)).toBe(true);
        });

        test('should detect missing fields', () => {
            const data = { name: 'Test' };
            const required = ['name', 'email'];
            expect(validateRequired(data, required)).toBe(false);
        });
    });

    describe('Data sanitization', () => {
        test('should sanitize input data', () => {
            expect(sanitizeInput('<script>alert("xss")</script>')).toBe('');
        });

        test('should handle null input', () => {
            expect(sanitizeInput(null)).toBe('');
            expect(sanitizeInput(undefined)).toBe('');
        });
    });
});
