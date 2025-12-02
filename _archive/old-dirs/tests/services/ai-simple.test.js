// Mock logger
jest.mock('../../src/utils/logger', () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
}));

const AIService = require('../../src/services/AIService');
const CrisisDetectionService = require('../../src/services/CrisisDetectionService');
const ResilienceService = require('../../src/services/ResilienceService');
const SecurityService = require('../../src/services/SecurityService');
const WhatsAppService = require('../../src/services/WhatsAppService');

describe('AI Services Simple Tests', () => {
    
    describe('AIService', () => {
        test('should be an object with methods', () => {
            expect(AIService).toBeDefined();
            expect(typeof AIService.generateResponse).toBe('function');
            expect(typeof AIService.analyzeMessage).toBe('function');
        });
    });

    describe('CrisisDetectionService', () => {
        test('should be an object with methods', () => {
            expect(CrisisDetectionService).toBeDefined();
            expect(typeof CrisisDetectionService.analyzeRisk).toBe('function');
            expect(typeof CrisisDetectionService.detectCrisis).toBe('function');
        });
    });

    describe('ResilienceService', () => {
        test('should be an object with methods', () => {
            expect(ResilienceService).toBeDefined();
            expect(typeof ResilienceService.getResilienceTips).toBe('function');
        });
    });

    describe('SecurityService', () => {
        test('should be an object with methods', () => {
            expect(SecurityService).toBeDefined();
            expect(typeof SecurityService.encrypt).toBe('function');
            expect(typeof SecurityService.decrypt).toBe('function');
        });
    });

    describe('WhatsAppService', () => {
        test('should be an object with methods', () => {
            // This might fail if its dependencies fail, but the service itself should load
            expect(WhatsAppService).toBeDefined();
            expect(typeof WhatsAppService.sendMessage).toBe('function');
        });
    });

}); 