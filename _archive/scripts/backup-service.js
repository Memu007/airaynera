const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const logger = require('../src/utils/logger');

class BackupService {
    constructor() {
        this.firestore = new Firestore();
        this.storage = new Storage();
        this.bucketName = process.env.BACKUP_BUCKET || 'aira-backups';
        this.encryptionKey = this.deriveBackupKey();
        
        // Configuración de retención
        this.retentionPolicies = {
            daily: 30,     // 30 días
            weekly: 12,    // 12 semanas
            monthly: 12,   // 12 meses
            yearly: 7      // 7 años (HIPAA requirement)
        };
    }

    /**
     * Deriva la clave de encriptación para backups
     */
    deriveBackupKey() {
        const secret = process.env.BACKUP_ENCRYPTION_SECRET || process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('BACKUP_ENCRYPTION_SECRET must be defined');
        }
        
        const salt = Buffer.from('aira-backup-salt-2024', 'utf8');
        return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
    }

    /**
     * Crear backup completo de Firestore
     * @param {string} backupType - Tipo de backup (daily, weekly, monthly, yearly)
     * @returns {Promise<Object>} - Información del backup
     */
    async createFirestoreBackup(backupType = 'daily') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupId = `${backupType}-${timestamp}`;
            const outputUriPrefix = `gs://${this.bucketName}/firestore/${backupId}`;

            logger.audit('Starting Firestore backup', { 
                backupId, 
                backupType, 
                outputUri: outputUriPrefix 
            });

            // Ejecutar backup de Firestore
            const [operation] = await this.firestore.collection('__backup__').add({
                // Esto es un placeholder - en producción usar gcloud CLI
                // gcloud firestore export gs://bucket-name/backup-folder
                timestamp: new Date().toISOString(),
                type: backupType,
                status: 'initiated'
            });

            // Simular backup real (en producción usar gcloud CLI)
            await this.simulateFirestoreExport(outputUriPrefix, backupId);

            const backupInfo = {
                id: backupId,
                type: backupType,
                timestamp,
                outputUri: outputUriPrefix,
                status: 'completed',
                encrypted: true,
                retentionDate: this.calculateRetentionDate(backupType)
            };

            // Registrar backup en metadata
            await this.recordBackupMetadata(backupInfo);

            logger.audit('Firestore backup completed', backupInfo);

            return backupInfo;

        } catch (error) {
            logger.error('Firestore backup failed', { 
                backupType, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Simular exportación de Firestore (reemplazar con gcloud en producción)
     * @param {string} outputUri - URI de destino
     * @param {string} backupId - ID del backup
     */
    async simulateFirestoreExport(outputUri, backupId) {
        // En producción, ejecutar:
        // const { exec } = require('child_process');
        // exec(`gcloud firestore export ${outputUri}`);
        
        const backupData = {
            metadata: {
                id: backupId,
                timestamp: new Date().toISOString(),
                version: '1.0',
                encrypted: true
            },
            collections: {
                users: await this.exportCollection('users'),
                patients: await this.exportCollection('patients'),
                sessions: await this.exportCollection('sessions'),
                audit_logs: await this.exportCollection('audit_logs')
            }
        };

        // Encriptar backup
        const encryptedBackup = this.encryptBackupData(JSON.stringify(backupData));
        
        // Simular guardado en Cloud Storage
        const fileName = `${backupId}/firestore-export.enc`;
        await this.saveToCloudStorage(fileName, encryptedBackup);
    }

    /**
     * Exportar una colección específica
     * @param {string} collectionName - Nombre de la colección
     * @returns {Promise<Array>} - Documentos de la colección
     */
    async exportCollection(collectionName) {
        try {
            const snapshot = await this.firestore.collection(collectionName).get();
            const documents = [];
            
            snapshot.forEach(doc => {
                documents.push({
                    id: doc.id,
                    data: doc.data()
                });
            });

            logger.audit('Collection exported', { 
                collection: collectionName, 
                documentCount: documents.length 
            });

            return documents;

        } catch (error) {
            logger.error('Collection export failed', { 
                collection: collectionName, 
                error: error.message 
            });
            return [];
        }
    }

    /**
     * Encriptar datos de backup
     * @param {string} data - Datos a encriptar
     * @returns {Buffer} - Datos encriptados
     */
    encryptBackupData(data) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        
        const cipher = crypto.createCipher(algorithm, this.encryptionKey, iv);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const tag = cipher.getAuthTag();
        
        // Combinar IV + tag + datos encriptados
        return Buffer.concat([
            iv,
            tag,
            Buffer.from(encrypted, 'hex')
        ]);
    }

    /**
     * Desencriptar datos de backup
     * @param {Buffer} encryptedData - Datos encriptados
     * @returns {string} - Datos desencriptados
     */
    decryptBackupData(encryptedData) {
        const algorithm = 'aes-256-gcm';
        
        const iv = encryptedData.slice(0, 16);
        const tag = encryptedData.slice(16, 32);
        const encrypted = encryptedData.slice(32);
        
        const decipher = crypto.createDecipher(algorithm, this.encryptionKey, iv);
        decipher.setAuthTag(tag);
        
        let decrypted = decipher.update(encrypted, null, 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    }

    /**
     * Guardar datos en Cloud Storage
     * @param {string} fileName - Nombre del archivo
     * @param {Buffer} data - Datos a guardar
     */
    async saveToCloudStorage(fileName, data) {
        try {
            const bucket = this.storage.bucket(this.bucketName);
            const file = bucket.file(fileName);
            
            await file.save(data, {
                metadata: {
                    contentType: 'application/octet-stream',
                    metadata: {
                        encrypted: 'true',
                        encryptionAlgorithm: 'aes-256-gcm',
                        createdBy: 'aira-backup-service'
                    }
                }
            });

            logger.audit('Backup saved to Cloud Storage', { 
                fileName, 
                size: data.length 
            });

        } catch (error) {
            logger.error('Failed to save backup to Cloud Storage', { 
                fileName, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Registrar metadata del backup
     * @param {Object} backupInfo - Información del backup
     */
    async recordBackupMetadata(backupInfo) {
        try {
            await this.firestore.collection('backup_metadata').doc(backupInfo.id).set({
                ...backupInfo,
                recordedAt: new Date().toISOString()
            });

        } catch (error) {
            logger.error('Failed to record backup metadata', { 
                backupId: backupInfo.id, 
                error: error.message 
            });
        }
    }

    /**
     * Calcular fecha de retención según política
     * @param {string} backupType - Tipo de backup
     * @returns {string} - Fecha de retención ISO
     */
    calculateRetentionDate(backupType) {
        const now = new Date();
        const retentionDays = this.retentionPolicies[backupType] || 30;
        
        let retentionDate;
        switch (backupType) {
            case 'yearly':
                retentionDate = new Date(now.getFullYear() + retentionDays, now.getMonth(), now.getDate());
                break;
            case 'monthly':
                retentionDate = new Date(now.getFullYear(), now.getMonth() + retentionDays, now.getDate());
                break;
            case 'weekly':
                retentionDate = new Date(now.getTime() + (retentionDays * 7 * 24 * 60 * 60 * 1000));
                break;
            default: // daily
                retentionDate = new Date(now.getTime() + (retentionDays * 24 * 60 * 60 * 1000));
        }
        
        return retentionDate.toISOString();
    }

    /**
     * Limpiar backups expirados
     * @returns {Promise<number>} - Número de backups eliminados
     */
    async cleanupExpiredBackups() {
        try {
            const now = new Date().toISOString();
            const expiredSnapshot = await this.firestore.collection('backup_metadata')
                .where('retentionDate', '<', now)
                .get();

            let deletedCount = 0;

            for (const doc of expiredSnapshot.docs) {
                const backupInfo = doc.data();
                
                try {
                    // Eliminar archivos de Cloud Storage
                    await this.deleteBackupFiles(backupInfo.id);
                    
                    // Eliminar metadata
                    await doc.ref.delete();
                    
                    deletedCount++;
                    
                    logger.audit('Expired backup deleted', { 
                        backupId: backupInfo.id,
                        retentionDate: backupInfo.retentionDate
                    });

                } catch (error) {
                    logger.error('Failed to delete expired backup', { 
                        backupId: backupInfo.id, 
                        error: error.message 
                    });
                }
            }

            logger.audit('Backup cleanup completed', { deletedCount });

            return deletedCount;

        } catch (error) {
            logger.error('Backup cleanup failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Eliminar archivos de backup de Cloud Storage
     * @param {string} backupId - ID del backup
     */
    async deleteBackupFiles(backupId) {
        const bucket = this.storage.bucket(this.bucketName);
        const [files] = await bucket.getFiles({ prefix: `firestore/${backupId}/` });
        
        for (const file of files) {
            await file.delete();
        }
    }

    /**
     * Restaurar backup
     * @param {string} backupId - ID del backup a restaurar
     * @param {Object} options - Opciones de restauración
     * @returns {Promise<Object>} - Resultado de la restauración
     */
    async restoreBackup(backupId, options = {}) {
        try {
            logger.audit('Starting backup restoration', { backupId, options });

            // Obtener metadata del backup
            const backupDoc = await this.firestore.collection('backup_metadata').doc(backupId).get();
            
            if (!backupDoc.exists) {
                throw new Error('Backup not found');
            }

            const backupInfo = backupDoc.data();

            // Descargar y desencriptar backup
            const backupData = await this.downloadAndDecryptBackup(backupId);

            // Validar integridad
            await this.validateBackupIntegrity(backupData);

            // Restaurar datos (en modo simulado)
            const restorationResult = await this.performRestore(backupData, options);

            logger.audit('Backup restoration completed', { 
                backupId, 
                restoredCollections: restorationResult.collections,
                restoredDocuments: restorationResult.totalDocuments
            });

            return restorationResult;

        } catch (error) {
            logger.error('Backup restoration failed', { backupId, error: error.message });
            throw error;
        }
    }

    /**
     * Descargar y desencriptar backup
     * @param {string} backupId - ID del backup
     * @returns {Promise<Object>} - Datos del backup
     */
    async downloadAndDecryptBackup(backupId) {
        const bucket = this.storage.bucket(this.bucketName);
        const file = bucket.file(`firestore/${backupId}/firestore-export.enc`);
        
        const [encryptedData] = await file.download();
        const decryptedData = this.decryptBackupData(encryptedData);
        
        return JSON.parse(decryptedData);
    }

    /**
     * Validar integridad del backup
     * @param {Object} backupData - Datos del backup
     */
    async validateBackupIntegrity(backupData) {
        if (!backupData.metadata || !backupData.collections) {
            throw new Error('Invalid backup format');
        }
        
        // Validaciones adicionales
        const requiredCollections = ['users', 'patients', 'sessions'];
        for (const collection of requiredCollections) {
            if (!backupData.collections[collection]) {
                logger.warn('Missing collection in backup', { collection });
            }
        }
    }

    /**
     * Realizar restauración
     * @param {Object} backupData - Datos del backup
     * @param {Object} options - Opciones de restauración
     * @returns {Promise<Object>} - Resultado de la restauración
     */
    async performRestore(backupData, options) {
        const result = {
            collections: [],
            totalDocuments: 0,
            errors: []
        };

        for (const [collectionName, documents] of Object.entries(backupData.collections)) {
            try {
                if (options.collections && !options.collections.includes(collectionName)) {
                    continue; // Saltar si no está en la lista de colecciones a restaurar
                }

                // En producción, restaurar documentos reales
                // Por ahora, solo simular
                logger.audit('Simulating restore for collection', { 
                    collection: collectionName, 
                    documentCount: documents.length 
                });

                result.collections.push(collectionName);
                result.totalDocuments += documents.length;

            } catch (error) {
                result.errors.push({
                    collection: collectionName,
                    error: error.message
                });
            }
        }

        return result;
    }

    /**
     * Obtener estadísticas de backups
     * @returns {Promise<Object>} - Estadísticas
     */
    async getBackupStats() {
        try {
            const snapshot = await this.firestore.collection('backup_metadata').get();
            
            const stats = {
                total: snapshot.size,
                byType: { daily: 0, weekly: 0, monthly: 0, yearly: 0 },
                totalSize: 0,
                oldestBackup: null,
                newestBackup: null
            };

            snapshot.forEach(doc => {
                const data = doc.data();
                stats.byType[data.type] = (stats.byType[data.type] || 0) + 1;
                
                if (!stats.oldestBackup || data.timestamp < stats.oldestBackup) {
                    stats.oldestBackup = data.timestamp;
                }
                
                if (!stats.newestBackup || data.timestamp > stats.newestBackup) {
                    stats.newestBackup = data.timestamp;
                }
            });

            return stats;

        } catch (error) {
            logger.error('Failed to get backup stats', { error: error.message });
            throw error;
        }
    }

    /**
     * Health check del servicio de backup
     * @returns {Promise<Object>} - Estado del servicio
     */
    async healthCheck() {
        try {
            const testData = 'AIRA Backup Test - ' + Date.now();
            const encrypted = this.encryptBackupData(testData);
            const decrypted = this.decryptBackupData(encrypted);
            
            const encryptionHealthy = decrypted === testData;
            
            // Verificar acceso a Cloud Storage
            const bucket = this.storage.bucket(this.bucketName);
            const [exists] = await bucket.exists();
            
            const health = {
                encryptionHealthy,
                storageAccessible: exists,
                retentionPolicies: this.retentionPolicies,
                status: (encryptionHealthy && exists) ? 'healthy' : 'unhealthy'
            };

            logger.audit('Backup service health check', health);

            return health;

        } catch (error) {
            logger.error('Backup service health check failed', { error: error.message });
            return {
                encryptionHealthy: false,
                storageAccessible: false,
                status: 'unhealthy',
                error: error.message
            };
        }
    }
}

module.exports = new BackupService(); 