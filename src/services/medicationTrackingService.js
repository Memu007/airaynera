/**
 * MEDICATION TRACKING SERVICE - AIRA Medical Bot
 * ONLY for mentioning medications that patients are taking
 * NO medical advice, prescriptions, or treatment recommendations
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class MedicationTrackingService {
  constructor() {
    this.storagePath = process.env.MEDICATION_STORAGE_PATH || './data/medications';
    this.encryptionKey = process.env.ENCRYPTION_SECRET;
    
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_SECRET is required for medication tracking');
    }
  }

  /**
   * Store medication mention in a session
   * @param {Object} medicationData - Medication information
   * @returns {Promise<Object>} - Stored medication metadata
   */
  async storeMedicationMention(medicationData) {
    const {
      sessionId,
      professionalId,
      professionalType, // 'psychologist' | 'psychiatrist'
      patientId,
      sessionDate,
      medicationName, // Just the name, no dosage or frequency
      medicationType, // 'prescribed_by_other' | 'over_the_counter' | 'supplement' | 'other'
      mentionType, // 'patient_mentioned' | 'family_mentioned' | 'current_medication' | 'past_medication'
      notes // Simple observation, no medical advice
    } = medicationData;

    // Validate required fields
    this.validateMedicationData(medicationData);

    // Create medication mention record
    const medicationRecord = {
      id: crypto.randomBytes(16).toString('hex'),
      sessionId,
      professionalId,
      professionalType,
      patientId,
      sessionDate: new Date(sessionDate).toISOString(),
      medicationName: medicationName.trim(),
      medicationType,
      mentionType,
      notes: notes || '',
      isPrescribed: medicationType === 'prescribed_by_other',
      createdAt: new Date().toISOString()
    };

    try {
      // Ensure storage directory exists
      await this.ensureDirectoryExists(this.storagePath);

      // Store medication record (encrypted)
      const medicationFile = path.join(this.storagePath, `${patientId}_medications.json`);
      const encryptedRecord = this.encryptRecord(medicationRecord);

      // Load existing medications or create new file
      let existingMedications = [];
      try {
        const existingData = await fs.readFile(medicationFile, 'utf8');
        const decryptedData = this.decryptData(existingData);
        existingMedications = decryptedData.medications || [];
      } catch (error) {
        // File doesn't exist yet, start with empty array
      }

      // Add new medication
      existingMedications.push(encryptedRecord);

      // Save updated medications
      const updatedData = {
        patientId,
        medications: existingMedications,
        lastUpdated: new Date().toISOString(),
        totalMentions: existingMedications.length
      };

      const encryptedData = this.encryptRecord(updatedData);
      await fs.writeFile(medicationFile, JSON.stringify(encryptedData), 'utf8');

      return {
        success: true,
        medicationId: medicationRecord.id,
        patientId,
        medicationName: medicationRecord.medicationName,
        medicationType: medicationRecord.medicationType,
        mentionType: medicationRecord.mentionType,
        createdAt: medicationRecord.createdAt
      };

    } catch (error) {
      throw new Error(`Failed to store medication mention: ${error.message}`);
    }
  }

  /**
   * Get all medication mentions for a patient
   * @param {string} patientId - Patient ID
   * @param {string} professionalId - Professional requesting access
   * @returns {Promise<Array>} - List of medication mentions
   */
  async getMedicationMentions(patientId, professionalId) {
    try {
      const medicationFile = path.join(this.storagePath, `${patientId}_medications.json`);
      
      try {
        const encryptedData = await fs.readFile(medicationFile, 'utf8');
        const decryptedData = this.decryptData(encryptedData);
        
        // Verify access permissions (only professionals who stored data can access)
        const accessibleMentions = decryptedData.medications.filter(med => {
          try {
            const decryptedMed = this.decryptRecord(med);
            return decryptedMed.professionalId === professionalId;
          } catch (error) {
            return false;
          }
        });

        return {
          success: true,
          patientId,
          medications: accessibleMentions.map(med => {
            const decryptedMed = this.decryptRecord(med);
            return {
              id: decryptedMed.id,
              sessionId: decryptedMed.sessionId,
              sessionDate: decryptedMed.sessionDate,
              medicationName: decryptedMed.medicationName,
              medicationType: decryptedMed.medicationType,
              mentionType: decryptedMed.mentionType,
              notes: decryptedMed.notes,
              isPrescribed: decryptedMed.isPrescribed,
              createdAt: decryptedMed.createdAt
            };
          })
        };

      } catch (error) {
        // File doesn't exist
        return {
          success: true,
          patientId,
          medications: []
        };
      }

    } catch (error) {
      throw new Error(`Failed to get medication mentions: ${error.message}`);
    }
  }

  /**
   * Get medication statistics for a professional
   * @param {string} professionalId - Professional ID
   * @returns {Promise<Object>} - Medication statistics
   */
  async getMedicationStats(professionalId) {
    try {
      // Scan all medication files
      const files = await fs.readdir(this.storagePath);
      const medicationFiles = files.filter(file => file.endsWith('_medications.json'));
      
      let totalMentions = 0;
      let uniquePatients = new Set();
      let medicationTypes = {};
      let mentionTypes = {};

      for (const file of medicationFiles) {
        try {
          const filePath = path.join(this.storagePath, file);
          const encryptedData = await fs.readFile(filePath, 'utf8');
          const decryptedData = this.decryptData(encryptedData);
          
          const patientId = decryptedData.patientId;
          
          // Filter medications by professional access
          const accessibleMentions = decryptedData.medications.filter(med => {
            try {
              const decryptedMed = this.decryptRecord(med);
              return decryptedMed.professionalId === professionalId;
            } catch (error) {
              return false;
            }
          });

          if (accessibleMentions.length > 0) {
            uniquePatients.add(patientId);
            totalMentions += accessibleMentions.length;
            
            // Count medication types
            accessibleMentions.forEach(med => {
              try {
                const decryptedMed = this.decryptRecord(med);
                medicationTypes[decryptedMed.medicationType] = (medicationTypes[decryptedMed.medicationType] || 0) + 1;
                mentionTypes[decryptedMed.mentionType] = (mentionTypes[decryptedMed.mentionType] || 0) + 1;
              } catch (error) {
                // Skip corrupted records
              }
            });
          }

        } catch (error) {
          // Skip corrupted files
          console.warn(`Skipping corrupted medication file: ${file}`);
        }
      }

      return {
        success: true,
        professionalId,
        stats: {
          totalMentions,
          uniquePatients: uniquePatients.size,
          medicationTypes,
          mentionTypes
        }
      };

    } catch (error) {
      throw new Error(`Failed to get medication stats: ${error.message}`);
    }
  }

  /**
   * Validate medication data
   * @param {Object} medicationData - Medication data to validate
   */
  validateMedicationData(medicationData) {
    const required = ['sessionId', 'professionalId', 'professionalType', 'patientId', 'sessionDate', 'medicationName', 'medicationType', 'mentionType'];
    
    for (const field of required) {
      if (!medicationData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate professional type
    if (!['psychologist', 'psychiatrist'].includes(medicationData.professionalType)) {
      throw new Error('Invalid professional type. Must be "psychologist" or "psychiatrist"');
    }

    // Validate medication type
    const validTypes = ['prescribed_by_other', 'over_the_counter', 'supplement', 'other'];
    if (!validTypes.includes(medicationData.medicationType)) {
      throw new Error(`Invalid medication type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Validate mention type
    const validMentionTypes = ['patient_mentioned', 'family_mentioned', 'current_medication', 'past_medication'];
    if (!validMentionTypes.includes(medicationData.mentionType)) {
      throw new Error(`Invalid mention type. Must be one of: ${validMentionTypes.join(', ')}`);
    }

    // Validate that no medical advice is present
    if (medicationData.notes) {
      const medicalKeywords = ['dosage', 'frecuencia', 'tomar', 'recetar', 'indicar', 'tratar', 'terapia', 'tratamiento', 'receta'];
      const notesLower = medicationData.notes.toLowerCase();
      
      for (const keyword of medicalKeywords) {
        if (notesLower.includes(keyword)) {
          throw new Error(`Medical advice detected in notes. Only medication observation is allowed.`);
        }
      }
    }

    // Validate medication name (no dosage information)
    const nameLower = medicationData.medicationName.toLowerCase();
    const dosageKeywords = ['mg', 'comprimido', 'tableta', 'cápsula', 'gotas', 'ml', 'dosis', 'cada', 'vez', 'diario', 'semanal', 'mensual'];
    
    for (const keyword of dosageKeywords) {
      if (nameLower.includes(keyword)) {
        throw new Error(`Dosage information detected in medication name. Only medication name is allowed.`);
      }
    }
  }

  /**
   * Encrypt record
   * @param {Object} record - Record to encrypt
   * @returns {Object} - Encrypted record
   */
  encryptRecord(record) {
    const recordString = JSON.stringify(record);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    let encrypted = cipher.update(recordString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  /**
   * Decrypt data
   * @param {Object} encryptedData - Encrypted data
   * @returns {Object} - Decrypted data
   */
  decryptData(encryptedData) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    
    let decrypted = decipher.update(encryptedData.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Decrypt record
   * @param {Object} encryptedRecord - Encrypted record
   * @returns {Object} - Decrypted record
   */
  decryptRecord(encryptedRecord) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    
    let decrypted = decipher.update(encryptedRecord.data, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  /**
   * Ensure directory exists
   * @param {string} dirPath - Directory path
   */
  async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath);
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }
}

module.exports = MedicationTrackingService;