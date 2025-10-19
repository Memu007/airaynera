#!/usr/bin/env node

const cron = require('node-cron');
const backupService = require('./backup-service');
const logger = require('../src/utils/logger');

class BackupScheduler {
    constructor() {
        this.jobs = new Map();
        this.isRunning = false;
        
        // Configuración de horarios (timezone: UTC)
        this.schedules = {
            daily: '0 2 * * *',      // 2:00 AM diario
            weekly: '0 3 * * 0',     // 3:00 AM domingos
            monthly: '0 4 1 * *',    // 4:00 AM primer día del mes
            yearly: '0 5 1 1 *',     // 5:00 AM 1 de enero
            cleanup: '0 6 * * *'     // 6:00 AM diario - limpieza
        };
    }

    /**
     * Iniciar el programador de backups
     */
    start() {
        try {
            if (this.isRunning) {
                logger.warn('Backup scheduler already running');
                return;
            }

            logger.audit('Starting backup scheduler', { schedules: this.schedules });

            // Programar backup diario
            this.jobs.set('daily', cron.schedule(this.schedules.daily, async () => {
                await this.executeBackup('daily');
            }, {
                scheduled: false,
                timezone: "UTC"
            }));

            // Programar backup semanal
            this.jobs.set('weekly', cron.schedule(this.schedules.weekly, async () => {
                await this.executeBackup('weekly');
            }, {
                scheduled: false,
                timezone: "UTC"
            }));

            // Programar backup mensual
            this.jobs.set('monthly', cron.schedule(this.schedules.monthly, async () => {
                await this.executeBackup('monthly');
            }, {
                scheduled: false,
                timezone: "UTC"
            }));

            // Programar backup anual
            this.jobs.set('yearly', cron.schedule(this.schedules.yearly, async () => {
                await this.executeBackup('yearly');
            }, {
                scheduled: false,
                timezone: "UTC"
            }));

            // Programar limpieza de backups expirados
            this.jobs.set('cleanup', cron.schedule(this.schedules.cleanup, async () => {
                await this.executeCleanup();
            }, {
                scheduled: false,
                timezone: "UTC"
            }));

            // Iniciar todos los jobs
            this.jobs.forEach((job, type) => {
                job.start();
                logger.audit('Backup job scheduled', { 
                    type, 
                    schedule: this.schedules[type] 
                });
            });

            this.isRunning = true;
            logger.audit('Backup scheduler started successfully');

            // Ejecutar health check inicial
            setTimeout(() => this.performHealthCheck(), 5000);

        } catch (error) {
            logger.error('Failed to start backup scheduler', { error: error.message });
            throw error;
        }
    }

    /**
     * Detener el programador de backups
     */
    stop() {
        try {
            logger.audit('Stopping backup scheduler');

            this.jobs.forEach((job, type) => {
                job.stop();
                logger.audit('Backup job stopped', { type });
            });

            this.jobs.clear();
            this.isRunning = false;

            logger.audit('Backup scheduler stopped successfully');

        } catch (error) {
            logger.error('Failed to stop backup scheduler', { error: error.message });
            throw error;
        }
    }

    /**
     * Ejecutar backup específico
     * @param {string} backupType - Tipo de backup
     */
    async executeBackup(backupType) {
        const startTime = Date.now();
        
        try {
            logger.audit('Starting scheduled backup', { 
                type: backupType,
                scheduledAt: new Date().toISOString()
            });

            // Verificar que el servicio esté saludable antes del backup
            const healthCheck = await backupService.healthCheck();
            if (healthCheck.status !== 'healthy') {
                throw new Error(`Backup service unhealthy: ${JSON.stringify(healthCheck)}`);
            }

            // Ejecutar backup
            const backupResult = await backupService.createFirestoreBackup(backupType);

            const duration = Date.now() - startTime;

            logger.audit('Scheduled backup completed', {
                type: backupType,
                backupId: backupResult.id,
                duration: `${duration}ms`,
                success: true
            });

            // Enviar notificación de éxito (si está configurado)
            await this.sendNotification('success', backupType, backupResult);

            return backupResult;

        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error('Scheduled backup failed', {
                type: backupType,
                duration: `${duration}ms`,
                error: error.message,
                success: false
            });

            // Enviar notificación de fallo
            await this.sendNotification('failure', backupType, { error: error.message });

            // Re-lanzar error para que sea capturado por monitoreo
            throw error;
        }
    }

    /**
     * Ejecutar limpieza de backups expirados
     */
    async executeCleanup() {
        const startTime = Date.now();

        try {
            logger.audit('Starting backup cleanup');

            const deletedCount = await backupService.cleanupExpiredBackups();

            const duration = Date.now() - startTime;

            logger.audit('Backup cleanup completed', {
                deletedCount,
                duration: `${duration}ms`,
                success: true
            });

            return { deletedCount, duration };

        } catch (error) {
            const duration = Date.now() - startTime;

            logger.error('Backup cleanup failed', {
                duration: `${duration}ms`,
                error: error.message,
                success: false
            });

            throw error;
        }
    }

