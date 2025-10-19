// Mock detection para tests
let db, encryption, logger;

if (process.env.NODE_ENV === 'test') {
    // En tests, usar mocks
    const { mockFirestore } = require('../../tests/setup/mockFirestore');
    db = mockFirestore;
    encryption = {
        encrypt: jest.fn((data) => `encrypted_${JSON.stringify(data)}`),
        decrypt: jest.fn((data) => {
            try {
                return JSON.parse(data.replace('encrypted_', ''));
            } catch {
                return data.replace('encrypted_', '');
            }
        })
    };
    logger = {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        child: jest.fn(() => ({
            info: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn()
        }))
    };
} else {
    // En producción, usar implementaciones reales
    const { db: dbInstance } = require('../config/database');
    db = dbInstance;
    encryption = require('../utils/encryption');
    logger = require('../utils/logger');
}

class SessionsService {
    constructor() {
        this.collection = db.collection('sessions');
        this.sensitiveFields = ['notes', 'diagnosis', 'treatment', 'observations'];
    }

    /**
     * Crear nueva sesión
     * @param {Object} sessionData - Datos de la sesión
     * @param {string} userId - ID del usuario que crea la sesión
     * @returns {Promise<Object>} - Sesión creada
     */
    async createSession(sessionData, userId) {
        try {
            // Validar datos requeridos
            if (!sessionData.patientId || !sessionData.date) {
                throw new Error('Patient ID and date are required');
            }

            // Validar fecha futura
            const sessionDate = new Date(sessionData.date);
            if (sessionDate < new Date()) {
                throw new Error('Session date must be in the future');
            }

            // Validar duración
            const duration = sessionData.duration || 60;
            if (duration < 15 || duration > 240) {
                throw new Error('Duration must be between 15 and 240 minutes');
            }

            // Encriptar campos sensibles
            const encryptedData = { ...sessionData };
            this.sensitiveFields.forEach(field => {
                if (encryptedData[field]) {
                    encryptedData[field] = encryption.encrypt(encryptedData[field]);
                }
            });

            // Agregar metadata
            encryptedData.createdBy = userId || 'system';
            encryptedData.createdAt = new Date().toISOString();
            encryptedData.updatedAt = new Date().toISOString();
            encryptedData.isActive = true;
            encryptedData.encryptionVersion = '1.0';
            encryptedData.status = encryptedData.status || 'programada';

            // Crear documento
            const docRef = this.collection.doc();
            await docRef.set(encryptedData);

            logger.info('Session created successfully', { 
                sessionId: docRef.id,
                patientId: sessionData.patientId,
                createdBy: userId
            });

            return {
                id: docRef.id,
                ...this.sanitizeForResponse(encryptedData)
            };

        } catch (error) {
            logger.error('Failed to create session', { 
                error: error.message,
                patientId: sessionData?.patientId,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener sesión por ID
     * @param {string} id - ID de la sesión
     * @param {string} userId - ID del usuario solicitante
     * @param {boolean} checkAuth - Si verificar autorización
     * @returns {Promise<Object|null>} - Datos de la sesión
     */
    async getSessionById(id, userId, checkAuth = true) {
        try {
            const doc = await this.collection.doc(id).get();
            
            if (!doc.exists) {
                return null;
            }

            const sessionData = doc.data();
            
            // Verificar autorización si se requiere
            if (checkAuth && !this.isUserAuthorized(sessionData, userId)) {
                throw new Error('Unauthorized to access this session');
            }

            // Desencriptar campos sensibles
            const decryptedData = { ...sessionData };
            this.sensitiveFields.forEach(field => {
                if (decryptedData[field]) {
                    try {
                        decryptedData[field] = encryption.decrypt(decryptedData[field]);
                    } catch (decryptError) {
                        logger.warn('Failed to decrypt session field', { 
                            field, 
                            sessionId: id,
                            error: decryptError.message 
                        });
                    }
                }
            });

            return {
                id: doc.id,
                ...this.sanitizeForResponse(decryptedData)
            };

        } catch (error) {
            logger.error('Failed to get session', { 
                error: error.message,
                sessionId: id,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener sesiones por paciente
     * @param {string} patientId - ID del paciente
     * @param {string} userId - ID del usuario solicitante
     * @param {Object} options - Opciones de consulta
     * @returns {Promise<Array>} - Lista de sesiones
     */
    async getSessionsByPatient(patientId, userId, options = {}) {
        try {
            const { limit = 50, includeInactive = false } = options;

            let query = this.collection.where('patientId', '==', patientId);
            
            if (!includeInactive) {
                query = query.where('isActive', '==', true);
            }

            query = query.orderBy('date', 'desc').limit(limit);

            const snapshot = await query.get();

            const sessions = [];
            snapshot.forEach(doc => {
                const sessionData = doc.data();
                
                // Verificar permisos
                if (this.isUserAuthorized(sessionData, userId)) {
                    sessions.push({
                        id: doc.id,
                        ...this.sanitizeForListing(sessionData)
                    });
                }
            });

            return sessions;

        } catch (error) {
            logger.error('Failed to get patient sessions', { 
                error: error.message,
                patientId,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener próximas sesiones
     * @param {number} limit - Límite de resultados
     * @param {string} userId - ID del usuario
     * @returns {Promise<Array>} - Próximas sesiones
     */
    async getUpcomingSessions(limit = 10, userId) {
        try {
            const now = new Date().toISOString();
            
            let query = this.collection
                .where('date', '>', now)
                .where('isActive', '==', true)
                .orderBy('date', 'asc')
                .limit(limit);

            const snapshot = await query.get();

            const sessions = [];
            snapshot.forEach(doc => {
                const sessionData = doc.data();
                
                // Verificar permisos
                if (this.isUserAuthorized(sessionData, userId)) {
                    sessions.push({
                        id: doc.id,
                        ...this.sanitizeForListing(sessionData)
                    });
                }
            });

            return sessions;

        } catch (error) {
            logger.error('Failed to get upcoming sessions', { 
                error: error.message,
                limit,
                userId
            });
            throw error;
        }
    }

    /**
     * Actualizar sesión
     * @param {string} id - ID de la sesión
     * @param {Object} updateData - Datos a actualizar
     * @param {string} userId - ID del usuario que actualiza
     * @returns {Promise<Object>} - Sesión actualizada
     */
    async updateSession(id, updateData, userId) {
        try {
            // Verificar que la sesión existe y el usuario tiene permisos
            const existingSession = await this.getSessionById(id, userId, true);
            if (!existingSession) {
                throw new Error('Session not found or unauthorized');
            }

            // Verificar si la sesión está completada
            if (existingSession.status === 'completada') {
                throw new Error('Cannot update completed session');
            }

            // Encriptar campos sensibles en los datos de actualización
            const encryptedUpdateData = { ...updateData };
            this.sensitiveFields.forEach(field => {
                if (encryptedUpdateData[field]) {
                    encryptedUpdateData[field] = encryption.encrypt(encryptedUpdateData[field]);
                }
            });

            // Agregar timestamp de actualización
            encryptedUpdateData.updatedAt = new Date().toISOString();
            encryptedUpdateData.updatedBy = userId;

            // Actualizar documento
            await this.collection.doc(id).update(encryptedUpdateData);

            logger.info('Session updated successfully', { 
                sessionId: id,
                updatedFields: Object.keys(updateData),
                userId
            });

            // Retornar sesión actualizada
            return await this.getSessionById(id, userId, false);

        } catch (error) {
            logger.error('Failed to update session', { 
                error: error.message,
                sessionId: id,
                userId
            });
            throw error;
        }
    }

    /**
     * Cancelar sesión
     * @param {string} id - ID de la sesión
     * @param {string} reason - Razón de cancelación
     * @param {string} userId - ID del usuario que cancela
     * @returns {Promise<Object>} - Sesión cancelada
     */
    async cancelSession(id, reason, userId) {
        try {
            // Verificar que la sesión existe y el usuario tiene permisos
            const existingSession = await this.getSessionById(id, userId, true);
            if (!existingSession) {
                throw new Error('Session not found or unauthorized');
            }

            // Verificar si la sesión está completada
            if (existingSession.status === 'completada') {
                throw new Error('Cannot cancel completed session');
            }

            // Actualizar estado
            const updateData = {
                status: 'cancelada',
                cancellationReason: reason,
                cancelledAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                updatedBy: userId
            };

            await this.collection.doc(id).update(updateData);

            logger.info('Session cancelled successfully', { 
                sessionId: id,
                reason,
                userId
            });

            return await this.getSessionById(id, userId, false);

        } catch (error) {
            logger.error('Failed to cancel session', { 
                error: error.message,
                sessionId: id,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener sesiones por rango de fechas
     * @param {Date} startDate - Fecha de inicio
     * @param {Date} endDate - Fecha de fin
     * @param {string} userId - ID del usuario
     * @returns {Promise<Array>} - Sesiones en el rango
     */
    async getSessionsByDateRange(startDate, endDate, userId) {
        try {
            let query = this.collection
                .where('date', '>=', startDate.toISOString())
                .where('date', '<=', endDate.toISOString())
                .where('isActive', '==', true)
                .orderBy('date', 'asc');

            const snapshot = await query.get();

            const sessions = [];
            snapshot.forEach(doc => {
                const sessionData = doc.data();
                
                // Verificar permisos
                if (this.isUserAuthorized(sessionData, userId)) {
                    sessions.push({
                        id: doc.id,
                        ...this.sanitizeForListing(sessionData)
                    });
                }
            });

            return sessions;

        } catch (error) {
            logger.error('Failed to get sessions by date range', { 
                error: error.message,
                startDate,
                endDate,
                userId
            });
            throw error;
        }
    }

    /**
     * Obtener estadísticas de sesiones
     * @param {string} userId - ID del usuario
     * @param {boolean} isAdmin - Si el usuario es admin
     * @returns {Promise<Object>} - Estadísticas
     */
    async getSessionStats(userId, isAdmin = false) {
        try {
            let query = this.collection;
            
            // Si no es admin, filtrar solo sus sesiones
            if (!isAdmin) {
                query = query.where('createdBy', '==', userId);
            }

            const snapshot = await query.get();

            let total = 0;
            let completed = 0;
            let cancelled = 0;
            let scheduled = 0;

            snapshot.forEach(doc => {
                const data = doc.data();
                total++;
                
                switch (data.status) {
                    case 'completada':
                        completed++;
                        break;
                    case 'cancelada':
                        cancelled++;
                        break;
                    case 'programada':
                        scheduled++;
                        break;
                }
            });

            const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

            return {
                total,
                completed,
                cancelled,
                scheduled,
                completionRate
            };

        } catch (error) {
            logger.error('Failed to get session statistics', { 
                error: error.message,
                userId,
                isAdmin
            });
            throw error;
        }
    }

    /**
     * Verificar si el usuario está autorizado para acceder a la sesión
     * @param {Object} sessionData - Datos de la sesión
     * @param {string} userId - ID del usuario
     * @returns {boolean} - Si está autorizado
     */
    isUserAuthorized(sessionData, userId) {
        // El usuario puede acceder si:
        // 1. Creó la sesión
        // 2. Es admin (se verifica en el controlador)
        return sessionData.createdBy === userId || !userId;
    }

    /**
     * Limpiar datos para respuesta
     * @param {Object} data - Datos de la sesión
     * @returns {Object} - Datos limpiados
     */
    sanitizeForResponse(data) {
        const sanitized = { ...data };
        
        // Remover campos internos
        delete sanitized.encryptionVersion;
        
        return sanitized;
    }

    /**
     * Limpiar datos para listado
     * @param {Object} data - Datos de la sesión
     * @returns {Object} - Datos limpiados para listado
     */
    sanitizeForListing(data) {
        return {
            patientId: data.patientId,
            date: data.date,
            type: data.type,
            duration: data.duration,
            status: data.status,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt,
            createdBy: data.createdBy
        };
    }
}

// Exportar funciones individuales para compatibilidad con tests
const sessionsServiceInstance = new SessionsService();

module.exports = {
    // Exportar instancia principal
    ...sessionsServiceInstance,
    
    // Alias para compatibilidad con tests
    createSession: sessionsServiceInstance.createSession.bind(sessionsServiceInstance),
    getSessionById: sessionsServiceInstance.getSessionById.bind(sessionsServiceInstance),
    getSessionsByPatient: sessionsServiceInstance.getSessionsByPatient.bind(sessionsServiceInstance),
    getUpcomingSessions: sessionsServiceInstance.getUpcomingSessions.bind(sessionsServiceInstance),
    updateSession: sessionsServiceInstance.updateSession.bind(sessionsServiceInstance),
    cancelSession: sessionsServiceInstance.cancelSession.bind(sessionsServiceInstance),
    getSessionsByDateRange: sessionsServiceInstance.getSessionsByDateRange.bind(sessionsServiceInstance),
    getSessionStats: sessionsServiceInstance.getSessionStats.bind(sessionsServiceInstance)
};
