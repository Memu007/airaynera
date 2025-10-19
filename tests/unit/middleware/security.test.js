const express = require('express');
const request = require('supertest');
const securityMiddleware = require('../../../src/middleware/security');

describe('Security Middleware', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    // Configurar variables de entorno para tests
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'test-secret';
  });

  describe('Security Headers', () => {
    test('should set security headers', async () => {
      app.use(securityMiddleware.securityHeaders);
      app.get('/test', (req, res) => res.json({ message: 'OK' }));
      
      const response = await request(app).get('/test');
      
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
    });
  });

  describe('Input Sanitization', () => {
    test('should sanitize malicious inputs', async () => {
      app.use(securityMiddleware.sanitizeInputs);
      app.post('/test', (req, res) => res.json({ data: req.body }));
      
      const maliciousInput = {
        name: '<script>alert("xss")</script>John',
        description: 'safe text'
      };
      
      const response = await request(app)
        .post('/test')
        .send(maliciousInput);
      
      expect(response.body.data.name).toBe('scriptalert("xss")/scriptJohn');
      expect(response.body.data.description).toBe('safe text');
    });
  });

  describe('Attack Detection', () => {
    test('should block SQL injection attempts', async () => {
      app.use(securityMiddleware.detectAttacks);
      app.post('/test', (req, res) => res.json({ message: 'OK' }));
      
      const response = await request(app)
        .post('/test')
        .send({ query: "SELECT * FROM users WHERE id = 1 OR 1=1" });
      
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
    });

    test('should block XSS attempts', async () => {
      app.use(securityMiddleware.detectAttacks);
      app.post('/test', (req, res) => res.json({ message: 'OK' }));
      
      const response = await request(app)
        .post('/test')
        .send({ input: "<script>alert('xss')</script>" });
      
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('SUSPICIOUS_REQUEST');
    });
  });

  describe('NoSQL Injection Prevention', () => {
    test('should block NoSQL operators', async () => {
      app.use(securityMiddleware.preventNoSQLInjection);
      app.post('/test', (req, res) => res.json({ message: 'OK' }));
      
      const response = await request(app)
        .post('/test')
        .send({ "$ne": null });
      
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('INVALID_REQUEST');
    });
  });

  describe('JWT Authentication', () => {
    test('should reject requests without token', async () => {
      app.use(securityMiddleware.authenticateToken);
      app.get('/protected', (req, res) => res.json({ message: 'OK' }));
      
      const response = await request(app).get('/protected');
      
      expect(response.status).toBe(401);
      expect(response.body.code).toBe('NO_TOKEN');
    });

    test('should reject invalid token', async () => {
      app.use(securityMiddleware.authenticateToken);
      app.get('/protected', (req, res) => res.json({ message: 'OK' }));
      
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token');
      
      expect(response.status).toBe(403);
      expect(response.body.code).toBe('INVALID_TOKEN');
    });
  });

  describe('Password Hashing', () => {
    test('should hash password correctly', async () => {
      const password = 'testPassword123';
      const hash = await securityMiddleware.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      expect(hash.length).toBeGreaterThan(50);
    });

    test('should verify password correctly', async () => {
      const password = 'testPassword123';
      const hash = await securityMiddleware.hashPassword(password);
      
      const isValid = await securityMiddleware.verifyPassword(password, hash);
      expect(isValid).toBe(true);
      
      const isInvalid = await securityMiddleware.verifyPassword('wrongPassword', hash);
      expect(isInvalid).toBe(false);
    });
  });

  describe('Token Generation', () => {
    test('should generate valid JWT token', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
        role: 'admin'
      };
      
      const tokens = securityMiddleware.generateToken(user);
      
      expect(tokens).toHaveProperty('token');
      expect(tokens).toHaveProperty('refreshToken');
      expect(typeof tokens.token).toBe('string');
      expect(typeof tokens.refreshToken).toBe('string');
    });
  });

  describe('Rate Limiting', () => {
    test('should apply rate limiting', async () => {
      // Crear nueva app sin rate limiting general para este test
      const rateApp = express();
      rateApp.use(express.json());
      
      // Configurar rate limiter con ventana muy corta para tests
      const rateLimit = require('express-rate-limit');
      const testLimiter = rateLimit({
        windowMs: 1000, // 1 segundo
        max: 2, // máximo 2 requests
        message: 'Rate limit exceeded',
        standardHeaders: true,
        legacyHeaders: false,
      });
      
      rateApp.use(testLimiter);
      rateApp.post('/login', (req, res) => res.json({ message: 'OK' }));
      
      // Hacer requests dentro del límite
      await request(rateApp).post('/login').send({ email: 'test@test.com' });
      await request(rateApp).post('/login').send({ email: 'test@test.com' });
      
      // Tercer request debería ser bloqueado
      const response = await request(rateApp)
        .post('/login')
        .send({ email: 'test@test.com' });
      
      expect(response.status).toBe(429);
    }, 10000);
  });
});
