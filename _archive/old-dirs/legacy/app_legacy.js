const express = require('express');
const mongoose = require('mongoose');
const config = require('./config/config');
const logger = require('./utils/logger');
const auth = require('./middleware/auth');
const { errorHandler, notFoundHandler } = require('./middleware/error');

// Initialize Express app
const app = express();

// Connect to MongoDB
mongoose.connect(config.mongodb.uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => logger.info('Connected to MongoDB'))
.catch(err => logger.error('MongoDB connection error:', err));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(auth.cors);
app.use(auth.rateLimiter);
app.use(logger.requestLogger);

// Static assets (js, css, images) so demo.html can load nlp.bundle.js, etc.
const path = require('path');
app.use(express.static(path.resolve(__dirname, '..')));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/crisis', require('./routes/crisis'));

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve demo.html at root
app.get('/', (req, res) => {
    console.log('Recibida petición GET /');
    res.sendFile(path.resolve(__dirname, '../demo.html'), (err) => {
        if (err) {
            console.error('Error al servir demo.html:', err);
            res.status(500).send('Error interno al servir demo.html');
        }
    });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const server = app.listen(config.port, () => {
    logger.info(`Server running in ${config.env} mode on port ${config.port}`);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    server.close(() => process.exit(1));
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    server.close(() => process.exit(1));
});

module.exports = app; 