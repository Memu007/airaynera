const { SessionsService } = require('../../../src/services/sessionsService');

// Mock para tests
jest.mock('../../../src/config/database', () => ({
    db: {
        collection: jest.fn(() => ({
            doc: jest.fn(() => ({
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn()
            })),
            where: jest.fn(() => ({
                where: jest.fn(),
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn()
                    }))
                })),
                get: jest.fn()
            }))
        }))
    }
}));

jest.mock('../../../src/utils/encryption', () => ({
    encrypt: jest.fn((data) => `encrypted_${data}`),
    decrypt: jest.fn((data) => data.replace('encrypted_', ''))
}));

jest.mock('../../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(() => ({
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn()
    }))
}));

describe('SessionsService - Tests Críticos para Profesionales', () => {
    let service;
    let mockCollection;
    let mockDoc;
    let mockGet;
    let mockSet;
    let mockUpdate;

    beforeEach(() => {
        mockGet = jest.fn();
        mockSet = jest.fn();
        mockUpdate = jest.fn();
        mockDoc = jest.fn(() => ({
            get: mockGet,
            set: mockSet,
            update: mockUpdate
        }));
        mockCollection = {
            doc: mockDoc,
            where: jest.fn(() => ({
                where: jest.fn(() => mockCollection),
                orderBy: jest.fn(() => ({
                    limit: jest.fn(() => ({
                        get: jest.fn()
                    }))
                })),
                get: jest.fn()
            }))
        };

        const { db } = require('../../../src/config/database');
        db.collection.mockReturnValue(mockCollection);

        service = new SessionsService();
    });

    describe('CRUD de Sesiones - Funcionalidad Crítica', () => {
        test('debe crear una sesión válida', async () => {
            const sessionData = {
                patientId: 'patient123',
                date: '2024-12-25T10:00:00Z',
                duration: 60,
                type: 'consulta'
            };
            const userId = 'user123';

            mockSet.mockResolvedValue();
            mockDoc.mockReturnValue({
                id: 'session123',
                set: mockSet
            });

            const result = await service.createSession(sessionData, userId);

            expect(result).toHaveProperty('id', 'session123');
            expect(result).toHaveProperty('patientId', 'patient123');
            expect(mockSet).toHaveBeenCalled();
        });

        test('debe obtener una sesión por ID', async () => {
            const sessionId = 'session123';
            const userId = 'user123';
            const mockSession = {
                patientId: 'patient123',
                date: '2024-12-25T10:00:00Z',
                createdBy: userId,
                isActive: true
            };

            mockGet.mockResolvedValue({
                exists: true,
                data: () => mockSession
            });

            const result = await service.getSessionById(sessionId, userId);

            expect(result).toHaveProperty('patientId', 'patient123');
            expect(result).toHaveProperty('id', 'session123');
        });

        test('debe obtener sesiones por paciente', async () => {
            const patientId = 'patient123';
            const userId = 'user123';
            const mockSessions = [
                { patientId, date: '2024-12-25T10:00:00Z', createdBy: userId, isActive: true },
                { patientId, date: '2024-12-26T10:00:00Z', createdBy: userId, isActive: true }
            ];

            const mockSnapshot = {
                forEach: (callback) => {
                    mockSessions.forEach(session => {
                        callback({
                            id: 'session123',
                            data: () => session
                        });
                    });
                }
            };

            mockCollection.where().get.mockResolvedValue(mockSnapshot);

            const result = await service.getSessionsByPatient(patientId, userId);

            expect(result).toHaveLength(2);
            expect(result[0]).toHaveProperty('patientId', patientId);
        });

        test('debe actualizar una sesión existente', async () => {
            const sessionId = 'session123';
            const userId = 'user123';
            const updateData = { duration: 90 };
            const existingSession = {
                patientId: 'patient123',
                date: '2024-12-25T10:00:00Z',
                createdBy: userId,
                isActive: true,
                status: 'programada'
            };

            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => existingSession
            });

            mockUpdate.mockResolvedValue();

            const result = await service.updateSession(sessionId, updateData, userId);

            expect(mockUpdate).toHaveBeenCalledWith(sessionId, expect.objectContaining(updateData), userId);
        });

        test('debe cancelar una sesión', async () => {
            const sessionId = 'session123';
            const userId = 'user123';
            const reason = 'Paciente enfermo';
            const existingSession = {
                patientId: 'patient123',
                date: '2024-12-25T10:00:00Z',
                createdBy: userId,
                isActive: true,
                status: 'programada'
            };

            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => existingSession
            });

            mockUpdate.mockResolvedValue();

            const result = await service.cancelSession(sessionId, reason, userId);

            expect(mockUpdate).toHaveBeenCalledWith(sessionId, expect.objectContaining({
                status: 'cancelada',
                cancellationReason: reason
            }), userId);
        });

        test('debe rechazar fechas pasadas', async () => {
            const sessionData = {
                patientId: 'patient123',
                date: '2020-01-01T10:00:00Z',
                duration: 60
            };
            const userId = 'user123';

            await expect(service.createSession(sessionData, userId))
                .rejects.toThrow('Session date must be in the future');
        });

        test('debe rechazar duraciones inválidas', async () => {
            const sessionData = {
                patientId: 'patient123',
                date: '2024-12-25T10:00:00Z',
                duration: 5
            };
            const userId = 'user123';

            await expect(service.createSession(sessionData, userId))
                .rejects.toThrow('Duration must be between 15 and 240 minutes');
        });

        test('debe rechazar actualizar sesiones completadas', async () => {
            const sessionId = 'session123';
            const userId = 'user123';
            const updateData = { duration: 90 };
            const existingSession = {
                patientId: 'patient123',
                date: '2024-12-25T10:00:00Z',
                createdBy: userId,
                isActive: true,
                status: 'completada'
            };

            mockGet.mockResolvedValueOnce({
                exists: true,
                data: () => existingSession
            });

            await expect(service.updateSession(sessionId, updateData, userId))
                .rejects.toThrow('Cannot update completed session');
        });
    });

    describe('Seguridad y Autorización', () => {
        test('debe verificar autorización del usuario', () => {
            const sessionData = { createdBy: 'user123' };
            expect(service.isUserAuthorized(sessionData, 'user123')).toBe(true);
            expect(service.isUserAuthorized(sessionData, 'user456')).toBe(false);
        });

        test('debe sanitizar datos para respuesta', () => {
            const data = {
                patientId: 'patient123',
                encryptionVersion: '1.0',
                sensitive: 'data'
            };
            const sanitized = service.sanitizeForResponse(data);
            expect(sanitized).not.toHaveProperty('encryptionVersion');
            expect(sanitized).toHaveProperty('patientId');
        });
    });
});
