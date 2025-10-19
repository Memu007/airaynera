const express = require('express');
const cors = require('cors');
const path = require('path');
const helmet = require('helmet');

// Import routes
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const patientsRoutes = require('./routes/patients');
// const sessionsRoutes = require('./routes/sessions');

// Import middleware functions properly
const { 
    sanitizeInputs, 
    preventNoSQLInjection, 
    detectAttacks,
    generalLimiter,
    helmetConfig
} = require('./middleware/security');

const app = express();

// Configure Express to trust proxy for rate limiting
app.set('trust proxy', 1);

// Basic security headers using helmet config from security middleware
app.use(helmet(helmetConfig));

// Rate limiting
app.use(generalLimiter);

// CORS configuration
app.use(cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Body parsing with proper charset handling
app.use(express.json({ 
    limit: '10mb',
    verify: (req, res, buf) => {
        // Ensure we can parse the body
        if (buf && buf.length) {
            req.rawBody = buf;
        }
    }
}));

app.use(express.urlencoded({ 
    extended: true, 
    limit: '10mb',
    verify: (req, res, buf) => {
        if (buf && buf.length) {
            req.rawBody = buf;
        }
    }
}));

// Add text parser for raw text content
app.use(express.text({ 
    limit: '10mb',
    type: 'text/*'
}));

// Security middleware
app.use(sanitizeInputs);
app.use(preventNoSQLInjection);
app.use(detectAttacks);

// Static files with proper caching
app.use(express.static(path.join(__dirname, '..'), {
    setHeaders: (res, path) => {
        // Set proper cache headers
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-cache');
        } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|svg)$/)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000');
        }
    }
}));

// Health check routes (no auth required)
app.use('/api', healthRoutes);

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientsRoutes);
// app.use('/api/sessions', sessionsRoutes);

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'demopagina.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Application error:', err);
    
    // Handle specific error types
    if (err.type === 'charset.unsupported') {
        return res.status(400).json({
            error: 'Unsupported character encoding',
            code: 'CHARSET_ERROR'
        });
    }
    
    // Security error
    if (err.type === 'security') {
        return res.status(403).json({
            error: 'Security violation detected',
            code: 'SECURITY_ERROR'
        });
    }

    // Validation error
    if (err.type === 'validation') {
        return res.status(400).json({
            error: err.message,
            code: 'VALIDATION_ERROR'
        });
    }

    // JSON parsing error
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({
            error: 'Invalid JSON format',
            code: 'JSON_PARSE_ERROR'
        });
    }

    // Default error
    res.status(500).json({
        error: 'Internal server error',
        code: 'INTERNAL_ERROR'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Route not found',
        code: 'NOT_FOUND'
    });
});

module.exports = app; 