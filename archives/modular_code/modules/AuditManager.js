/**
 * AIRA Medical System - Audit Manager Module
 * Auditoría HIPAA en frontend para profesionales de la salud
 * Compliance completo con regulaciones médicas
 */

class AuditManager {
    constructor(app) {
        this.app = app;
        this.auditLog = [];
        this.batchSize = 50;
        this.batchTimeout = null;
        this.maxLogSize = 1000;

        // Configuración específica para auditoría médica
        this.config = {
            autoFlush: true,
            flushInterval: 30000, // 30 segundos
            enableConsoleLogging: true,
            enableRemoteLogging: true,
            maxBatchSize: 50,
            logLevel: 'INFO',
            encryptPHI: true,
            retainDays: 90 // Días de retención de logs
        };

        // Tipos de eventos HIPAA
        this.HIPAA_EVENT_TYPES = {
            AUTHENTICATION: 'AUTHENTICATION',
            DATA_ACCESS: 'DATA_ACCESS',
            DATA_MODIFICATION: 'DATA_MODIFICATION',
            DATA_EXPORT: 'DATA_EXPORT',
            DATA_DELETE: 'DATA_DELETE',
            SECURITY_VIOLATION: 'SECURITY_VIOLATION',
            SYSTEM_ERROR: 'SYSTEM_ERROR',
            SESSION_START: 'SESSION_START',
            SESSION_END: 'SESSION_END',
            PATIENT_ACCESS: 'PATIENT_ACCESS',
            RECORDING_START: 'RECORDING_START',
            RECORDING_STOP: 'RECORDING_STOP',
            LOGIN: 'LOGIN',
            LOGOUT: 'LOGOUT',
            PAGE_VIEW: 'PAGE_VIEW',
            NOTIFICATION: 'NOTIFICATION'
        };

        // Niveles de severidad
        this.SEVERITY_LEVELS = {
            LOW: 'LOW',
            MEDIUM: 'MEDIUM',
            HIGH: 'HIGH',
            CRITICAL: 'CRITICAL'
        };

        this.init();
    }

    /**
     * Inicializar Audit Manager
     */
    init() {
        console.log('📋 Inicializando Audit Manager para compliance HIPAA');

        // Cargar logs existentes desde localStorage
        this.loadStoredLogs();

        // Configurar auto-flush
        this.setupAutoFlush();

        // Configurar listeners de eventos de auditoría
        this.setupAuditListeners();

        // Configurar manejo de descarga de página
        this.setupPageUnloadHandling();

        // Limpiar logs antiguos
        this.cleanupOldLogs();

        console.log('✅ Audit Manager inicializado');
    }

    /**
     * Cargar logs almacenados en localStorage
     */
    loadStoredLogs() {
        try {
            const storedLogs = localStorage.getItem('aira_audit_logs');
            if (storedLogs) {
                this.auditLog = JSON.parse(storedLogs);
                console.log(`📋 Cargados ${this.auditLog.length} logs de auditoría`);
            }
        } catch (error) {
            console.error('❌ Error cargando logs almacenados:', error);
            this.auditLog = [];
        }
    }

    /**
     * Configurar auto-flush de logs
     */
    setupAutoFlush() {
        if (this.config.autoFlush) {
            setInterval(() => {
                this.flushLogs();
            }, this.config.flushInterval);
        }
    }

