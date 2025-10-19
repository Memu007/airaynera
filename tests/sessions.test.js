// Mock SessionsService para testing
class MockSessionsService {
  constructor() {
    this.sessions = new Map();
  }

  async create(sessionData) {
    if (!sessionData.patientId || !sessionData.professionalId || !sessionData.date || !sessionData.time) {
      throw new Error('Campos requeridos: patientId, professionalId, date, time');
    }

    const sessionId = `session_${Date.now()}_${Math.random()}`; // Make ID more unique
    const session = {
      id: sessionId,
      patientId: sessionData.patientId,
      professionalId: sessionData.professionalId,
      date: sessionData.date,
      time: sessionData.time,
      duration: sessionData.duration || 60,
      notes: sessionData.notes || '',
      type: sessionData.type || 'individual',
      status: sessionData.status || 'scheduled',
      createdAt: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);

    return {
      success: true,
      session: session
    };
  }

  async getByPatient(patientId) {
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.patientId === patientId)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    return {
      success: true,
      sessions: sessions
    };
  }

  async getById(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sesión no encontrada');
    }

    return {
      success: true,
      session: session
    };
  }

  async update(sessionId, updateData) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Sesión no encontrada');
    }

    const updatedSession = {
      ...session,
      ...updateData,
      id: sessionId, // Preserve ID
      updatedAt: new Date().toISOString()
    };

    this.sessions.set(sessionId, updatedSession);

    return {
      success: true,
      session: updatedSession
    };
  }

  async getStatistics(patientId) {
    const patientSessions = Array.from(this.sessions.values())
      .filter(s => s.patientId === patientId);

    const stats = {
      total: patientSessions.length,
      completed: patientSessions.filter(s => s.status === 'completed').length,
      scheduled: patientSessions.filter(s => s.status === 'scheduled').length,
      cancelled: patientSessions.filter(s => s.status === 'cancelled').length,
      totalDuration: patientSessions.reduce((sum, s) => sum + (s.duration || 0), 0)
    };

    return {
      success: true,
      statistics: stats
    };
  }

  async checkSchedulingConflict(sessionData) {
    const conflicts = Array.from(this.sessions.values())
      .filter(s => 
        s.professionalId === sessionData.professionalId &&
        s.date === sessionData.date &&
        s.time === sessionData.time &&
        s.status !== 'cancelled'
      );

    return conflicts.length > 0;
  }
}

