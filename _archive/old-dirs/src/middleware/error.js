const logger = require('../utils/logger');

// Custom error class for API errors
class APIError extends Error {
    constructor(message, statusCode, isOperational = true) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Error.captureStackTrace(this, this.constructor);
    }
}

// Error handler middleware
const errorHandler = (err, req, res, next) => {
    // Log error
    logger.error('Error occurred', {
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method
    });

    // Handle operational errors
    if (err instanceof APIError) {
        return res.status(err.statusCode).json({
            error: err.message,
            status: 'error'
        });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.message,
            status: 'error'
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            error: 'Invalid token',
            status: 'error'
        });
    }

    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
        return res.status(409).json({
            error: 'Duplicate entry',
            status: 'error'
        });
    }

    // Handle unhandled errors
    return res.status(500).json({
        error: process.env.NODE_ENV === 'production' 
            ? 'Internal server error' 
            : err.message,
        status: 'error'
    });
};

// Not found handler
const notFoundHandler = (req, res, next) => {
    const error = new APIError(`Not found - ${req.originalUrl}`, 404);
    next(error);
};

// Async handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
    APIError,
    errorHandler,
    notFoundHandler,
    asyncHandler
}; 