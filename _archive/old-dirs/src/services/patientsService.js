const { db } = require('../config/database');
const encryption = require('../utils/encryption');
const logger = require('../utils/logger');

class PatientsService {
    constructor() {
        this.sensitiveFields = ['insurance', 'emergencyContact', 'medicalRecord', 'allergies'];
    }

    // Lazy loading de la collection
    getCollection() {
        if (!this.collection) {
            this.collection = db.collection('patients');
        }
        return this.collection;
    }

    /**
     * Crear un nuevo paciente
     * @param {Object} patientData - Datos del paciente
     * @returns {Promise<Object>} - Paciente creado
     */
    async create(patientData) {
        try {
            // Validar datos requeridos
            if (!patientData.name || !patientData.dni) {
                throw new Error('Name and DNI are required');
            }

            // Verificar que no exista un paciente con el mismo DNI
            const existingPatient = await this.findByDNI(patientData.dni);
            if (existingPatient) {
                throw new Error('Patient with this DNI already exists');
            }

            // Encriptar campos sensibles
            const encryptedData = encryption.encryptSensitiveFields(patientData, this.sensitiveFields);
            
            // Agregar metadata
            encryptedData.id = `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            encryptedData.createdAt = new Date().toISOString();
            encryptedData.updatedAt = new Date().toISOString();
            encryptedData.status = 'active';

            // Guardar en la base de datos
            const docRef = this.getCollection().doc(encryptedData.id);
            await docRef.set(encryptedData);

            logger.info('Patient created successfully', { 
                patientId: docRef.id,
                dni: patientData.dni 
            });

            return this.sanitizeForResponse(encryptedData);
        } catch (error) {
            logger.error('Error creating patient', { error: error.message });
            throw error;
        }
    }

    /**
     * Obtener paciente por ID, verificando propiedad
     * @param {string} id - ID del paciente
     * @param {string} userId - ID del usuario propietario
     * @returns {Promise<Object|null>} - Datos del paciente o null
     */
    async getById(id, userId) {
        try {
            const doc = await this.getCollection().doc(id).get();
            
            if (!doc.exists) return null;

            const patientData = doc.data();

            // *** COMPROBACIÓN DE PROPIEDAD ***
            if (patientData.userId !== userId) {
                logger.warn('Unauthorized access attempt on patient', { 
                    requesterId: userId, 
                    patientId: id,
                    ownerId: patientData.userId
                });
                return null; // O lanzar un error específico
            }
            
            // Desencriptar campos sensibles
            const decryptedData = { ...patientData };
            this.sensitiveFields.forEach(field => {
                if (decryptedData[field]) {
                    try {
                        decryptedData[field] = encryption.decrypt(decryptedData[field]);
                    } catch (decryptError) {
                        logger.warn('Failed to decrypt field', { 
                            field, 
                            patientId: id,
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
            logger.error('Failed to get patient', { 
                error: error.message,
                patientId: id 
            });
            throw error;
        }
    }

    /**
     * Obtener pacientes con paginación
     * @param {Object} options - Opciones de consulta
     * @returns {Promise<Object>} - Lista de pacientes
     */
    async getAll(options = {}) {
        try {
            const { 
                limit = 50, 
                offset = 0, 
                includeInactive = false 
            } = options;

            let query = this.getCollection();
            
            if (!includeInactive) {
                query = query.where('isActive', '==', true);
            }

            query = query.orderBy('createdAt', 'desc').limit(limit);

            const snapshot = await query.get();

            const patients = [];
            snapshot.forEach(doc => {
                const patientData = doc.data();
                patients.push({
                    id: doc.id,
                    ...this.sanitizeForListing(patientData)
                });
            });

            return {
                patients,
                total: snapshot.size,
                hasMore: snapshot.size === limit
            };

        } catch (error) {
            logger.error('Failed to get patients', { 
                error: error.message,
                options 
            });
            throw error;
        }
    }

    /**
     * Obtener pacientes de un usuario con paginación
     * @param {string} userId - ID del usuario
     * @param {Object} options - Opciones de consulta
     * @returns {Promise<Object>} - Lista de pacientes
     */
    async getPatientsByUser(userId, options = {}) {
        try {
            const { 
                limit = 50, 
                offset = 0, 
                status = 'activo'
            } = options;

            let query = this.getCollection().where('userId', '==', userId);
            
            if (status) {
                query = query.where('status', '==', status);
            }

            query = query.orderBy('createdAt', 'desc').limit(limit).offset(offset);

            const snapshot = await query.get();

            const patients = [];
            snapshot.forEach(doc => {
                const patientData = doc.data();
                patients.push({
                    id: doc.id,
                    ...this.sanitizeForListing(patientData)
                });
            });

            return {
                patients,
                total: snapshot.size,
                hasMore: snapshot.size === limit
            };

        } catch (error) {
            logger.error('Failed to get patients by user', { 
                error: error.message,
                userId,
                options 
            });
            throw error;
        }
    }
    
    /**
     * Actualizar paciente, verificando propiedad
     * @param {string} id - ID del paciente
     * @param {string} userId - ID del usuario propietario
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<Object>} - Paciente actualizado
     */
    async update(id, userId, updateData) {
        try {
            const patientToUpdate = await this.getById(id, userId);
            if (!patientToUpdate) {
                throw new Error('Patient not found or access denied');
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

            // Actualizar documento
            await this.getCollection().doc(id).update(encryptedUpdateData);

            logger.info('Patient updated successfully', { 
                patientId: id,
                updatedFields: Object.keys(updateData)
            });

            // Retornar paciente actualizado
            return await this.getById(id, userId);

        } catch (error) {
            logger.error('Failed to update patient', { 
                error: error.message,
                patientId: id 
            });
            throw error;
        }
    }

    /**
     * Eliminar paciente (soft delete), verificando propiedad
     * @param {string} id - ID del paciente
     * @param {string} userId - ID del usuario propietario
     * @returns {Promise<boolean>} - Éxito de la operación
     */
    async delete(id, userId) {
        try {
            const patientToDelete = await this.getById(id, userId);
            if (!patientToDelete) {
                throw new Error('Patient not found or access denied');
            }

            // Soft delete
            await this.getCollection().doc(id).update({
                isActive: false,
                deletedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            logger.info('Patient deleted successfully', { 
                patientId: id 
            });

            return true;

        } catch (error) {
            logger.error('Failed to delete patient', { 
                error: error.message,
                patientId: id 
            });
            throw error;
        }
    }

    /**
     * Buscar pacientes
     * @param {Object} criteria - Criterios de búsqueda
     * @returns {Promise<Array>} - Pacientes encontrados
     */
    async search(criteria) {
        try {
            const { name, dni, phone, limit = 50 } = criteria;
            
            let query = this.getCollection().where('isActive', '==', true);

            // Para búsqueda por DNI (campo no encriptado)
            if (dni) {
                query = query.where('dni', '==', dni);
            }

            const snapshot = await query.limit(limit).get();

            const patients = [];
            snapshot.forEach(doc => {
                const patientData = doc.data();
                
                // Buscar en campos no encriptados
                let matches = true;
                
                if (name && patientData.name) {
                    matches = matches && patientData.name.toLowerCase().includes(name.toLowerCase());
                }
                
                if (phone && patientData.phone) {
                    matches = matches && patientData.phone.includes(phone);
                }

                if (matches) {
                    patients.push({
                        id: doc.id,
                        ...this.sanitizeForListing(patientData)
                    });
                }
            });

            return patients;

        } catch (error) {
            logger.error('Failed to search patients', { 
                error: error.message,
                criteria 
            });
            throw error;
        }
    }

    /**
     * Buscar paciente por DNI
     * @param {string} dni - DNI del paciente
     * @returns {Promise<Object|null>} - Paciente encontrado o null
     */
    async findByDNI(dni) {
        try {
            const snapshot = await this.getCollection().where('dni', '==', dni).get();
            
            if (snapshot.empty) {
                return null;
            }

            const doc = snapshot.docs[0];
            return {
                id: doc.id,
                ...doc.data()
            };
        } catch (error) {
            logger.error('Error finding patient by DNI', { error: error.message, dni });
            throw error;
        }
    }

    /**
     * Obtener estadísticas de pacientes por usuario
     * @param {string} userId - ID del usuario
     * @returns {Promise<Object>} - Estadísticas
     */
    async getStats(userId) {
        try {
            let query = this.getCollection();

            // *** FILTRADO POR PROPIETARIO ***
            if (userId) {
                query = query.where('userId', '==', userId);
            }

            const snapshot = await query.get();
            
            let active = 0;
            let inactive = 0;
            let total = snapshot.size;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.isActive) {
                    active++;
                } else {
                    inactive++;
                }
            });

            return {
                total,
                active,
                inactive,
                createdToday: 0 // TODO: Implementar conteo por fecha
            };

        } catch (error) {
            logger.error('Failed to get patient statistics', { 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Migrar pacientes a encriptación
     * @returns {Promise<number>} - Número de pacientes migrados
     */
    async migrateToEncryption() {
        try {
            const snapshot = await this.getCollection().get();
            let migratedCount = 0;

            for (const doc of snapshot.docs) {
                const data = doc.data();
                
                // Verificar si ya está encriptado
                if (data.encryptionVersion) {
                    continue;
                }

                // Encriptar campos sensibles
                const updates = { encryptionVersion: '1.0' };
                let needsUpdate = false;

                this.sensitiveFields.forEach(field => {
                    if (data[field] && typeof data[field] === 'string') {
                        updates[field] = encryption.encrypt(data[field]);
                        needsUpdate = true;
                    }
                });

                if (needsUpdate) {
                    await doc.ref.update(updates);
                    migratedCount++;
                }
            }

            logger.info('Migration completed', { migratedCount });
            return migratedCount;

        } catch (error) {
            logger.error('Migration failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Limpiar datos para respuesta
     * @param {Object} data - Datos del paciente
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
     * @param {Object} data - Datos del paciente
     * @returns {Object} - Datos limpiados para listado
     */
    sanitizeForListing(data) {
        return {
            name: data.name,
            dni: data.dni,
            phone: data.phone,
            email: data.email,
            isActive: data.isActive,
            createdAt: data.createdAt,
            updatedAt: data.updatedAt
        };
    }
}

module.exports = new PatientsService(); 