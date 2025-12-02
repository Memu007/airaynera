const patientsService = require('../../../src/services/patientsService');
const { db } = require('../../../src/config/database');
const encryption = require('../../../src/utils/encryption');
const logger = require('../../../src/utils/logger');

// Mock dependencies
jest.mock('../../../src/config/database');
jest.mock('../../../src/utils/encryption');
jest.mock('../../../src/utils/logger');

describe('PatientsService', () => {
    let mockCollection;
    let mockDoc;
    let mockSnapshot;
    let mockQuery;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

        // Setup mocks
        mockDoc = {
            get: jest.fn(),
            set: jest.fn(),
            update: jest.fn()
        };

        mockSnapshot = {
            exists: true,
            data: jest.fn(),
            forEach: jest.fn(),
            empty: false,
            size: 0,
            docs: []
        };

        mockQuery = {
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
            get: jest.fn()
        };

        mockCollection = {
            doc: jest.fn(() => mockDoc),
            where: jest.fn(() => mockQuery),
            get: jest.fn()
        };

        db.collection = jest.fn(() => mockCollection);

        // Mock encryption
        encryption.encrypt = jest.fn((data) => `encrypted_${data}`);
        encryption.decrypt = jest.fn((data) => data.replace('encrypted_', ''));
        encryption.encryptSensitiveFields = jest.fn((data) => data);
    });

    describe('create', () => {
        it('should create a new patient successfully', async () => {
            const patientData = {
                name: 'John Doe',
                dni: '12345678',
                phone: '555-1234',
                insurance: 'Provider A'
            };

            mockCollection.where.mockReturnValue({
                get: jest.fn().mockResolvedValue({ empty: true })
            });

            mockDoc.set.mockResolvedValue();

            const result = await patientsService.create(patientData);

            expect(result).toHaveProperty('id');
            expect(result.name).toBe('John Doe');
            expect(result.dni).toBe('12345678');
            expect(mockDoc.set).toHaveBeenCalled();
        });

        it('should throw error when name is missing', async () => {
            const patientData = { dni: '12345678' };

            await expect(patientsService.create(patientData))
                .rejects.toThrow('Name and DNI are required');
        });

        it('should throw error when DNI already exists', async () => {
            const patientData = {
                name: 'John Doe',
                dni: '12345678'
            };

            mockCollection.where.mockReturnValue({
                get: jest.fn().mockResolvedValue({ empty: false })
            });

            await expect(patientsService.create(patientData))
                .rejects.toThrow('Patient with this DNI already exists');
        });

        it('should handle database errors', async () => {
            const patientData = {
                name: 'John Doe',
                dni: '12345678'
            };

            mockCollection.where.mockReturnValue({
                get: jest.fn().mockRejectedValue(new Error('DB Error'))
            });

            await expect(patientsService.create(patientData))
                .rejects.toThrow('DB Error');
        });
    });

    describe('getById', () => {
        it('should return patient when found and owned by user', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';
            const patientData = {
                name: 'John Doe',
                dni: '12345678',
                userId: 'user_456',
                insurance: 'encrypted_insurance_data'
            };

            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => patientData
            });

            const result = await patientsService.getById(patientId, userId);

            expect(result).toBeTruthy();
            expect(result.name).toBe('John Doe');
            expect(result.id).toBe(patientId);
        });

        it('should return null when patient not found', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';

            mockDoc.get.mockResolvedValue({
                exists: false
            });

            const result = await patientsService.getById(patientId, userId);

            expect(result).toBeNull();
        });

        it('should return null when patient belongs to different user', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';
            const patientData = {
                name: 'John Doe',
                userId: 'user_789' // Different user
            };

            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => patientData
            });

            const result = await patientsService.getById(patientId, userId);

            expect(result).toBeNull();
        });

        it('should handle decryption errors gracefully', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';
            const patientData = {
                name: 'John Doe',
                userId: 'user_456',
                insurance: 'encrypted_data'
            };

            mockDoc.get.mockResolvedValue({
                exists: true,
                data: () => patientData
            });

            encryption.decrypt.mockImplementation(() => {
                throw new Error('Decryption failed');
            });

            const result = await patientsService.getById(patientId, userId);

            expect(result).toBeTruthy();
            expect(logger.warn).toHaveBeenCalled();
        });
    });

    describe('getAll', () => {
        it('should return paginated patients list', async () => {
            const mockPatients = [
                { id: '1', name: 'Patient 1', isActive: true, createdAt: '2024-01-01' },
                { id: '2', name: 'Patient 2', isActive: true, createdAt: '2024-01-02' }
            ];

            mockQuery.get.mockResolvedValue({
                forEach: (callback) => mockPatients.forEach(p => callback({ 
                    id: p.id, 
                    data: () => p 
                })),
                size: 2
            });

            const result = await patientsService.getAll({ limit: 10, offset: 0 });

            expect(result.patients).toHaveLength(2);
            expect(result.total).toBe(2);
            expect(result.hasMore).toBe(false);
        });

        it('should filter inactive patients by default', async () => {
            await patientsService.getAll();

            expect(mockCollection.where).toHaveBeenCalledWith('isActive', '==', true);
        });

        it('should include inactive patients when requested', async () => {
            await patientsService.getAll({ includeInactive: true });

            expect(mockCollection.where).not.toHaveBeenCalledWith('isActive', '==', true);
        });

        it('should handle empty results', async () => {
            mockQuery.get.mockResolvedValue({
                forEach: () => {},
                size: 0
            });

            const result = await patientsService.getAll();

            expect(result.patients).toHaveLength(0);
            expect(result.total).toBe(0);
        });
    });

    describe('getPatientsByUser', () => {
        it('should return patients for specific user', async () => {
            const userId = 'user_123';
            const mockPatients = [
                { id: '1', name: 'Patient 1', userId: 'user_123' },
                { id: '2', name: 'Patient 2', userId: 'user_123' }
            ];

            mockQuery.get.mockResolvedValue({
                forEach: (callback) => mockPatients.forEach(p => callback({ 
                    id: p.id, 
                    data: () => p 
                })),
                size: 2
            });

            const result = await patientsService.getPatientsByUser(userId);

            expect(result.patients).toHaveLength(2);
            expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', userId);
        });

        it('should filter by status when provided', async () => {
            const userId = 'user_123';
            await patientsService.getPatientsByUser(userId, { status: 'activo' });

            expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', userId);
            expect(mockCollection.where).toHaveBeenCalledWith('status', '==', 'activo');
        });
    });

    describe('update', () => {
        it('should update patient successfully', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';
            const updateData = { name: 'Updated Name' };

            // Mock getById to return patient
            jest.spyOn(patientsService, 'getById').mockResolvedValue({
                id: patientId,
                name: 'Original Name',
                userId: userId
            });

            mockDoc.update.mockResolvedValue();

            const result = await patientsService.update(patientId, userId, updateData);

            expect(result).toBeTruthy();
            expect(mockDoc.update).toHaveBeenCalled();
            expect(logger.info).toHaveBeenCalled();
        });

        it('should throw error when patient not found', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';
            const updateData = { name: 'Updated Name' };

            jest.spyOn(patientsService, 'getById').mockResolvedValue(null);

            await expect(patientsService.update(patientId, userId, updateData))
                .rejects.toThrow('Patient not found or access denied');
        });

        it('should encrypt sensitive fields during update', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';
            const updateData = { insurance: 'New Insurance' };

            jest.spyOn(patientsService, 'getById').mockResolvedValue({
                id: patientId,
                userId: userId
            });

            mockDoc.update.mockResolvedValue();

            await patientsService.update(patientId, userId, updateData);

            expect(encryption.encrypt).toHaveBeenCalledWith('New Insurance');
        });
    });

    describe('delete', () => {
        it('should soft delete patient successfully', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';

            jest.spyOn(patientsService, 'getById').mockResolvedValue({
                id: patientId,
                userId: userId
            });

            mockDoc.update.mockResolvedValue();

            const result = await patientsService.delete(patientId, userId);

            expect(result).toBe(true);
            expect(mockDoc.update).toHaveBeenCalledWith({
                isActive: false,
                deletedAt: expect.any(String),
                updatedAt: expect.any(String)
            });
        });

        it('should throw error when patient not found', async () => {
            const patientId = 'patient_123';
            const userId = 'user_456';

            jest.spyOn(patientsService, 'getById').mockResolvedValue(null);

            await expect(patientsService.delete(patientId, userId))
                .rejects.toThrow('Patient not found or access denied');
        });
    });

    describe('search', () => {
        it('should search patients by name', async () => {
            const criteria = { name: 'John' };
            const mockPatients = [
                { id: '1', name: 'John Doe', isActive: true },
                { id: '2', name: 'Jane Doe', isActive: true }
            ];

            mockCollection.where.mockReturnValue(mockQuery);
            mockQuery.get.mockResolvedValue({
                forEach: (callback) => mockPatients.forEach(p => callback({ 
                    id: p.id, 
                    data: () => p 
                }))
            });

            const result = await patientsService.search(criteria);

            expect(result).toHaveLength(2);
            expect(mockCollection.where).toHaveBeenCalledWith('isActive', '==', true);
        });

        it('should search patients by DNI', async () => {
            const criteria = { dni: '12345678' };

            mockCollection.where.mockReturnValue(mockQuery);
            mockQuery.get.mockResolvedValue({
                forEach: () => {}
            });

            await patientsService.search(criteria);

            expect(mockCollection.where).toHaveBeenCalledWith('dni', '==', '12345678');
        });

        it('should return empty array when no matches', async () => {
            mockCollection.where.mockReturnValue(mockQuery);
            mockQuery.get.mockResolvedValue({
                forEach: () => {}
            });

            const result = await patientsService.search({ name: 'Nonexistent' });

            expect(result).toEqual([]);
        });
    });

    describe('findByDNI', () => {
        it('should return patient when found by DNI', async () => {
            const dni = '12345678';
            const mockPatient = { id: '1', name: 'John Doe', dni: '12345678' };

            mockCollection.where.mockReturnValue({
                get: jest.fn().mockResolvedValue({
                    empty: false,
                    docs: [{ id: '1', data: () => mockPatient }]
                })
            });

            const result = await patientsService.findByDNI(dni);

            expect(result).toEqual(mockPatient);
        });

        it('should return null when patient not found', async () => {
            const dni = '99999999';

            mockCollection.where.mockReturnValue({
                get: jest.fn().mockResolvedValue({ empty: true })
            });

            const result = await patientsService.findByDNI(dni);

            expect(result).toBeNull();
        });
    });

    describe('getStats', () => {
        it('should return statistics for all patients', async () => {
            const mockPatients = [
                { isActive: true },
                { isActive: true },
                { isActive: false }
            ];

            mockCollection.get.mockResolvedValue({
                forEach: (callback) => mockPatients.forEach(p => callback({ data: () => p })),
                size: 3
            });

            const result = await patientsService.getStats();

            expect(result).toEqual({
                total: 3,
                active: 2,
                inactive: 1,
                createdToday: 0
            });
        });

        it('should return statistics filtered by user', async () => {
            const userId = 'user_123';
            const mockPatients = [
                { isActive: true, userId: 'user_123' },
                { isActive: false, userId: 'user_123' }
            ];

            mockCollection.where.mockReturnValue({
                get: jest.fn().mockResolvedValue({
                    forEach: (callback) => mockPatients.forEach(p => callback({ data: () => p })),
                    size: 2
                })
            });

            const result = await patientsService.getStats(userId);

            expect(result).toEqual({
                total: 2,
                active: 1,
                inactive: 1,
                createdToday: 0
            });
            expect(mockCollection.where).toHaveBeenCalledWith('userId', '==', userId);
        });
    });

    describe('migrateToEncryption', () => {
        it('should migrate patients to encryption', async () => {
            const mockPatients = [
                { id: '1', data: () => ({ name: 'John', insurance: 'data1' }), ref: { update: jest.fn() } },
                { id: '2', data: () => ({ name: 'Jane', insurance: 'data2', encryptionVersion: '1.0' }), ref: { update: jest.fn() } }
            ];

            mockCollection.get.mockResolvedValue({
                forEach: (callback) => mockPatients.forEach(p => callback(p))
            });

            const result = await patientsService.migrateToEncryption();

            expect(result).toBe(1); // Only first patient needs migration
            expect(mockPatients[0].ref.update).toHaveBeenCalledWith({
                encryptionVersion: '1.0',
                insurance: 'encrypted_data1'
            });
            expect(mockPatients[1].ref.update).not.toHaveBeenCalled();
        });

        it('should handle migration errors', async () => {
            mockCollection.get.mockRejectedValue(new Error('DB Error'));

            await expect(patientsService.migrateToEncryption())
                .rejects.toThrow('DB Error');
        });
    });
});
