const authMiddleware = require('../../src/middleware/auth');
const jwt = require('jsonwebtoken');

// Mock JWT
jest.mock('jsonwebtoken');
jest.mock('../../src/utils/logger');

describe('Auth Middleware', () => {
    let mockReq, mockRes, mockNext;

    beforeEach(() => {
        mockReq = {
            headers: {},
            cookies: {}
        };

        mockRes = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis()
        };

        mockNext = jest.fn();

        jest.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });

    describe('verifyToken', () => {
        test('should authenticate valid token from Authorization header', async () => {
            const validToken = 'valid-jwt-token';
            const decodedUser = { id: 'user-123', email: 'test@example.com', role: 'therapist' };

            mockReq.headers.authorization = `Bearer ${validToken}`;
            jwt.verify.mockReturnValue(decodedUser);

            authMiddleware.verifyToken(mockReq, mockRes, mockNext);

            expect(jwt.verify).toHaveBeenCalledWith(validToken, expect.any(String));
            expect(mockReq.user).toEqual(decodedUser);
            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should reject request without token', async () => {
            await authMiddleware.verifyToken(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'No token provided'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should reject invalid token', async () => {
            mockReq.headers.authorization = 'Bearer invalid-token';
            jwt.verify.mockImplementation(() => {
                throw new Error('Invalid token');
            });

            await authMiddleware.verifyToken(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid token'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should handle expired token', async () => {
            mockReq.headers.authorization = 'Bearer expired-token';
            jwt.verify.mockImplementation(() => {
                const error = new Error('Token expired');
                error.name = 'TokenExpiredError';
                throw error;
            });

            await authMiddleware.verifyToken(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(401);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Invalid token'
            });
        });
    });

    describe('isProfessional', () => {
        test('should allow access for professional role', async () => {
            mockReq.user = { id: 'user-123', role: 'professional' };

            await authMiddleware.isProfessional(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should deny access for non-professional role', async () => {
            mockReq.user = { id: 'user-123', role: 'user' };

            await authMiddleware.isProfessional(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access denied. Professional role required.'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });

        test('should deny access without user', async () => {
            await authMiddleware.isProfessional(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access denied. Professional role required.'
            });
        });
    });

    describe('isAdmin', () => {
        test('should allow access for admin role', async () => {
            mockReq.user = { id: 'user-123', role: 'admin' };

            await authMiddleware.isAdmin(mockReq, mockRes, mockNext);

            expect(mockNext).toHaveBeenCalled();
            expect(mockRes.status).not.toHaveBeenCalled();
        });

        test('should deny access for non-admin role', async () => {
            mockReq.user = { id: 'user-123', role: 'professional' };

            await authMiddleware.isAdmin(mockReq, mockRes, mockNext);

            expect(mockRes.status).toHaveBeenCalledWith(403);
            expect(mockRes.json).toHaveBeenCalledWith({
                error: 'Access denied. Admin role required.'
            });
            expect(mockNext).not.toHaveBeenCalled();
        });
    });
}); 