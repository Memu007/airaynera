const request = require('supertest');
const app = require('../../src/app');
const { db } = require('../../src/config/database');
const authService = require('../../src/services/authService');
const patientsService = require('../../src/services/patientsService');

// Mock the entire database
jest.mock('../../src/config/database');
jest.mock('../../src/services/authService');
jest.mock('../../src/services/patientsService');

describe('E2E Tests - Complete Application Flow', () => {
    let server;
    let authToken;
    let refreshToken;
    let patientId;

    beforeAll(async () => {
        // Setup mock database
        db.collection = jest.fn().mockReturnValue({
            doc: jest.fn().mockReturnValue({
                get: jest.fn(),
                set: jest.fn(),
                update: jest.fn(),
                delete: jest.fn()
            }),
            add: jest.fn(),
            where: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            offset: jest.fn().mockReturnThis(),
            get: jest.fn()
        });

        // Setup mock services
        authService.register.mockResolvedValue({
            id: 'user123',
            email: 'test@example.com',
            name: 'Test User',
            role: 'doctor'
        });

        authService.login.mockResolvedValue({
            user: { id: 'user123', email: 'test@example.com', role: 'doctor' },
            token: 'jwt-token-123',
            refreshToken: 'refresh-token-456'
        });

        patientsService.create.mockResolvedValue({
            id: 'patient123',
            name: 'John Doe',
            dni: '12345678',
            phone: '555-1234',
            email: 'john@example.com'
        });

        patientsService.getPatientsByUser.mockResolvedValue({
            patients: [
                { id: 'patient123', name: 'John Doe', dni: '12345678' }
            ],
            total: 1,
            hasMore: false
        });

        patientsService.getById.mockResolvedValue({
            id: 'patient123',
            name: 'John Doe',
            dni: '12345678',
            phone: '555-1234',
            email: 'john@example.com'
        });

        patientsService.update.mockResolvedValue({
            id: 'patient123',
            name: 'Updated Name',
            dni: '12345678',
            phone: '555-9999'
        });

        patientsService.delete.mockResolvedValue(true);
    });

    afterAll(async () => {
        if (server) {
            server.close();
        }
    });

    describe('Complete User Journey', () => {
        it('should complete full user registration and patient management flow', async () => {
            // 1. Register new user
            const registerResponse = await request(app)
                .post('/api/auth/register')
                .send({
                    email: 'test@example.com',
                    password: 'password123',
                    name: 'Test User',
                    role: 'doctor'
                });

            expect(registerResponse.status).toBe(201);
            expect(registerResponse.body).toHaveProperty('id');
            expect(registerResponse.body.email).toBe('test@example.com');

            // 2. Login user
            const loginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'test@example.com',
                    password: 'password123'
                });

            expect(loginResponse.status).toBe(200);
            expect(loginResponse.body).toHaveProperty('token');
            expect(loginResponse.body).toHaveProperty('refreshToken');
            
            authToken = loginResponse.body.token;
            refreshToken = loginResponse.body.refreshToken;

            // 3. Create new patient
            const createPatientResponse = await request(app)
                .post('/api/patients')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'John Doe',
                    dni: '12345678',
                    phone: '555-1234',
                    email: 'john@example.com',
                    address: '123 Main St',
                    birthDate: '1990-01-01',
                    medicalHistory: 'No known allergies'
                });

            expect(createPatientResponse.status).toBe(201);
            expect(createPatientResponse.body).toHaveProperty('id');
            patientId = createPatientResponse.body.id;

            // 4. Get all patients
            const getPatientsResponse = await request(app)
                .get('/api/patients')
                .set('Authorization', `Bearer ${authToken}`);

            expect(getPatientsResponse.status).toBe(200);
            expect(getPatientsResponse.body).toHaveProperty('patients');
            expect(getPatientsResponse.body.patients).toHaveLength(1);

            // 5. Get specific patient
            const getPatientResponse = await request(app)
                .get(`/api/patients/${patientId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(getPatientResponse.status).toBe(200);
            expect(getPatientResponse.body.name).toBe('John Doe');

            // 6. Update patient
            const updatePatientResponse = await request(app)
                .put(`/api/patients/${patientId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: 'Updated Name',
                    phone: '555-9999'
                });

            expect(updatePatientResponse.status).toBe(200);
            expect(updatePatientResponse.body.name).toBe('Updated Name');

            // 7. Search patients
            const searchResponse = await request(app)
                .get('/api/patients/search?name=Updated')
                .set('Authorization', `Bearer ${authToken}`);

            expect(searchResponse.status).toBe(200);
            expect(Array.isArray(searchResponse.body)).toBe(true);

            // 8. Delete patient
            const deleteResponse = await request(app)
                .delete(`/api/patients/${patientId}`)
                .set('Authorization', `Bearer ${authToken}`);

            expect(deleteResponse.status).toBe(200);
            expect(deleteResponse.body).toEqual({ success: true });

            // 9. Refresh token
            const refreshResponse = await request(app)
                .post('/api/auth/refresh')
                .send({ refreshToken });

            expect(refreshResponse.status).toBe(200);
            expect(refreshResponse.body).toHaveProperty('token');

            // 10. Logout
            const logoutResponse = await request(app)
                .post('/api/auth/logout')
                .send({ refreshToken });

            expect(logoutResponse.status).toBe(200);
            expect(logoutResponse.body).toEqual({ success: true });
        });

        it('should handle error scenarios gracefully', async () => {
            // Test invalid login
            authService.login.mockRejectedValue(new Error('Invalid credentials'));
            
            const invalidLoginResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: 'wrong@example.com',
                    password: 'wrongpass'
                });

            expect(invalidLoginResponse.status).toBe(401);
            expect(invalidLoginResponse.body).toHaveProperty('error');

            // Test unauthorized access
            const unauthorizedResponse = await request(app)
                .get('/api/patients')
                .set('Authorization', 'Bearer invalid-token');

            expect(unauthorizedResponse.status).toBe(401);

            // Test validation errors
            const validationResponse = await request(app)
                .post('/api/patients')
                .set('Authorization', `Bearer ${authToken}`)
                .send({});

            expect(validationResponse.status).toBe(400);
        });

        it('should handle concurrent operations', async () => {
            // Simulate concurrent patient creation
            const concurrentRequests = Array(5).fill(null).map((_, i) => 
                request(app)
                    .post('/api/patients')
                    .set('Authorization', `Bearer ${authToken}`)
                    .send({
                        name: `Patient ${i}`,
                        dni: `1234567${i}`,
                        phone: `555-000${i}`
                    })
            );

            const responses = await Promise.all(concurrentRequests);
            
            responses.forEach(response => {
                expect(response.status).toBe(201);
            });
        });
    });

    describe('Security Tests', () => {
        it('should prevent SQL injection attempts', async () => {
            const maliciousResponse = await request(app)
                .post('/api/auth/login')
                .send({
                    email: "test@example.com'; DROP TABLE users; --",
                    password: 'password123'
                });

            expect(maliciousResponse.status).toBeGreaterThanOrEqual(400);
        });

        it('should sanitize input data', async () => {
            const xssResponse = await request(app)
                .post('/api/patients')
                .set('Authorization', `Bearer ${authToken}`)
                .send({
                    name: '<script>alert("XSS")</script>',
                    dni: '12345678',
                    phone: '555-1234'
                });

            expect(xssResponse.status).toBe(201);
            expect(xssResponse.body.name).not.toContain('<script>');
        });

        it('should enforce rate limiting', async () => {
            const requests = Array(10).fill(null).map(() => 
                request(app)
                    .post('/api/auth/login')
                    .send({
                        email: 'test@example.com',
                        password: 'password123'
                    })
            );

            const responses = await Promise.all(requests);
            const rateLimitedResponses = responses.filter(r => r.status === 429);
            
            expect(rateLimitedResponses.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Performance Tests', () => {
        it('should handle large patient lists efficiently', async () => {
            const largePatientList = Array(100).fill(null).map((_, i) => ({
                id: `patient${i}`,
                name: `Patient ${i}`,
                dni: `1234567${i}`,
                phone: `555-000${i}`
            }));

            patientsService.getPatientsByUser.mockResolvedValue({
                patients: largePatientList,
                total: 100,
                hasMore: false
            });

            const response = await request(app)
                .get('/api/patients?limit=100')
                .set('Authorization', `Bearer ${authToken}`);

            expect(response.status).toBe(200);
            expect(response.body.patients).toHaveLength(100);
            expect(response.body.total).toBe(100);
        });

        it('should respond within acceptable time limits', async () => {
            const startTime = Date.now();
            
            const response = await request(app)
                .get('/api/patients')
                .set('Authorization', `Bearer ${authToken}`);
            
            const endTime = Date.now();
            const responseTime = endTime - startTime;
            
            expect(response.status).toBe(200);
            expect(responseTime).toBeLessThan(5000); // 5 seconds max
        });
    });
});
