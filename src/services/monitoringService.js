const logger = require('../utils/logger');

class MonitoringService {
    constructor() {
        this.metrics = new Map();
        this.alerts = new Map();
        this.thresholds = {
            errorRate: 5, // 5% error rate
            responseTime: 5000, // 5 segundos
            memoryUsage: 80, // 80% memoria
            cpuUsage: 85, // 85% CPU
            diskUsage: 90, // 90% disco
            activeConnections: 1000, // 1000 conexiones activas
            queueSize: 100 // 100 items en cola
        };
        
        this.alertChannels = {
            slack: process.env.SLACK_WEBHOOK_URL,
            email: process.env.ADMIN_EMAIL,
            sms: process.env.SMS_ENDPOINT
        };

        // Inicializar métricas
        this.initializeMetrics();
        
        // Iniciar monitoreo automático
        this.startMonitoring();
    }

    /**
     * Inicializar métricas básicas
     */
    initializeMetrics() {
        this.metrics.set('requests_total', { value: 0, type: 'counter' });
        this.metrics.set('requests_errors', { value: 0, type: 'counter' });
        this.metrics.set('response_time_avg', { value: 0, type: 'gauge' });
        this.metrics.set('memory_usage', { value: 0, type: 'gauge' });
        this.metrics.set('cpu_usage', { value: 0, type: 'gauge' });
        this.metrics.set('active_connections', { value: 0, type: 'gauge' });
        this.metrics.set('encryption_operations', { value: 0, type: 'counter' });
        this.metrics.set('backup_operations', { value: 0, type: 'counter' });
        this.metrics.set('auth_attempts', { value: 0, type: 'counter' });
        this.metrics.set('auth_failures', { value: 0, type: 'counter' });
        this.metrics.set('sessions_created', { value: 0, type: 'counter' });
        this.metrics.set('patients_created', { value: 0, type: 'counter' });
        
        logger.audit('Monitoring metrics initialized', { 
            metricsCount: this.metrics.size,
            thresholds: this.thresholds
        });
    }

    /**
     * Incrementar contador
     * @param {string} metric - Nombre de la métrica
     * @param {number} value - Valor a incrementar (default: 1)
     */
    incrementCounter(metric, value = 1) {
        const current = this.metrics.get(metric);
        if (current && current.type === 'counter') {
            current.value += value;
            current.lastUpdated = new Date().toISOString();
            
            this.checkThresholds(metric, current.value);
        }
    }

    /**
     * Establecer valor de gauge
     * @param {string} metric - Nombre de la métrica
     * @param {number} value - Valor a establecer
     */
    setGauge(metric, value) {
        const current = this.metrics.get(metric);
        if (current && current.type === 'gauge') {
            current.value = value;
            current.lastUpdated = new Date().toISOString();
            
            this.checkThresholds(metric, value);
        }
    }

    /**
     * Obtener valor de métrica
     * @param {string} metric - Nombre de la métrica
     * @returns {Object} - Objeto con valor y metadata
     */
    getMetric(metric) {
        return this.metrics.get(metric);
    }

    /**
     * Obtener todas las métricas
     * @returns {Object} - Todas las métricas
     */
    getAllMetrics() {
        const result = {};
        for (const [key, value] of this.metrics.entries()) {
            result[key] = {
                value: value.value,
                type: value.type,
                lastUpdated: value.lastUpdated
            };
        }
        return result;
    }

    /**
     * Registrar tiempo de respuesta
     * @param {number} responseTime - Tiempo en milisegundos
     */
    recordResponseTime(responseTime) {
        this.incrementCounter('requests_total');
        
        // Calcular promedio móvil
        const current = this.getMetric('response_time_avg');
        const totalRequests = this.getMetric('requests_total').value;
        
        if (totalRequests === 1) {
            this.setGauge('response_time_avg', responseTime);
        } else {
            // Promedio móvil ponderado
            const newAvg = (current.value * 0.9) + (responseTime * 0.1);
            this.setGauge('response_time_avg', Math.round(newAvg));
        }
        
        // Check threshold
        if (responseTime > this.thresholds.responseTime) {
            this.triggerAlert('high_response_time', {
                value: responseTime,
                threshold: this.thresholds.responseTime,
                severity: responseTime > this.thresholds.responseTime * 2 ? 'critical' : 'warning'
            });
        }
    }

