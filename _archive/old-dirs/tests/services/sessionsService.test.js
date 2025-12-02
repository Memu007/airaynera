const sessionsService = require('../../src/services/sessionsService');
const encryption = require('../../src/utils/encryption');

// Mock de Firestore
jest.mock('../../src/config/db', () => ({
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                set: jest.fn(),
                get: jest.fn(),
                update: jest.fn()
            })),
            where: jest.fn(() => ({
                where: jest.fn(() => ({
                    orderBy: jest.fn(() => ({
                        get: jest.fn()
                    }))
                })),
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn()
                    })),
                    get: jest.fn()
                })),
                get: jest.fn()
            })),
            get: jest.fn()
        }))
    }
}));

// Mock del logger
jest.mock('../../src/utils/logger', () => ({
    audit: jest.fn(),
    error: jest.fn()
}));

describe('SessionsService', () => {
    const { db } = require('../../src/config/db');
    const logger = require('../../src/utils/logger');

    const mockSessionData = {
        patientId: 'patient-123',
        content: 'Sesión de terapia cognitivo-conductual. El paciente muestra progreso significativo.',
        notes: 'Próxima sesión en 2 semanas',
        diagnosis: 'Trastorno de ansiedad generalizada',
        treatment: 'Terapia CBT + técnicas de relajación',
        symptoms: 'Ansiedad, insomnio ocasional'
    };

    const mockUserId = 'user-456';
    const mockAdminId = 'admin-789';

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Mock admin users
        process.env.ADMIN_USERS = mockAdminId;
    });

    afterEach(() => {
        delete process.env.ADMIN_USERS;
    });

    describe('create', () => {
        test('should create session with encrypted sensitive fields', async () => {
            const mockDoc = {
                set: jest.fn().mockResolvedValue()
            };
            
            db.collection().doc.mockReturnValue(mockDoc);

            const result = await sessionsService.create(mockSessionData, mockUserId);

            expect(mockDoc.set).toHaveBeenCalledWith(
                expect.objectContaining({
                    patientId: mockSessionData.patientId,
                    createdBy: mockUserId,
                    isActive: true,
                    encryptionVersion: '1.0'
                })
            );

            // Verificar que los campos sensibles fueron encriptados
            const setCallArgs = mockDoc.set.mock.calls[0][0];
            expect(setCallArgs.content).not.toBe(mockSessionData.content);
            expect(setCallArgs.notes).not.toBe(mockSessionData.notes);
            expect(setCallArgs.diagnosis).not.toBe(mockSessionData.diagnosis);
            expect(setCallArgs.treatment).not.toBe(mockSessionData.treatment);
            expect(setCallArgs.symptoms).not.toBe(mockSessionData.symptoms);

            expect(logger.audit).toHaveBeenCalledWith(
                'Medical session created',
                expect.objectContaining({
                    sessionId: expect.any(String),
                    patientId: mockSessionData.patientId,
                    createdBy: mockUserId,
                    encryptedFields: expect.any(Array)
                })
            );
        });

        test('should throw error when required fields are missing', async () => {
            const incompleteData = { patientId: 'patient-123' }; // Falta content

            await expect(sessionsService.create(incompleteData, mockUserId))
                .rejects.toThrow('PatientId and content are required');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to create session',
                expect.objectContaining({
                    error: 'PatientId and content are required',
                    userId: mockUserId
                })
            );
        });

        test('should handle encryption errors during creation', async () => {
            // Mock encryption error
            const originalEncrypt = encryption.encrypt;
            encryption.encrypt = jest.fn().mockImplementation(() => {
                throw new Error('Encryption service unavailable');
            });

            await expect(sessionsService.create(mockSessionData, mockUserId))
                .rejects.toThrow('Encryption service unavailable');

            // Restore original function
            encryption.encrypt = originalEncrypt;
        });
    });

    describe('getById', () => {
        test('should return session with decrypted fields for authorized user', async () => {
            const encryptedSession = {
                ...mockSessionData,
                id: 'session-123',
                createdBy: mockUserId,
                content: encryption.encrypt(mockSessionData.content, 'content'),
                notes: encryption.encrypt(mockSessionData.notes, 'notes'),
                isActive: true
            };

            const mockDoc = {
                exists: true,
                data: () => encryptedSession
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            const result = await sessionsService.getById('session-123', mockUserId, true);

            expect(result.content).toBe(mockSessionData.content);
            expect(result.notes).toBe(mockSessionData.notes);
            
            expect(logger.audit).toHaveBeenCalledWith(
                'Medical session accessed',
                expect.objectContaining({
                    sessionId: 'session-123',
                    accessedBy: mockUserId
                })
            );
        });

        test('should throw error when user is not authorized', async () => {
            const encryptedSession = {
                id: 'session-123',
                createdBy: 'different-user',
                patientId: 'patient-123',
                isActive: true
            };

            const mockDoc = {
                exists: true,
                data: () => encryptedSession
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            await expect(sessionsService.getById('session-123', mockUserId, true))
                .rejects.toThrow('Unauthorized to access this session');
        });

        test('should allow admin to access any session', async () => {
            const encryptedSession = {
                id: 'session-123',
                createdBy: 'different-user',
                patientId: 'patient-123',
                content: encryption.encrypt(mockSessionData.content, 'content'),
                isActive: true
            };

            const mockDoc = {
                exists: true,
                data: () => encryptedSession
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            const result = await sessionsService.getById('session-123', mockAdminId, true);

            expect(result.content).toBe(mockSessionData.content);
            expect(logger.audit).toHaveBeenCalledWith(
                'Medical session accessed',
                expect.objectContaining({
                    sessionId: 'session-123',
                    accessedBy: mockAdminId
                })
            );
        });

        test('should return null when session not found', async () => {
            const mockDoc = {
                exists: false
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            const result = await sessionsService.getById('nonexistent', mockUserId);

            expect(result).toBeNull();
        });
    });

    describe('getByPatientId', () => {
        test('should return patient sessions for authorized user', async () => {
            const mockSessions = [
                { 
                    id: 'session-1', 
                    patientId: 'patient-123', 
                    createdBy: mockUserId,
                    content: 'encrypted_content_1',
                    isActive: true 
                },
                { 
                    id: 'session-2', 
                    patientId: 'patient-123', 
                    createdBy: mockUserId,
                    content: 'encrypted_content_2',
                    isActive: true 
                }
            ];

            const mockSnapshot = {
                forEach: jest.fn(callback => {
                    mockSessions.forEach(session => {
                        callback({ data: () => session });
                    });
                })
            };

            db.collection().where().where().orderBy().get.mockResolvedValue(mockSnapshot);

            const result = await sessionsService.getByPatientId('patient-123', mockUserId, false);

            expect(result).toHaveLength(2);
            // Sin desencriptar, no debe incluir contenido sensible
            expect(result[0]).not.toHaveProperty('content');
            expect(result[0]).toHaveProperty('hasContent', true);

            expect(logger.audit).toHaveBeenCalledWith(
                'Patient sessions accessed',
                expect.objectContaining({
                    patientId: 'patient-123',
                    accessedBy: mockUserId,
                    sessionsCount: 2,
                    decrypted: false
                })
            );
        });

        test('should filter out unauthorized sessions', async () => {
            const mockSessions = [
                { 
                    id: 'session-1', 
                    patientId: 'patient-123', 
                    createdBy: mockUserId,
                    isActive: true 
                },
                { 
                    id: 'session-2', 
                    patientId: 'patient-123', 
                    createdBy: 'different-user',
                    isActive: true 
                }
            ];

            const mockSnapshot = {
                forEach: jest.fn(callback => {
                    mockSessions.forEach(session => {
                        callback({ data: () => session });
                    });
                })
            };

            db.collection().where().where().orderBy().get.mockResolvedValue(mockSnapshot);

            const result = await sessionsService.getByPatientId('patient-123', mockUserId, false);

            expect(result).toHaveLength(1); // Solo la sesión autorizada
            expect(result[0].id).toBe('session-1');
        });
    });

    describe('update', () => {
        test('should update session with encrypted sensitive fields', async () => {
            const existingSession = {
                id: 'session-123',
                patientId: 'patient-123',
                createdBy: mockUserId,
                isActive: true
            };

            const updateData = {
                notes: 'Notas actualizadas de la sesión',
                diagnosis: 'Diagnóstico actualizado'
            };

            // Mock para getById (verificar existencia)
            const mockGetDoc = {
                exists: true,
                data: () => existingSession
            };

            // Mock para update
            const mockUpdateDoc = {
                update: jest.fn().mockResolvedValue()
            };

            // Mock para getById después de actualizar
            const updatedSession = {
                ...existingSession,
                ...updateData,
                updatedAt: expect.any(String),
                updatedBy: mockUserId
            };

            const mockUpdatedDoc = {
                exists: true,
                data: () => updatedSession
            };

            db.collection().doc().get
                .mockResolvedValueOnce(mockGetDoc)  // Primera llamada (verificar existencia)
                .mockResolvedValueOnce(mockUpdatedDoc); // Segunda llamada (obtener actualizado)
            
            db.collection().doc().update.mockResolvedValue();

            const result = await sessionsService.update('session-123', updateData, mockUserId);

            expect(db.collection().doc().update).toHaveBeenCalledWith(
                expect.objectContaining({
                    updatedAt: expect.any(String),
                    updatedBy: mockUserId
                })
            );

            // Verificar que los campos sensibles fueron encriptados
            const updateCallArgs = db.collection().doc().update.mock.calls[0][0];
            expect(updateCallArgs.notes).not.toBe(updateData.notes);
            expect(updateCallArgs.diagnosis).not.toBe(updateData.diagnosis);

            expect(logger.audit).toHaveBeenCalledWith(
                'Medical session updated',
                expect.objectContaining({
                    sessionId: 'session-123',
                    updatedBy: mockUserId,
                    updatedFields: ['notes', 'diagnosis']
                })
            );
        });

        test('should throw error when session not found or unauthorized', async () => {
            const mockDoc = {
                exists: false
            };

            db.collection().doc().get.mockResolvedValue(mockDoc);

            await expect(sessionsService.update('nonexistent', { notes: 'test' }, mockUserId))
                .rejects.toThrow('Session not found or unauthorized');
        });
    });

    describe('delete', () => {
        test('should perform soft delete', async () => {
            const existingSession = {
                id: 'session-123',
                patientId: 'patient-123',
                createdBy: mockUserId,
                isActive: true
            };

            const mockGetDoc = {
                exists: true,
                data: () => existingSession
            };

            db.collection().doc().get.mockResolvedValue(mockGetDoc);
            db.collection().doc().update.mockResolvedValue();

            const result = await sessionsService.delete('session-123', mockUserId);

            expect(result).toBe(true);
            expect(db.collection().doc().update).toHaveBeenCalledWith(
                expect.objectContaining({
                    isActive: false,
                    deletedAt: expect.any(String),
                    deletedBy: mockUserId,
                    updatedAt: expect.any(String)
                })
            );

            expect(logger.audit).toHaveBeenCalledWith(
                'Medical session deleted (soft)',
                expect.objectContaining({
                    sessionId: 'session-123',
                    deletedBy: mockUserId
                })
            );
        });
    });

    describe('search', () => {
        test('should search sessions with criteria', async () => {
            const criteria = {
                patientId: 'patient-123',
                dateFrom: '2024-01-01',
                dateTo: '2024-12-31',
                limit: 10
            };

            const mockSessions = [
                { 
                    id: 'session-1', 
                    patientId: 'patient-123', 
                    createdBy: mockUserId,
                    createdAt: '2024-06-01',
                    isActive: true 
                }
            ];

            const mockSnapshot = {
                forEach: jest.fn(callback => {
                    mockSessions.forEach(session => {
                        callback({ data: () => session });
                    });
                })
            };

            // Mock chain de métodos de query
            const mockLimit = { get: jest.fn().mockResolvedValue(mockSnapshot) };
            const mockOrderBy = { limit: jest.fn().mockReturnValue(mockLimit) };
            const mockWhere4 = { orderBy: jest.fn().mockReturnValue(mockOrderBy) };
            const mockWhere3 = { where: jest.fn().mockReturnValue(mockWhere4) };
            const mockWhere2 = { where: jest.fn().mockReturnValue(mockWhere3) };
            const mockWhere1 = { where: jest.fn().mockReturnValue(mockWhere2) };
            
            db.collection().where.mockReturnValue(mockWhere1);

            const result = await sessionsService.search(criteria, mockUserId);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe('session-1');

            expect(logger.audit).toHaveBeenCalledWith(
                'Sessions searched',
                expect.objectContaining({
                    criteria: expect.objectContaining(criteria),
                    searchedBy: mockUserId,
                    resultsCount: 1
                })
            );
        });

        test('should use default limit when not specified', async () => {
            const criteria = { patientId: 'patient-123' };

            const mockSnapshot = { forEach: jest.fn() };
            const mockLimit = { get: jest.fn().mockResolvedValue(mockSnapshot) };
            const mockOrderBy = { limit: jest.fn().mockReturnValue(mockLimit) };
            const mockWhere2 = { orderBy: jest.fn().mockReturnValue(mockOrderBy) };
            const mockWhere1 = { where: jest.fn().mockReturnValue(mockWhere2) };
            
            db.collection().where.mockReturnValue(mockWhere1);

            await sessionsService.search(criteria, mockUserId);

            expect(mockLimit.get).toHaveBeenCalled();
            expect(logger.audit).toHaveBeenCalledWith(
                'Sessions searched',
                expect.objectContaining({
                    criteria: { ...criteria, limit: 50 }
                })
            );
        });
    });

    describe('getStats', () => {
        test('should return session statistics for regular user', async () => {
            const mockSessions = [
                { isActive: true, createdAt: new Date().toISOString() },
                { isActive: true, createdAt: '2024-01-01T00:00:00.000Z' },
                { isActive: false, createdAt: '2024-01-01T00:00:00.000Z' }
            ];

            const mockSnapshot = {
                size: 3,
                forEach: jest.fn(callback => {
                    mockSessions.forEach(session => {
                        callback({ data: () => session });
                    });
                })
            };

            db.collection().where().get.mockResolvedValue(mockSnapshot);

            const result = await sessionsService.getStats(mockUserId);

            expect(result).toEqual({
                total: 3,
                active: 2,
                inactive: 1,
                todaySessions: 1, // Una sesión de hoy
                encryptionHealthy: true
            });

            expect(logger.audit).toHaveBeenCalledWith(
                'Session stats requested',
                expect.objectContaining({
                    requestedBy: mockUserId,
                    isAdmin: false
                })
            );
        });

        test('should return all sessions statistics for admin', async () => {
            const mockSessions = [
                { isActive: true, createdAt: new Date().toISOString() },
                { isActive: false, createdAt: '2024-01-01T00:00:00.000Z' }
            ];

            const mockSnapshot = {
                size: 2,
                forEach: jest.fn(callback => {
                    mockSessions.forEach(session => {
                        callback({ data: () => session });
                    });
                })
            };

            db.collection().get.mockResolvedValue(mockSnapshot);

            const result = await sessionsService.getStats(mockAdminId);

            expect(result.total).toBe(2);
            expect(logger.audit).toHaveBeenCalledWith(
                'Session stats requested',
                expect.objectContaining({
                    requestedBy: mockAdminId,
                    isAdmin: true
                })
            );
        });
    });

    describe('migrateToEncryption', () => {
        test('should migrate unencrypted sessions', async () => {
            const legacySessions = [
                { 
                    id: 'session-1', 
                    content: 'Contenido sin encriptar',
                    // Sin encryptionVersion = legacy
                },
                {
                    id: 'session-2',
                    content: 'Contenido encriptado',
                    encryptionVersion: '1.0' // Ya migrado
                }
            ];

            const mockDocs = legacySessions.map(session => ({
                id: session.id,
                data: () => session
            }));

            const mockSnapshot = {
                size: 2,
                docs: mockDocs
            };

            db.collection().get.mockResolvedValue(mockSnapshot);
            db.collection().doc().update.mockResolvedValue();

            const result = await sessionsService.migrateToEncryption();

            expect(result).toBe(1); // Solo 1 migrado
            expect(db.collection().doc().update).toHaveBeenCalledTimes(1);
            expect(db.collection().doc().update).toHaveBeenCalledWith(
                expect.objectContaining({
                    encryptionVersion: '1.0',
                    migratedAt: expect.any(String)
                })
            );

            expect(logger.audit).toHaveBeenCalledWith(
                'Session encryption migration completed',
                expect.objectContaining({
                    migratedCount: 1,
                    totalSessions: 2
                })
            );
        });
    });

    describe('utility methods', () => {
        test('should identify admin users correctly', () => {
            expect(sessionsService.isAdmin(mockAdminId)).toBe(true);
            expect(sessionsService.isAdmin(mockUserId)).toBe(false);
            expect(sessionsService.isAdmin('unknown-user')).toBe(false);
        });

        test('should sanitize session data for response', () => {
            const sessionWithInternal = {
                id: 'session-123',
                content: 'Contenido médico',
                encryptionVersion: '1.0'
            };

            const result = sessionsService.sanitizeForResponse(sessionWithInternal);

            expect(result).not.toHaveProperty('encryptionVersion');
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('content');
        });

        test('should sanitize session data for listing', () => {
            const sessionWithSensitive = {
                id: 'session-123',
                patientId: 'patient-123',
                content: 'Contenido médico sensible',
                notes: 'Notas privadas',
                diagnosis: 'Diagnóstico',
                treatment: 'Tratamiento',
                symptoms: 'Síntomas',
                encryptionVersion: '1.0'
            };

            const result = sessionsService.sanitizeForListing(sessionWithSensitive);

            expect(result).not.toHaveProperty('content');
            expect(result).not.toHaveProperty('notes');
            expect(result).not.toHaveProperty('diagnosis');
            expect(result).not.toHaveProperty('treatment');
            expect(result).not.toHaveProperty('symptoms');
            expect(result).not.toHaveProperty('encryptionVersion');
            
            expect(result).toHaveProperty('id');
            expect(result).toHaveProperty('patientId');
            expect(result).toHaveProperty('hasContent', true);
            expect(result).toHaveProperty('hasNotes', true);
            expect(result).toHaveProperty('hasDiagnosis', true);
        });
    });

    describe('error handling', () => {
        test('should handle database errors gracefully', async () => {
            db.collection().doc().get.mockRejectedValue(new Error('Database connection failed'));

            await expect(sessionsService.getById('session-123', mockUserId))
                .rejects.toThrow('Database connection failed');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to get session',
                expect.objectContaining({
                    id: 'session-123',
                    userId: mockUserId,
                    error: 'Database connection failed'
                })
            );
        });

        test('should handle search errors', async () => {
            db.collection().where.mockImplementation(() => {
                throw new Error('Query failed');
            });

            await expect(sessionsService.search({ patientId: 'test' }, mockUserId))
                .rejects.toThrow('Query failed');

            expect(logger.error).toHaveBeenCalledWith(
                'Failed to search sessions',
                expect.objectContaining({
                    error: 'Query failed'
                })
            );
        });
    });
}); 