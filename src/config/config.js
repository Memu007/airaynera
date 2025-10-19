const Joi = require('joi');

// Configuration schema
const schema = Joi.object({
    // Server configuration
    NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
    PORT: Joi.number().default(9000),
    
    // Database configuration
    MONGODB_URI: Joi.string().default('mongodb://localhost:27017/aira-bot'),
    
    // WhatsApp configuration
    WHATSAPP_TOKEN: Joi.string().default('dummy_token'),
    WHATSAPP_PHONE_NUMBER_ID: Joi.string().default('dummy_id'),
    
    // OpenAI configuration
    OPENAI_API_KEY: Joi.string().default('dummy_key'),
    
    // Security configuration
    JWT_SECRET: Joi.string().default('your-secret-key-here'),
    JWT_EXPIRES_IN: Joi.string().default('24h'),
    
    // Crisis detection configuration
    CRISIS_THRESHOLD: Joi.number().min(0).max(1).default(0.7),
    
    // Logging configuration
    LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    
    // Rate limiting
    RATE_LIMIT_WINDOW: Joi.number().default(15 * 60 * 1000), // 15 minutes
    RATE_LIMIT_MAX: Joi.number().default(100)
});

// Load and validate configuration
const config = {
    env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT, 10) || 9000,
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/aira-bot'
    },
    whatsapp: {
        token: process.env.WHATSAPP_TOKEN || 'dummy_token',
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || 'dummy_id'
    },
    openai: {
        apiKey: process.env.OPENAI_API_KEY || 'dummy_key'
    },
    security: {
        jwtSecret: process.env.JWT_SECRET || 'your-secret-key-here',
        jwtExpiresIn: process.env.JWT_EXPIRES_IN || '24h'
    },
    crisis: {
        threshold: parseFloat(process.env.CRISIS_THRESHOLD) || 0.7
    },
    logging: {
        level: process.env.LOG_LEVEL || 'info'
    },
    rateLimit: {
        windowMs: parseInt(process.env.RATE_LIMIT_WINDOW, 10) || 15 * 60 * 1000,
        max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100
    }
};

// Validate configuration
const { error, value } = schema.validate(process.env, { allowUnknown: true });
if (error) {
    throw new Error(`Config validation error: ${error.message}`);
}

module.exports = config; 