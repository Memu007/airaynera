const request = require('supertest');
const express = require('express');
const patientsRoutes = require('../../src/routes/patients');
const patientsController = require('../../src/controllers/patientsController');
const authMiddleware = require('../../src/middleware/auth');
const { db } = require('../../src/config/database');

// Mock dependencies
jest.mock('../../src/controllers/patientsController');
jest.mock('../../src/middleware/auth');
jest.mock('../../src/config/database');

describe('Patients API Integration Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/patients', patientsRoutes);
        
        // Reset mocks
        jest.clearAllMocks();
        
        // Mock auth middleware
        authMiddleware.authenticate = jest.fn((req, res, next) => {
            req.user = { id: 'user123', email: 'test@example.com' };
            next();
        });
    });

    describe('GET /api/patients', () => {
        it('should return patients list successfully', async () => {
            const mockPatients = [
                { id: '1', name: 'John Doe', dni: '12345678', phone: '555-1234' },
                { id: '2', name: 'Jane Smith', dni: '87654321', phone: '555-5678' }
            ];

            patientsController.getAllPatients.mockImplementation((req, res) => {
                res.json({ patients: mockPatients, total: 2 });
            });

            const response = await request(app)
                .get('/api/patients')
                .expect(200);

            expect(response.body).toEqual({
                patients: mockPatients,
                total: 2
            });
        });

        it('should handle pagination parameters', async () => {
            patientsController.getAllPatients.mockImplementation((req, res) => {
                expect(req.query.limit).toBe('10');
                expect(req.query.offset).toBe('0');
                res.json({ patients: [], total: 0 });
            });

            await request(app)
                .get('/api/patients?limit=10&offset=0')
                .expect(200);
        });

        it('should handle errors gracefully', async () => {
            patientsController.getAllPatients.mockImplementation((req, res) => {
                res.status(500).json({ error: 'Internal server error' });
            });

            const response = await request(app)
                .get('/api/patients')
                .expect(500);

            expect(response.body).toEqual({ error: 'Internal server error' });
        });
    });

    describe('POST /api/patients', () => {
        it('should create a new patient successfully', async () => {
            const newPatient = {
                name: 'John Doe',
                dni: '12345678',
                phone: '555-1234',
                email: 'john@example.com'
            };

            patientsController.createPatient.mockImplementation((req, res) => {
                res.status(201).json({
                    id: 'patient123',
                    ...newPatient,
                    createdAt: new Date().toISOString()
                });
            });

            const response = await request(app)
                .post('/api/patients')
                .send(newPatient)
                .expect(201);

            expect(response.body).toHaveProperty('id');
            expect(response.body.name).toBe('John Doe');
        });

        it('should validate required fields', async () => {
            patientsController.createPatient.mockImplementation((req, res) => {
                res.status(400).json({ error: 'Name and DNI are required' });
            });

            const response = await request(app)
                .post('/api/patients')
                .send({})
                .expect(400);

            expect(response.body).toEqual({ error: 'Name and DNI are required' });
        });
    });

    describe('GET /api/patients/:id', () => {
        it('should return patient by ID', async () => {
            const mockPatient = {
                id: 'patient123',
                name: 'John Doe',
                dni: '12345678',
                phone: '555-1234'
            };

            patientsController.getPatientById.mockImplementation((req, res) => {
                res.json(mockPatient);
            });

            const response = await request(app)
                .get('/api/patients/patient123')
                .expect(200);

            expect(response.body).toEqual(mockPatient);
        });

        it('should return 404 when patient not found', async () => {
            patientsController.getPatientById.mockImplementation((req, res) => {
                res.status(404).json({ error: 'Patient not found' });
            });

            const response = await request(app)
                .get('/api/patients/nonexistent')
                .expect(404);

            expect(response.body).toEqual({ error: 'Patient not found' });
        });
    });

    describe('PUT /api/patients/:id', () => {
        it('should update patient successfully', async () => {
            const updateData = { name: 'Updated Name', phone: '555-9999' };

            patientsController.updatePatient.mockImplementation((req, res) => {
                res.json({
                    id: 'patient123',
                    ...updateData,
                    updatedAt: new Date().toISOString()
                });
            });

            const response = await request(app)
                .put('/api/patients/patient123')
                .send(updateData)
                .expect(200);

            expect(response.body.name).toBe('Updated Name');
        });

        it('should handle validation errors', async () => {
            patientsController.updatePatient.mockImplementation((req, res) => {
                res.status(400).json({ error: 'Invalid data' });
            });

            const response = await request(app)
                .put('/api/patients/patient123')
                .send({ invalid: 'data' })
                .expect(400);

            expect(response.body).toEqual({ error: 'Invalid data' });
        });
    });

    describe('DELETE /api/patients/:id', () => {
        it('should soft delete patient successfully', async () => {
            patientsController.deletePatient.mockImplementation((req, res) => {
                res.json({ success: true });
            });

            const response = await request(app)
                .delete('/api/patients/patient123')
                .expect(200);

            expect(response.body).toEqual({ success: true });
        });

        it('should handle deletion errors', async () => {
            patientsController.deletePatient.mockImplementation((req, res) => {
                res.status(404).json({ error: 'Patient not found' });
            });

            const response = await request(app)
                .delete('/api/patients/nonexistent')
                .expect(404);

            expect(response.body).toEqual({ error: 'Patient not found' });
        });
    });

    describe('GET /api/patients/search', () => {
        it('should search patients by criteria', async () => {
            const mockResults = [
                { id: '1', name: 'John Doe', dni: '12345678' }
            ];

            patientsController.searchPatients.mockImplementation((req, res) => {
                res.json(mockResults);
            });

            const response = await request(app)
                .get('/api/patients/search?name=John')
                .expect(200);

            expect(response.body).toEqual(mockResults);
        });

        it('should handle empty search results', async () => {
            patientsController.searchPatients.mockImplementation((req, res) => {
                res.json([]);
            });

            const response = await request(app)
                .get('/api/patients/search?name=Nonexistent')
                .expect(200);

            expect(response.body).toEqual([]);
        });
    });
});
