/**
 * SESSION STORAGE TESTS - AIRA Medical Bot
 * Testing session recording and storage functionality
 * NO medical advice or treatment recommendations
 */

const SessionStorageService = require('../../src/services/sessionStorageService');
const fs = require('fs').promises;
const path = require('path');

describe('SessionStorageService', () => {
  let sessionStorage;
  const testStoragePath = './test-data/sessions';
  
  beforeAll(() => {
    // Configure test environment
    process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32-characters-long';
    process.env.SESSION_STORAGE_PATH = testStoragePath;
    
    sessionStorage = new SessionStorageService();
  });

  beforeAll(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testStoragePath, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, continue
    }
  });

  afterAll(async () => {
    // Clean up test directory
    try {
      await fs.rmdir(testStoragePath, { recursive: true });
    } catch (error) {
      // Directory doesn't exist, continue
    }
  });

  describe('Session Storage - Audio Sessions', () => {
    test('should store audio session successfully', async () => {
      const sessionData = {
        sessionId: 'test_session_audio_001',
        professionalId: 'psychologist_001',
        professionalType: 'psychologist',
        patientId: 'patient_001',
        sessionDate: '2025-10-26T10:00:00.000Z',
        sessionType: 'audio',
        sessionDuration: 45,
        audioFile: Buffer.from('test audio data'),
        notes: 'Sesión de prueba - psicólogo'
      };

      const result = await sessionStorage.storeSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test_session_audio_001');
      expect(result.filePath).toContain('test_session_audio_001.webm');
      expect(result.metadata.professionalType).toBe('psychologist');
      expect(result.metadata.sessionType).toBe('audio');
    });

    test('should retrieve audio session successfully', async () => {
      const sessionData = {
        sessionId: 'test_session_audio_002',
        professionalId: 'psychiatrist_001',
        professionalType: 'psychiatrist',
        patientId: 'patient_002',
        sessionDate: '2025-10-26T14:00:00.000Z',
        sessionType: 'audio',
        sessionDuration: 60,
        audioFile: Buffer.from('test audio data for psychiatrist'),
        notes: 'Sesión de prueba - psiquiatra'
      };

      // Store session
      await sessionStorage.storeSession(sessionData);

      // Retrieve session
      const session = await sessionStorage.retrieveSession('test_session_audio_002', 'psychiatrist_001');

      expect(session.success).toBe(true);
      expect(session.sessionId).toBe('test_session_audio_002');
      expect(session.professionalType).toBe('psychiatrist');
      expect(session.sessionType).toBe('audio');
      expect(session.sessionDuration).toBe(60);
      expect(session.sessionContent).toEqual(Buffer.from('test audio data for psychiatrist'));
    });

    test('should prevent access to session by different professional', async () => {
      const sessionData = {
        sessionId: 'test_session_audio_003',
        professionalId: 'psychologist_001',
        professionalType: 'psychologist',
        patientId: 'patient_003',
        sessionDate: '2025-10-26T16:00:00.000Z',
        sessionType: 'audio',
        sessionDuration: 30,
        audioFile: Buffer.from('test audio data'),
        notes: 'Sesión de prueba'
      };

      // Store session by psychologist_001
      await sessionStorage.storeSession(sessionData);

      // Try to access with different professional
      await expect(
        sessionStorage.retrieveSession('test_session_audio_003', 'psychiatrist_001')
      ).rejects.toThrow('Access denied: Session belongs to different professional');
    });
  });

  describe('Session Storage - Text Sessions', () => {
    test('should store text session successfully', async () => {
      const sessionData = {
        sessionId: 'test_session_text_001',
        professionalId: 'psychologist_002',
        professionalType: 'psychologist',
        patientId: 'patient_004',
        sessionDate: '2025-10-26T11:00:00.000Z',
        sessionType: 'text',
        sessionDuration: 40,
        notes: 'Sesión de texto de prueba - observaciones del paciente'
      };

      const result = await sessionStorage.storeSession(sessionData);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('test_session_text_001');
      expect(result.metadata.sessionType).toBe('text');
      expect(result.metadata.sessionDuration).toBe(40);
    });

    test('should retrieve text session successfully', async () => {
      const sessionData = {
        sessionId: 'test_session_text_002',
        professionalId: 'psychiatrist_002',
        professionalType: 'psychiatrist',
        patientId: 'patient_005',
        sessionDate: '2025-10-26T15:00:00.000Z',
        sessionType: 'text',
        sessionDuration: 50,
        notes: 'Notas de sesión de psiquiatría - solo observaciones'
      };

      // Store session
      await sessionStorage.storeSession(sessionData);

      // Retrieve session
      const session = await sessionStorage.retrieveSession('test_session_text_002', 'psychiatrist_002');

      expect(session.success).toBe(true);
      expect(session.sessionType).toBe('text');
      expect(session.sessionContent).toBe('Notas de sesión de psiquiatría - solo observaciones');
      expect(session.professionalType).toBe('psychiatrist');
    });
  });

  describe('Session Storage - Validation', () => {
    test('should reject session with medical advice', async () => {
      const sessionData = {
        sessionId: 'test_session_invalid_001',
        professionalId: 'psychologist_003',
        professionalType: 'psychologist',
        patientId: 'patient_006',
        sessionDate: '2025-10-26T12:00:00.000Z',
        sessionType: 'text',
        sessionDuration: 30,
        notes: 'Se le receta medicamento para la ansiedad'
      };

      await expect(sessionStorage.storeSession(sessionData))
        .rejects.toThrow('Medical advice detected in notes. Only session recording is allowed.');
    });

    test('should reject session with treatment recommendations', async () => {
      const sessionData = {
        sessionId: 'test_session_invalid_002',
        professionalId: 'psychiatrist_003',
        professionalType: 'psychiatrist',
        patientId: 'patient_007',
        sessionDate: '2025-10-26T13:00:00.000Z',
        sessionType: 'text',
        sessionDuration: 45,
        notes: 'Recomiendo iniciar tratamiento con fluoxetina'
      };

      await expect(sessionStorage.storeSession(sessionData))
        .rejects.toThrow('Medical advice detected in notes. Only session recording is allowed.');
    });

    test('should reject invalid professional type', async () => {
      const sessionData = {
        sessionId: 'test_session_invalid_003',
        professionalId: 'professional_001',
        professionalType: 'invalid_type',
        patientId: 'patient_008',
        sessionDate: '2025-10-26T17:00:00.000Z',
        sessionType: 'text',
        sessionDuration: 30,
        notes: 'Sesión de prueba'
      };

      await expect(sessionStorage.storeSession(sessionData))
        .rejects.toThrow('Invalid professional type. Must be "psychologist" or "psychiatrist"');
    });

    test('should reject audio session without audio file', async () => {
      const sessionData = {
        sessionId: 'test_session_invalid_004',
        professionalId: 'psychologist_004',
        professionalType: 'psychologist',
        patientId: 'patient_009',
        sessionDate: '2025-10-26T18:00:00.000Z',
        sessionType: 'audio',
        sessionDuration: 45,
        notes: 'Sesión de prueba'
      };

      await expect(sessionStorage.storeSession(sessionData))
        .rejects.toThrow('Audio sessions require an audio file');
    });

    test('should reject text session without notes', async () => {
      const sessionData = {
        sessionId: 'test_session_invalid_005',
        professionalId: 'psychiatrist_004',
        professionalType: 'psychiatrist',
        patientId: 'patient_010',
        sessionDate: '2025-10-26T19:00:00.000Z',
        sessionType: 'text',
        sessionDuration: 30,
        notes: ''
      };

      await expect(sessionStorage.storeSession(sessionData))
        .rejects.toThrow('Text sessions require notes');
    });
  });

  describe('Session Storage - List and Filter', () => {
    beforeEach(async () => {
      // Create test data
      const sessions = [
        {
          sessionId: 'psychologist_session_001',
          professionalId: 'psychologist_list_001',
          professionalType: 'psychologist',
          patientId: 'patient_list_001',
          sessionDate: '2025-10-26T10:00:00.000Z',
          sessionType: 'audio',
          sessionDuration: 45,
          audioFile: Buffer.from('test audio 1'),
          notes: 'Sesión de psicólogo 1'
        },
        {
          sessionId: 'psychiatrist_session_001',
          professionalId: 'psychiatrist_list_001',
          professionalType: 'psychiatrist',
          patientId: 'patient_list_002',
          sessionDate: '2025-10-26T14:00:00.000Z',
          sessionType: 'text',
          sessionDuration: 60,
          notes: 'Sesión de psiquiatra 1'
        },
        {
          sessionId: 'psychologist_session_002',
          professionalId: 'psychologist_list_001',
          professionalType: 'psychologist',
          patientId: 'patient_list_003',
          sessionDate: '2025-10-26T12:00:00.000Z',
          sessionType: 'text',
          sessionDuration: 30,
          notes: 'Sesión de psicólogo 2'
        }
      ];

      for (const session of sessions) {
        await sessionStorage.storeSession(session);
      }
    });

    test('should list all sessions for psychologist', async () => {
      const result = await sessionStorage.listSessions('psychologist_list_001');

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions[0].professionalType).toBe('psychologist');
      expect(result.total).toBe(2);
    });

    test('should list sessions for psychiatrist', async () => {
      const result = await sessionStorage.listSessions('psychiatrist_list_001');

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].professionalType).toBe('psychiatrist');
      expect(result.total).toBe(1);
    });

    test('should filter sessions by professional type', async () => {
      const result = await sessionStorage.listSessions('psychologist_list_001', {
        professionalType: 'psychologist'
      });

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every(s => s.professionalType === 'psychologist')).toBe(true);
    });

    test('should filter sessions by session type', async () => {
      const result = await sessionStorage.listSessions('psychologist_list_001', {
        sessionType: 'audio'
      });

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].sessionType).toBe('audio');
    });

    test('should filter sessions by date range', async () => {
      const result = await sessionStorage.listSessions('psychologist_list_001', {
        dateFrom: '2025-10-26T11:30:00.000Z',
        dateTo: '2025-10-26T14:00:00.000Z'
      });

      expect(result.success).toBe(true);
      expect(result.sessions).toHaveLength(1);
      expect(result.sessions[0].sessionDate).toBe('2025-10-26T12:00:00.000Z');
    });
  });

  describe('Session Storage - Delete', () => {
    test('should delete session successfully', async () => {
      const sessionData = {
        sessionId: 'test_session_delete_001',
        professionalId: 'psychologist_delete_001',
        professionalType: 'psychologist',
        patientId: 'patient_delete_001',
        sessionDate: '2025-10-26T20:00:00.000Z',
        sessionType: 'audio',
        sessionDuration: 30,
        audioFile: Buffer.from('test audio to delete'),
        notes: 'Sesión para eliminar'
      };

      // Store session
      await sessionStorage.storeSession(sessionData);

      // Verify session exists
      const retrieveResult = await sessionStorage.retrieveSession('test_session_delete_001', 'psychologist_delete_001');
      expect(retrieveResult.success).toBe(true);

      // Delete session
      const deleteResult = await sessionStorage.deleteSession('test_session_delete_001', 'psychologist_delete_001');
      expect(deleteResult.success).toBe(true);

      // Verify session no longer exists
      await expect(
        sessionStorage.retrieveSession('test_session_delete_001', 'psychologist_delete_001')
      ).rejects.toThrow('Session not found');
    });

    test('should prevent deletion by different professional', async () => {
      const sessionData = {
        sessionId: 'test_session_delete_002',
        professionalId: 'psychologist_delete_002',
        professionalType: 'psychologist',
        patientId: 'patient_delete_002',
        sessionDate: '2025-10-26T21:00:00.000Z',
        sessionType: 'text',
        sessionDuration: 30,
        notes: 'Sesión protegida'
      };

      // Store session
      await sessionStorage.storeSession(sessionData);

      // Try to delete with different professional
      await expect(
        sessionStorage.deleteSession('test_session_delete_002', 'psychiatrist_delete_001')
      ).rejects.toThrow('Access denied: Session belongs to different professional');
    });
  });

  describe('Session Storage - Statistics', () => {
    beforeEach(async () => {
      // Create test data for statistics
      const sessions = [
        {
          sessionId: 'stats_audio_001',
          professionalId: 'psychologist_stats_001',
          professionalType: 'psychologist',
          patientId: 'patient_stats_001',
          sessionDate: '2025-10-26T08:00:00.000Z',
          sessionType: 'audio',
          sessionDuration: 45,
          audioFile: Buffer.from('test audio'),
          notes: 'Sesión de audio'
        },
        {
          sessionId: 'stats_text_001',
          professionalId: 'psychologist_stats_001',
          professionalType: 'psychologist',
          patientId: 'patient_stats_002',
          sessionDate: '2025-10-26T09:00:00.000Z',
          sessionType: 'text',
          sessionDuration: 30,
          notes: 'Sesión de texto'
        },
        {
          sessionId: 'stats_audio_002',
          professionalId: 'psychiatrist_stats_001',
          professionalType: 'psychiatrist',
          patientId: 'patient_stats_003',
          sessionDate: '2025-10-26T10:00:00.000Z',
          sessionType: 'audio',
          sessionDuration: 60,
          audioFile: Buffer.from('test audio 2'),
          notes: 'Sesión de psiquiatra'
        }
      ];

      for (const session of sessions) {
        await sessionStorage.storeSession(session);
      }
    });

    test('should calculate statistics for psychologist', async () => {
      const result = await sessionStorage.getStorageStats('psychologist_stats_001');

      expect(result.success).toBe(true);
      expect(result.stats.totalSessions).toBe(2);
      expect(result.stats.audioSessions).toBe(1);
      expect(result.stats.textSessions).toBe(1);
      expect(result.stats.psychologistSessions).toBe(2);
      expect(result.stats.psychiatristSessions).toBe(0);
      expect(result.stats.totalDuration).toBe(75); // 45 + 30
    });

    test('should calculate statistics for psychiatrist', async () => {
      const result = await sessionStorage.getStorageStats('psychiatrist_stats_001');

      expect(result.success).toBe(true);
      expect(result.stats.totalSessions).toBe(1);
      expect(result.stats.audioSessions).toBe(1);
      expect(result.stats.textSessions).toBe(0);
      expect(result.stats.psychologistSessions).toBe(0);
      expect(result.stats.psychiatristSessions).toBe(1);
      expect(result.stats.totalDuration).toBe(60);
    });
  });

  describe('Session Storage - Error Handling', () => {
    test('should handle non-existent session retrieval', async () => {
      await expect(
        sessionStorage.retrieveSession('non_existent_session', 'psychologist_001')
      ).rejects.toThrow('Session not found');
    });

    test('should handle non-existent session deletion', async () => {
      await expect(
        sessionStorage.deleteSession('non_existent_session', 'psychologist_001')
      ).rejects.toThrow('Session not found');
    });

    test('should handle missing encryption key', async () => {
      delete process.env.ENCRYPTION_SECRET;
      
      expect(() => new SessionStorageService())
        .toThrow('ENCRYPTION_SECRET is required for session storage');
      
      // Restore for other tests
      process.env.ENCRYPTION_SECRET = 'test-encryption-secret-32-characters-long';
    });
  });
});