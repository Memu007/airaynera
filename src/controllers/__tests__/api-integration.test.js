const request = require('supertest');
const app = require('../app'); // La app real
const authService = require('../services/authService');
const patientsService = require('../services/patientsService');
const sessionsService = require('../services/sessionsService');
const { MockAuthService, MockPatientsService, MockSessionsService } = require('../../tests/mocks/services');

// Mockear los servicios ANTES de que la app los importe
jest.mock('../services/authService');
jest.mock('../services/patientsService');
jest.mock('../services/sessionsService');

describe('API Integration Tests - Final Audit', () => {
  
  beforeEach(() => {
    // Resetear los mocks a una nueva instancia limpia para cada test
    const mockAuth = new MockAuthService();
    const mockPatients = new MockPatientsService();
    const mockSessions = new MockSessionsService();

    authService.register = jest.fn((...args) => mockAuth.register(...args));
    authService.login = jest.fn((...args) => mockAuth.login(...args));
    authService.verifyToken = jest.fn((...args) => mockAuth.verifyToken(...args));
    
    patientsService.create = jest.fn((...args) => mockPatients.create(...args));
    patientsService.getAll = jest.fn((...args) => mockPatients.getAll(...args));

    sessionsService.create = jest.fn((...args) => mockSessions.create(...args));
    sessionsService.getByPatient = jest.fn((...args) => mockSessions.getByPatient(...args));

    jest.clearAllMocks();
  });

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/register - should register a new user and return 201', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Test User',
          email: 'test@example.com',
          password: 'password123'
        });
        
      expect(response.status).toBe(201);
      expect(response.body.user.email).toBe('test@example.com');
      expect(authService.register).toHaveBeenCalledTimes(1);
    });

    test('POST /api/auth/login - should fail with non-existent user and return 500', async () => {
        // Mock a failure case
        authService.login.mockRejectedValue(new Error('Invalid credentials'));

        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'password123'
          });
          
        expect(response.status).toBe(500); // El controlador lo convierte en 500
        expect(response.body.error).toContain('Error en el servidor');
    });
  });

  describe('Protected Patient Endpoints', () => {
    let token;

    beforeEach(() => {
        // Simular un token válido para las pruebas
        token = 'valid-token';
        authService.verifyToken.mockReturnValue({
            id: 'prof-123',
            role: 'professional'
        });
    });

    test('GET /api/patients - should return 401 without a token', async () => {
        authService.verifyToken.mockImplementation(() => { throw new Error('Invalid token'); });

        const response = await request(app)
            .get('/api/patients');
        
        expect(response.status).toBe(401);
    });

    test('GET /api/patients - should return patients with a valid token', async () => {
        const response = await request(app)
            .get('/api/patients')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(200);
        expect(patientsService.getAll).toHaveBeenCalledTimes(1);
    });

    test('POST /api/patients - should create a patient with a valid token', async () => {
        const response = await request(app)
            .post('/api/patients')
            .set('Authorization', `Bearer ${token}`)
            .send({
                name: 'Nuevo Paciente',
                dni: '12345678'
            });

        expect(response.status).toBe(201);
        expect(response.body.patient.name).toBe('Nuevo Paciente');
        expect(patientsService.create).toHaveBeenCalledTimes(1);
    });

    test('GET /api/patients/:id - should return 400 for an invalid ID format', async () => {
        const response = await request(app)
            .get('/api/patients/invalid-id-format')
            .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid ID format');
    });
  });
}); 