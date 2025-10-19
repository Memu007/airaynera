/**
 * 🔄 SESSION SERVICE - AIRA Medical System
 * Gestión robusta de sesiones con monitoreo y control
 * Versión 2.0 - Production Ready
 */

const { EventEmitter } = require('events');
const crypto = require('crypto');

class SessionService extends EventEmitter {
    constructor(db, authService) {
        super();
        this.db = db;
        this.authService = authService;
        
        // Configuración
        this.config = {
            maxSessionsPerUser: 3,           // Máximo sesiones simultáneas
            sessionTimeout: 24 * 60 * 60 * 1000,  // 24 horas inactividad
            warningTime: 30 * 60 * 1000,    // 30 minutos antes de expirar
            cleanupInterval: 60 * 60 * 1000, // Cleanup cada hora
            trackingEnabled: true
        };

        // Stores (en producción usar Redis)
        this.sessionStore = new Map();        // sessionId -> sessionData
        this.userSessions = new Map();        // userId -> Set of sessionIds
        this.sessionActivity = new Map();     // sessionId -> lastActivity
        this.sessionWarnings = new Map();     // sessionId -> warningSent

        // Iniciar cleanup y monitoreo
        this.startCleanupTimer();
        this.startActivityMonitor();
        
        console.log('🔄 SessionService initialized');
    }

    /**
     * Crear nueva sesión
     */
    async createSession(userId, userAgent, ipAddress, additionalData = {}) {
        try {
            const sessionId = crypto.randomBytes(32).toString('hex');
            const now = Date.now();

            // Datos de la sesión
            const sessionData = {
                sessionId,
                userId,
                userAgent,
                ipAddress,
                createdAt: now,
                lastActivity: now,
                expiresAt: now + this.config.sessionTimeout,
                status: 'active',
                metadata: {
                    source: additionalData.source || 'web',
                    deviceInfo: this.parseUserAgent(userAgent),
                    location: additionalData.location || null,
                    loginMethod: additionalData.loginMethod || 'password'
                },
                activityLog: [
                    {
                        timestamp: now,
                        action: 'session_created',
                        details: 'Session initialized'
                    }
                ]
            };

            // Verificar límite de sesiones
            await this.enforceSessionLimit(userId, sessionId);

            // Guardar sesión
            this.sessionStore.set(sessionId, sessionData);
            this.sessionActivity.set(sessionId, now);

            // Agregar a sesiones del usuario
            if (!this.userSessions.has(userId)) {
                this.userSessions.set(userId, new Set());
            }
            this.userSessions.get(userId).add(sessionId);

            // Persistir en base de datos
            await this.persistSession(sessionData);

            console.log(`✅ Session created: ${sessionId.substring(0, 8)}*** for user ${userId.substring(0, 4)}***`);

            this.emit('sessionCreated', { sessionId, userId });

            return {
                success: true,
                session: {
                    sessionId,
                    userId,
                    expiresAt: sessionData.expiresAt,
                    maxInactivity: this.config.sessionTimeout
                }
            };

        } catch (error) {
            console.error('Error creating session:', error);
            throw error;
        }
    }

    /**
     * Obtener sesión
     */
    async getSession(sessionId) {
        try {
            const sessionData = this.sessionStore.get(sessionId);
            
            if (!sessionData) {
                // Intentar cargar desde base de datos
                const dbSession = await this.loadSessionFromDB(sessionId);
                if (dbSession) {
                    this.sessionStore.set(sessionId, dbSession);
                    return dbSession;
                }
                return null;
            }

            // Verificar si la sesión está activa
            if (sessionData.status !== 'active') {
                return null;
            }

            // Verificar expiración
            if (Date.now() > sessionData.expiresAt) {
                await this.invalidateSession(sessionId, 'expired');
                return null;
            }

            // Actualizar última actividad
            sessionData.lastActivity = Date.now();
            this.sessionActivity.set(sessionId, Date.now());

            return sessionData;

        } catch (error) {
            console.error('Error getting session:', error);
            return null;
        }
    }

