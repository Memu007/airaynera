// MOCKS DEBEN IR PRIMERO - ANTES DE CUALQUIER IMPORT

// Mock del logger
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    audit: jest.fn()
}));

// Mock del encryption
jest.mock('../../src/utils/encryption', () => ({
    encrypt: jest.fn((data) => `encrypted_${JSON.stringify(data)}`),
    decrypt: jest.fn((data) => {
        try {
            return JSON.parse(data.replace('encrypted_', ''));
        } catch {
            return data.replace('encrypted_', '');
        }
    }),
    encryptSensitiveFields: jest.fn((obj) => ({
        ...obj,
        personalData: `encrypted_${JSON.stringify(obj.personalData || {})}`,
        medicalHistory: `encrypted_${JSON.stringify(obj.medicalHistory || {})}`
    }))
}));

// Mock de la configuración de database
jest.mock('../../src/config/database', () => {
    const { createMockFirestore } = require('../setup/firestore-mock');
    const mockDb = createMockFirestore();
    
    // Agregar datos de prueba para patients
    mockDb._addTestData('patients', [
        {
            id: 'test-patient-1',
            name: 'John Doe',
            email: 'john@example.com',
            dni: '12345678',
            phone: '555-0123',
            status: 'active',
            userId: 'test-user-1',
            personalData: 'encrypted_data',
            medicalHistory: 'encrypted_history',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        },
        {
            id: 'test-patient-2',
            name: 'Jane Smith',
            email: 'jane@example.com',
            dni: '87654321',
            phone: '555-0456',
            status: 'inactive',
            userId: 'test-user-1',
            personalData: 'encrypted_data',
            medicalHistory: 'encrypted_history',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
    ]);
    
    return { db: mockDb };
});

// AHORA SI IMPORTAR LOS MÓDULOS
const patientsService = require('../../src/services/patientsService');
const encryption = require('../../src/utils/encryption');

describe('PatientsService', () => {
    const { db } = require('../../src/config/db');
    const logger = require('../../src/utils/logger');

    const mockPatientData = {
        name: 'Juan Pérez',
        dni: '12345678',
        phone: '+54 11 1234-5678',
        email: 'juan.perez@email.com',
        insurance: 'OSDE Plan 310',
        emergencyContact: 'María Pérez - +54 11 8765-4321',
        medicalRecord: 'MR-2024-001',
        allergies: 'Penicilina, Mariscos'
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        test('should create patient with encrypted sensitive fields', async () => {
            const mockDoc = {
                set: jest.fn().mockResolvedValue()
            };
            
            db.collection().doc.mockReturnValue(mockDoc);

            const result = await patientsService.create(mockPatientData);

            expect(mockDoc.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    name: mockPatientData.name,
                    dni: mockPatientData.dni,
                    phone: mockPatientData.phone,
                    email: mockPatientData.email,
                    isActive: true,
                    encryptionVersion: '1.0'
                })
            );

            // Verificar que los campos sensibles fueron encriptados
            const setCallArgs = mockDoc.set.mock.calls[0][0];
            expect(setCallArgs.insurance).not.toBe(mockPatientData.insurance);
            expect(setCallArgs.emergencyContact).not.toBe(mockPatientData.emergencyContact);
            expect(setCallArgs.medicalRecord).not.toBe(mockPatientData.medicalRecord);
            expect(setCallArgs.allergies).not.toBe(mockPatientData.allergies);

            expect(logger.audit).toHaveBeenCalledWith(
                'Patient created',
                expect.objectContaining({
                    patientId: expect.any(String),
                    encryptedFields: expect.any(Array)
                })
            );
        });

        test('should throw error when required fields are missing', async () => {
            const incompleteData = { name: 'Juan Pérez' }; // Falta DNI

            await expect(patientsService.create(incompleteData))
                .rejects.toThrow('Name and DNI are required');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to create patient',
                expect.objectContaining({
                    error: 'Name and DNI are required'
                })
            );
        });

        test('should handle database errors gracefully', async () => {
            const mockDoc = {
                set: jest.fn().mockRejectedValue(new Error('Database connection failed'))
            };
            
            db.collection().doc.mockReturnValue(mockDoc);

            await expect(patientsService.create(mockPatientData))
                .rejects.toThrow('Database connection failed');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to create patient',
                expect.objectContaining({
                    error: 'Database connection failed'
                })
            );
        });
    });

    describe('getById', () => {
        test('should return patient with decrypted fields when decrypt=true', async () => {
            const encryptedPatient = {
                ...mockPatientData,
                id: '123',
                insurance: encryption.encrypt(mockPatientData.insurance, 'insurance'),
                emergencyContact: encryption.encrypt(mockPatientData.emergencyContact, 'emergencyContact'),
                isActive: true
            };

            const mockDoc = {
                exists: true,
                data: () => encryptedPatient
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            const result = await patientsService.getById('123', true);

            expect(result.insurance).toBe(mockPatientData.insurance);
            expect(result.emergencyContact).toBe(mockPatientData.emergencyContact);
            
            expect(logger.audit).toHaveBeenCalledWith(
                'Patient accessed',
                expect.objectContaining({
                    patientId: '123'
                })
            );
        });

        test('should return null when patient not found', async () => {
            const mockDoc = {
                exists: false
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            const result = await patientsService.getById('nonexistent');

            expect(result).toBeNull();
        });

        test('should return encrypted data when decrypt=false', async () => {
            const encryptedPatient = {
                ...mockPatientData,
                id: '123',
                insurance: 'encrypted_insurance_data',
                isActive: true
            };

            const mockDoc = {
                exists: true,
                data: () => encryptedPatient
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            const result = await patientsService.getById('123', false);

            expect(result.insurance).toBe('encrypted_insurance_data');
            expect(logger.audit).not.toHaveBeenCalled();
        });
    });

    describe('getAll', () => {
        test('should return list of patients without sensitive data when decrypt=false', async () => {
            const mockPatients = [
                { id: '1', name: 'Juan', dni: '123', isActive: true, insurance: 'encrypted1' },
                { id: '2', name: 'María', dni: '456', isActive: true, insurance: 'encrypted2' }
            ];

            const mockSnapshot = {
                forEach: jest.fn(callback => {
                    mockPatients.forEach(patient => {
                        callback({ data: () => patient });
                    });
                })
            };

            db.collection().where().orderBy().get.mockResolvedValue(mockSnapshot);

            const result = await patientsService.getAll(false);

            expect(result).toHaveLength(2);
            expect(result[0]).not.toHaveProperty('insurance');
            expect(result[0]).not.toHaveProperty('emergencyContact');
            
            expect(logger.audit).toHaveBeenCalledWith(
                'Patients listed',
                expect.objectContaining({
                    count: 2,
                    decrypted: false
                })
            );
        });

        test('should handle empty patient list', async () => {
            const mockSnapshot = {
                forEach: jest.fn()
            };

            db.collection().where().orderBy().get.mockResolvedValue(mockSnapshot);

            const result = await patientsService.getAll(false);

            expect(result).toHaveLength(0);
            expect(logger.audit).toHaveBeenCalledWith(
                'Patients listed',
                expect.objectContaining({
                    count: 0
                })
            );
        });
    });

    describe('update', () => {
        test('should update patient with encrypted sensitive fields', async () => {
            const existingPatient = {
                id: '123',
                name: 'Juan Pérez',
                dni: '12345678',
                isActive: true
            };

            const updateData = {
                phone: '+54 11 9999-8888',
                insurance: 'Swiss Medical Plan 300'
            };

            // Mock para getById
            const mockGetDoc = {
                exists: true,
                data: () => existingPatient
            };

            // Mock para update y getById después de actualizar
            const mockUpdateDoc = {
                update: jest.fn().mockResolvedValue()
            };

            const updatedPatient = {
                ...existingPatient,
                ...updateData,
                updatedAt: expect.any(String)
            };

            const mockUpdatedDoc = {
                exists: true,
                data: () => updatedPatient
            };

            db.collection().doc().get
                .mockResolvedValueOnce(mockGetDoc)  // Primera llamada (verificar existencia)
                .mockResolvedValueOnce(mockUpdatedDoc); // Segunda llamada (obtener actualizado)
            
            db.collection().doc().update.mockResolvedValue();

            const result = await patientsService.update('123', updateData);

            expect(db.collection().doc().update).toHaveBeenCalledWith(
                expect.objectContaining({
                    phone: updateData.phone,
                    updatedAt: expect.any(String)
                })
            );

            // Verificar que insurance fue encriptado
            const updateCallArgs = db.collection().doc().update.mock.calls[0][0];
            expect(updateCallArgs.insurance).not.toBe(updateData.insurance);

            expect(logger.audit).toHaveBeenCalledWith(
                'Patient updated',
                expect.objectContaining({
                    patientId: '123',
                    updatedFields: ['phone', 'insurance']
                })
            );
        });

        test('should throw error when patient not found', async () => {
            const mockDoc = {
                exists: false
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            await expect(patientsService.update('nonexistent', { phone: '123' }))
                .rejects.toThrow('Patient not found');
        });
    });

    describe('delete', () => {
        test('should perform soft delete', async () => {
            const existingPatient = {
                id: '123',
                name: 'Juan Pérez',
                isActive: true
            };

            const mockGetDoc = {
                exists: true,
                data: () => existingPatient
            };

            const mockUpdateDoc = {
                update: jest.fn().mockResolvedValue()
            };

            db.collection().doc().get.mockResolvedValue(mockGetDoc);
            db.collection().doc().update.mockResolvedValue();

            const result = await patientsService.delete('123');

            expect(result).toBe(true);
            expect(db.collection().doc().update).toHaveBeenCalledWith(
                expect.objectContaining({
                    isActive: false,
                    deletedAt: expect.any(String),
                    updatedAt: expect.any(String)
                })
            );

            expect(logger.audit).toHaveBeenCalledWith(
                'Patient deleted (soft)',
                expect.objectContaining({
                    patientId: '123'
                })
            );
        });

        test('should throw error when patient not found for deletion', async () => {
            const mockDoc = {
                exists: false
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            await expect(patientsService.delete('nonexistent'))
                .rejects.toThrow('Patient not found');
        });
    });

    describe('search', () => {
        test('should search patients by name', async () => {
            const mockPatients = [
                { id: '1', name: 'Juan Pérez', dni: '123', isActive: true },
                { id: '2', name: 'María García', dni: '456', isActive: true },
                { id: '3', name: 'Pedro Juan', dni: '789', isActive: true }
            ];

            const mockSnapshot = {
                forEach: jest.fn(callback => {
                    mockPatients.forEach(patient => {
                        callback({ data: () => patient });
                    });
                })
            };

            db.collection().where().get.mockResolvedValue(mockSnapshot);

            const result = await patientsService.search('juan');

            expect(result).toHaveLength(2); // Juan Pérez y Pedro Juan
            expect(result[0].name).toContain('Juan');
            expect(result[1].name).toContain('Juan');

            expect(logger.audit).toHaveBeenCalledWith(
                'Patients searched',
                expect.objectContaining({
                    query: 'juan...', // Truncado por privacidad
                    resultsCount: 2
                })
            );
        });

        test('should search patients by DNI', async () => {
            const mockPatients = [
                { id: '1', name: 'Juan Pérez', dni: '12345678', isActive: true }
            ];

            const mockSnapshot = {
                forEach: jest.fn(callback => {
                    mockPatients.forEach(patient => {
                        callback({ data: () => patient });
                    });
                })
            };

            db.collection().where().get.mockResolvedValue(mockSnapshot);

            const result = await patientsService.search('12345');

            expect(result).toHaveLength(1);
            expect(result[0].dni).toContain('12345');
        });

        test('should return empty array when no matches found', async () => {
            const mockSnapshot = {
                forEach: jest.fn()
            };

            db.collection().where().get.mockResolvedValue(mockSnapshot);

            const result = await patientsService.search('noexiste');

            expect(result).toHaveLength(0);
        });
    });

    describe('getStats', () => {
        test('should return patient statistics', async () => {
            const mockPatients = [
                { isActive: true },
                { isActive: true },
                { isActive: false },
                { isActive: true }
            ];

            const mockSnapshot = {
                size: 4,
                forEach: jest.fn(callback => {
                    mockPatients.forEach(patient => {
                        callback({ data: () => patient });
                    });
                })
            };

            db.collection().get.mockResolvedValue(mockSnapshot);

            const result = await patientsService.getStats();

            expect(result).toEqual({
                total: 4,
                active: 3,
                inactive: 1,
                encryptionHealthy: true
            });

            expect(logger.audit).toHaveBeenCalledWith(
                'Patient stats requested',
                expect.objectContaining({
                    total: 4,
                    active: 3,
                    inactive: 1
                })
            );
        });
    });

    describe('migrateToEncryption', () => {
        test('should migrate unencrypted patients', async () => {
            const legacyPatients = [
                { 
                    id: '1', 
                    name: 'Juan', 
                    insurance: 'OSDE',
                    // Sin encryptionVersion = legacy
                },
                {
                    id: '2',
                    name: 'María',
                    insurance: 'Swiss Medical',
                    encryptionVersion: '1.0' // Ya migrado
                }
            ];

            const mockDocs = legacyPatients.map(patient => ({
                id: patient.id,
                data: () => patient
            }));

            const mockSnapshot = {
                size: 2,
                docs: mockDocs
            };

            db.collection().get.mockResolvedValue(mockSnapshot);
            db.collection().doc().update.mockResolvedValue();

            const result = await patientsService.migrateToEncryption();

            expect(result).toBe(1); // Solo 1 migrado (el que no tenía encryptionVersion)
            expect(db.collection().doc().update).toHaveBeenCalledTimes(1);
            expect(db.collection().doc().update).toHaveBeenCalledWith(
                expect.objectContaining({
                    encryptionVersion: '1.0',
                    migratedAt: expect.any(String)
                })
            );

            expect(logger.audit).toHaveBeenCalledWith(
                'Patient encryption migration completed',
                expect.objectContaining({
                    migratedCount: 1,
                    totalPatients: 2
                })
            );
        });
    });

    describe('sanitization methods', () => {
        test('should sanitize patient data for response', () => {
            const patientWithInternal = {
                id: '123',
                name: 'Juan Pérez',
                insurance: 'OSDE',
                encryptionVersion: '1.0'
            };

            const result = patientsService.sanitizeForResponse(patientWithInternal);

            expect(result).not.toHaveProperty('encryptionVersion');
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('insurance');
        });

        test('should sanitize patient data for listing', () => {
            const patientWithSensitive = {
                id: '123',
                name: 'Juan Pérez',
                dni: '12345678',
                insurance: 'OSDE',
                emergencyContact: '+54 11 1234-5678',
                medicalRecord: 'MR-001',
                allergies: 'Penicilina',
                encryptionVersion: '1.0'
            };

            const result = patientsService.sanitizeForListing(patientWithSensitive);

            expect(result).not.toHaveProperty('insurance');
            expect(result).not.toHaveProperty('emergencyContact');
            expect(result).not.toHaveProperty('medicalRecord');
            expect(result).not.toHaveProperty('allergies');
            expect(result).not.toHaveProperty('encryptionVersion');
            
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('name');
            expect(result).toHaveProperty('dni');
        });
    });

    describe('error handling', () => {
        test('should handle database connection errors', async () => {
            db.collection().doc().get.mockRejectedValue(new Error('Connection timeout'));

            await expect(patientsService.getById('123'))
                .rejects.toThrow('Connection timeout');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to get patient',
                expect.objectContaining({
                    id: '123',
                    error: 'Connection timeout'
                })
            );
        });

        test('should handle encryption service errors', async () => {
            // Mock encryption error
            const originalEncrypt = encryption.encrypt;
            encryption.encrypt = jest.fn().mockImplementation(() => {
                throw new Error('Encryption failed');
            });

            await expect(patientsService.create(mockPatientData))
                .rejects.toThrow('Encryption failed');

            // Restore original function
            encryption.encrypt = originalEncrypt;
        });
    });
}); 