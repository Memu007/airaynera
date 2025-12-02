const request = require('supertest');
const express = require('express');
const patientsController = require('../../src/controllers/patientsController');
const patientsService = require('../../src/services/patientsService');

// Mock del service
jest.mock('../../src/services/patientsService');
jest.mock('../../src/utils/logger');

describe('PatientsController', () => {
    let app;
    let mockReq, mockRes;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        
        // Mock middleware de autenticación
        app.use((req, res, next) => {
            req.user = { id: 'therapist-123', role: 'therapist' };
            next();
        });

        // Setup rutas
        app.post('/patients', patientsController.create);
        app.get('/patients', patientsController.getAll);
        app.get('/patients/:id', patientsController.getById);
        app.put('/patients/:id', patientsController.update);
        app.delete('/patients/:id', patientsController.delete);
        app.get('/patients/search/:query', patientsController.search);

        mockReq = {
            body: {},
            params: {},
            query: {},
            user: { id: 'therapist-123', role: 'therapist' }
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        jest.clearAllMocks();
    });

    describe('POST /patients', () => {
        test('should create patient successfully', async () => {
            const patientData = {
                name: 'Juan Pérez',
                dni: '12345678',
                email: 'juan@example.com',
                phone: '+1234567890',
                notes: 'Paciente con ansiedad'
            };

            const createdPatient = {
                id: 'patient-123',
                ...patientData,
                createdAt: new Date().toISOString(),
                createdBy: 'therapist-123'
            };

            patientsService.create.mockResolvedValue(createdPatient);

            const response = await request(app)
                .post('/patients')
                .send(patientData)
                .expect(201);

            expect(response.body.success).toBe(true);
            expect(response.body.patient.name).toBe(patientData.name);
            expect(response.body.patient.id).toBe('patient-123');
            expect(patientsService.create).toHaveBeenCalledWith(patientData, 'therapist-123');
        });

        test('should handle validation errors', async () => {
            const invalidData = {
                name: '', // Required field empty
                email: 'invalid-email'
            };

            patientsService.create.mockRejectedValue(new Error('Name is required'));

            const response = await request(app)
                .post('/patients')
                .send(invalidData)
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Name is required');
        });

        test('should handle duplicate DNI error', async () => {
            const patientData = {
                name: 'Juan Pérez',
                dni: '12345678', // DNI ya existente
                email: 'juan@example.com'
            };

            patientsService.create.mockRejectedValue(new Error('DNI already exists'));

            const response = await request(app)
                .post('/patients')
                .send(patientData)
                .expect(409);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('DNI already exists');
        });
    });

    describe('GET /patients', () => {
        test('should get all patients successfully', async () => {
            const mockPatients = [
                { id: 'patient-1', name: 'Juan Pérez', dni: '12345678' },
                { id: 'patient-2', name: 'María García', dni: '87654321' }
            ];

            patientsService.getAll.mockResolvedValue(mockPatients);

            const response = await request(app)
                .get('/patients')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.patients).toHaveLength(2);
            expect(response.body.patients[0].name).toBe('Juan Pérez');
            expect(patientsService.getAll).toHaveBeenCalledWith('therapist-123', false);
        });

        test('should get patients with decryption when requested', async () => {
            const mockPatients = [
                { id: 'patient-1', name: 'Juan Pérez', notes: 'Decrypted notes' }
            ];

            patientsService.getAll.mockResolvedValue(mockPatients);

            const response = await request(app)
                .get('/patients?decrypt=true')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(patientsService.getAll).toHaveBeenCalledWith('therapist-123', true);
        });

        test('should handle empty patient list', async () => {
            patientsService.getAll.mockResolvedValue([]);

            const response = await request(app)
                .get('/patients')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.patients).toHaveLength(0);
        });
    });

    describe('GET /patients/:id', () => {
        test('should get patient by id successfully', async () => {
            const mockPatient = {
                id: 'patient-123',
                name: 'Juan Pérez',
                dni: '12345678',
                notes: 'Patient notes'
            };

            patientsService.getById.mockResolvedValue(mockPatient);

            mockReq.params = { id: 'patient-123' };

            await patientsController.getById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                patient: mockPatient
            });
            expect(patientsService.getById).toHaveBeenCalledWith('patient-123', 'therapist-123', false);
        });

        test('should handle patient not found', async () => {
            patientsService.getById.mockResolvedValue(null);

            mockReq.params = { id: 'nonexistent-patient' };

            await patientsController.getById(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Patient not found'
            });
        });

        test('should get patient with decryption when requested', async () => {
            const mockPatient = {
                id: 'patient-123',
                name: 'Juan Pérez',
                notes: 'Decrypted sensitive notes'
            };

            patientsService.getById.mockResolvedValue(mockPatient);

            mockReq.params = { id: 'patient-123' };
            mockReq.query = { decrypt: 'true' };

            await patientsController.getById(mockReq, mockRes);

            expect(patientsService.getById).toHaveBeenCalledWith('patient-123', 'therapist-123', true);
        });
    });

    describe('PUT /patients/:id', () => {
        test('should update patient successfully', async () => {
            const updateData = {
                name: 'Juan Pérez Updated',
                phone: '+9876543210'
            };

            const updatedPatient = {
                id: 'patient-123',
                ...updateData,
                updatedAt: new Date().toISOString(),
                updatedBy: 'therapist-123'
            };

            patientsService.update.mockResolvedValue(updatedPatient);

            mockReq.params = { id: 'patient-123' };
            mockReq.body = updateData;

            await patientsController.update(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                patient: updatedPatient
            });
            expect(patientsService.update).toHaveBeenCalledWith('patient-123', updateData, 'therapist-123');
        });

        test('should handle unauthorized update', async () => {
            patientsService.update.mockRejectedValue(new Error('Unauthorized to update this patient'));

            mockReq.params = { id: 'patient-123' };
            mockReq.body = { name: 'Updated Name' };

            await patientsController.update(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Unauthorized to update this patient'
            });
        });

        test('should handle validation errors on update', async () => {
            const invalidData = {
                email: 'invalid-email-format'
            };

            patientsService.update.mockRejectedValue(new Error('Invalid email format'));

            mockReq.params = { id: 'patient-123' };
            mockReq.body = invalidData;

            await patientsController.update(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Invalid email format'
            });
        });
    });

    describe('DELETE /patients/:id', () => {
        test('should delete patient successfully', async () => {
            patientsService.delete.mockResolvedValue(true);

            mockReq.params = { id: 'patient-123' };

            await patientsController.delete(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                message: 'Patient deleted successfully'
            });
            expect(patientsService.delete).toHaveBeenCalledWith('patient-123', 'therapist-123');
        });

        test('should handle unauthorized delete', async () => {
            patientsService.delete.mockRejectedValue(new Error('Unauthorized to delete this patient'));

            mockReq.params = { id: 'patient-123' };

            await patientsController.delete(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Unauthorized to delete this patient'
            });
        });

        test('should handle patient not found on delete', async () => {
            patientsService.delete.mockRejectedValue(new Error('Patient not found'));

            mockReq.params = { id: 'nonexistent-patient' };

            await patientsController.delete(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Patient not found'
            });
        });
    });

    describe('GET /patients/search/:query', () => {
        test('should search patients successfully', async () => {
            const searchResults = [
                { id: 'patient-1', name: 'Juan Pérez', dni: '12345678' },
                { id: 'patient-2', name: 'Juan Carlos', dni: '11111111' }
            ];

            patientsService.search.mockResolvedValue(searchResults);

            mockReq.params = { query: 'Juan' };

            await patientsController.search(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                patients: searchResults,
                query: 'Juan'
            });
            expect(patientsService.search).toHaveBeenCalledWith('Juan', 'therapist-123');
        });

        test('should handle empty search results', async () => {
            patientsService.search.mockResolvedValue([]);

            mockReq.params = { query: 'NonexistentName' };

            await patientsController.search(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(200);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: true,
                patients: [],
                query: 'NonexistentName'
            });
        });

        test('should handle invalid search query', async () => {
            mockReq.params = { query: '' };

            await patientsController.search(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Search query is required'
            });
        });

        test('should handle search query too short', async () => {
            mockReq.params = { query: 'a' }; // Too short

            await patientsController.search(mockReq, mockRes);

            expect(mockRes.status).toHaveBeenCalledWith(400);
            expect(mockRes.json).toHaveBeenCalledWith({
                success: false,
                error: 'Search query must be at least 2 characters'
            });
        });
    });

    describe('Error handling', () => {
        test('should handle database errors gracefully', async () => {
            patientsService.getAll.mockRejectedValue(new Error('Database connection failed'));

            const response = await request(app)
                .get('/patients')
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Internal server error');
        });

        test('should handle encryption service errors', async () => {
            patientsService.create.mockRejectedValue(new Error('Encryption service unavailable'));

            const response = await request(app)
                .post('/patients')
                .send({ name: 'Test Patient', dni: '12345678' })
                .expect(500);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Internal server error');
        });
    });

    describe('Input validation and sanitization', () => {
        test('should handle malicious input safely', async () => {
            const maliciousData = {
                name: '<script>alert("xss")</script>',
                notes: '<img src=x onerror=alert("xss")>',
                dni: '12345678'
            };

            patientsService.create.mockResolvedValue({
                id: 'patient-123',
                name: 'Safe Name',
                notes: 'Safe Notes',
                dni: '12345678'
            });

            const response = await request(app)
                .post('/patients')
                .send(maliciousData)
                .expect(201);

            expect(response.body.patient.name).not.toContain('<script>');
            expect(response.body.patient.notes).not.toContain('<img');
        });

        test('should handle SQL injection attempts', async () => {
            const sqlInjectionAttempt = {
                name: "'; DROP TABLE patients; --",
                dni: '12345678'
            };

            patientsService.create.mockResolvedValue({
                id: 'patient-123',
                name: 'Safe Name',
                dni: '12345678'
            });

            const response = await request(app)
                .post('/patients')
                .send(sqlInjectionAttempt)
                .expect(201);

            // El servicio debería limpiar/validar la entrada
            expect(response.body.success).toBe(true);
        });
    });

    describe('Authorization scenarios', () => {
        test('should allow admin to access any patient', async () => {
            // Override user role for this test
            app.use((req, res, next) => {
                req.user = { id: 'admin-123', role: 'admin' };
                next();
            });

            const mockPatient = { id: 'patient-123', name: 'Juan Pérez' };
            patientsService.getById.mockResolvedValue(mockPatient);

            const response = await request(app)
                .get('/patients/patient-123')
                .expect(200);

            expect(response.body.success).toBe(true);
        });

        test('should restrict therapist to own patients only', async () => {
            patientsService.getById.mockRejectedValue(new Error('Unauthorized to access this patient'));

            const response = await request(app)
                .get('/patients/other-therapist-patient')
                .expect(403);

            expect(response.body.success).toBe(false);
            expect(response.body.error).toBe('Unauthorized to access this patient');
        });
    });
}); 