    /**
     * Actualizar actividad de sesión
     */
    async updateSessionActivity(sessionId, activity = {}) {
        try {
            const sessionData = this.sessionStore.get(sessionId);
            if (!sessionData) return false;

            const now = Date.now();
            sessionData.lastActivity = now;
            this.sessionActivity.set(sessionId, now);

            // Agregar al log de actividad
            sessionData.activityLog.push({
                timestamp: now,
                action: activity.action || 'activity_update',
                details: activity.details || 'Session activity updated',
                metadata: activity.metadata || {}
            });

            // Limitar tamaño del log (mantener últimos 50 eventos)
            if (sessionData.activityLog.length > 50) {
                sessionData.activityLog = sessionData.activityLog.slice(-50);
            }

            // Verificar si necesita warning de expiración
            await this.checkExpirationWarning(sessionData);

            // Persistir cambios
            await this.updateSessionInDB(sessionId, {
                lastActivity: now,
                activityLog: sessionData.activityLog
            });

            return true;

        } catch (error) {
            console.error('Error updating session activity:', error);
            return false;
        }
    }

    /**
     * Invalidar sesión
     */
    async invalidateSession(sessionId, reason = 'logout') {
        try {
            const sessionData = this.sessionStore.get(sessionId);
            if (!sessionData) return false;

            // Marcar como inactiva
            sessionData.status = 'inactive';
            sessionData.inactiveAt = Date.now();
            sessionData.inactiveReason = reason;

            // Agregar al log
            sessionData.activityLog.push({
                timestamp: Date.now(),
                action: 'session_invalidated',
                details: `Session invalidated: ${reason}`
            });

            // Remover de sesiones activas del usuario
            const userSessions = this.userSessions.get(sessionData.userId);
            if (userSessions) {
                userSessions.delete(sessionId);
                if (userSessions.size === 0) {
                    this.userSessions.delete(sessionData.userId);
                }
            }

            // Limpiar stores
            this.sessionActivity.delete(sessionId);
            this.sessionWarnings.delete(sessionId);

            // Persistir cambios
            await this.updateSessionInDB(sessionId, {
                status: 'inactive',
                inactiveAt: sessionData.inactiveAt,
                inactiveReason: sessionData.inactiveReason,
                activityLog: sessionData.activityLog
            });

            console.log(`🚪 Session invalidated: ${sessionId.substring(0, 8)}*** (${reason})`);

            this.emit('sessionInvalidated', { sessionId, userId: sessionData.userId, reason });

            return true;

        } catch (error) {
            console.error('Error invalidating session:', error);
            return false;
        }
    }

    /**
     * Invalidar todas las sesiones de un usuario
     */
    async invalidateAllUserSessions(userId, reason = 'admin_action') {
        try {
            const userSessions = this.userSessions.get(userId);
            if (!userSessions || userSessions.size === 0) {
                return { success: true, invalidatedCount: 0 };
            }

            const sessionIds = Array.from(userSessions);
            let invalidatedCount = 0;

            for (const sessionId of sessionIds) {
                if (await this.invalidateSession(sessionId, reason)) {
                    invalidatedCount++;
                }
            }

            console.log(`🚪 All sessions invalidated for user ${userId.substring(0, 4)}*** (${invalidatedCount} sessions)`);

            this.emit('allUserSessionsInvalidated', { userId, count: invalidatedCount, reason });

            return { success: true, invalidatedCount };

        } catch (error) {
            console.error('Error invalidating all user sessions:', error);
            throw error;
        }
    }

    /**
     * Obtener sesiones activas de un usuario
     */
    async getUserSessions(userId) {
        try {
            const userSessions = this.userSessions.get(userId);
            if (!userSessions || userSessions.size === 0) {
                return [];
            }

            const sessions = [];
            for (const sessionId of userSessions) {
                const sessionData = this.sessionStore.get(sessionId);
                if (sessionData && sessionData.status === 'active') {
                    sessions.push({
                        sessionId: sessionData.sessionId,
                        createdAt: sessionData.createdAt,
                        lastActivity: sessionData.lastActivity,
                        expiresAt: sessionData.expiresAt,
                        userAgent: sessionData.userAgent,
                        ipAddress: sessionData.ipAddress,
                        deviceInfo: sessionData.metadata.deviceInfo,
                        source: sessionData.metadata.source
                    });
                }
            }

            return sessions.sort((a, b) => b.lastActivity - a.lastActivity);

        } catch (error) {
            console.error('Error getting user sessions:', error);
            return [];
        }
    }

