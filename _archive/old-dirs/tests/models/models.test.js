describe('Models Tests', () => {
    describe('User model', () => {
        test('should load user model', () => {
            expect(() => {
                const User = require('../../src/models/user');
                expect(User).toBeDefined();
            }).not.toThrow();
        });
    });

    describe('Message model', () => {
        test('should load message model', () => {
            expect(() => {
                const Message = require('../../src/models/message');
                expect(Message).toBeDefined();
            }).not.toThrow();
        });

        test('should create message instance', () => {
            const Message = require('../../src/models/message');
            const message = new Message({
                content: 'Test message',
                userId: 'user-123',
                type: 'text'
            });
            
            expect(message.content).toBe('Test message');
            expect(message.userId).toBe('user-123');
            expect(message.type).toBe('text');
        });
    });
}); 