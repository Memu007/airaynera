#!/usr/bin/env node

/**
 * 🏥 MONITOREO DE SALUD DEL SISTEMA MÉDICO
 * Script para verificar el estado del sistema en producción
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

// Configuración
const CONFIG = {
    endpoints: [
        'https://aira-medical-system.vercel.app/health',
        'https://aira-medical-system.vercel.app/api/patients',
        'https://aira-medical-system.vercel.app/api/sessions'
    ],
    checkInterval: 5 * 60 * 1000, // 5 minutos
    logFile: path.join(__dirname, '../logs/health-monitor.log'),
    alertThreshold: 3 // fallos consecutivos antes de alertar
};

class HealthMonitor {
    constructor() {
        this.failureCount = 0;
        this.lastCheck = null;
        this.ensureLogDirectory();
    }

    ensureLogDirectory() {
        const logDir = path.dirname(CONFIG.logFile);
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }
    }

    log(message, type = 'INFO') {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${type}: ${message}\n`;
        
        console.log(logEntry.trim());
        
        fs.appendFileSync(CONFIG.logFile, logEntry);
    }

    async checkEndpoint(url) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const req = https.get(url, (res) => {
                const responseTime = Date.now() - startTime;
                
                if (res.statusCode === 200) {
                    resolve({
                        status: 'OK',
                        responseTime,
                        statusCode: res.statusCode
                    });
                } else {
                    resolve({
                        status: 'ERROR',
                        responseTime,
                        statusCode: res.statusCode,
                        error: `HTTP ${res.statusCode}`
                    });
                }
            });

            req.on('error', (error) => {
                resolve({
                    status: 'ERROR',
                    responseTime: Date.now() - startTime,
                    error: error.message
                });
            });

            req.setTimeout(10000, () => {
                req.destroy();
                resolve({
                    status: 'TIMEOUT',
                    responseTime: 10000,
                    error: 'Request timeout'
                });
            });
        });
    }

    async checkAllEndpoints() {
        this.log('Iniciando verificación de salud del sistema...');
        
        const results = [];
        
        for (const endpoint of CONFIG.endpoints) {
            const result = await this.checkEndpoint(endpoint);
            results.push({ endpoint, ...result });
            
            this.log(`Endpoint ${endpoint}: ${result.status} (${result.responseTime}ms)`);
        }

        const failedChecks = results.filter(r => r.status !== 'OK');
        
        if (failedChecks.length > 0) {
            this.failureCount++;
            this.log(`⚠️ ${failedChecks.length} endpoints fallando. Fallo #${this.failureCount}`, 'WARN');
            
            if (this.failureCount >= CONFIG.alertThreshold) {
                this.sendAlert(failedChecks);
            }
        } else {
            this.failureCount = 0;
            this.log('✅ Todos los endpoints funcionando correctamente');
        }

        return results;
    }

    sendAlert(failedChecks) {
        const alertMessage = `
🚨 ALERTA DE SALUD DEL SISTEMA MÉDICO

Fecha: ${new Date().toISOString()}
Fallos consecutivos: ${this.failureCount}

Endpoints fallando:
${failedChecks.map(c => `- ${c.endpoint}: ${c.error}`).join('\n')}

Acción requerida: Verificar sistema inmediatamente
        `;

        this.log(alertMessage, 'ALERT');
        
        // Aquí podrías integrar con servicios de notificación
        // como Slack, email, SMS, etc.
        console.error(alertMessage);
    }

    async start() {
        this.log('🚀 Iniciando monitoreo de salud del sistema médico...');
        
        // Verificación inicial
        await this.checkAllEndpoints();
        
        // Monitoreo continuo
        setInterval(async () => {
            await this.checkAllEndpoints();
        }, CONFIG.checkInterval);
    }

    async stop() {
        this.log('⏹️ Monitoreo detenido');
        process.exit(0);
    }
}

// Manejo de señales
process.on('SIGINT', () => {
    console.log('\n🛑 Deteniendo monitoreo...');
    process.exit(0);
});

// Ejecutar si se llama directamente
if (require.main === module) {
    const monitor = new HealthMonitor();
    monitor.start();
}

module.exports = HealthMonitor;
