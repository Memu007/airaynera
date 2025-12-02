const logger = require('../../src/utils/logger');
const fs = require('fs');
const path = require('path');

// Mock fs para tests
jest.mock('fs', () => ({
    writeFileSync: jest.fn(),
    readFileSync: jest.fn(),
    createWriteStream: jest.fn(() => ({
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
        once: jest.fn(),
        emit: jest.fn()
    })),
    stat: jest.fn((path, callback) => callback(null, { size: 1000 })),
    statSync: jest.fn(() => ({ size: 1000 })),
    promises: {
        mkdir: jest.fn(),
        writeFile: jest.fn(),
        readFile: jest.fn()
    }
}));

describe('Logger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Reset logger state
        logger.setLevel('info');
    });

    describe('Log levels', () => {
        test('should log error messages', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            logger.error('Test error message');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('ERROR'),
                expect.stringContaining('Test error message')
            );
            
            consoleSpy.mockRestore();
        });

        test('should log warn messages', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            logger.warn('Test warning message');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('WARN'),
                expect.stringContaining('Test warning message')
            );
            
            consoleSpy.mockRestore();
        });

        test('should log info messages', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.info('Test info message');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('INFO'),
                expect.stringContaining('Test info message')
            );
            
            consoleSpy.mockRestore();
        });

        test('should log debug messages when level allows', () => {
            const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
            
            logger.setLevel('debug');
            logger.debug('Test debug message');
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('DEBUG'),
                expect.stringContaining('Test debug message')
            );
            
            consoleSpy.mockRestore();
        });

        test('should not log debug messages when level is info', () => {
            const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
            
            logger.setLevel('info');
            logger.debug('Test debug message');
            
            expect(consoleSpy).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });
    });

    describe('Log formatting', () => {
        test('should include timestamp in log messages', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.info('Test message');
            
            const logCall = consoleSpy.mock.calls[0][0];
            expect(logCall).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
            
            consoleSpy.mockRestore();
        });

        test('should include environment in log messages', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'test';
            
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.info('Test message');
            
            const logCall = consoleSpy.mock.calls[0][0];
            expect(logCall).toContain('[aira-backend]');
            
            consoleSpy.mockRestore();
            process.env.NODE_ENV = originalEnv;
        });

        test('should format structured data as JSON', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.info('Test message', { user: 'test-user', action: 'login' });
            
            const logCall = consoleSpy.mock.calls[0];
            expect(logCall[1]).toContain('"user":"test-user"');
            expect(logCall[1]).toContain('"action":"login"');
            
            consoleSpy.mockRestore();
        });

        test('should handle error objects properly', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            const testError = new Error('Test error');
            testError.stack = 'Error: Test error\n    at test.js:1:1';
            
            logger.error('Error occurred', { error: testError });
            
            const logCall = consoleSpy.mock.calls[0];
            expect(logCall[1]).toContain('"message":"Test error"');
            expect(logCall[1]).toContain('"stack"');
            
            consoleSpy.mockRestore();
        });
    });

    describe('Audit logging', () => {
        test('should create audit log entries', () => {
            fs.existsSync.mockReturnValue(true);
            
            logger.audit('User login', { userId: 'user-123', ip: '127.0.0.1' });
            
            expect(fs.appendFileSync).toHaveBeenCalledWith(
                expect.stringContaining('audit.log'),
                expect.stringContaining('"event":"User login"')
            );
        });

        test('should create logs directory if it does not exist', () => {
            fs.existsSync.mockReturnValue(false);
            
            logger.audit('Test event', {});
            
            expect(fs.mkdirSync).toHaveBeenCalledWith(
                expect.stringContaining('logs'),
                expect.objectContaining({ recursive: true })
            );
        });

        test('should include all required audit fields', () => {
            fs.existsSync.mockReturnValue(true);
            
            logger.audit('User action', { userId: 'user-123' });
            
            const auditCall = fs.appendFileSync.mock.calls[0][1];
            const auditData = JSON.parse(auditCall);
            
            expect(auditData).toHaveProperty('timestamp');
            expect(auditData).toHaveProperty('event');
            expect(auditData).toHaveProperty('data');
            expect(auditData).toHaveProperty('environment');
            expect(auditData.event).toBe('User action');
            expect(auditData.data.userId).toBe('user-123');
        });

        test('should handle audit logging errors gracefully', () => {
            fs.appendFileSync.mockImplementation(() => {
                throw new Error('Disk full');
            });
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            expect(() => {
                logger.audit('Test event', {});
            }).not.toThrow();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to write audit log')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('Security logging', () => {
        test('should create security log entries', () => {
            fs.existsSync.mockReturnValue(true);
            
            logger.security('Failed login attempt', { 
                ip: '192.168.1.100', 
                userAgent: 'Mozilla/5.0',
                email: 'test@example.com'
            });
            
            expect(fs.appendFileSync).toHaveBeenCalledWith(
                expect.stringContaining('security.log'),
                expect.stringContaining('"event":"Failed login attempt"')
            );
        });

        test('should include security metadata', () => {
            fs.existsSync.mockReturnValue(true);
            
            logger.security('Suspicious activity', { userId: 'user-123' });
            
            const securityCall = fs.appendFileSync.mock.calls[0][1];
            const securityData = JSON.parse(securityCall);
            
            expect(securityData).toHaveProperty('timestamp');
            expect(securityData).toHaveProperty('severity');
            expect(securityData).toHaveProperty('event');
            expect(securityData).toHaveProperty('data');
            expect(securityData.severity).toBe('medium');
        });

        test('should support different severity levels', () => {
            fs.existsSync.mockReturnValue(true);
            
            logger.security('Critical security breach', { userId: 'user-123' }, 'high');
            
            const securityCall = fs.appendFileSync.mock.calls[0][1];
            const securityData = JSON.parse(securityCall);
            
            expect(securityData.severity).toBe('high');
        });
    });

    describe('Performance logging', () => {
        test('should log performance metrics', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.performance('Database query', 150, { 
                query: 'SELECT * FROM users',
                resultCount: 5 
            });
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('PERF'),
                expect.stringContaining('"duration":150')
            );
            
            consoleSpy.mockRestore();
        });

        test('should measure execution time automatically', async () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            const timer = logger.startTimer('Test operation');
            await new Promise(resolve => setTimeout(resolve, 100));
            timer.end();
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('PERF'),
                expect.stringContaining('"operation":"Test operation"')
            );
            
            const logCall = consoleSpy.mock.calls[0][1];
            const perfData = JSON.parse(logCall);
            expect(perfData.duration).toBeGreaterThan(90);
            
            consoleSpy.mockRestore();
        });

        test('should warn about slow operations', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            
            logger.performance('Slow operation', 5000); // 5 seconds
            
            expect(consoleSpy).toHaveBeenCalledWith(
                expect.stringContaining('WARN'),
                expect.stringContaining('Slow operation detected')
            );
            
            consoleSpy.mockRestore();
        });
    });

    describe('Context and correlation', () => {
        test('should support request correlation IDs', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.setCorrelationId('req-12345');
            logger.info('Processing request');
            
            const logCall = consoleSpy.mock.calls[0][1];
            expect(logCall).toContain('"correlationId":"req-12345"');
            
            consoleSpy.mockRestore();
        });

        test('should support user context', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.setUserContext({ id: 'user-123', role: 'therapist' });
            logger.info('User action');
            
            const logCall = consoleSpy.mock.calls[0][1];
            expect(logCall).toContain('"userId":"user-123"');
            expect(logCall).toContain('"userRole":"therapist"');
            
            consoleSpy.mockRestore();
        });

        test('should clear context when needed', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.setUserContext({ id: 'user-123' });
            logger.clearContext();
            logger.info('After clearing context');
            
            const logCall = consoleSpy.mock.calls[0][1];
            expect(logCall).not.toContain('"userId"');
            
            consoleSpy.mockRestore();
        });
    });

    describe('Log filtering and sanitization', () => {
        test('should filter sensitive information', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.info('User login', { 
                email: 'test@example.com',
                password: 'secret123',
                creditCard: '1234-5678-9012-3456'
            });
            
            const logCall = consoleSpy.mock.calls[0][1];
            expect(logCall).toContain('"email":"test@example.com"');
            expect(logCall).toContain('"password":"[FILTERED]"');
            expect(logCall).toContain('"creditCard":"[FILTERED]"');
            
            consoleSpy.mockRestore();
        });

        test('should handle nested sensitive data', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.info('User update', {
                user: {
                    email: 'test@example.com',
                    profile: {
                        ssn: '123-45-6789'
                    }
                }
            });
            
            const logCall = consoleSpy.mock.calls[0][1];
            expect(logCall).toContain('"ssn":"[FILTERED]"');
            
            consoleSpy.mockRestore();
        });

        test('should truncate very long log messages', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            const longMessage = 'x'.repeat(10000);
            logger.info(longMessage);
            
            const logCall = consoleSpy.mock.calls[0][0];
            expect(logCall.length).toBeLessThan(5000);
            expect(logCall).toContain('[TRUNCATED]');
            
            consoleSpy.mockRestore();
        });
    });

    describe('Log rotation and management', () => {
        test('should rotate log files when they get too large', () => {
            fs.readFileSync.mockReturnValue('x'.repeat(50 * 1024 * 1024)); // 50MB
            fs.existsSync.mockReturnValue(true);
            
            logger.audit('Test event', {});
            
            // Should attempt to rotate the file
            expect(fs.writeFileSync).toHaveBeenCalled();
        });

        test('should handle log rotation errors gracefully', () => {
            fs.readFileSync.mockImplementation(() => {
                throw new Error('File access error');
            });
            
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            expect(() => {
                logger.audit('Test event', {});
            }).not.toThrow();
            
            consoleSpy.mockRestore();
        });
    });

    describe('Environment-specific behavior', () => {
        test('should behave differently in production', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const consoleSpy = jest.spyOn(console, 'debug').mockImplementation();
            
            logger.setLevel('debug');
            logger.debug('Debug message');
            
            // In production, debug messages should not be logged even if level is set
            expect(consoleSpy).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
            process.env.NODE_ENV = originalEnv;
        });

        test('should use different log levels in test environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'test';
            
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            logger.info('Test message');
            
            // In test environment, should suppress most logs unless explicitly needed
            expect(consoleSpy).not.toHaveBeenCalled();
            
            consoleSpy.mockRestore();
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('Error handling and resilience', () => {
        test('should handle circular references in log data', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            const circularObj = { name: 'test' };
            circularObj.self = circularObj;
            
            expect(() => {
                logger.info('Circular reference test', circularObj);
            }).not.toThrow();
            
            expect(consoleSpy).toHaveBeenCalled();
            
            consoleSpy.mockRestore();
        });

        test('should handle undefined and null values', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            expect(() => {
                logger.info('Null test', null);
                logger.info('Undefined test', undefined);
                logger.info(null);
                logger.info(undefined);
            }).not.toThrow();
            
            consoleSpy.mockRestore();
        });

        test('should continue logging even if one log operation fails', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Mock file system error for audit logs
            fs.appendFileSync.mockImplementationOnce(() => {
                throw new Error('Disk full');
            });
            
            logger.audit('First event', {});
            logger.info('Second log'); // Should still work
            
            expect(consoleSpy).toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                expect.stringContaining('Failed to write audit log')
            );
            
            consoleSpy.mockRestore();
            consoleErrorSpy.mockRestore();
        });
    });

    describe('Performance and memory management', () => {
        test('should not leak memory with many log calls', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            // Simulate many log calls
            for (let i = 0; i < 1000; i++) {
                logger.info(`Log message ${i}`, { iteration: i });
            }
            
            expect(consoleSpy).toHaveBeenCalledTimes(1000);
            
            // Check that logger doesn't retain references to old log data
            expect(logger.getContextSize()).toBeLessThan(10); // Should only keep recent context
            
            consoleSpy.mockRestore();
        });

        test('should handle high-frequency logging efficiently', () => {
            const consoleSpy = jest.spyOn(console, 'info').mockImplementation();
            
            const start = Date.now();
            
            // Log 100 messages rapidly
            for (let i = 0; i < 100; i++) {
                logger.info(`Rapid log ${i}`);
            }
            
            const duration = Date.now() - start;
            expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
            
            consoleSpy.mockRestore();
        });
    });
}); 