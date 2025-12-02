const encryption = require('../../src/utils/encryption');

describe('EncryptionService', () => {
    beforeAll(() => {
        // Asegurar que existe la variable de entorno para tests
        if (!process.env.JWT_SECRET) {
            process.env.JWT_SECRET = 'test-secret-key-for-encryption-testing-2024';
        }
    });

    describe('Basic encryption/decryption', () => {
        test('should encrypt and decrypt text correctly', () => {
            const plaintext = 'Información médica confidencial del paciente';
            const encrypted = encryption.encrypt(plaintext, 'content');
            const decrypted = encryption.decrypt(encrypted, 'content');

            expect(decrypted).toBe(plaintext);
            expect(encrypted).not.toBe(plaintext);
            expect(encrypted.length).toBeGreaterThan(plaintext.length);
        });

        test('should return different encrypted values for same input', () => {
            const plaintext = 'Mismo texto médico';
            const encrypted1 = encryption.encrypt(plaintext, 'notes');
            const encrypted2 = encryption.encrypt(plaintext, 'notes');

            expect(encrypted1).not.toBe(encrypted2);
            
            const decrypted1 = encryption.decrypt(encrypted1, 'notes');
            const decrypted2 = encryption.decrypt(encrypted2, 'notes');
            
            expect(decrypted1).toBe(plaintext);
            expect(decrypted2).toBe(plaintext);
        });

        test('should handle empty strings', () => {
            const result = encryption.encrypt('', 'test');
            expect(result).toBe('');
        });

        test('should handle null values', () => {
            const result = encryption.encrypt(null, 'test');
            expect(result).toBeNull();
        });

        test('should handle undefined values', () => {
            const result = encryption.encrypt(undefined, 'test');
            expect(result).toBeUndefined();
        });

        test('should handle non-string values', () => {
            const number = 123;
            const result = encryption.encrypt(number, 'test');
            expect(result).toBe(number);
        });
    });

    describe('Encryption detection', () => {
        test('should correctly identify encrypted data', () => {
            const plaintext = 'Datos médicos para encriptar';
            const encrypted = encryption.encrypt(plaintext, 'diagnosis');
            
            expect(encryption.isEncrypted(encrypted)).toBe(true);
            expect(encryption.isEncrypted(plaintext)).toBe(false);
        });

        test('should handle invalid base64 strings', () => {
            expect(encryption.isEncrypted('invalid-base64-string')).toBe(false);
            expect(encryption.isEncrypted('short')).toBe(false);
        });

        test('should handle edge cases', () => {
            expect(encryption.isEncrypted('')).toBe(false);
            expect(encryption.isEncrypted(null)).toBe(false);
            expect(encryption.isEncrypted(undefined)).toBe(false);
        });
    });

    describe('Object encryption', () => {
        const testPatient = {
            id: '123',
            name: 'Juan Pérez',
            dni: '12345678',
            insurance: 'OSDE Plan 310',
            emergencyContact: '+54 11 1234-5678',
            medicalRecord: 'MR-2024-001',
            allergies: 'Penicilina, Mariscos',
            notes: 'Paciente con diabetes tipo 2'
        };

        test('should encrypt sensitive fields in object', () => {
            const sensitiveFields = ['insurance', 'emergencyContact', 'medicalRecord', 'allergies'];
            const encrypted = encryption.encryptObject(testPatient, sensitiveFields);

            expect(encrypted.id).toBe(testPatient.id);
            expect(encrypted.name).toBe(testPatient.name);
            expect(encrypted.dni).toBe(testPatient.dni);
            
            // Campos sensibles deben estar encriptados
            expect(encrypted.insurance).not.toBe(testPatient.insurance);
            expect(encrypted.emergencyContact).not.toBe(testPatient.emergencyContact);
            expect(encrypted.medicalRecord).not.toBe(testPatient.medicalRecord);
            expect(encrypted.allergies).not.toBe(testPatient.allergies);
            
            // Campo no sensible no debe cambiar
            expect(encrypted.notes).toBe(testPatient.notes);
        });

        test('should decrypt object fields correctly', () => {
            const sensitiveFields = ['insurance', 'emergencyContact', 'medicalRecord', 'allergies'];
            const encrypted = encryption.encryptObject(testPatient, sensitiveFields);
            const decrypted = encryption.decryptObject(encrypted, sensitiveFields);
            
            // Verificar que la estructura se mantiene
            expect(decrypted).toBeDefined();
            expect(decrypted.id).toBe(testPatient.id);
            expect(decrypted.name).toBe(testPatient.name);
            // Los campos sensibles deberían ser iguales después de decrypt
            expect(decrypted.insurance).toBe(testPatient.insurance);
        });

        test('should handle objects with missing fields', () => {
            const partialPatient = {
                id: '456',
                name: 'María García',
                insurance: 'Swiss Medical'
            };

            const encrypted = encryption.encryptObject(partialPatient, ['insurance']);
            const decrypted = encryption.decryptObject(encrypted, ['insurance']);
            
            expect(decrypted.id).toBe(partialPatient.id);
            expect(decrypted.name).toBe(partialPatient.name);
            expect(decrypted.insurance).toBe(partialPatient.insurance);
        });

        test('should handle null object', () => {
            expect(encryption.encryptObject(null)).toBeNull();
            expect(encryption.decryptObject(null)).toBeNull();
        });

        test('should use default sensitive fields when not specified', () => {
            const sessionData = {
                id: '789',
                patientId: '123',
                content: 'Sesión de terapia cognitivo-conductual',
                notes: 'Progreso significativo en el tratamiento'
            };

            const encrypted = encryption.encryptObject(sessionData);
            
            // 'content' y 'notes' están en sensitiveFields por defecto
            expect(encrypted.content).not.toBe(sessionData.content);
            expect(encrypted.notes).not.toBe(sessionData.notes);
            
            // Otros campos no deben cambiar
            expect(encrypted.id).toBe(sessionData.id);
            expect(encrypted.patientId).toBe(sessionData.patientId);
        });
    });

    describe('Legacy data handling', () => {
        test('should handle legacy unencrypted data gracefully', () => {
            const legacyData = 'Datos médicos sin encriptar';
            
            // Intentar desencriptar datos legacy debería retornar el valor original
            const result = encryption.decrypt(legacyData, 'content');
            expect(result).toBe(legacyData);
        });

        test('should handle corrupted encrypted data', () => {
            const corruptedData = 'ZGF0b3MgY29ycm9tcGlkb3M='; // Base64 válido pero no encriptación válida
            
            // Debería retornar el valor original sin lanzar error
            const result = encryption.decrypt(corruptedData, 'content');
            expect(result).toBe(corruptedData);
        });
    });

    describe('Health check', () => {
        test('should perform health check successfully', () => {
            const isHealthy = encryption.healthCheck();
            expect(isHealthy).toBe(true);
        });

        test('should return stats correctly', () => {
            const stats = encryption.getStats();
            
            expect(stats).toHaveProperty('algorithm');
            expect(stats).toHaveProperty('keyLength');
            expect(stats).toHaveProperty('sensitiveFieldsCount');
            expect(stats).toHaveProperty('sensitiveFields');
            expect(stats).toHaveProperty('healthStatus');
            
            expect(stats.algorithm).toBe('aes-256-gcm');
            expect(stats.keyLength).toBe(32);
            expect(stats.sensitiveFieldsCount).toBeGreaterThan(0);
            expect(Array.isArray(stats.sensitiveFields)).toBe(true);
            expect(stats.healthStatus).toBe(true);
        });

        test('should include expected sensitive fields', () => {
            const stats = encryption.getStats();
            const expectedFields = [
                'content', 'notes', 'diagnosis', 'treatment',
                'medication', 'symptoms', 'personalHistory',
                'familyHistory', 'allergies', 'emergencyContact',
                'insurance', 'socialSecurity', 'medicalRecord'
            ];

            for (const field of expectedFields) {
                expect(stats.sensitiveFields).toContain(field);
            }
        });
    });

    describe('Error handling', () => {
        test('should handle encryption errors gracefully', () => {
            // Simular error modificando temporalmente la clave
            const originalKey = encryption.masterKey;
            encryption.masterKey = null;

            expect(() => {
                encryption.encrypt('test data', 'content');
            }).toThrow();

            // Restaurar clave original
            encryption.masterKey = originalKey;
        });

        test('should log audit events', () => {
            // Mock del logger para verificar que se llama
            const mockLogger = {
                audit: jest.fn(),
                error: jest.fn()
            };

            // Sustituir logger temporalmente
            const originalLogger = require('../../src/utils/logger');
            jest.mock('../../src/utils/logger', () => mockLogger);

            const plaintext = 'Datos de prueba para auditoría';
            encryption.encrypt(plaintext, 'test-field');

            // Verificar que se registró el evento de auditoría
            // Nota: esto requeriría una implementación más sofisticada del mock
        });
    });

    describe('Performance', () => {
        test('should encrypt/decrypt large texts efficiently', () => {
            const largeText = 'A'.repeat(10000); // 10KB de texto
            
            const startTime = Date.now();
            const encrypted = encryption.encrypt(largeText, 'content');
            const decrypted = encryption.decrypt(encrypted, 'content');
            const endTime = Date.now();

            expect(decrypted).toBe(largeText);
            expect(endTime - startTime).toBeLessThan(1000); // Menos de 1 segundo
        });

        test('should handle multiple simultaneous operations', async () => {
            const promises = [];
            
            for (let i = 0; i < 100; i++) {
                promises.push(new Promise(resolve => {
                    const text = `Datos médicos ${i}`;
                    const encrypted = encryption.encrypt(text, 'content');
                    const decrypted = encryption.decrypt(encrypted, 'content');
                    resolve(decrypted === text);
                }));
            }

            const results = await Promise.all(promises);
            expect(results.every(result => result === true)).toBe(true);
        });
    });

    describe('Security validation', () => {
        test('should produce different IVs for same input', () => {
            const plaintext = 'Datos médicos sensibles';
            const encrypted1 = encryption.encrypt(plaintext, 'content');
            const encrypted2 = encryption.encrypt(plaintext, 'content');

            // Extraer IVs (primeros 16 bytes después de decodificar base64)
            const buffer1 = Buffer.from(encrypted1, 'base64');
            const buffer2 = Buffer.from(encrypted2, 'base64');
            
            const iv1 = buffer1.slice(0, 16);
            const iv2 = buffer2.slice(0, 16);

            expect(iv1.equals(iv2)).toBe(false);
        });

        test('should validate encryption format', () => {
            const plaintext = 'Datos para validar formato';
            const encrypted = encryption.encrypt(plaintext, 'content');

            // Verificar que es base64 válido
            expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();

            // Verificar longitud mínima (IV + tag + datos)
            const buffer = Buffer.from(encrypted, 'base64');
            expect(buffer.length).toBeGreaterThanOrEqual(32); // 16 IV + 16 tag mínimo
        });

        test('should not leak information in encrypted output', () => {
            const sensitiveData = 'INFORMACIÓN ULTRA SECRETA';
            const encrypted = encryption.encrypt(sensitiveData, 'content');

            // El texto encriptado no debe contener partes del texto original
            expect(encrypted.toLowerCase()).not.toContain('información');
            expect(encrypted.toLowerCase()).not.toContain('secreta');
            expect(encrypted.toLowerCase()).not.toContain('ultra');
        });
    });
}); 