    /**
     * Registrar error
     * @param {Error} error - Error ocurrido
     * @param {Object} context - Contexto adicional
     */
    recordError(error, context = {}) {
        this.incrementCounter('requests_errors');
        
        const totalRequests = this.getMetric('requests_total').value;
        const totalErrors = this.getMetric('requests_errors').value;
        const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
        
        if (errorRate > this.thresholds.errorRate) {
            this.triggerAlert('high_error_rate', {
                errorRate: Math.round(errorRate * 100) / 100,
                threshold: this.thresholds.errorRate,
                error: error.message,
                context,
                severity: errorRate > this.thresholds.errorRate * 2 ? 'critical' : 'warning'
            });
        }

        logger.error('Error recorded in monitoring', {
            error: error.message,
            errorRate,
            context
        });
    }

    /**
     * Monitorear recursos del sistema
     */
    async monitorSystemResources() {
        try {
            // Memoria
            const memUsage = process.memoryUsage();
            const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
            this.setGauge('memory_usage', Math.round(memoryPercent));

            // CPU (aproximación usando uv metrics si están disponibles)
            if (process.cpuUsage) {
                const cpuUsage = process.cpuUsage();
                const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) / 10; // Aproximación
                this.setGauge('cpu_usage', Math.min(Math.round(cpuPercent), 100));
            }

            // Conexiones activas (mock - en producción usar el servidor real)
            const activeConnections = Math.floor(Math.random() * 50) + 10; // Simulado
            this.setGauge('active_connections', activeConnections);

            logger.audit('System resources monitored', {
                memoryPercent: Math.round(memoryPercent),
                memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
                activeConnections
            });

        } catch (error) {
            logger.error('Failed to monitor system resources', { error: error.message });
        }
    }

    /**
     * Verificar umbrales y disparar alertas
     * @param {string} metric - Nombre de la métrica
     * @param {number} value - Valor actual
     */
    checkThresholds(metric, value) {
        const thresholdKey = metric.replace(/_/g, '');
        const threshold = this.thresholds[thresholdKey];
        
        if (!threshold) return;

        let severity = 'info';
        let shouldAlert = false;

        switch (metric) {
            case 'memory_usage':
            case 'cpu_usage':
            case 'disk_usage':
                if (value > threshold) {
                    severity = value > threshold * 1.1 ? 'critical' : 'warning';
                    shouldAlert = true;
                }
                break;
            
            case 'active_connections':
            case 'queue_size':
                if (value > threshold) {
                    severity = value > threshold * 1.2 ? 'critical' : 'warning';
                    shouldAlert = true;
                }
                break;
        }

        if (shouldAlert) {
            this.triggerAlert(`threshold_exceeded_${metric}`, {
                metric,
                value,
                threshold,
                severity
            });
        }
    }

    /**
     * Disparar alerta
     * @param {string} alertType - Tipo de alerta
     * @param {Object} data - Datos de la alerta
     */
    async triggerAlert(alertType, data) {
        const alertId = `${alertType}_${Date.now()}`;
        const alert = {
            id: alertId,
            type: alertType,
            severity: data.severity || 'warning',
            timestamp: new Date().toISOString(),
            data,
            status: 'active'
        };

        this.alerts.set(alertId, alert);

        // Log de la alerta
        logger.audit('Alert triggered', alert);

        // Enviar notificaciones
        await this.sendAlertNotifications(alert);

        // Auto-resolver alertas de severidad baja después de un tiempo
        if (alert.severity === 'warning') {
            setTimeout(() => {
                this.resolveAlert(alertId);
            }, 5 * 60 * 1000); // 5 minutos
        }

        return alertId;
    }

    /**
     * Enviar notificaciones de alerta
     * @param {Object} alert - Objeto de alerta
     */
    async sendAlertNotifications(alert) {
        try {
            // Slack notification
            if (this.alertChannels.slack && alert.severity !== 'info') {
                await this.sendSlackAlert(alert);
            }

            // Email notification para alertas críticas
            if (this.alertChannels.email && alert.severity === 'critical') {
                await this.sendEmailAlert(alert);
            }

            // SMS para alertas críticas del sistema
            if (this.alertChannels.sms && 
                alert.severity === 'critical' && 
                alert.type.includes('system')) {
                await this.sendSMSAlert(alert);
            }

        } catch (error) {
            logger.error('Failed to send alert notifications', {
                alertId: alert.id,
                error: error.message
            });
        }
    }

    /**
     * Enviar alerta a Slack
     * @param {Object} alert - Objeto de alerta
     */
    async sendSlackAlert(alert) {
        try {
            if (!this.alertChannels.slack) return;

            const color = {
                'info': '#36a64f',
                'warning': '#ff9500',
                'critical': '#ff0000'
            }[alert.severity] || '#cccccc';

            const message = {
                attachments: [{
                    color,
                    title: `🚨 AIRA Alert: ${alert.type.toUpperCase()}`,
                    fields: [
                        {
                            title: 'Severity',
                            value: alert.severity.toUpperCase(),
                            short: true
                        },
                        {
                            title: 'Time',
                            value: alert.timestamp,
                            short: true
                        },
                        {
                            title: 'Details',
                            value: JSON.stringify(alert.data, null, 2),
                            short: false
                        }
                    ],
                    footer: 'AIRA Monitoring System',
                    ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
                }]
            };

            // Simular envío a Slack
            logger.audit('Slack alert would be sent', {
                alertId: alert.id,
                webhook: this.alertChannels.slack.substring(0, 50) + '...'
            });

        } catch (error) {
            logger.error('Failed to send Slack alert', {
                alertId: alert.id,
                error: error.message
            });
        }
    }

    /**
     * Enviar alerta por email
     * @param {Object} alert - Objeto de alerta
     */
    async sendEmailAlert(alert) {
        try {
            if (!this.alertChannels.email) return;

            const emailContent = {
                to: this.alertChannels.email,
                subject: `🚨 CRITICAL ALERT: ${alert.type}`,
                body: `
                    Alert Details:
                    - Type: ${alert.type}
                    - Severity: ${alert.severity}
                    - Time: ${alert.timestamp}
                    - Data: ${JSON.stringify(alert.data, null, 2)}
                    
                    Please check the system immediately.
                    
                    AIRA Monitoring System
                `
            };

            // Simular envío de email
            logger.audit('Email alert would be sent', {
                alertId: alert.id,
                to: this.alertChannels.email
            });

        } catch (error) {
            logger.error('Failed to send email alert', {
                alertId: alert.id,
                error: error.message
            });
        }
    }

    /**
     * Enviar alerta por SMS
     * @param {Object} alert - Objeto de alerta
     */
    async sendSMSAlert(alert) {
        try {
            if (!this.alertChannels.sms) return;

            const smsText = `AIRA CRITICAL: ${alert.type} at ${alert.timestamp}. Check system immediately.`;

            // Simular envío de SMS
            logger.audit('SMS alert would be sent', {
                alertId: alert.id,
                endpoint: this.alertChannels.sms
            });

        } catch (error) {
            logger.error('Failed to send SMS alert', {
                alertId: alert.id,
                error: error.message
            });
        }
    }

    /**
     * Resolver alerta
     * @param {string} alertId - ID de la alerta
     */
    resolveAlert(alertId) {
        const alert = this.alerts.get(alertId);
        if (alert && alert.status === 'active') {
            alert.status = 'resolved';
            alert.resolvedAt = new Date().toISOString();
            
            logger.audit('Alert resolved', {
                alertId,
                type: alert.type,
                duration: new Date(alert.resolvedAt) - new Date(alert.timestamp)
            });
        }
    }

    /**
     * Obtener alertas activas
     * @returns {Array} - Lista de alertas activas
     */
    getActiveAlerts() {
        const activeAlerts = [];
        for (const alert of this.alerts.values()) {
            if (alert.status === 'active') {
                activeAlerts.push(alert);
            }
        }
        return activeAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }

    /**
     * Obtener resumen de salud del sistema
     * @returns {Object} - Resumen de salud
     */
    getHealthSummary() {
        const metrics = this.getAllMetrics();
        const activeAlerts = this.getActiveAlerts();
        
        const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
        const warningAlerts = activeAlerts.filter(a => a.severity === 'warning').length;
        
        let overallStatus = 'healthy';
        if (criticalAlerts > 0) {
            overallStatus = 'critical';
        } else if (warningAlerts > 0) {
            overallStatus = 'warning';
        }

        return {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            metrics: {
                requests_total: metrics.requests_total?.value || 0,
                error_rate: metrics.requests_total?.value > 0 ? 
                    Math.round((metrics.requests_errors?.value || 0) / metrics.requests_total.value * 100 * 100) / 100 : 0,
                avg_response_time: metrics.response_time_avg?.value || 0,
                memory_usage: metrics.memory_usage?.value || 0,
                cpu_usage: metrics.cpu_usage?.value || 0,
                active_connections: metrics.active_connections?.value || 0
            },
            alerts: {
                total: activeAlerts.length,
                critical: criticalAlerts,
                warning: warningAlerts
            },
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0'
        };
    }

    /**
     * Iniciar monitoreo automático
     */
    startMonitoring() {
        // Monitorear recursos del sistema cada 30 segundos
        this.systemMonitorInterval = setInterval(() => {
            this.monitorSystemResources();
        }, 30000);

        // Limpiar alertas resueltas cada hora
        this.cleanupInterval = setInterval(() => {
            this.cleanupResolvedAlerts();
        }, 60 * 60 * 1000);

        logger.audit('Automatic monitoring started', {
            systemMonitorInterval: 30000,
            cleanupInterval: 3600000
        });
    }

    /**
     * Detener monitoreo automático
     */
    stopMonitoring() {
        if (this.systemMonitorInterval) {
            clearInterval(this.systemMonitorInterval);
        }
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        
        logger.audit('Automatic monitoring stopped');
    }

    /**
     * Limpiar alertas resueltas antiguas
     */
    cleanupResolvedAlerts() {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 horas
        let cleanedCount = 0;

        for (const [alertId, alert] of this.alerts.entries()) {
            if (alert.status === 'resolved' && 
                new Date(alert.resolvedAt) < cutoffTime) {
                this.alerts.delete(alertId);
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            logger.audit('Resolved alerts cleaned up', { cleanedCount });
        }
    }

    /**
     * Generar reporte de métricas
     * @param {Object} options - Opciones del reporte
     * @returns {Object} - Reporte de métricas
     */
    generateReport(options = {}) {
        const {
            period = '1h',
            includeAlerts = true,
            includeMetrics = true
        } = options;

        const report = {
            period,
            generatedAt: new Date().toISOString(),
            summary: this.getHealthSummary()
        };

        if (includeMetrics) {
            report.metrics = this.getAllMetrics();
        }

        if (includeAlerts) {
            report.alerts = {
                active: this.getActiveAlerts(),
                resolved: Array.from(this.alerts.values())
                    .filter(a => a.status === 'resolved')
                    .slice(-50) // Últimas 50 alertas resueltas
            };
        }

        logger.audit('Monitoring report generated', {
            period,
            metricsIncluded: includeMetrics,
            alertsIncluded: includeAlerts
        });

        return report;
    }

    /**
     * Health check del servicio de monitoreo
     * @returns {Object} - Estado del servicio
     */
    healthCheck() {
        return {
            status: 'healthy',
            metricsCount: this.metrics.size,
            activeAlertsCount: this.getActiveAlerts().length,
            monitoringActive: !!this.systemMonitorInterval,
            lastUpdate: new Date().toISOString()
        };
    }
}

// Singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService; 