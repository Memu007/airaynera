// Mock fs antes de importar logger
jest.mock('fs', () => ({
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(() => '{}'),
    stat: jest.fn((path, callback) => callback(null, { size: 1000 })),
    statSync: jest.fn(() => ({ size: 1000 })),
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    createWriteStream: jest.fn(() => ({
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn().mockImplementation((event, cb) => {
            if (event === 'finish') {
                cb();
            }
            return this;
        }),
    })),
    promises: {
        mkdir: jest.fn().mockResolvedValue(),
        writeFile: jest.fn().mockResolvedValue(),
        readFile: jest.fn().mockResolvedValue('{}')
    }
}));

const logger = require('../../src/utils/logger');

describe('Logger Simple Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Basic logging', () => {
        test('should log info messages', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            
            logger.info('Test info message');
            
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        test('should log error messages', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            logger.error('Test error message');
            
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });

        test('should log warn messages', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            logger.warn('Test warning message');
            
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('Audit logging', () => {
        test('should handle audit logs', () => {
            expect(() => {
                logger.audit('User action', { userId: 'test-123' });
            }).not.toThrow();
        });
    });

    describe('Log levels', () => {
        test('should set log level', () => {
            expect(() => {
                logger.setLevel('debug');
            }).not.toThrow();
        });

        test('should get log level', () => {
            const level = logger.getLevel();
            expect(typeof level).toBe('string');
        });
    });
}); 