    /**
     * Configurar listeners de eventos de auditoría
     */
    setupAuditListeners() {
        // Eventos de autenticación
        document.addEventListener('login', (e) => {
            this.logLogin(this.app.currentUser);
        });

        document.addEventListener('logout', (e) => {
            this.logLogout(this.app.currentUser);
        });

        // Eventos de sesión
        document.addEventListener('sessionStarted', (e) => {
            this.logSessionStart(this.app.currentUser, e.detail);
        });

        document.addEventListener('sessionEnded', (e) => {
            this.logSessionEnd(this.app.currentUser, e.detail);
        });

        // Eventos de acceso a pacientes
        document.addEventListener('patientSelected', (e) => {
            this.logPatientAccess(this.app.currentUser, e.detail);
        });

        document.addEventListener('patientDataAccess', (e) => {
            this.logPatientDataAccess(this.app.currentUser, e.detail.action, e.detail.count);
        });

        // Eventos de grabación
        document.addEventListener('recordingStarted', (e) => {
            this.logRecordingStart(this.app.currentUser, e.detail.sessionId);
        });

        document.addEventListener('recordingStopped', (e) => {
            this.logRecordingStop(this.app.currentUser, e.detail.sessionId, e.detail.duration);
        });

        // Eventos de seguridad
        document.addEventListener('securityEvent', (e) => {
            this.logSecurityEvent(this.app.currentUser, e.detail.type, e.detail.message);
        });

        // Eventos de errores del sistema
        window.addEventListener('error', (e) => {
            this.logSystemError({
                message: e.error?.message || e.message,
                filename: e.filename,
                lineno: e.lineno,
                colno: e.colno,
                stack: e.error?.stack
            });
        });

        // Eventos de navegación
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.logPageView(this.app.currentUser, 'PAGE_HIDDEN');
            } else {
                this.logPageView(this.app.currentUser, 'PAGE_VISIBLE');
            }
        });

        // Eventos de notificaciones
        document.addEventListener('notificationShown', (e) => {
            this.logNotification(e.detail);
        });
    }

    /**
     * Configurar manejo de descarga de página
     */
    setupPageUnloadHandling() {
        window.addEventListener('beforeunload', () => {
            // Guardar logs en localStorage antes de salir
            this.saveLogsToStorage();

            // Hacer flush final de logs pendientes
            if (this.auditLog.length > 0) {
                this.flushLogs(false); // Síncrono
            }
        });
    }

    /**
     * Crear entrada de auditoría
     */
    createAuditLogEntry(eventType, details, severity = 'MEDIUM') {
        const entry = {
            id: this.generateLogId(),
            timestamp: new Date().toISOString(),
            eventType,
            severity,
            userId: this.app.currentUser?.id || 'anonymous',
            userRole: this.app.currentUser?.role || 'unknown',
            sessionId: this.getSessionId(),
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            details: this.config.encryptPHI ? this.encryptPHI(details) : details
        };

        return entry;
    }

    /**
     * Escribir entrada de log
     */
    writeLogEntry(entry) {
        // Agregar al array de logs
        this.auditLog.push(entry);

        // Logging a consola si está habilitado
        if (this.config.enableConsoleLogging) {
            this.logToConsole(entry);
        }

        // Mantener tamaño máximo del log
        if (this.auditLog.length > this.maxLogSize) {
            this.auditLog = this.auditLog.slice(-this.maxLogSize);
        }

        // Programar flush si es necesario
        if (this.config.autoFlush && this.auditLog.length >= this.batchSize) {
            this.scheduleFlush();
        }
    }

    /**
     * Logging a consola con formato
     */
    logToConsole(entry) {
        const logMethod = this.getConsoleMethod(entry.severity);
        const prefix = `[AUDIT][${entry.eventType}][${entry.severity}]`;

        logMethod(prefix, {
            timestamp: entry.timestamp,
            userId: entry.userId,
            userRole: entry.userRole,
            details: entry.details
        });
    }

    /**
     * Obtener método de consola según severidad
     */
    getConsoleMethod(severity) {
        switch (severity) {
            case 'CRITICAL':
            case 'HIGH':
                return console.error;
            case 'MEDIUM':
                return console.warn;
            case 'LOW':
            default:
                return console.log;
        }
    }

    /**
     * Programar flush de logs
     */
    scheduleFlush() {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.flushLogs();
        }, 1000); // 1 segundo para acumular más eventos
    }

    /**
     * Enviar logs al servidor
     */
    async flushLogs(async = true) {
        if (!this.config.enableRemoteLogging || this.auditLog.length === 0) {
            return;
        }

        const logsToSend = this.auditLog.slice();

        try {
            const response = await fetch(`${this.app.config.apiBaseUrl}/audit/logs`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    logs: logsToSend,
                    clientInfo: {
                        userAgent: navigator.userAgent,
                        timestamp: new Date().toISOString(),
                        sessionId: this.getSessionId()
                    }
                })
            });

            if (response.ok) {
                // Remover logs enviados del array local
                this.auditLog = this.auditLog.filter(log =>
                    !logsToSend.find(sentLog => sentLog.id === log.id)
                );

                console.log(`✅ Audit logs flushed: ${logsToSend.length} entries`);
            } else {
                console.warn(`⚠️ Error flushing audit logs: ${response.status}`);
            }
        } catch (error) {
            console.error('❌ Error flushing audit logs:', error);

            // Si falla el envío, guardar en localStorage para reintentar después
            this.saveLogsToStorage();
        }

        // Guardar logs restantes en localStorage
        this.saveLogsToStorage();
    }

    /**
     * Guardar logs en localStorage
     */
    saveLogsToStorage() {
        try {
            localStorage.setItem('aira_audit_logs', JSON.stringify(this.auditLog));
        } catch (error) {
            console.error('❌ Error guardando logs en localStorage:', error);

            // Si localStorage está lleno, limpiar logs antiguos
            if (error.name === 'QuotaExceededError') {
                this.auditLog = this.auditLog.slice(-100); // Mantener solo últimos 100
                localStorage.setItem('aira_audit_logs', JSON.stringify(this.auditLog));
            }
        }
    }

    /**
     * Limpiar logs antiguos
     */
    cleanupOldLogs() {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - this.config.retainDays);

        const originalLength = this.auditLog.length;
        this.auditLog = this.auditLog.filter(log =>
            new Date(log.timestamp) > cutoffDate
        );

        if (this.auditLog.length < originalLength) {
            console.log(`🧹 Cleanup: Removed ${originalLength - this.auditLog.length} old audit logs`);
            this.saveLogsToStorage();
        }
    }

    /**
     * Métodos específicos de auditoría médica
     */

    /**
     * Log de acceso a paciente
     */
    async logPatientAccess(user, patientData) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.PATIENT_ACCESS,
            {
                action: 'PATIENT_VIEW',
                patientId: this.maskPHI(patientData.id),
                patientName: this.maskPHI(patientData.name),
                accessType: 'VIEW',
                timestamp: new Date().toISOString()
            },
            'MEDIUM'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de acceso a datos de paciente
     */
    async logPatientDataAccess(user, action, count = 1) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.DATA_ACCESS,
            {
                action,
                recordCount: count,
                dataType: 'PATIENT_DATA',
                timestamp: new Date().toISOString()
            },
            'MEDIUM'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de inicio de sesión
     */
    async logLogin(user) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.LOGIN,
            {
                loginMethod: 'FORM',
                success: true,
                timestamp: new Date().toISOString()
            },
            'MEDIUM'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de cierre de sesión
     */
    async logLogout(user) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.LOGOUT,
            {
                logoutMethod: 'FORM',
                sessionDuration: this.getSessionDuration(),
                timestamp: new Date().toISOString()
            },
            'MEDIUM'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de inicio de sesión clínica
     */
    async logSessionStart(user, sessionData) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.SESSION_START,
            {
                sessionId: sessionData.id,
                patientId: this.maskPHI(sessionData.patientId),
                patientName: this.maskPHI(sessionData.patientName),
                sessionType: sessionData.type,
                timestamp: new Date().toISOString()
            },
            'HIGH'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de fin de sesión clínica
     */
    async logSessionEnd(user, sessionData) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.SESSION_END,
            {
                sessionId: sessionData.id,
                patientId: this.maskPHI(sessionData.patientId),
                patientName: this.maskPHI(sessionData.patientName),
                sessionDuration: sessionData.duration,
                completed: sessionData.completed,
                timestamp: new Date().toISOString()
            },
            'HIGH'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de inicio de grabación
     */
    async logRecordingStart(user, sessionId) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.RECORDING_START,
            {
                sessionId,
                recordingFormat: 'WEBM',
                timestamp: new Date().toISOString()
            },
            'HIGH'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de fin de grabación
     */
    async logRecordingStop(user, sessionId, duration) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.RECORDING_STOP,
            {
                sessionId,
                duration,
                recordingSize: 'ENCRYPTED', // No exponer tamaño real
                timestamp: new Date().toISOString()
            },
            'HIGH'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de eventos de seguridad
     */
    async logSecurityEvent(user, eventType, message) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.SECURITY_VIOLATION,
            {
                securityEventType: eventType,
                message,
                severity: this.getSecuritySeverity(eventType),
                timestamp: new Date().toISOString()
            },
            'CRITICAL'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de errores del sistema
     */
    async logSystemError(errorDetails) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.SYSTEM_ERROR,
            {
                errorMessage: errorDetails.message,
                filename: errorDetails.filename,
                lineNumber: errorDetails.lineno,
                stackTrace: errorDetails.stack ? errorDetails.stack.substring(0, 1000) : null,
                timestamp: new Date().toISOString()
            },
            'HIGH'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de vista de página
     */
    async logPageView(user, action) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.PAGE_VIEW,
            {
                action,
                page: window.location.pathname,
                timestamp: new Date().toISOString()
            },
            'LOW'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Log de notificaciones
     */
    async logNotification(notificationData) {
        const entry = this.createAuditLogEntry(
            this.HIPAA_EVENT_TYPES.NOTIFICATION,
            {
                type: notificationData.type,
                title: notificationData.title,
                priority: notificationData.priority,
                timestamp: new Date().toISOString()
            },
            'LOW'
        );

        this.writeLogEntry(entry);
    }

    /**
     * Métodos utilitarios
     */

    /**
     * Generar ID único para log
     */
    generateLogId() {
        return `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Obtener ID de sesión actual
     */
    getSessionId() {
        return sessionStorage.getItem('session_id') || this.generateSessionId();
    }

    /**
     * Generar ID de sesión
     */
    generateSessionId() {
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        sessionStorage.setItem('session_id', sessionId);
        return sessionId;
    }

    /**
     * Obtener IP del cliente
     */
    getClientIP() {
        // En producción, esto debería obtenerse del servidor
        // Por ahora, retornamos un placeholder
        return 'CLIENT_IP';
    }

    /**
     * Obtener duración de sesión
     */
    getSessionDuration() {
        const sessionStart = sessionStorage.getItem('session_start');
        if (!sessionStart) return 0;

        return Date.now() - parseInt(sessionStart);
    }

    /**
     * Encriptar información PHI
     */
    encryptPHI(data) {
        if (!this.config.encryptPHI) return data;

        // En producción, usar encriptación real
        // Por ahora, simulamos encriptación
        return {
            encrypted: true,
            data: btoa(JSON.stringify(data))
        };
    }

    /**
     * Enmascarar datos PHI para logs
     */
    maskPHI(data) {
        if (!data) return data;

        // Enmascarar nombres, IDs, etc.
        if (typeof data === 'string') {
            if (data.length <= 4) return '****';
            return data.substring(0, 2) + '*'.repeat(data.length - 4) + data.substring(data.length - 2);
        }

        return 'MASKED_PHI';
    }

    /**
     * Obtener severidad de evento de seguridad
     */
    getSecuritySeverity(eventType) {
        const severityMap = {
            'LOGIN_FAILED': 'HIGH',
            'UNAUTHORIZED_ACCESS': 'CRITICAL',
            'DATA_BREACH': 'CRITICAL',
            'SUSPICIOUS_ACTIVITY': 'HIGH',
            'SESSION_HIJACK': 'CRITICAL',
            'MULTIPLE_FAILED_ATTEMPTS': 'MEDIUM'
        };

        return severityMap[eventType] || 'MEDIUM';
    }

    /**
     * Métodos públicos para consulta de logs
     */

    /**
     * Obtener logs filtrados
     */
    getFilteredLogs(filters = {}) {
        let filteredLogs = [...this.auditLog];

        if (filters.eventType) {
            filteredLogs = filteredLogs.filter(log => log.eventType === filters.eventType);
        }

        if (filters.userId) {
            filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
        }

        if (filters.severity) {
            filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
        }

        if (filters.startDate) {
            const startDate = new Date(filters.startDate);
            filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) >= startDate);
        }

        if (filters.endDate) {
            const endDate = new Date(filters.endDate);
            filteredLogs = filteredLogs.filter(log => new Date(log.timestamp) <= endDate);
        }

        return filteredLogs;
    }

    /**
     * Exportar logs para análisis
     */
    exportLogs(format = 'JSON') {
        const logs = this.getFilteredLogs();

        switch (format.toUpperCase()) {
            case 'JSON':
                return JSON.stringify(logs, null, 2);
            case 'CSV':
                return this.convertToCSV(logs);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Convertir logs a CSV
     */
    convertToCSV(logs) {
        if (logs.length === 0) return '';

        const headers = Object.keys(logs[0]).join(',');
        const rows = logs.map(log =>
            Object.values(log).map(value =>
                typeof value === 'object' ? JSON.stringify(value) : value
            ).join(',')
        );

        return [headers, ...rows].join('\n');
    }

    /**
     * Obtener estadísticas de auditoría
     */
    getAuditStats() {
        const stats = {
            totalLogs: this.auditLog.length,
            eventTypeCounts: {},
            severityCounts: {},
            recentActivity: this.auditLog.slice(-10).reverse()
        };

        // Contar por tipo de evento
        this.auditLog.forEach(log => {
            stats.eventTypeCounts[log.eventType] = (stats.eventTypeCounts[log.eventType] || 0) + 1;
            stats.severityCounts[log.severity] = (stats.severityCounts[log.severity] || 0) + 1;
        });

        return stats;
    }
}

// Hacer AuditManager disponible globalmente
window.AuditManager = AuditManager;