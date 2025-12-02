const { firestorePool } = require('../config/database');
const SecurityService = require('./SecurityService');
const logger = require('../utils/logger');

class DatabaseService {
    constructor() {
        this.db = firestorePool.getConnection();
    }

    async authenticateProfessional(dni, pin) {
        try {
            const validation = SecurityService.validateInput(dni, 'dni');
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const pinValidation = SecurityService.validateInput(pin, 'pin');
            if (!pinValidation.valid) {
                throw new Error(pinValidation.error);
            }

            const professionalRef = this.db.collection('professionals').doc(dni);
            const doc = await professionalRef.get();

            if (!doc.exists) {
                logger.medical.auditEvent(dni, 'AUTH_FAILED', null, { reason: 'professional_not_found' });
                return { success: false, error: 'Profesional no encontrado' };
            }

            const data = doc.data();
            const isValidPin = await SecurityService.verifyPin(pin, data.pin_hash);

            if (!isValidPin) {
                logger.medical.auditEvent(dni, 'AUTH_FAILED', null, { reason: 'invalid_pin' });
                return { success: false, error: 'PIN incorrecto' };
            }

            // Update last login
            await professionalRef.update({
                last_login: new Date(),
                login_count: (data.login_count || 0) + 1
            });

            logger.medical.auditEvent(dni, 'AUTH_SUCCESS', null);

            return {
                success: true,
                professional: {
                    dni: data.dni,
                    nombre: data.nombre,
                    especialidad: data.especialidad,
                    matricula: data.matricula
                }
            };

        } catch (error) {
            logger.error('Authentication error:', error);
            return { success: false, error: 'Error de autenticación' };
        }
    }

    async registerPatient(professionalDni, patientData) {
        try {
            const validation = this.validatePatientData(patientData);
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const encryptedData = this.encryptPatientData(patientData, professionalDni);
            const patientId = `${professionalDni}_${patientData.dni}`;

            const patientRef = this.db.collection('patients').doc(patientId);
            
            await patientRef.set({
                ...encryptedData,
                professional_dni: professionalDni,
                created_at: new Date(),
                updated_at: new Date(),
                active: true
            });

            logger.medical.auditEvent(professionalDni, 'PATIENT_REGISTERED', patientId);

            return {
                success: true,
                patient: {
                    id: patientId,
                    nombre: patientData.nombre,
                    dni: patientData.dni
                }
            };

        } catch (error) {
            logger.error('Patient registration error:', error);
            return { success: false, error: 'Error al registrar paciente' };
        }
    }

    async getPatients(professionalDni) {
        try {
            const patientsRef = this.db.collection('patients')
                .where('professional_dni', '==', professionalDni)
                .where('active', '==', true);

            const snapshot = await patientsRef.get();
            const patients = [];

            snapshot.forEach(doc => {
                try {
                    const encryptedData = doc.data();
                    const decryptedData = this.decryptPatientData(encryptedData, professionalDni);
                    
                    patients.push({
                        id: doc.id,
                        ...decryptedData,
                        created_at: encryptedData.created_at,
                        updated_at: encryptedData.updated_at
                    });
                } catch (decryptError) {
                    logger.error(`Failed to decrypt patient ${doc.id}:`, decryptError);
                }
            });

            logger.medical.auditEvent(professionalDni, 'PATIENTS_ACCESSED', null, { count: patients.length });

            return { success: true, patients };

        } catch (error) {
            logger.error('Get patients error:', error);
            return { success: false, error: 'Error al obtener pacientes' };
        }
    }

