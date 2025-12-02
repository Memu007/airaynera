const encryption = require('../../src/utils/encryption');

describe('Encryption Utils', () => {
    beforeEach(() => {
        process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32-chars!!';
    });

    describe('Basic encryption/decryption', () => {
        test('should encrypt and decrypt text correctly', () => {
            const text = 'Hello World';
            const encrypted = encryption.encrypt(text);
            const decrypted = encryption.decrypt(encrypted);
            
            expect(decrypted).toBe(text);
            expect(encrypted).not.toBe(text);
        });

        test('should handle empty strings', () => {
            const encrypted = encryption.encrypt('');
            const decrypted = encryption.decrypt(encrypted);
            
            expect(decrypted).toBe('');
        });

        test('should handle null values', () => {
            const result = encryption.encrypt(null);
            expect(result).toBeNull();
        });

        test('should handle undefined values', () => {
            const result = encryption.encrypt(undefined);
            expect(result).toBeUndefined();
        });
    });

    describe('Object encryption', () => {
        test('should encrypt sensitive fields in object', () => {
            const obj = {
                name: 'John',
                email: 'john@example.com',
                password: 'secret123'
            };
            const sensitiveFields = ['password'];
            
            const result = encryption.encryptSensitiveFields(obj, sensitiveFields);
            
            expect(result.name).toBe('John');
            expect(result.email).toBe('john@example.com');
            expect(result.password).not.toBe('secret123');
        });

        test('should handle empty objects', () => {
            const result = encryption.encryptSensitiveFields({}, []);
            expect(result).toEqual({});
        });

        test('should handle null objects', () => {
            const result = encryption.encryptSensitiveFields(null, []);
            expect(result).toBeNull();
        });
    });

    describe('isEncrypted', () => {
        test('should identify encrypted data', () => {
            const text = 'Hello World';
            const encrypted = encryption.encrypt(text);
            
            expect(encryption.isEncrypted(encrypted)).toBe(true);
            expect(encryption.isEncrypted(text)).toBe(false);
        });

        test('should handle invalid data', () => {
            expect(encryption.isEncrypted(null)).toBe(false);
            expect(encryption.isEncrypted(undefined)).toBe(false);
            expect(encryption.isEncrypted('')).toBe(false);
        });
    });
}); 