    /**
     * Forzar límite de sesiones por usuario
     */
    async enforceSessionLimit(userId, newSessionId) {
        try {
            const userSessions = this.userSessions.get(userId);
            if (!userSessions || userSessions.size < this.config.maxSessionsPerUser) {
                return;
            }

            // Obtener sesiones ordenadas por última actividad
            const sessions = [];
            for (const sessionId of userSessions) {
                const sessionData = this.sessionStore.get(sessionId);
                if (sessionData) {
                    sessions.push({ sessionId, lastActivity: sessionData.lastActivity });
                }
            }

            sessions.sort((a, b) => a.lastActivity - b.lastActivity);

            // Invalidar las sesiones más antiguas
            const toInvalidate = sessions.slice(0, sessions.length - this.config.maxSessionsPerUser + 1);
            for (const { sessionId } of toInvalidate) {
                await this.invalidateSession(sessionId, 'session_limit_exceeded');
            }

            console.log(`🔄 Session limit enforced for user ${userId.substring(0, 4)}*** (invalidated ${toInvalidate.length} sessions)`);

        } catch (error) {
            console.error('Error enforcing session limit:', error);
        }
    }

    /**
     * Verificar y enviar warning de expiración
     */
    async checkExpirationWarning(sessionData) {
        try {
            const now = Date.now();
            const timeUntilExpiry = sessionData.expiresAt - now;

            if (timeUntilExpiry <= this.config.warningTime && 
                timeUntilExpiry > 0 && 
                !this.sessionWarnings.has(sessionData.sessionId)) {
                
                this.sessionWarnings.set(sessionData.sessionId, true);
                
                // Emitir evento de warning
                this.emit('sessionExpiringSoon', {
                    sessionId: sessionData.sessionId,
                    userId: sessionData.userId,
                    expiresAt: sessionData.expiresAt,
                    timeLeft: timeUntilExpiry
                });

                console.log(`⏰ Session expiring soon: ${sessionData.sessionId.substring(0, 8)}*** (${Math.ceil(timeUntilExpiry / 60000)} minutes)`);
            }

        } catch (error) {
            console.error('Error checking expiration warning:', error);
        }
    }

    /**
     * Parse User Agent
     */
    parseUserAgent(userAgent) {
        const deviceInfo = {
            browser: 'Unknown',
            os: 'Unknown',
            device: 'Unknown'
        };

        try {
            // Browser detection
            if (userAgent.includes('Chrome')) deviceInfo.browser = 'Chrome';
            else if (userAgent.includes('Firefox')) deviceInfo.browser = 'Firefox';
            else if (userAgent.includes('Safari')) deviceInfo.browser = 'Safari';
            else if (userAgent.includes('Edge')) deviceInfo.browser = 'Edge';

            // OS detection
            if (userAgent.includes('Windows')) deviceInfo.os = 'Windows';
            else if (userAgent.includes('Mac')) deviceInfo.os = 'macOS';
            else if (userAgent.includes('Linux')) deviceInfo.os = 'Linux';
            else if (userAgent.includes('Android')) deviceInfo.os = 'Android';
            else if (userAgent.includes('iOS')) deviceInfo.os = 'iOS';

            // Device detection
            if (userAgent.includes('Mobile') || userAgent.includes('Android') || userAgent.includes('iPhone')) {
                deviceInfo.device = 'Mobile';
            } else if (userAgent.includes('Tablet') || userAgent.includes('iPad')) {
                deviceInfo.device = 'Tablet';
            } else {
                deviceInfo.device = 'Desktop';
            }

        } catch (error) {
            console.warn('Error parsing user agent:', error);
        }

        return deviceInfo;
    }

    /**
     * Persistir sesión en base de datos
     */
    async persistSession(sessionData) {
        try {
            const docRef = this.db.collection('sessions').doc(sessionData.sessionId);
            await docRef.set({
                session_id: sessionData.sessionId,
                user_id: sessionData.userId,
                user_agent: sessionData.userAgent,
                ip_address: sessionData.ipAddress,
                created_at: new Date(sessionData.createdAt),
                last_activity: new Date(sessionData.lastActivity),
                expires_at: new Date(sessionData.expiresAt),
                status: sessionData.status,
                metadata: sessionData.metadata,
                activity_log: sessionData.activityLog.slice(0, 10) // Limitar en BD
            });

        } catch (error) {
            console.error('Error persisting session:', error);
        }
    }

