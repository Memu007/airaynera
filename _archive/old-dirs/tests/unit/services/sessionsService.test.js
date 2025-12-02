const sessionsService = require('../../../src/services/sessionsService');
const { createMockSession } = require('../../fixtures');

// Mock the database and dependencies
jest.mock('../../../src/config/database', () => ({
  collection: jest.fn(() => ({
    doc: jest.fn(() => ({
      set: jest.fn(),
      get: jest.fn(),
      update: jest.fn(),
      delete: jest.fn()
    })),
    get: jest.fn(),
    add: jest.fn(),
    where: jest.fn(() => ({
      get: jest.fn(),
      orderBy: jest.fn(() => ({
        limit: jest.fn(() => ({
          get: jest.fn()
        }))
      }))
    }))
  }))
}));

// Mock encryption
jest.mock('../../../src/utils/encryption', () => ({
  encrypt: jest.fn((data) => `encrypted_${data}`),
  decrypt: jest.fn((data) => data.replace('encrypted_', ''))
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
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
}));

describe('SessionsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    test('should create session with valid data', async () => {
      const sessionData = createMockSession();
      const mockAdd = jest.fn().mockResolvedValue({ id: 'session-id' });
      
      require('../../../src/config/database').collection().add.mockImplementation(mockAdd);

      const result = await sessionsService.createSession(sessionData, 'user-123');
      
      expect(mockAdd).toHaveBeenCalled();
      expect(result).toHaveProperty('id');
      expect(result.id).toBe('session-id');
    });

    test('should reject session with past date', async () => {
      const sessionData = createMockSession({ date: new Date('2020-01-01') });
      
      await expect(sessionsService.createSession(sessionData, 'user-123'))
        .rejects.toThrow('Session date must be in the future');
    });

    test('should reject invalid duration', async () => {
      const sessionData = createMockSession({ duration: 0 });
      
      await expect(sessionsService.createSession(sessionData, 'user-123'))
        .rejects.toThrow('Duration must be between 15 and 240 minutes');
    });

    test('should reject missing patientId', async () => {
      const sessionData = createMockSession({ patientId: undefined });
      
      await expect(sessionsService.createSession(sessionData, 'user-123'))
        .rejects.toThrow('Patient ID and date are required');
    });
  });

  describe('getSessionById', () => {
    test('should return session by id', async () => {
      const mockSession = createMockSession();
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => mockSession
      });
      
      require('../../../src/config/database').collection().doc().get.mockImplementation(mockGet);

      const result = await sessionsService.getSessionById('session-id', 'user-123', false);
      
      expect(result).toEqual(mockSession);
    });

    test('should return null for non-existent session', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        exists: false
      });
      
      require('../../../src/config/database').collection().doc().get.mockImplementation(mockGet);

      const result = await sessionsService.getSessionById('non-existent-id', 'user-123', false);
      
      expect(result).toBeNull();
    });
  });

  describe('getSessionsByPatient', () => {
    test('should return sessions for specific patient', async () => {
      const mockSessions = [
        createMockSession({ patientId: 'patient-1' }),
        createMockSession({ patientId: 'patient-1' })
      ];
      
      const mockGet = jest.fn().mockResolvedValue({
        docs: mockSessions.map(session => ({
          id: 'session-' + Math.random(),
          data: () => session
        }))
      });
      
      require('../../../src/config/database').collection().where().get.mockImplementation(mockGet);

      const result = await sessionsService.getSessionsByPatient('patient-1', 'user-123');
      
      expect(result).toHaveLength(2);
    });

    test('should return empty array for patient with no sessions', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        docs: []
      });
      
      require('../../../src/config/database').collection().where().get.mockImplementation(mockGet);

      const result = await sessionsService.getSessionsByPatient('patient-no-sessions', 'user-123');
      
      expect(result).toEqual([]);
    });
  });

  describe('getUpcomingSessions', () => {
    test('should return upcoming sessions', async () => {
      const mockSessions = [
        createMockSession({ date: new Date('2025-12-25') }),
        createMockSession({ date: new Date('2025-12-26') })
      ];
      
      const mockGet = jest.fn().mockResolvedValue({
        docs: mockSessions.map(session => ({
          id: 'session-' + Math.random(),
          data: () => session
        }))
      });
      
      require('../../../src/config/database').collection().where().orderBy().limit().get.mockImplementation(mockGet);

      const result = await sessionsService.getUpcomingSessions(10, 'user-123');
      
      expect(result).toHaveLength(2);
    });
  });

  describe('updateSession', () => {
    test('should update session successfully', async () => {
      const updateData = { notes: 'Updated notes', status: 'completada' };
      const mockUpdate = jest.fn().mockResolvedValue();
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => createMockSession({ status: 'programada' })
      });
      
      require('../../../src/config/database').collection().doc().update.mockImplementation(mockUpdate);
      require('../../../src/config/database').collection().doc().get.mockImplementation(mockGet);

      await sessionsService.updateSession('session-id', updateData, 'user-123');
      
      expect(mockUpdate).toHaveBeenCalled();
    });

    test('should reject update for completed session', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => createMockSession({ status: 'completada' })
      });
      
      require('../../../src/config/database').collection().doc().get.mockImplementation(mockGet);

      await expect(sessionsService.updateSession('session-id', { notes: 'New notes' }, 'user-123'))
        .rejects.toThrow('Cannot update completed session');
    });
  });

  describe('cancelSession', () => {
    test('should cancel session successfully', async () => {
      const mockUpdate = jest.fn().mockResolvedValue();
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => createMockSession({ status: 'programada' })
      });
      
      require('../../../src/config/database').collection().doc().update.mockImplementation(mockUpdate);
      require('../../../src/config/database').collection().doc().get.mockImplementation(mockGet);

      await sessionsService.cancelSession('session-id', 'Patient illness', 'user-123');
      
      expect(mockUpdate).toHaveBeenCalled();
    });

    test('should reject cancellation for completed session', async () => {
      const mockGet = jest.fn().mockResolvedValue({
        exists: true,
        data: () => createMockSession({ status: 'completada' })
      });
      
      require('../../../src/config/database').collection().doc().get.mockImplementation(mockGet);

      await expect(sessionsService.cancelSession('session-id', 'Reason', 'user-123'))
        .rejects.toThrow('Cannot cancel completed session');
    });
  });

  describe('getSessionsByDateRange', () => {
    test('should return sessions within date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      const mockSessions = [
        createMockSession({ date: new Date('2025-01-15') }),
        createMockSession({ date: new Date('2025-01-20') })
      ];
      
      const mockGet = jest.fn().mockResolvedValue({
        docs: mockSessions.map(session => ({
          id: 'session-' + Math.random(),
          data: () => session
        }))
      });
      
      require('../../../src/config/database').collection().where().get.mockImplementation(mockGet);

      const result = await sessionsService.getSessionsByDateRange(startDate, endDate, 'user-123');
      
      expect(result).toHaveLength(2);
    });
  });

  describe('getSessionStats', () => {
    test('should return session statistics', async () => {
      const mockSessions = [
        createMockSession({ status: 'completada' }),
        createMockSession({ status: 'completada' }),
        createMockSession({ status: 'cancelada' }),
        createMockSession({ status: 'programada' })
      ];
      
      const mockGet = jest.fn().mockResolvedValue({
        docs: mockSessions.map(session => ({
          id: 'session-' + Math.random(),
          data: () => session
        }))
      });
      
      require('../../../src/config/database').collection().get.mockImplementation(mockGet);

      const result = await sessionsService.getSessionStats('user-123');
      
      expect(result).toEqual({
        total: 4,
        completed: 2,
        cancelled: 1,
        scheduled: 1,
        completionRate: 50
      });
    });
  });
});
