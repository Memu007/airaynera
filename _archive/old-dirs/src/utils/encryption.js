const crypto = require('crypto');
const logger = require('./logger');

class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16;  // 128 bits
        this.tagLength = 16; // 128 bits
        
        // Obtener clave maestra de variables de entorno
        this.masterKey = this.deriveMasterKey();
        
        // Campos que requieren encriptación según HIPAA
        this.sensitiveFields = new Set([
            'content',          // Contenido de sesiones
            'notes',            // Notas médicas
            'diagnosis',        // Diagnósticos
            'treatment',        // Tratamientos
            'medication',       // Medicación
            'symptoms',         // Síntomas
            'personalHistory',  // Historia personal
            'familyHistory',    // Historia familiar
            'allergies',        // Alergias
            'emergencyContact', // Contacto de emergencia
            'insurance',        // Información de seguro
            'socialSecurity',   // Seguridad social
            'medicalRecord'     // Número de expediente médico
        ]);
    }

    /**
     * Deriva la clave maestra de las variables de entorno
     */
    deriveMasterKey() {
        const secret = process.env.ENCRYPTION_SECRET || process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('ENCRYPTION_SECRET o JWT_SECRET debe estar definido');
        }
        
        // Usar PBKDF2 para derivar una clave consistente
        const salt = Buffer.from('aira-health-salt-2024', 'utf8');
        return crypto.pbkdf2Sync(secret, salt, 100000, this.keyLength, 'sha256');
    }

    /**
     * Encripta un campo sensible
     * @param {string} plaintext - Texto a encriptar
     * @param {string} fieldName - Nombre del campo (para logging)
     * @returns {string} - Texto encriptado en formato base64
     */
    encrypt(plaintext, fieldName = 'unknown') {
        try {
            if (!plaintext || typeof plaintext !== 'string') {
                return plaintext; // No encriptar valores vacíos o no string
            }

            // Generar IV aleatorio para cada encriptación
            const iv = crypto.randomBytes(this.ivLength);
            
            // Crear cipher usando createCipheriv (no deprecado)
            const cipher = crypto.createCipheriv(this.algorithm, this.masterKey, iv);
            
            // Encriptar
            let encrypted = cipher.update(plaintext, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            // Obtener tag de autenticación
            const tag = cipher.getAuthTag();
            
            // Combinar IV + tag + encrypted en un solo string
            const combined = Buffer.concat([iv, tag, Buffer.from(encrypted, 'hex')]);
            const result = combined.toString('base64');
            
            if (logger && logger.audit) {
                logger.audit('Field encrypted', { 
                    fieldName, 
                    originalLength: plaintext.length,
                    encryptedLength: result.length 
                });
            }
            
            return result;
            
        } catch (error) {
            if (logger && logger.error) {
                logger.error('Encryption failed', { fieldName, error: error.message });
            }
            throw new Error(`Failed to encrypt field ${fieldName}: ${error.message}`);
        }
    }

    /**
     * Desencripta un campo
     * @param {string} encryptedData - Datos encriptados en base64
     * @param {string} fieldName - Nombre del campo (para logging)
     * @returns {string} - Texto desencriptado
     */
    decrypt(encryptedData, fieldName = 'unknown') {
        try {
            if (!encryptedData || typeof encryptedData !== 'string') {
                return encryptedData; // Retornar tal como está si no es string válido
            }

            // Verificar si parece estar encriptado (base64)
            if (!this.isEncrypted(encryptedData)) {
                return encryptedData; // Asumir que es texto plano legacy
            }

            // Decodificar de base64
            const combined = Buffer.from(encryptedData, 'base64');
            
            // Extraer componentes
            const iv = combined.slice(0, this.ivLength);
            const tag = combined.slice(this.ivLength, this.ivLength + this.tagLength);
            const encrypted = combined.slice(this.ivLength + this.tagLength);
            
            // Crear decipher usando createDecipheriv (no deprecado)
            const decipher = crypto.createDecipheriv(this.algorithm, this.masterKey, iv);
            decipher.setAuthTag(tag);
            
            // Desencriptar
            let decrypted = decipher.update(encrypted, null, 'utf8');
            decrypted += decipher.final('utf8');
            
            if (logger && logger.audit) {
                logger.audit('Field decrypted', { 
                    fieldName, 
                    encryptedLength: encryptedData.length,
                    decryptedLength: decrypted.length 
                });
            }
            
            return decrypted;
            
        } catch (error) {
            if (logger && logger.error) {
                logger.error('Decryption failed', { fieldName, error: error.message });
            }
            // En caso de error, retornar el valor original (podría ser texto plano legacy)
            return encryptedData;
        }
    }

    /**
     * Verifica si un string parece estar encriptado
     * @param {string} data - Datos a verificar
     * @returns {boolean} - True si parece encriptado
     */
    isEncrypted(data) {
        try {
            if (!data || typeof data !== 'string') {
                return false;
            }
            
            // Verificar si es base64 válido y tiene longitud mínima esperada
            const decoded = Buffer.from(data, 'base64');
            return decoded.length >= (this.ivLength + this.tagLength + 16); // IV + tag + al menos 16 bytes de datos
        } catch {
            return false;
        }
    }

    /**
     * Encripta múltiples campos de un objeto
     * @param {Object} data - Objeto con datos
     * @param {string[]} fieldsToEncrypt - Array de campos a encriptar (opcional)
     * @returns {Object} - Objeto con campos encriptados
     */
    encryptObject(data, fieldsToEncrypt = null) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const result = { ...data };
        const fields = fieldsToEncrypt || Array.from(this.sensitiveFields);
        
        fields.forEach(field => {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = this.encrypt(result[field], field);
            }
        });

        return result;
    }

    /**
     * Desencripta múltiples campos de un objeto
     * @param {Object} data - Objeto con datos encriptados
     * @param {string[]} fieldsToDecrypt - Array de campos a desencriptar (opcional)
     * @returns {Object} - Objeto con campos desencriptados
     */
    decryptObject(data, fieldsToDecrypt = null) {
        if (!data || typeof data !== 'object') {
            return data;
        }

        const result = { ...data };
        const fields = fieldsToDecrypt || Array.from(this.sensitiveFields);
        
        fields.forEach(field => {
            if (result[field] && typeof result[field] === 'string') {
                result[field] = this.decrypt(result[field], field);
            }
        });

        return result;
    }

    /**
     * Verifica la integridad del sistema de encriptación
     * @returns {boolean} - True si el sistema funciona correctamente
     */
    healthCheck() {
        try {
            const testData = 'AIRA Health System Test - ' + Date.now();
            const encrypted = this.encrypt(testData, 'healthcheck');
            const decrypted = this.decrypt(encrypted, 'healthcheck');
            
            const isHealthy = decrypted === testData;
            
            if (logger && logger.audit) {
                logger.audit('Encryption health check', { 
                    status: isHealthy ? 'PASS' : 'FAIL',
                    testLength: testData.length
                });
            }
            
            return isHealthy;
        } catch (error) {
            if (logger && logger.error) {
                logger.error('Encryption health check failed', { error: error.message });
            }
            return false;
        }
    }

    /**
     * Obtiene estadísticas del servicio de encriptación
     * @returns {Object} - Estadísticas
     */
    getStats() {
        return {
            algorithm: this.algorithm,
            keyLength: this.keyLength,
            ivLength: this.ivLength,
            tagLength: this.tagLength,
            sensitiveFieldsCount: this.sensitiveFields.size,
            sensitiveFields: Array.from(this.sensitiveFields),
            healthStatus: this.healthCheck()
        };
    }
}

// Singleton instance
const encryptionService = new EncryptionService();

module.exports = encryptionService; 