    /**
     * Actualizar sesión en base de datos
     */
    async updateSessionInDB(sessionId, updates) {
        try {
            const docRef = this.db.collection('sessions').doc(sessionId);
            await docRef.update(updates);
        } catch (error) {
            console.error('Error updating session in DB:', error);
        }
    }

    /**
     * Cargar sesión desde base de datos
     */
    async loadSessionFromDB(sessionId) {
        try {
            const docRef = this.db.collection('sessions').doc(sessionId);
            const doc = await docRef.get();
            
            if (!doc.exists) return null;

            const data = doc.data();
            
            return {
                sessionId: data.session_id,
                userId: data.user_id,
                userAgent: data.user_agent,
                ipAddress: data.ip_address,
                createdAt: data.created_at.toDate().getTime(),
                lastActivity: data.last_activity.toDate().getTime(),
                expiresAt: data.expires_at.toDate().getTime(),
                status: data.status,
                metadata: data.metadata || {},
                activityLog: data.activity_log || []
            };

        } catch (error) {
            console.error('Error loading session from DB:', error);
            return null;
        }
    }

    /**
     * Iniciar timer de cleanup
     */
    startCleanupTimer() {
        setInterval(async () => {
            await this.cleanupExpiredSessions();
        }, this.config.cleanupInterval);
    }

    /**
     * Iniciar monitor de actividad
     */
    startActivityMonitor() {
        setInterval(async () => {
            await this.monitorSessionActivity();
        }, 5 * 60 * 1000); // Cada 5 minutos
    }

    /**
     * Limpiar sesiones expiradas
     */
    async cleanupExpiredSessions() {
        try {
            const now = Date.now();
            let cleanedCount = 0;

            for (const [sessionId, sessionData] of this.sessionStore.entries()) {
                if (now > sessionData.expiresAt || sessionData.status !== 'active') {
                    await this.invalidateSession(sessionId, 'expired');
                    cleanedCount++;
                }
            }

            if (cleanedCount > 0) {
                console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
                this.emit('sessionsCleanedUp', { count: cleanedCount });
            }

        } catch (error) {
            console.error('Error cleaning up sessions:', error);
        }
    }

    /**
     * Monitorear actividad de sesiones
     */
    async monitorSessionActivity() {
        try {
            const now = Date.now();
            const stats = {
                totalSessions: this.sessionStore.size,
                activeSessions: 0,
                expiringSoon: 0,
                activeUsers: this.userSessions.size
            };

            for (const [sessionId, sessionData] of this.sessionStore.entries()) {
                if (sessionData.status === 'active') {
                    stats.activeSessions++;
                    
                    const timeUntilExpiry = sessionData.expiresAt - now;
                    if (timeUntilExpiry <= this.config.warningTime && timeUntilExpiry > 0) {
                        stats.expiringSoon++;
                    }
                }
            }

            // Emitir estadísticas cada 15 minutos
            if (Math.random() < 0.25) { // 25% de probabilidad
                this.emit('sessionStats', stats);
            }

        } catch (error) {
            console.error('Error monitoring session activity:', error);
        }
    }

    /**
     * Obtener estadísticas de sesiones
     */
    getStats() {
        const now = Date.now();
        let activeSessions = 0;
        let expiringSoon = 0;

        for (const [sessionId, sessionData] of this.sessionStore.entries()) {
            if (sessionData.status === 'active') {
                activeSessions++;
                const timeUntilExpiry = sessionData.expiresAt - now;
                if (timeUntilExpiry <= this.config.warningTime && timeUntilExpiry > 0) {
                    expiringSoon++;
                }
            }
        }

        return {
            totalSessions: this.sessionStore.size,
            activeSessions,
            expiringSoon,
            activeUsers: this.userSessions.size,
            config: this.config,
            uptime: process.uptime()
        };
    }

    /**
     * Forzar cleanup manual
     */
    async forceCleanup() {
        await this.cleanupExpiredSessions();
        return this.getStats();
    }
}

module.exports = SessionService;