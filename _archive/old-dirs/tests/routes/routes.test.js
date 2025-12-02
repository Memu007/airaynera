// Mock dependencies first
jest.mock('../../src/controllers/authController', () => ({
    login: jest.fn((req, res) => res.json({ success: true })),
    register: jest.fn((req, res) => res.json({ success: true })),
    logout: jest.fn((req, res) => res.json({ success: true })),
    getProfile: jest.fn((req, res) => res.json({ success: true }))
}));

jest.mock('../../src/controllers/patientsController', () => ({
    getAll: jest.fn((req, res) => res.json({ success: true })),
    create: jest.fn((req, res) => res.json({ success: true })),
    getById: jest.fn((req, res) => res.json({ success: true }))
}));

const express = require('express');

describe('Routes Tests', () => {
    let app;

    beforeEach(() => {
        app = express();
        app.use(express.json());
    });

    describe('Auth routes', () => {
        test('should load auth routes', () => {
            expect(() => {
                const authRoutes = require('../../src/routes/auth');
                expect(authRoutes).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('Health routes', () => {
        test('should load health routes', () => {
            expect(() => {
                const healthRoutes = require('../../src/routes/health');
                expect(healthRoutes).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('Patients routes', () => {
        test('should load patients routes', () => {
            expect(() => {
                const patientsRoutes = require('../../src/routes/patients');
                expect(patientsRoutes).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('Sessions routes', () => {
        test('should load sessions routes', () => {
            expect(() => {
                const sessionsRoutes = require('../../src/routes/sessions');
                expect(sessionsRoutes).toBeDefined();
            }).not.toThrow();
        });
    });
}); 