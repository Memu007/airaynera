require('dotenv').config();

const config = {
    // Server Configuration
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // WhatsApp Business API
    WHATSAPP: {
        TOKEN: process.env.WHATSAPP_TOKEN,
        PHONE_ID: process.env.WHATSAPP_PHONE_ID,
        VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
        API_URL: 'https://graph.facebook.com/v18.0'
    },
    
    // Google Cloud / Firestore
    GOOGLE_CLOUD: {
        PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID,
        CREDENTIALS_PATH: process.env.GOOGLE_APPLICATION_CREDENTIALS
    },
    
    // Google Gemini AI
    GEMINI: {
        API_KEY: process.env.GEMINI_API_KEY,
        BACKUP_KEY: process.env.GEMINI_BACKUP_KEY,
        MODEL: 'gemini-1.5-flash'
    },
    
    // AI Provider (DeepSeek/OpenAI-compatible or Gemini)
    AI: {
        PROVIDER: (process.env.AI_PROVIDER || 'deepseek').toLowerCase(), // deepseek | gemini
        MODEL: process.env.AI_MODEL || 'deepseek-chat',
        OPENAI_COMPAT_BASE_URL: process.env.OPENAI_COMPAT_BASE_URL || 'https://api.deepseek.com/v1',
        OPENAI_COMPAT_API_KEY: process.env.OPENAI_COMPAT_API_KEY || process.env.DEEPSEEK_API_KEY || ''
    },
    
    // Security
    SECURITY: {
        JWT_SECRET: process.env.JWT_SECRET || 'aira_jwt_secret_2025',
        MASTER_KEY: process.env.MASTER_KEY,
        PIN_PEPPER: process.env.PIN_PEPPER || 'aira_medical_2025',
        LOG_SALT: process.env.LOG_SALT || 'log_salt_2025'
    },
    
    // Rate Limiting
    RATE_LIMIT: {
        WINDOW_MS: 15 * 60 * 1000, // 15 minutes
        MAX_REQUESTS: 100,
        MAX_FAILED_ATTEMPTS: 5
    },
    
    // Session Configuration
    SESSION: {
        TIMEOUT_MS: 30 * 60 * 1000, // 30 minutes
        CLEANUP_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes
    },
    
    // Crisis Detection
    CRISIS: {
        CONFIDENCE_THRESHOLD: 0.7,
        EMERGENCY_PHONE: '135', // Argentina suicide prevention
        LOG_ALL_DETECTIONS: true
    }
};

// Validation
const requiredEnvVars = [
    'WHATSAPP_TOKEN',
    'WHATSAPP_PHONE_ID', 
    'GOOGLE_CLOUD_PROJECT_ID',
    'GEMINI_API_KEY'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
if (missingVars.length > 0 && config.NODE_ENV === 'production') {
    console.error('❌ Missing required environment variables:', missingVars);
    process.exit(1);
}

module.exports = config; 