/**
 * SESSION STORAGE SERVICE - AIRA Medical Bot
 * ONLY for recording and storing sessions
 * NO medical advice or treatment recommendations
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;

class SessionStorageService {
  constructor() {
    this.storagePath = process.env.SESSION_STORAGE_PATH || './data/sessions';
    this.encryptionKey = process.env.ENCRYPTION_SECRET;
    
    if (!this.encryptionKey) {
      throw new Error('ENCRYPTION_SECRET is required for session storage');
    }
  }

  /**
   * Store a session recording (audio/text only)
   * @param {Object} sessionData - Session information
   * @returns {Promise<Object>} - Stored session metadata
   */
  async storeSession(sessionData) {
    const {
      sessionId,
      professionalId,
      professionalType, // 'psychologist' | 'psychiatrist'
      patientId,
      sessionDate,
      sessionType, // 'audio' | 'text'
      sessionDuration, // in minutes
      audioFile, // Buffer if audio session
      notes // Simple session notes (no medical advice)
    } = sessionData;

    // Validate required fields
    this.validateSessionData(sessionData);

    // Generate session file path
    const sessionFile = this.generateSessionPath(sessionId, sessionType);
    
    // Create session metadata
    const metadata = {
      sessionId,
      professionalId,
      professionalType,
      patientId,
      sessionDate: new Date(sessionDate).toISOString(),
      sessionType,
      sessionDuration,
      notes: notes || '',
      createdAt: new Date().toISOString(),
      status: 'stored',
      fileSize: audioFile ? audioFile.length : 0,
      checksum: audioFile ? crypto.createHash('sha256').update(audioFile).digest('hex') : null
    };

    try {
      // Ensure storage directory exists
      await this.ensureDirectoryExists(this.storagePath);

      // Store session file (audio or text)
      if (sessionType === 'audio' && audioFile) {
        await fs.writeFile(sessionFile, audioFile);
      } else if (sessionType === 'text' && notes) {
        await fs.writeFile(sessionFile, notes, 'utf8');
      }

      // Store metadata (encrypted)
      const metadataFile = sessionFile + '.meta';
      const encryptedMetadata = this.encryptMetadata(metadata);
      await fs.writeFile(metadataFile, JSON.stringify(encryptedMetadata), 'utf8');

      return {
        success: true,
        sessionId,
        filePath: sessionFile,
        metadata: {
          sessionId: metadata.sessionId,
          professionalType: metadata.professionalType,
          sessionDate: metadata.sessionDate,
          sessionType: metadata.sessionType,
          duration: metadata.sessionDuration,
          status: metadata.status
        }
      };

    } catch (error) {
      throw new Error(`Failed to store session: ${error.message}`);
    }
  }

  /**
   * Retrieve a stored session
   * @param {string} sessionId - Session ID
   * @param {string} professionalId - Professional requesting access
   * @returns {Promise<Object>} - Session data
   */
  async retrieveSession(sessionId, professionalId) {
    try {
      // Find session metadata files
      const metadataFiles = await this.findSessionFiles(sessionId);
      
      if (metadataFiles.length === 0) {
        throw new Error('Session not found');
      }

      // Load and decrypt metadata
      const metadataFile = metadataFiles[0];
      const metadataContent = await fs.readFile(metadataFile, 'utf8');
      const encryptedMetadata = JSON.parse(metadataContent);
      const metadata = this.decryptMetadata(encryptedMetadata);

      // Verify access permissions
      if (metadata.professionalId !== professionalId) {
        throw new Error('Access denied: Session belongs to different professional');
      }

      // Load session file
      const sessionFile = metadataFile.replace('.meta', '');
      let sessionContent = null;

      if (metadata.sessionType === 'audio') {
        sessionContent = await fs.readFile(sessionFile);
      } else if (metadata.sessionType === 'text') {
        sessionContent = await fs.readFile(sessionFile, 'utf8');
      }

      return {
        success: true,
        sessionId: metadata.sessionId,
        professionalType: metadata.professionalType,
        patientId: metadata.patientId,
        sessionDate: metadata.sessionDate,
        sessionType: metadata.sessionType,
        sessionDuration: metadata.sessionDuration,
        notes: metadata.notes,
        sessionContent,
        checksum: metadata.checksum,
        createdAt: metadata.createdAt
      };

    } catch (error) {
      throw new Error(`Failed to retrieve session: ${error.message}`);
    }
  }

  /**
   * List sessions for a professional
   * @param {string} professionalId - Professional ID
   * @param {Object} filters - Optional filters
   * @returns {Promise<Array>} - List of sessions
   */
  async listSessions(professionalId, filters = {}) {
    try {
      const sessions = [];
      const { dateFrom, dateTo, sessionType, professionalType } = filters;

      // Scan storage directory for session metadata files
      const files = await fs.readdir(this.storagePath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.name.endsWith('.meta')) {
          try {
            const metadataPath = path.join(this.storagePath, file.name);
            const metadataContent = await fs.readFile(metadataPath, 'utf8');
            const encryptedMetadata = JSON.parse(metadataContent);
            const metadata = this.decryptMetadata(encryptedMetadata);

            // Check professional access
            if (metadata.professionalId !== professionalId) {
              continue;
            }

            // Apply filters
            if (dateFrom && new Date(metadata.sessionDate) < new Date(dateFrom)) continue;
            if (dateTo && new Date(metadata.sessionDate) > new Date(dateTo)) continue;
            if (sessionType && metadata.sessionType !== sessionType) continue;
            if (professionalType && metadata.professionalType !== professionalType) continue;

            sessions.push({
              sessionId: metadata.sessionId,
              professionalType: metadata.professionalType,
              patientId: metadata.patientId,
              sessionDate: metadata.sessionDate,
              sessionType: metadata.sessionType,
              sessionDuration: metadata.sessionDuration,
              status: metadata.status,
              createdAt: metadata.createdAt
            });

          } catch (error) {
            // Skip corrupted metadata files
            console.warn(`Skipping corrupted metadata file: ${file.name}`);
          }
        }
      }

      // Sort by session date (newest first)
      sessions.sort((a, b) => new Date(b.sessionDate) - new Date(a.sessionDate));

      return {
        success: true,
        sessions,
        total: sessions.length
      };

    } catch (error) {
      throw new Error(`Failed to list sessions: ${error.message}`);
    }
  }

  /**
   * Delete a session
   * @param {string} sessionId - Session ID
   * @param {string} professionalId - Professional requesting deletion
   * @returns {Promise<Object>} - Deletion result
   */
  async deleteSession(sessionId, professionalId) {
    try {
      const metadataFiles = await this.findSessionFiles(sessionId);
      
      if (metadataFiles.length === 0) {
        throw new Error('Session not found');
      }

      const metadataFile = metadataFiles[0];
      const metadataContent = await fs.readFile(metadataFile, 'utf8');
      const encryptedMetadata = JSON.parse(metadataContent);
      const metadata = this.decryptMetadata(encryptedMetadata);

      // Verify access permissions
      if (metadata.professionalId !== professionalId) {
        throw new Error('Access denied: Session belongs to different professional');
      }

      // Delete session file and metadata
      const sessionFile = metadataFile.replace('.meta', '');
      
      try {
        await fs.unlink(sessionFile);
      } catch (error) {
        // Session file might not exist
        console.warn(`Session file not found: ${sessionFile}`);
      }
      
      await fs.unlink(metadataFile);

      return {
        success: true,
        sessionId,
        message: 'Session deleted successfully'
      };

    } catch (error) {
      throw new Error(`Failed to delete session: ${error.message}`);
    }
  }

  /**
   * Validate session data
   * @param {Object} sessionData - Session data to validate
   */
  validateSessionData(sessionData) {
    const required = ['sessionId', 'professionalId', 'professionalType', 'patientId', 'sessionDate', 'sessionType'];
    
    for (const field of required) {
      if (!sessionData[field]) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate professional type
    if (!['psychologist', 'psychiatrist'].includes(sessionData.professionalType)) {
      throw new Error('Invalid professional type. Must be "psychologist" or "psychiatrist"');
    }

    // Validate session type
    if (!['audio', 'text'].includes(sessionData.sessionType)) {
      throw new Error('Invalid session type. Must be "audio" or "text"');
    }

    // For audio sessions, validate audio file
    if (sessionData.sessionType === 'audio' && !sessionData.audioFile) {
      throw new Error('Audio sessions require an audio file');
    }

    // For text sessions, validate notes
    if (sessionData.sessionType === 'text' && !sessionData.notes) {
      throw new Error('Text sessions require notes');
    }

    // Validate that no medical advice is present
    if (sessionData.notes) {
      const medicalKeywords = [
        'receta', 'medicamento', 'tratamiento', 'prescripción', 'dosificación', 
        'terapia farmacológica', 'tomar', 'debe tomar', ' dosis', 'mg', 'comprimido',
        'tableta', 'cápsula', 'gotas', 'ml', 'cada', 'vez', 'diario',
        'semanal', 'mensual', 'tratar', 'curar', 'sanar', 'aliviar'
      ];
      const notesLower = sessionData.notes.toLowerCase();
      
      for (const keyword of medicalKeywords) {
        if (notesLower.includes(keyword)) {
          throw new Error(`Medical advice detected in notes. Only session recording is allowed. Found: "${keyword}"`);
        }
      }
    }
  }

  /**
   * Generate session file path
   * @param {string} sessionId - Session ID
   * @param {string} sessionType - Session type
   * @returns {string} - File path
   */
  generateSessionPath(sessionId, sessionType) {
    const extension = sessionType === 'audio' ? '.webm' : '.txt';
    return path.join(this.storagePath, `${sessionId}${extension}`);
  }

  /**
   * Find session files by session ID
   * @param {string} sessionId - Session ID
   * @returns {Promise<Array>} - Array of metadata file paths
   */
  async findSessionFiles(sessionId) {
    try {
      const files = await fs.readdir(this.storagePath);
      return files
        .filter(file => file.startsWith(sessionId) && file.endsWith('.meta'))
        .map(file => path.join(this.storagePath, file));
    } catch (error) {
      return [];
    }
  }

  /**
   * Encrypt metadata
   * @param {Object} metadata - Metadata to encrypt
   * @returns {Object} - Encrypted metadata
   */
  encryptMetadata(metadata) {
    const metadataString = JSON.stringify(metadata);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher('aes-256-cbc', this.encryptionKey);
    
    let encrypted = cipher.update(metadataString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      iv: iv.toString('hex'),
      data: encrypted
    };
  }

  /**
   * Decrypt metadata
   * @param {Object} encryptedMetadata - Encrypted metadata
   * @returns {Object} - Decrypted metadata
   */
  decryptMetadata(encryptedMetadata) {
    const decipher = crypto.createDecipher('aes-256-cbc', this.encryptionKey);
    
    let decrypted = decipher.update(encryptedMetadata.data, 'hex', 'utf8');
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

  /**
   * Get storage statistics
   * @param {string} professionalId - Professional ID
   * @returns {Promise<Object>} - Storage statistics
   */
  async getStorageStats(professionalId) {
    try {
      const sessions = await this.listSessions(professionalId);
      const stats = {
        totalSessions: sessions.sessions.length,
        audioSessions: 0,
        textSessions: 0,
        psychologistSessions: 0,
        psychiatristSessions: 0,
        totalDuration: 0,
        storageUsed: 0
      };

      // Calculate statistics
      for (const session of sessions.sessions) {
        if (session.sessionType === 'audio') stats.audioSessions++;
        if (session.sessionType === 'text') stats.textSessions++;
        if (session.professionalType === 'psychologist') stats.psychologistSessions++;
        if (session.professionalType === 'psychiatrist') stats.psychiatristSessions++;
        stats.totalDuration += session.sessionDuration || 0;
      }

      return {
        success: true,
        stats
      };

    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }
}

module.exports = SessionStorageService;