    async registerSession(professionalDni, sessionData) {
        try {
            const sessionId = require('crypto').randomUUID();
            const encryptedObservations = SecurityService.encrypt(
                sessionData.observaciones, 
                `session_${professionalDni}`
            );

            const sessionDoc = {
                id: sessionId,
                professional_dni: professionalDni,
                patient_id: sessionData.patient_id,
                patient_name_hash: SecurityService.hashSensitiveData(sessionData.patient_name),
                observaciones_encrypted: encryptedObservations,
                resumen: sessionData.resumen || null,
                mood_score: sessionData.mood_score || null,
                duration_minutes: sessionData.duration_minutes || null,
                session_type: sessionData.session_type || 'regular',
                crisis_detected: sessionData.crisis_detected || false,
                crisis_severity: sessionData.crisis_severity || null,
                created_at: new Date(),
                updated_at: new Date()
            };

            await this.db.collection('sessions').doc(sessionId).set(sessionDoc);

            logger.medical.auditEvent(
                professionalDni, 
                'SESSION_REGISTERED', 
                sessionId,
                { 
                    patient_id: sessionData.patient_id,
                    crisis_detected: sessionData.crisis_detected,
                    session_type: sessionData.session_type
                }
            );

            return { success: true, sessionId };

        } catch (error) {
            logger.error('Session registration error:', error);
            return { success: false, error: 'Error al registrar sesión' };
        }
    }