    /**
     * Ejecutar backup manual
     * @param {string} backupType - Tipo de backup
     * @returns {Promise<Object>} - Resultado del backup
     */
    async executeManualBackup(backupType = 'manual') {
        try {
            logger.audit('Starting manual backup', { 
                type: backupType,
                requestedAt: new Date().toISOString()
            });

            const backupResult = await backupService.createFirestoreBackup(backupType);

            logger.audit('Manual backup completed', {
                type: backupType,
                backupId: backupResult.id
            });

            return backupResult;

        } catch (error) {
            logger.error('Manual backup failed', {
                type: backupType,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Enviar notificaciones
     * @param {string} status - success o failure
     * @param {string} backupType - Tipo de backup
     * @param {Object} data - Datos adicionales
     */
    async sendNotification(status, backupType, data) {
        try {
            const notification = {
                status,
                backupType,
                timestamp: new Date().toISOString(),
                data
            };

            // Log la notificación
            logger.audit('Backup notification', notification);

            // Aquí se pueden agregar integraciones con:
            // - Slack
            // - Email
            // - SMS
            // - Discord
            // - Microsoft Teams
            
            if (process.env.SLACK_WEBHOOK_URL && status === 'failure') {
                await this.sendSlackNotification(notification);
            }

            if (process.env.EMAIL_NOTIFICATIONS && ['failure', 'weekly', 'monthly'].includes(backupType)) {
                await this.sendEmailNotification(notification);
            }

        } catch (error) {
            logger.error('Failed to send backup notification', {
                status,
                backupType,
                error: error.message
            });
        }
    }

    /**
     * Enviar notificación a Slack
     * @param {Object} notification - Datos de notificación
     */
    async sendSlackNotification(notification) {
        try {
            const webhook = process.env.SLACK_WEBHOOK_URL;
            if (!webhook) return;

            const color = notification.status === 'success' ? 'good' : 'danger';
            const message = {
                attachments: [{
                    color,
                    title: `AIRA Backup ${notification.status.toUpperCase()}`,
                    fields: [
                        {
                            title: 'Type',
                            value: notification.backupType,
                            short: true
                        },
                        {
                            title: 'Time',
                            value: notification.timestamp,
                            short: true
                        }
                    ]
                }]
            };

            if (notification.status === 'failure') {
                message.attachments[0].fields.push({
                    title: 'Error',
                    value: notification.data.error || 'Unknown error',
                    short: false
                });
            }

            // Enviar a Slack (implementación básica)
            const fetch = require('node-fetch');
            await fetch(webhook, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(message)
            });

            logger.audit('Slack notification sent', { 
                status: notification.status,
                type: notification.backupType 
            });

        } catch (error) {
            logger.error('Failed to send Slack notification', { error: error.message });
        }
    }

    /**
     * Enviar notificación por email
     * @param {Object} notification - Datos de notificación
     */
    async sendEmailNotification(notification) {
        try {
            // Implementación básica - en producción usar SendGrid, SES, etc.
            logger.audit('Email notification would be sent', {
                to: process.env.ADMIN_EMAIL,
                subject: `AIRA Backup ${notification.status}`,
                type: notification.backupType
            });

        } catch (error) {
            logger.error('Failed to send email notification', { error: error.message });
        }
    }

    /**
     * Realizar health check del sistema de backups
     */
    async performHealthCheck() {
        try {
            const health = await backupService.healthCheck();
            const stats = await backupService.getBackupStats();

            const overallHealth = {
                scheduler: {
                    running: this.isRunning,
                    jobsCount: this.jobs.size,
                    schedules: this.schedules
                },
                service: health,
                stats,
                timestamp: new Date().toISOString()
            };

            logger.audit('Backup system health check', overallHealth);

            // Alertar si hay problemas
            if (health.status !== 'healthy') {
                await this.sendNotification('failure', 'healthcheck', {
                    error: 'Backup service unhealthy',
                    details: health
                });
            }

            return overallHealth;

        } catch (error) {
            logger.error('Backup health check failed', { error: error.message });
            
            await this.sendNotification('failure', 'healthcheck', {
                error: 'Health check failed',
                details: error.message
            });

            throw error;
        }
    }

    /**
     * Obtener estado del programador
     * @returns {Object} - Estado actual
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            jobsCount: this.jobs.size,
            schedules: this.schedules,
            jobs: Array.from(this.jobs.keys())
        };
    }

    /**
     * Actualizar horarios de backup
     * @param {Object} newSchedules - Nuevos horarios
     */
    updateSchedules(newSchedules) {
        try {
            logger.audit('Updating backup schedules', { 
                old: this.schedules,
                new: newSchedules 
            });

            // Detener jobs actuales
            this.stop();

            // Actualizar horarios
            this.schedules = { ...this.schedules, ...newSchedules };

            // Reiniciar con nuevos horarios
            this.start();

            logger.audit('Backup schedules updated successfully');

        } catch (error) {
            logger.error('Failed to update backup schedules', { error: error.message });
            throw error;
        }
    }
}

// Crear instancia singleton
const scheduler = new BackupScheduler();

// Manejo de señales del sistema
process.on('SIGTERM', () => {
    logger.audit('Received SIGTERM, stopping backup scheduler gracefully');
    scheduler.stop();
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.audit('Received SIGINT, stopping backup scheduler gracefully');
    scheduler.stop();
    process.exit(0);
});

// Si se ejecuta directamente, iniciar el scheduler
if (require.main === module) {
    scheduler.start();
    
    // Mantener el proceso vivo
    setInterval(() => {
        // Health check cada hora
        scheduler.performHealthCheck().catch(console.error);
    }, 60 * 60 * 1000);
}

module.exports = scheduler; 