describe('Sessions Service Tests', () => {
  let sessionsService;

  beforeEach(() => {
    sessionsService = new MockSessionsService();
    jest.clearAllMocks();
  });

  describe('Create Session', () => {
    test('should create session successfully', async () => {
      const sessionData = {
        patientId: 'patient-123',
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00',
        duration: 60,
        notes: 'Primera sesión de terapia',
        type: 'individual',
        status: 'scheduled'
      };

      const result = await sessionsService.create(sessionData);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('session');
      expect(result.session).toHaveProperty('id');
      expect(result.session.patientId).toBe(sessionData.patientId);
      expect(result.session.professionalId).toBe(sessionData.professionalId);
    });

    test('should validate required fields', async () => {
      const incompleteData = {
        patientId: 'patient-123'
        // missing professionalId, date, time
      };

      await expect(sessionsService.create(incompleteData))
        .rejects.toThrow('Campos requeridos: patientId, professionalId, date, time');
    });

    test('should set default values for optional fields', async () => {
      const minimalData = {
        patientId: 'patient-123',
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00'
      };

      const result = await sessionsService.create(minimalData);

      expect(result.session.duration).toBe(60); // default duration
      expect(result.session.type).toBe('individual'); // default type
      expect(result.session.status).toBe('scheduled'); // default status
      expect(result.session.notes).toBe(''); // default notes
    });

    test('should preserve provided optional values', async () => {
      const sessionData = {
        patientId: 'patient-123',
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00',
        duration: 90,
        type: 'group',
        status: 'confirmed'
      };

      const result = await sessionsService.create(sessionData);

      expect(result.session.duration).toBe(90);
      expect(result.session.type).toBe('group');
      expect(result.session.status).toBe('confirmed');
    });
  });

  describe('Get Sessions', () => {
    beforeEach(async () => {
      // Crear sesiones de prueba
      await sessionsService.create({
        patientId: 'patient-123',
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00',
        notes: 'Primera sesión'
      });

      await sessionsService.create({
        patientId: 'patient-123',
        professionalId: 'prof-456',
        date: '2024-01-22',
        time: '10:00',
        notes: 'Segunda sesión'
      });

      await sessionsService.create({
        patientId: 'patient-456',
        professionalId: 'prof-456',
        date: '2024-01-16',
        time: '11:00',
        notes: 'Sesión otro paciente'
      });
    });

    test('should get sessions by patient ID', async () => {
      const result = await sessionsService.getByPatient('patient-123');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('sessions');
      expect(result.sessions).toHaveLength(2);
      expect(result.sessions.every(s => s.patientId === 'patient-123')).toBe(true);
    });

    test('should sort sessions by date (newest first)', async () => {
      const result = await sessionsService.getByPatient('patient-123');

      expect(result.sessions[0].date).toBe('2024-01-22'); // More recent
      expect(result.sessions[1].date).toBe('2024-01-15'); // Older
    });

    test('should get session by ID', async () => {
      const createResult = await sessionsService.create({
        patientId: 'patient-789',
        professionalId: 'prof-456',
        date: '2024-01-20',
        time: '14:00',
        notes: 'Sesión específica'
      });

      const result = await sessionsService.getById(createResult.session.id);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('session');
      expect(result.session.id).toBe(createResult.session.id);
      expect(result.session.notes).toBe('Sesión específica');
    });

    test('should handle non-existent session', async () => {
      await expect(sessionsService.getById('non-existent'))
        .rejects.toThrow('Sesión no encontrada');
    });

    test('should return empty array for patient with no sessions', async () => {
      const result = await sessionsService.getByPatient('patient-no-sessions');

      expect(result).toHaveProperty('success', true);
      expect(result.sessions).toHaveLength(0);
    });
  });

  describe('Update Session', () => {
    let sessionId;

    beforeEach(async () => {
      const createResult = await sessionsService.create({
        patientId: 'patient-123',
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00',
        notes: 'Notas originales'
      });
      sessionId = createResult.session.id;
    });

    test('should update session successfully', async () => {
      const updateData = {
        notes: 'Notas actualizadas',
        status: 'completed',
        duration: 90
      };

      const result = await sessionsService.update(sessionId, updateData);

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('session');
      expect(result.session.notes).toBe(updateData.notes);
      expect(result.session.status).toBe(updateData.status);
      expect(result.session.duration).toBe(updateData.duration);
    });

    test('should handle update of non-existent session', async () => {
      await expect(sessionsService.update('non-existent', { notes: 'Test' }))
        .rejects.toThrow('Sesión no encontrada');
    });

    test('should preserve unchanged fields', async () => {
      const updateData = { notes: 'Solo cambio las notas' };

      const result = await sessionsService.update(sessionId, updateData);

      expect(result.session.patientId).toBe('patient-123'); // Should remain unchanged
      expect(result.session.date).toBe('2024-01-15'); // Should remain unchanged
      expect(result.session.notes).toBe('Solo cambio las notas'); // Should be updated
    });

    test('should not allow ID changes', async () => {
      const updateData = { 
        id: 'new-id-attempt',
        notes: 'Trying to change ID'
      };

      const result = await sessionsService.update(sessionId, updateData);

      expect(result.session.id).toBe(sessionId); // ID should remain unchanged
    });
  });

  describe('Session Statistics', () => {
    beforeEach(async () => {
      // Crear sesiones con diferentes estados
      await sessionsService.create({
        patientId: 'patient-stats',
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00',
        status: 'completed',
        duration: 60
      });

      await sessionsService.create({
        patientId: 'patient-stats',
        professionalId: 'prof-456',
        date: '2024-01-16',
        time: '10:00',
        status: 'completed',
        duration: 90
      });

      await sessionsService.create({
        patientId: 'patient-stats',
        professionalId: 'prof-456',
        date: '2024-01-17',
        time: '10:00',
        status: 'scheduled',
        duration: 60
      });

      await sessionsService.create({
        patientId: 'patient-stats',
        professionalId: 'prof-456',
        date: '2024-01-18',
        time: '10:00',
        status: 'cancelled',
        duration: 60
      });
    });

    test('should get session statistics for patient', async () => {
      const result = await sessionsService.getStatistics('patient-stats');

      expect(result).toHaveProperty('success', true);
      expect(result).toHaveProperty('statistics');
      expect(result.statistics.total).toBe(4);
      expect(result.statistics.completed).toBe(2);
      expect(result.statistics.scheduled).toBe(1);
      expect(result.statistics.cancelled).toBe(1);
      expect(result.statistics.totalDuration).toBe(270); // 60+90+60+60
    });

    test('should handle patient with no sessions', async () => {
      const result = await sessionsService.getStatistics('patient-no-sessions');

      expect(result.statistics.total).toBe(0);
      expect(result.statistics.completed).toBe(0);
      expect(result.statistics.totalDuration).toBe(0);
    });
  });

  describe('Session Scheduling', () => {
    beforeEach(async () => {
      // Crear sesión existente
      await sessionsService.create({
        patientId: 'patient-123',
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00',
        status: 'scheduled'
      });
    });

    test('should check for scheduling conflicts', async () => {
      const newSession = {
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00'
      };

      const hasConflict = await sessionsService.checkSchedulingConflict(newSession);
      expect(hasConflict).toBe(true);
    });

    test('should confirm no scheduling conflicts for different time', async () => {
      const newSession = {
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '11:00' // Different time
      };

      const hasConflict = await sessionsService.checkSchedulingConflict(newSession);
      expect(hasConflict).toBe(false);
    });

    test('should confirm no scheduling conflicts for different professional', async () => {
      const newSession = {
        professionalId: 'prof-789', // Different professional
        date: '2024-01-15',
        time: '10:00'
      };

      const hasConflict = await sessionsService.checkSchedulingConflict(newSession);
      expect(hasConflict).toBe(false);
    });

    test('should not consider cancelled sessions as conflicts', async () => {
      // Actualizar sesión existente a cancelada
      const sessions = Array.from(sessionsService.sessions.values());
      const existingSession = sessions.find(s => 
        s.professionalId === 'prof-456' && 
        s.date === '2024-01-15' && 
        s.time === '10:00'
      );
      
      if (existingSession) {
        await sessionsService.update(existingSession.id, { status: 'cancelled' });
      }

      const newSession = {
        professionalId: 'prof-456',
        date: '2024-01-15',
        time: '10:00'
      };

      const hasConflict = await sessionsService.checkSchedulingConflict(newSession);
      expect(hasConflict).toBe(false);
    });
  });

  describe('Data Integrity', () => {
    test('should generate unique session IDs', async () => {
      const session1 = await sessionsService.create({
        patientId: 'patient-1',
        professionalId: 'prof-1',
        date: '2024-01-15',
        time: '10:00'
      });

      const session2 = await sessionsService.create({
        patientId: 'patient-2',
        professionalId: 'prof-1',
        date: '2024-01-15',
        time: '11:00'
      });

      expect(session1.session.id).not.toBe(session2.session.id);
    });

    test('should maintain session count correctly', async () => {
      const initialSessions = await sessionsService.getByPatient('test-patient');
      const initialCount = initialSessions.sessions.length;

      await sessionsService.create({
        patientId: 'test-patient',
        professionalId: 'prof-1',
        date: '2024-01-15',
        time: '10:00'
      });

      const updatedSessions = await sessionsService.getByPatient('test-patient');
      expect(updatedSessions.sessions.length).toBe(initialCount + 1);
    });
  });
}); 