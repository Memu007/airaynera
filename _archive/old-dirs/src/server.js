require('dotenv').config();
const app = require('./app');
const config = require('./config/config');
const logger = require('./utils/logger');

let port = config.port;
const server = app.listen(port, () => {
    logger.info(`Server running in ${config.env} mode on port ${port}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        port = Math.floor(Math.random() * (9999 - 3000) + 3000);
        logger.info(`Port ${config.port} is in use, trying port ${port}`);
        server.listen(port);
    } else {
        logger.error('Server error:', err);
    }
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

// Handle SIGTERM
process.on('SIGTERM', () => {
    logger.info('SIGTERM received. Shutting down gracefully');
    server.close(() => {
        logger.info('Process terminated');
    });
}); 