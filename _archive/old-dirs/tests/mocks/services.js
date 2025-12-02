// Mock AuthService
class MockAuthService {
  constructor() {
    this.users = new Map();
  }
  
  async register(userData) {
    if (this.users.has(userData.email)) {
      throw new Error('User already exists');
    }
    const user = { id: `user_${Date.now()}`, ...userData };
    this.users.set(userData.email, user);
    return { success: true, user };
  }
  
  async login(email, password) {
    const user = this.users.get(email);
    if (user && user.password === password) {
      return { success: true, token: `token_${user.id}`, user };
    }
    throw new Error('Invalid credentials');
  }

  verifyToken(token) {
    if (token.startsWith('token_')) {
      const userId = token.split('_')[1];
      const user = Array.from(this.users.values()).find(u => u.id === userId);
      if (user) return user;
    }
    throw new Error('Invalid token');
  }

  async getUserProfile(userId) {
    const user = Array.from(this.users.values()).find(u => u.id === userId);
    if (user) return { success: true, user };
    throw new Error('User not found');
  }
}

// Mock PatientsService
class MockPatientsService {
  constructor() {
    this.patients = new Map();
  }
  
  async create(patientData) {
    const patient = { id: `patient_${Date.now()}`, ...patientData };
    this.patients.set(patient.id, patient);
    return { success: true, patient };
  }
  
  async getAll() {
    return { success: true, patients: Array.from(this.patients.values()) };
  }
  
  async getById(id) {
    const patient = this.patients.get(id);
    if (patient) return { success: true, patient };
    throw new Error('Patient not found');
  }
  
  async update(id, data) {
    const patient = this.patients.get(id);
    if (patient) {
      const updated = { ...patient, ...data };
      this.patients.set(id, updated);
      return { success: true, patient: updated };
    }
    throw new Error('Patient not found');
  }
}

// Mock SessionsService
class MockSessionsService {
  constructor() {
    this.sessions = new Map();
  }

  async create(sessionData) {
    const session = { id: `session_${Date.now()}`, ...sessionData };
    this.sessions.set(session.id, session);
    return { success: true, session };
  }
  
  async getByPatient(patientId) {
    const sessions = Array.from(this.sessions.values()).filter(s => s.patientId === patientId);
    return { success: true, sessions };
  }
  
  async getById(id) {
    const session = this.sessions.get(id);
    if (session) return { success: true, session };
    throw new Error('Session not found');
  }
  
  async update(id, data) {
    const session = this.sessions.get(id);
    if (session) {
      const updated = { ...session, ...data };
      this.sessions.set(id, updated);
      return { success: true, session: updated };
    }
    throw new Error('Session not found');
  }
}

module.exports = {
  MockAuthService,
  MockPatientsService,
  MockSessionsService
}; 