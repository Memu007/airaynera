const validators = require('../../src/validators');

describe('Validators', () => {
    describe('validateEmail', () => {
        test('should validate correct email formats', () => {
            const validEmails = [
                'test@example.com',
                'user.name@domain.co.uk',
                'test+tag@gmail.com',
                'user123@test-domain.org',
                'a@b.co'
            ];

            validEmails.forEach(email => {
                expect(validators.validateEmail(email)).toBe(true);
            });
        });

        test('should reject invalid email formats', () => {
            const invalidEmails = [
                'invalid-email',
                '@domain.com',
                'user@',
                'user@@domain.com',
                'user@domain',
                'user name@domain.com',
                '',
                null,
                undefined,
                123
            ];

            invalidEmails.forEach(email => {
                expect(validators.validateEmail(email)).toBe(false);
            });
        });

        test('should handle edge cases', () => {
            expect(validators.validateEmail('a'.repeat(64) + '@domain.com')).toBe(false); // Too long local part
            expect(validators.validateEmail('test@' + 'a'.repeat(64) + '.com')).toBe(false); // Too long domain
            expect(validators.validateEmail('test@domain.' + 'a'.repeat(10))).toBe(false); // Too long TLD
        });
    });

    // Tests parametrizados para validación avanzada de email
    describe.each([
      ['user@example.com', true, 'valid email'],
      ['invalid-email@', false, 'invalid email (trailing @)'],
      ['', false, 'empty string'],
      [null, false, 'null value'],
      ['a@b.c', true, 'short but valid email'],
      ['test@sub.domain.co.uk', true, 'email with subdomain'],
      ['email with space@test.com', false, 'email with space'],
      [undefined, false, 'undefined value']
    ])('validateEmail(%s)', (input, expected, description) => {
      test(`should return ${expected} for ${description}`, () => {
        expect(validators.validateEmail(input)).toBe(expected);
      });
    });

    describe('validatePassword', () => {
        test('should validate strong passwords', () => {
            const strongPasswords = [
                'SecurePassword123!',
                'MyP@ssw0rd',
                'ComplexPass1$',
                'Str0ng!P@ssword',
                'AnotherGoodP@ss1'
            ];

            strongPasswords.forEach(password => {
                const result = validators.validatePassword(password);
                expect(result.isValid).toBe(true);
                expect(result.errors).toHaveLength(0);
            });
        });

        test('should reject weak passwords', () => {
            const weakPasswords = [
                { password: '123', expectedErrors: ['length', 'uppercase', 'lowercase', 'special'] },
                { password: 'password', expectedErrors: ['uppercase', 'number', 'special'] },
                { password: 'PASSWORD', expectedErrors: ['lowercase', 'number', 'special'] },
                { password: '12345678', expectedErrors: ['uppercase', 'lowercase', 'special'] },
                { password: 'Password1', expectedErrors: ['special'] },
                { password: 'short', expectedErrors: ['length', 'uppercase', 'number', 'special'] }
            ];

            weakPasswords.forEach(({ password, expectedErrors }) => {
                const result = validators.validatePassword(password);
                expect(result.isValid).toBe(false);
                expectedErrors.forEach(errorType => {
                    expect(result.errors.some(err => err.type === errorType)).toBe(true);
                });
            });
        });

        test('should provide detailed error messages', () => {
            const result = validators.validatePassword('weak');
            
            expect(result.errors).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({ type: 'length', message: expect.any(String) }),
                    expect.objectContaining({ type: 'uppercase', message: expect.any(String) }),
                    expect.objectContaining({ type: 'number', message: expect.any(String) }),
                    expect.objectContaining({ type: 'special', message: expect.any(String) })
                ])
            );
        });

        test('should handle null and undefined passwords', () => {
            expect(validators.validatePassword(null).isValid).toBe(false);
            expect(validators.validatePassword(undefined).isValid).toBe(false);
            expect(validators.validatePassword('').isValid).toBe(false);
        });
    });

    // Tests parametrizados para validación avanzada de contraseñas
    describe.each([
      ['StrongPass123!', true, 'strong password'],
      ['weak', false, 'short password'],
      ['noNumber!', false, 'password without numbers'],
      ['NoSpecialChar123', false, 'password without special chars'],
      ['L0ngP@ssw0rdW1thSpec!alChars', true, 'long and strong password'],
      ['Short1!', false, 'short password with number and special char']
    ])('validatePassword(%s)', (input, expected, description) => {
      test(`should return ${expected} for ${description}`, () => {
        expect(validators.validatePassword(input)).toBe(expected);
      });
    });

    describe('validateDNI', () => {
        test('should validate correct DNI formats', () => {
            const validDNIs = [
                '12345678',
                '87654321',
                '11111111',
                '99999999'
            ];

            validDNIs.forEach(dni => {
                expect(validators.validateDNI(dni)).toBe(true);
            });
        });

        test('should reject invalid DNI formats', () => {
            const invalidDNIs = [
                '123',          // Too short
                '123456789',    // Too long
                '1234567a',     // Contains letters
                '12-345-678',   // Contains hyphens
                '',             // Empty
                null,           // Null
                undefined,      // Undefined
                123456789       // Number instead of string
            ];

            invalidDNIs.forEach(dni => {
                expect(validators.validateDNI(dni)).toBe(false);
            });
        });

        test('should validate Argentine DNI with checksum', () => {
            // Test some real Argentine DNI numbers with valid checksums
            const validArgentineDNIs = [
                '20123456',
                '30987654'
            ];

            validArgentineDNIs.forEach(dni => {
                expect(validators.validateDNI(dni, 'AR')).toBe(true);
            });
        });
    });

    describe('validatePhone', () => {
        test('should validate international phone numbers', () => {
            const validPhones = [
                '+1234567890',
                '+54 11 1234-5678',
                '+34 123 456 789',
                '+44 20 1234 5678',
                '1234567890'
            ];

            validPhones.forEach(phone => {
                expect(validators.validatePhone(phone)).toBe(true);
            });
        });

        test('should reject invalid phone numbers', () => {
            const invalidPhones = [
                '123',              // Too short
                'abc123456789',     // Contains letters
                '+',                // Only plus sign
                '++1234567890',     // Double plus
                '',                 // Empty
                null,               // Null
                undefined           // Undefined
            ];

            invalidPhones.forEach(phone => {
                expect(validators.validatePhone(phone)).toBe(false);
            });
        });

        test('should validate by country code', () => {
            expect(validators.validatePhone('+54 11 1234-5678', 'AR')).toBe(true);
            expect(validators.validatePhone('+1 123 456 7890', 'US')).toBe(true);
            expect(validators.validatePhone('+34 123 456 789', 'ES')).toBe(true);
        });
    });

    describe('validateDate', () => {
        test('should validate correct date formats', () => {
            const validDates = [
                '2024-01-15',
                '1990-12-31',
                '2000-02-29', // Leap year
                new Date('2024-01-01').toISOString(),
                new Date()
            ];

            validDates.forEach(date => {
                expect(validators.validateDate(date)).toBe(true);
            });
        });

        test('should reject invalid dates', () => {
            const invalidDates = [
                '2024-13-01',   // Invalid month
                '2024-01-32',   // Invalid day
                '2023-02-29',   // Not a leap year
                'invalid-date',
                '',
                null,
                undefined
            ];

            invalidDates.forEach(date => {
                expect(validators.validateDate(date)).toBe(false);
            });
        });

        test('should validate age restrictions', () => {
            const today = new Date();
            const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
            const futureDate = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());

            expect(validators.validateDate(eighteenYearsAgo.toISOString(), { minAge: 18 })).toBe(true);
            expect(validators.validateDate(futureDate.toISOString(), { maxAge: 100 })).toBe(false);
        });
    });

    describe('validatePatientData', () => {
        test('should validate complete patient data', () => {
            const validPatient = {
                name: 'Juan Pérez',
                dni: '12345678',
                email: 'juan@example.com',
                phone: '+54 11 1234-5678',
                dateOfBirth: '1990-05-15'
            };

            const result = validators.validatePatientData(validPatient);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should validate partial patient data for updates', () => {
            const partialData = {
                phone: '+54 11 9876-5432'
            };

            const result = validators.validatePatientData(partialData, { partial: true });
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject invalid patient data', () => {
            const invalidPatient = {
                name: '',
                dni: '123',
                email: 'invalid-email',
                phone: 'abc',
                dateOfBirth: 'invalid-date'
            };

            const result = validators.validatePatientData(invalidPatient);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            
            // Should have errors for each invalid field
            expect(result.errors.some(err => err.field === 'name')).toBe(true);
            expect(result.errors.some(err => err.field === 'dni')).toBe(true);
            expect(result.errors.some(err => err.field === 'email')).toBe(true);
            expect(result.errors.some(err => err.field === 'phone')).toBe(true);
            expect(result.errors.some(err => err.field === 'dateOfBirth')).toBe(true);
        });

        test('should validate required fields', () => {
            const result = validators.validatePatientData({});
            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.field === 'name' && err.type === 'required')).toBe(true);
            expect(result.errors.some(err => err.field === 'dni' && err.type === 'required')).toBe(true);
        });
    });

    describe('validateSessionData', () => {
        test('should validate complete session data', () => {
            const validSession = {
                patientId: 'patient-123',
                content: 'Session content with enough detail for a therapy session',
                notes: 'Additional therapy notes',
                date: new Date().toISOString(),
                duration: 60
            };

            const result = validators.validateSessionData(validSession);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should reject invalid session data', () => {
            const invalidSession = {
                patientId: '',
                content: 'Short',  // Too short
                duration: -5       // Negative duration
            };

            const result = validators.validateSessionData(invalidSession);
            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });

        test('should validate content length', () => {
            const sessionWithShortContent = {
                patientId: 'patient-123',
                content: 'Too short'
            };

            const result = validators.validateSessionData(sessionWithShortContent);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.field === 'content' && err.type === 'minLength')).toBe(true);
        });

        test('should validate duration ranges', () => {
            const invalidDurations = [-5, 0, 500]; // Negative, zero, too long

            invalidDurations.forEach(duration => {
                const session = {
                    patientId: 'patient-123',
                    content: 'Valid session content with appropriate length',
                    duration
                };

                const result = validators.validateSessionData(session);
                expect(result.isValid).toBe(false);
            });
        });
    });

    describe('sanitizeInput', () => {
        test('should remove HTML tags', () => {
            const dirtyInput = '<script>alert("xss")</script>Hello World<b>Bold</b>';
            const cleaned = validators.sanitizeInput(dirtyInput);
            
            expect(cleaned).not.toContain('<script>');
            expect(cleaned).not.toContain('</script>');
            expect(cleaned).not.toContain('<b>');
            expect(cleaned).toContain('Hello World');
        });

        test('should remove dangerous attributes', () => {
            const dirtyInput = '<img src="x" onerror="alert(\'xss\')" alt="test">';
            const cleaned = validators.sanitizeInput(dirtyInput);
            
            expect(cleaned).not.toContain('onerror');
            expect(cleaned).not.toContain('alert');
        });

        test('should handle SQL injection attempts', () => {
            const sqlInjection = "'; DROP TABLE users; --";
            const cleaned = validators.sanitizeInput(sqlInjection);
            
            expect(cleaned).not.toContain('DROP TABLE');
            expect(cleaned).not.toContain('--');
        });

        test('should preserve safe content', () => {
            const safeInput = 'This is normal text with números 123 and símbolos @#$%';
            const cleaned = validators.sanitizeInput(safeInput);
            
            expect(cleaned).toBe(safeInput);
        });

        test('should handle null and undefined input', () => {
            expect(validators.sanitizeInput(null)).toBe('');
            expect(validators.sanitizeInput(undefined)).toBe('');
            expect(validators.sanitizeInput('')).toBe('');
        });

        test('should handle objects and arrays', () => {
            const objectInput = {
                name: '<script>alert("xss")</script>John',
                notes: 'Normal notes'
            };

            const cleaned = validators.sanitizeInput(objectInput);
            expect(cleaned.name).not.toContain('<script>');
            expect(cleaned.name).toContain('John');
            expect(cleaned.notes).toBe('Normal notes');
        });
    });

    describe('validateFileUpload', () => {
        test('should validate allowed file types', () => {
            const validFiles = [
                { mimetype: 'image/jpeg', size: 1024 * 1024, originalname: 'photo.jpg' },
                { mimetype: 'image/png', size: 512 * 1024, originalname: 'image.png' },
                { mimetype: 'application/pdf', size: 2 * 1024 * 1024, originalname: 'document.pdf' }
            ];

            validFiles.forEach(file => {
                const result = validators.validateFileUpload(file, {
                    allowedTypes: ['image/jpeg', 'image/png', 'application/pdf'],
                    maxSize: 5 * 1024 * 1024
                });
                expect(result.isValid).toBe(true);
            });
        });

        test('should reject disallowed file types', () => {
            const invalidFile = {
                mimetype: 'application/javascript',
                size: 1024,
                originalname: 'malicious.js'
            };

            const result = validators.validateFileUpload(invalidFile, {
                allowedTypes: ['image/jpeg', 'image/png'],
                maxSize: 5 * 1024 * 1024
            });

            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.type === 'fileType')).toBe(true);
        });

        test('should reject files exceeding size limit', () => {
            const largeFile = {
                mimetype: 'image/jpeg',
                size: 10 * 1024 * 1024, // 10MB
                originalname: 'large.jpg'
            };

            const result = validators.validateFileUpload(largeFile, {
                allowedTypes: ['image/jpeg'],
                maxSize: 5 * 1024 * 1024 // 5MB limit
            });

            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.type === 'fileSize')).toBe(true);
        });

        test('should detect dangerous file extensions', () => {
            const dangerousFiles = [
                { mimetype: 'image/jpeg', originalname: 'image.jpg.exe' },
                { mimetype: 'image/png', originalname: 'photo.png.bat' },
                { mimetype: 'text/plain', originalname: 'document.txt.js' }
            ];

            dangerousFiles.forEach(file => {
                const result = validators.validateFileUpload(file, {
                    allowedTypes: ['image/jpeg', 'image/png', 'text/plain'],
                    maxSize: 5 * 1024 * 1024
                });

                expect(result.isValid).toBe(false);
                expect(result.errors.some(err => err.type === 'dangerousExtension')).toBe(true);
            });
        });
    });

    describe('validateMedicalData', () => {
        test('should validate medical history data', () => {
            const medicalData = {
                allergies: ['Penicilina', 'Mariscos'],
                medications: ['Aspirina 100mg'],
                conditions: ['Hipertensión'],
                emergencyContact: {
                    name: 'María Pérez',
                    phone: '+54 11 1234-5678',
                    relationship: 'Esposa'
                }
            };

            const result = validators.validateMedicalData(medicalData);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should validate emergency contact information', () => {
            const invalidEmergencyContact = {
                emergencyContact: {
                    name: '',
                    phone: 'invalid-phone',
                    relationship: ''
                }
            };

            const result = validators.validateMedicalData(invalidEmergencyContact);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.field === 'emergencyContact.name')).toBe(true);
            expect(result.errors.some(err => err.field === 'emergencyContact.phone')).toBe(true);
        });
    });

    describe('validateTherapistData', () => {
        test('should validate therapist registration data', () => {
            const therapistData = {
                name: 'Dr. Ana García',
                email: 'ana@example.com',
                license: 'MP12345',
                specialization: 'Psicología Clínica',
                phone: '+54 11 1234-5678'
            };

            const result = validators.validateTherapistData(therapistData);
            expect(result.isValid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        test('should validate license format', () => {
            const invalidLicense = {
                name: 'Dr. Ana García',
                email: 'ana@example.com',
                license: '123', // Too short
                specialization: 'Psicología Clínica'
            };

            const result = validators.validateTherapistData(invalidLicense);
            expect(result.isValid).toBe(false);
            expect(result.errors.some(err => err.field === 'license')).toBe(true);
        });
    });

    describe('Performance and edge cases', () => {
        test('should handle very long strings efficiently', () => {
            const longString = 'a'.repeat(100000);
            const start = Date.now();
            validators.sanitizeInput(longString);
            const duration = Date.now() - start;
            
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
        });

        test('should handle deeply nested objects', () => {
            const deepObject = {
                level1: {
                    level2: {
                        level3: {
                            level4: {
                                value: '<script>alert("deep xss")</script>'
                            }
                        }
                    }
                }
            };

            const cleaned = validators.sanitizeInput(deepObject);
            expect(cleaned.level1.level2.level3.level4.value).not.toContain('<script>');
        });

        test('should handle circular references safely', () => {
            const circularObj = { name: 'test' };
            circularObj.self = circularObj;

            expect(() => {
                validators.sanitizeInput(circularObj);
            }).not.toThrow();
        });
    });
}); 