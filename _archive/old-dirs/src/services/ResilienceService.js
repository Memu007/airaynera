const logger = require('../utils/logger');
const config = require('../config/environment');

class ResilienceService {
    constructor() {
        this.circuitBreaker = new Map();
        this.sessionBuffer = new Map();
        this.systemHealth = { ai: true, database: true, crisis: true };
        this.lastHealthCheck = new Date();
        
        this.startBasicMonitoring();
        this.startSessionRetry();
    }

    async executeWithFallback(service, operation, fallback) {
        const circuit = this.getCircuit(service);
        
        // Simple circuit breaker: open for 30 seconds after 3 failures
        if (circuit.isOpen && Date.now() - circuit.lastFailTime < 30000) {
            logger.warn(`Service ${service} temporarily unavailable`);
            return await fallback();
        }

        try {
            const result = await Promise.race([
                operation(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('timeout')), 8000)
                )
            ]);
            this.recordSuccess(service);
            return result;
        } catch (error) {
            logger.error(`Service ${service} failed:`, error);
            this.recordFailure(service);
            return await fallback();
        }
    }

    getCircuit(service) {
        if (!this.circuitBreaker.has(service)) {
            this.circuitBreaker.set(service, { 
                failures: 0, 
                isOpen: false, 
                lastFailTime: 0,
                lastSuccessTime: Date.now()
            });
        }
        return this.circuitBreaker.get(service);
    }

    recordFailure(service) {
        const circuit = this.getCircuit(service);
        circuit.failures++;
        circuit.lastFailTime = Date.now();
        
        if (circuit.failures >= 3) {
            circuit.isOpen = true;
            this.systemHealth[service] = false;
            
            logger.warn(`Circuit breaker opened for service: ${service}`);
            
            if (service === 'crisis') {
                logger.error('🚨 CRISIS SYSTEM FAILED - MANUAL EVALUATION REQUIRED');
                console.log('🚨 ALERT: Crisis detection offline - Evaluate all messages manually');
            }
        }
    }

    recordSuccess(service) {
        const circuit = this.getCircuit(service);
        circuit.failures = Math.max(0, circuit.failures - 1);
        circuit.lastSuccessTime = Date.now();
        
        if (circuit.failures === 0) {
            circuit.isOpen = false;
            this.systemHealth[service] = true;
            logger.info(`Service ${service} recovered`);
        }
    }

    // Simple session buffering for database failures
    bufferSession(sessionData) {
        const sessionId = require('crypto').randomUUID();
        this.sessionBuffer.set(sessionId, {
            ...sessionData,
            timestamp: Date.now(),
            retryCount: 0
        });
        
        logger.info(`Session buffered: ${sessionId}`);
        
        // Alert if too many buffered sessions
        if (this.sessionBuffer.size >= 20) {
            logger.warn(`🔔 ${this.sessionBuffer.size} sessions pending - Check database connection`);
        }
        
        return sessionId;
    }

    async retryBufferedSessions() {
        if (this.sessionBuffer.size === 0) return;

        const DatabaseService = require('./DatabaseService');
        
        for (const [sessionId, data] of this.sessionBuffer.entries()) {
            if (data.retryCount >= 3) {
                this.sessionBuffer.delete(sessionId);
                logger.error(`Session lost after 3 retries: ${sessionId}`);
                continue;
            }

            try {
                await DatabaseService.registerSession(data.professionalDni, data);
                this.sessionBuffer.delete(sessionId);
                logger.info(`Session synced: ${sessionId}`);
            } catch (error) {
                data.retryCount++;
                logger.warn(`Session retry ${data.retryCount} failed: ${sessionId}`);
            }
        }
    }

    startBasicMonitoring() {
        // Simple health check every 60 seconds
        setInterval(async () => {
            await this.updateSystemHealth();
            this.lastHealthCheck = new Date();
        }, 60000);
    }

    startSessionRetry() {
        // Retry buffered sessions every 30 seconds
        setInterval(async () => {
            await this.retryBufferedSessions();
        }, 30000);
    }

    async updateSystemHealth() {
        // Test database
        try {
            const { testConnection } = require('../config/database');
            const isHealthy = await testConnection();
            this.systemHealth.database = isHealthy;
        } catch (error) {
            this.systemHealth.database = false;
            logger.warn('Database health check failed:', error.message);
        }

        // Test AI (if configured)
        if (config.GEMINI.API_KEY) {
            try {
                const { GoogleGenerativeAI } = require('@google/generative-ai');
                const genAI = new GoogleGenerativeAI(config.GEMINI.API_KEY);
                const model = genAI.getGenerativeModel({ model: config.GEMINI.MODEL });
                await model.generateContent("test");
                this.systemHealth.ai = true;
            } catch (error) {
                this.systemHealth.ai = false;
                logger.warn('AI health check failed:', error.message);
            }
        }

        // Crisis detection always available (has fallback)
        this.systemHealth.crisis = true;
    }

    getHealthStatus() {
        const overall = Object.values(this.systemHealth).every(status => status);
        
        return {
            status: overall ? '🟢 Operativo' : '🟡 Degradado',
            services: this.systemHealth,
            buffered_sessions: this.sessionBuffer.size,
            last_health_check: this.lastHealthCheck,
            circuit_breakers: this.getCircuitBreakerStatus(),
            message: overall ? 
                'Sistema funcionando normalmente' : 
                'Algunos servicios limitados - modo seguro activo'
        };
    }

    getCircuitBreakerStatus() {
        const status = {};
        for (const [service, circuit] of this.circuitBreaker.entries()) {
            status[service] = {
                isOpen: circuit.isOpen,
                failures: circuit.failures,
                lastFailTime: circuit.lastFailTime,
                lastSuccessTime: circuit.lastSuccessTime
            };
        }
        return status;
    }

    // Simple conversation recovery
    detectIntent(message) {
        const lower = message.toLowerCase();
        if (lower.includes('paciente') && (lower.includes('registr') || lower.includes('nuevo'))) {
            return 'registro_paciente';
        }
        if (lower.includes('sesión') || lower.includes('sesion') || lower.includes('consulta')) {
            return 'nueva_sesion';
        }
        if (lower.includes('historial') || lower.includes('lista')) {
            return 'historial';
        }
        return 'menu_principal';
    }

    recoverConversation(message) {
        const intent = this.detectIntent(message);
        const messages = {
            'registro_paciente': '🔄 Continuando registro. Enviá: Nombre, DNI, Obra Social, Teléfono',
            'nueva_sesion': '🔄 Continuando sesión. ¿Podés repetir el contenido?',
            'historial': '🔄 Mostrando historial...',
            'menu_principal': '🔄 Reiniciado. ¿En qué te ayudo?'
        };
        
        return {
            response: messages[intent],
            newState: intent,
            recovered: true
        };
    }

    // Force circuit breaker reset (admin function)
    resetCircuitBreaker(service) {
        if (this.circuitBreaker.has(service)) {
            const circuit = this.circuitBreaker.get(service);
            circuit.failures = 0;
            circuit.isOpen = false;
            circuit.lastFailTime = 0;
            this.systemHealth[service] = true;
            
            logger.info(`Circuit breaker manually reset for service: ${service}`);
            return true;
        }
        return false;
    }

    // Get system metrics
    getMetrics() {
        return {
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            health: this.systemHealth,
            buffered_sessions: this.sessionBuffer.size,
            circuit_breakers: this.getCircuitBreakerStatus(),
            last_health_check: this.lastHealthCheck
        };
    }
}

module.exports = new ResilienceService(); 