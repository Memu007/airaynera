const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');

// Middleware para verificar el token JWT y el rol del usuario
const verifyToken = (allowedRoles = []) => {
    return (req, res, next) => {
        try {
            const token = req.headers.authorization?.split(' ')[1];
            
            if (!token) {
                return res.status(401).json({ 
                    error: 'No token provided',
                    code: 'NO_TOKEN'
                });
            }

            const decoded = jwt.verify(token, config.security.jwtSecret);
            req.user = decoded;
            
            // Si se especifican roles, verificar que el usuario tenga uno de ellos
            if (allowedRoles.length > 0 && !allowedRoles.includes(req.user.role)) {
                logger.warn('Authorization failed', { 
                    userId: req.user.id, 
                    role: req.user.role, 
                    requiredRoles: allowedRoles 
                });
                return res.status(403).json({ 
                    error: 'Access denied. Insufficient permissions.',
                    code: 'INSUFFICIENT_PERMISSIONS'
                });
            }

            next();
        } catch (error) {
            logger.error('Token verification failed', { error: error.message });
            
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ 
                    error: 'Token expired',
                    code: 'TOKEN_EXPIRED'
                });
            }
            
            return res.status(401).json({ 
                error: 'Invalid token',
                code: 'INVALID_TOKEN'
            });
        }
    };
};

const isProfessional = verifyToken(['professional', 'admin']);
const isAdmin = verifyToken(['admin']);

const rateLimiter = require('express-rate-limit')({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    message: 'Too many requests from this IP, please try again later.'
});

const cors = require('cors')({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
});

module.exports = {
    verifyToken,
    isProfessional,
    isAdmin,
    rateLimiter,
    cors
}; 