const patientsController = require('../../src/controllers/patientsController');
const patientsService = require('../../src/services/patientsService');
const { validationResult } = require('express-validator');

// Mock dependencies
jest.mock('../../src/services/patientsService');
jest.mock('express-validator');

describe('PatientsController', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            query: {},
            user: { id: 'user123' }
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
            send: jest.fn()
        };
        
        // Reset mocks
        jest.clearAllMocks();
    });

    describe('createPatient', () => {
        it('should create patient successfully', async () => {
            const patientData = {
                name: 'John Doe',
                dni: '12345678',
                phone: '555-1234',
                email: 'john@example.com'
            };

            req.body = patientData;
            validationResult.mockReturnValue({ isEmpty: () => true });
            patientsService.create.mockResolvedValue({
                id: 'patient123',
                ...patientData,
                createdAt: new Date().toISOString()
            });

            await patientsController.createPatient(req, res);

            expect(patientsService.create).toHaveBeenCalledWith(patientData);
            expect(res.status).toHaveBeenCalledWith(201);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                id: 'patient123',
                name: 'John Doe'
            }));
        });

        it('should handle validation errors', async () => {
            req.body = { name: 'John Doe' };
            validationResult.mockReturnValue({
                isEmpty: () => false,
                array: () => [{ msg: 'DNI is required' }]
            });

            await patientsController.createPatient(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Validation failed',
                details: [{ msg: 'DNI is required' }]
            });
            expect(patientsService.create).not.toHaveBeenCalled();
        });

        it('should handle service errors', async () => {
            req.body = { name: 'John Doe', dni: '12345678' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            patientsService.create.mockRejectedValue(new Error('Patient already exists'));

            await patientsController.createPatient(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Patient already exists' });
        });
    });

    describe('getAllPatients', () => {
        it('should return all patients with pagination', async () => {
            req.query = { limit: '10', offset: '0' };
            const mockPatients = [
                { id: '1', name: 'John Doe', dni: '12345678' },
                { id: '2', name: 'Jane Smith', dni: '87654321' }
            ];

            patientsService.getPatientsByUser.mockResolvedValue({
                patients: mockPatients,
                total: 2,
                hasMore: false
            });

            await patientsController.getAllPatients(req, res);

            expect(patientsService.getPatientsByUser).toHaveBeenCalledWith('user123', {
                limit: 10,
                offset: 0,
                status: 'activo'
            });
            expect(res.json).toHaveBeenCalledWith({
                patients: mockPatients,
                total: 2,
                hasMore: false
            });
        });

        it('should handle service errors', async () => {
            patientsService.getPatientsByUser.mockRejectedValue(new Error('Database error'));

            await patientsController.getAllPatients(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
        });
    });

    describe('getPatientById', () => {
        it('should return patient by ID', async () => {
            req.params.id = 'patient123';
            const mockPatient = {
                id: 'patient123',
                name: 'John Doe',
                dni: '12345678',
                phone: '555-1234'
            };

            patientsService.getById.mockResolvedValue(mockPatient);

            await patientsController.getPatientById(req, res);

            expect(patientsService.getById).toHaveBeenCalledWith('patient123', 'user123');
            expect(res.json).toHaveBeenCalledWith(mockPatient);
        });

        it('should return 404 when patient not found', async () => {
            req.params.id = 'nonexistent';
            patientsService.getById.mockResolvedValue(null);

            await patientsController.getPatientById(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Patient not found' });
        });

        it('should handle service errors', async () => {
            req.params.id = 'patient123';
            patientsService.getById.mockRejectedValue(new Error('Database error'));

            await patientsController.getPatientById(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
        });
    });

    describe('updatePatient', () => {
        it('should update patient successfully', async () => {
            req.params.id = 'patient123';
            req.body = { name: 'Updated Name', phone: '555-9999' };
            validationResult.mockReturnValue({ isEmpty: () => true });

            const updatedPatient = {
                id: 'patient123',
                name: 'Updated Name',
                phone: '555-9999',
                updatedAt: new Date().toISOString()
            };

            patientsService.update.mockResolvedValue(updatedPatient);

            await patientsController.updatePatient(req, res);

            expect(patientsService.update).toHaveBeenCalledWith('patient123', 'user123', req.body);
            expect(res.json).toHaveBeenCalledWith(updatedPatient);
        });

        it('should handle validation errors', async () => {
            req.params.id = 'patient123';
            validationResult.mockReturnValue({
                isEmpty: () => false,
                array: () => [{ msg: 'Invalid phone format' }]
            });

            await patientsController.updatePatient(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({
                error: 'Validation failed',
                details: [{ msg: 'Invalid phone format' }]
            });
        });

        it('should handle patient not found', async () => {
            req.params.id = 'nonexistent';
            req.body = { name: 'Updated' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            patientsService.update.mockResolvedValue(null);

            await patientsController.updatePatient(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Patient not found or access denied' });
        });

        it('should handle service errors', async () => {
            req.params.id = 'patient123';
            req.body = { name: 'Updated' };
            validationResult.mockReturnValue({ isEmpty: () => true });
            patientsService.update.mockRejectedValue(new Error('Update failed'));

            await patientsController.updatePatient(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Update failed' });
        });
    });

    describe('deletePatient', () => {
        it('should soft delete patient successfully', async () => {
            req.params.id = 'patient123';
            patientsService.delete.mockResolvedValue(true);

            await patientsController.deletePatient(req, res);

            expect(patientsService.delete).toHaveBeenCalledWith('patient123', 'user123');
            expect(res.json).toHaveBeenCalledWith({ success: true });
        });

        it('should handle patient not found', async () => {
            req.params.id = 'nonexistent';
            patientsService.delete.mockResolvedValue(false);

            await patientsController.deletePatient(req, res);

            expect(res.status).toHaveBeenCalledWith(404);
            expect(res.json).toHaveBeenCalledWith({ error: 'Patient not found or access denied' });
        });

        it('should handle service errors', async () => {
            req.params.id = 'patient123';
            patientsService.delete.mockRejectedValue(new Error('Delete failed'));

            await patientsController.deletePatient(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Delete failed' });
        });
    });

    describe('searchPatients', () => {
        it('should search patients by criteria', async () => {
            req.query = { name: 'John', dni: '123' };
            const mockResults = [
                { id: '1', name: 'John Doe', dni: '12345678' }
            ];

            patientsService.search.mockResolvedValue(mockResults);

            await patientsController.searchPatients(req, res);

            expect(patientsService.search).toHaveBeenCalledWith({
                name: 'John',
                dni: '123',
                limit: 50
            });
            expect(res.json).toHaveBeenCalledWith(mockResults);
        });

        it('should handle empty search results', async () => {
            req.query = { name: 'Nonexistent' };
            patientsService.search.mockResolvedValue([]);

            await patientsController.searchPatients(req, res);

            expect(res.json).toHaveBeenCalledWith([]);
        });

        it('should handle service errors', async () => {
            req.query = { name: 'John' };
            patientsService.search.mockRejectedValue(new Error('Search failed'));

            await patientsController.searchPatients(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Search failed' });
        });
    });

    describe('getPatientStats', () => {
        it('should return patient statistics', async () => {
            const mockStats = {
                total: 10,
                active: 8,
                inactive: 2,
                createdToday: 1
            };

            patientsService.getStats.mockResolvedValue(mockStats);

            await patientsController.getPatientStats(req, res);

            expect(patientsService.getStats).toHaveBeenCalledWith('user123');
            expect(res.json).toHaveBeenCalledWith(mockStats);
        });

        it('should handle service errors', async () => {
            patientsService.getStats.mockRejectedValue(new Error('Stats error'));

            await patientsController.getPatientStats(req, res);

            expect(res.status).toHaveBeenCalledWith(500);
            expect(res.json).toHaveBeenCalledWith({ error: 'Stats error' });
        });
    });
});