    async getSessions(professionalDni, filters = {}) {
        try {
            let query = this.db.collection('sessions')
                .where('professional_dni', '==', professionalDni);

            // Apply filters
            if (filters.patient_id) {
                query = query.where('patient_id', '==', filters.patient_id);
            }

            if (filters.crisis_only) {
                query = query.where('crisis_detected', '==', true);
            }

            if (filters.date_from) {
                query = query.where('created_at', '>=', filters.date_from);
            }

            if (filters.date_to) {
                query = query.where('created_at', '<=', filters.date_to);
            }

            // Order by creation date (most recent first)
            query = query.orderBy('created_at', 'desc');

            // Limit results
            if (filters.limit) {
                query = query.limit(filters.limit);
            }

            const snapshot = await query.get();
            const sessions = [];

            snapshot.forEach(doc => {
                try {
                    const data = doc.data();
                    
                    // Decrypt observations
                    const observaciones = SecurityService.decrypt(
                        data.observaciones_encrypted,
                        `session_${professionalDni}`
                    );

                    sessions.push({
                        id: data.id,
                        patient_id: data.patient_id,
                        observaciones,
                        resumen: data.resumen,
                        mood_score: data.mood_score,
                        duration_minutes: data.duration_minutes,
                        session_type: data.session_type,
                        crisis_detected: data.crisis_detected,
                        crisis_severity: data.crisis_severity,
                        created_at: data.created_at,
                        updated_at: data.updated_at
                    });
                } catch (decryptError) {
                    logger.error(`Failed to decrypt session ${doc.id}:`, decryptError);
                }
            });

            logger.medical.auditEvent(
                professionalDni, 
                'SESSIONS_ACCESSED', 
                null,
                { 
                    count: sessions.length,
                    filters: Object.keys(filters)
                }
            );

            return { success: true, sessions };

        } catch (error) {
            logger.error('Get sessions error:', error);
    }
}

async getSessions(professionalDni, filters = {}) {
    try {
        let query = this.db.collection('sessions')
            .where('professional_dni', '==', professionalDni);

        // Apply filters
        if (filters.patient_id) {
            query = query.where('patient_id', '==', filters.patient_id);
        }

        if (filters.crisis_only) {
            query = query.where('crisis_detected', '==', true);
        }

        if (filters.date_from) {
            query = query.where('created_at', '>=', filters.date_from);
        }

        if (filters.date_to) {
            query = query.where('created_at', '<=', filters.date_to);
        }

        // Order by creation date (most recent first)
        query = query.orderBy('created_at', 'desc');

        // Limit results
        if (filters.limit) {
            query = query.limit(filters.limit);
        }

        const snapshot = await query.get();
        const sessions = [];

        snapshot.forEach(doc => {
            try {
                const data = doc.data();
                
                // Decrypt observations
                const observaciones = SecurityService.decrypt(
                    data.observaciones_encrypted,
                    `session_${professionalDni}`
                );

                sessions.push({
                    id: data.id,
                    patient_id: data.patient_id,
                    observaciones,
                    resumen: data.resumen,
                    mood_score: data.mood_score,
                    duration_minutes: data.duration_minutes,
                    session_type: data.session_type,
                    crisis_detected: data.crisis_detected,
                    crisis_severity: data.crisis_severity,
                    created_at: data.created_at,
                    updated_at: data.updated_at
                });
            } catch (decryptError) {
                logger.error(`Failed to decrypt session ${doc.id}:`, decryptError);
            }
        });

        logger.medical.auditEvent(
            professionalDni, 
            'SESSIONS_ACCESSED', 
            null,
            { 
                count: sessions.length,
                filters: Object.keys(filters)
            }
        );

        return { success: true, sessions };

    } catch (error) {
        logger.error('Get sessions error:', error);
        return { success: false, error: 'Error al obtener sesiones' };
    }
}

validatePatientData(data) {
    if (!data.dni) {
        return { valid: false, error: 'Campo dni requerido' };
    }
    // Validate DNI format
    const dniValidation = SecurityService.validateInput(data.dni, 'dni');
    if (!dniValidation.valid) {
        return { valid: false, error: 'DNI inválido' };
    }
    // Phone is optional, but if provided, validate
    if (data.telefono) {
        const phoneValidation = SecurityService.validateInput(data.telefono, 'phone');
        if (!phoneValidation.valid) {
            return { valid: false, error: 'Teléfono inválido' };
        }
    }
    return { valid: true };
}

encryptPatientData(data, professionalDni) {
    const context = `patient_${professionalDni}`;
    
    return {
        nombre_encrypted: SecurityService.encrypt(data.nombre, context),
        dni_encrypted: SecurityService.encrypt(data.dni, context),
        obra_social_encrypted: SecurityService.encrypt(data.obra_social, context),
        telefono_encrypted: SecurityService.encrypt(data.telefono, context),
        notas_encrypted: data.notas ? SecurityService.encrypt(data.notas, context) : null
    };
}

decryptPatientData(encryptedData, professionalDni) {
    const context = `patient_${professionalDni}`;
    
    return {
        nombre: SecurityService.decrypt(encryptedData.nombre_encrypted, context),
        dni: SecurityService.decrypt(encryptedData.dni_encrypted, context),
        obra_social: SecurityService.decrypt(encryptedData.obra_social_encrypted, context),
        telefono: SecurityService.decrypt(encryptedData.telefono_encrypted, context),
        notas: encryptedData.notas_encrypted ? 
            SecurityService.decrypt(encryptedData.notas_encrypted, context) : null
    };
}

async logAuditEvent(action, professionalDni, details = {}) {
    try {
        const auditDoc = {
            action,
            professional_dni: professionalDni,
            details,
            timestamp: new Date(),
            ip_hash: details.ip ? SecurityService.hashSensitiveData(details.ip) : null
        };

        await this.db.collection('audit_log').add(auditDoc);
    } catch (error) {
        logger.error('Audit logging error:', error);
    }
}

// Health check method
async healthCheck() {
    try {
        await this.db.collection('health_check').doc('test').get();
        return true;
    } catch (error) {
        logger.error('Database health check failed:', error);
        return false;
    }
}

// Get database statistics
async getStats(professionalDni) {
    try {
        const [patientsSnapshot, sessionsSnapshot] = await Promise.all([
            this.db.collection('patients')
                .where('professional_dni', '==', professionalDni)
                .where('active', '==', true)
                .get(),
            this.db.collection('sessions')
                .where('professional_dni', '==', professionalDni)
                .get()
        ]);

        const crisisSessionsSnapshot = await this.db.collection('sessions')
            .where('professional_dni', '==', professionalDni)
            .where('crisis_detected', '==', true)
            .get();

        return {
            total_patients: patientsSnapshot.size,
            total_sessions: sessionsSnapshot.size,
            crisis_sessions: crisisSessionsSnapshot.size,
            crisis_rate: sessionsSnapshot.size > 0 ? 
                (crisisSessionsSnapshot.size / sessionsSnapshot.size * 100).toFixed(2) : 0
        };

    } catch (error) {
        logger.error('Get stats error:', error);
        return null;
    }
}
}

module.exports = new DatabaseService(); 