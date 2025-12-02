// Servicio de base de datos para AIRA Bot
const dotenv = require('dotenv');
dotenv.config();

class DatabaseService {
  constructor() {
    console.log('Inicializando DatabaseService');
    
    // En implementación real, aquí inicializaríamos Firestore
    this.mockDb = {
      professionals: [
        { dni: '12345678', nombre: 'Dr. Juan Pérez', pin: '$2b$10$abcdefghijklmnopqrstuv' }
      ],
      patients: [
        { id: 'pat1', dni: '87654321', nombre: 'María García', professionalDni: '12345678', obra_social: 'OSDE', habilitado: true },
        { id: 'pat2', dni: '11223344', nombre: 'Carlos López', professionalDni: '12345678', habilitado: true }
      ],
      sessions: [],
      crisisLogs: []
    };
  }

  // Métodos para profesionales
  async getProfessionalByDni(dni) {
    // Simulación de búsqueda en DB
    return this.mockDb.professionals.find(p => p.dni === dni) || null;
  }

  async registerProfessional(data) {
    // Verificar si ya existe
    const exists = await this.getProfessionalByDni(data.dni);
    if (exists) return { error: 'Ya existe un profesional con ese DNI' };
    
    // En real, aquí insertaríamos en Firestore
    const newProfessional = { ...data };
    this.mockDb.professionals.push(newProfessional);
    
    return { success: true, dni: data.dni };
  }

  // Métodos para pacientes
  async registerPatient(patientData) {
    // Generar ID único
    const id = `pat${Date.now()}`;
    
    // Validar DNI único para este profesional
    const exists = this.mockDb.patients.find(p => 
      p.dni === patientData.dni && 
      p.professionalDni === patientData.professionalDni
    );
    
    if (exists) return { error: 'Ya existe un paciente con ese DNI para este profesional' };
    
    // Crear nuevo paciente
    const newPatient = { 
      id, 
      ...patientData,
      habilitado: true, 
      createdAt: new Date().toISOString()
    };
    
    // Guardar
    this.mockDb.patients.push(newPatient);
    
    return id;
  }

  async getPatientById(id) {
    return this.mockDb.patients.find(p => p.id === id) || null;
  }

  async getPatientsByProfessional(professionalDni, includeDisabled = false) {
    let patients = this.mockDb.patients.filter(p => p.professionalDni === professionalDni);
    if (!includeDisabled) {
      patients = patients.filter(p => p.habilitado === true);
    }
    return patients;
  }

  async updatePatientStatus(professionalDni, patientId, newStatus) {
    const patientIndex = this.mockDb.patients.findIndex(p => p.id === patientId && p.professionalDni === professionalDni);
    if (patientIndex === -1) {
      return { success: false, error: 'Paciente no encontrado o no pertenece a este profesional' };
    }
    
    // Convertir string a booleano para la base de datos mock
    let booleanStatus = newStatus;
    if (newStatus === 'activo') {
      booleanStatus = true;
    } else if (newStatus === 'inactivo') {
      booleanStatus = false;
    }
    
    this.mockDb.patients[patientIndex].habilitado = booleanStatus;
    return { success: true };
  }

  // Métodos para sesiones
  async createSession(sessionData) {
    // Validar que existe el paciente
    const patient = await this.getPatientById(sessionData.paciente_id);
    if (!patient) return { error: 'Paciente no encontrado' };
    
    // Generar ID único para la sesión
    const id = `ses${Date.now()}`;
    
    // Crear sesión
    const newSession = {
      id,
      ...sessionData,
      createdAt: new Date().toISOString()
    };
    
    // Guardar
    this.mockDb.sessions.push(newSession);
    
    return id;
  }

  async getSessions(options = {}) {
    let result = [...this.mockDb.sessions];
    
    // Filtrar por profesional
    if (options.professionalDni) {
      result = result.filter(s => s.professional === options.professionalDni);
    }
    
    // Filtrar por paciente
    if (options.patientId) {
      result = result.filter(s => s.paciente_id === options.patientId);
    }
    
    // Filtrar por fechas
    if (options.startDate) {
      const start = new Date(options.startDate);
      result = result.filter(s => new Date(s.createdAt) >= start);
    }
    
    if (options.endDate) {
      const end = new Date(options.endDate);
      result = result.filter(s => new Date(s.createdAt) <= end);
    }
    
    // Ordenar por fecha (más reciente primero)
    result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // Limitar cantidad
    if (options.limit) {
      result = result.slice(0, options.limit);
    }
    
    return result;
  }

  async getSessionById(id) {
    return this.mockDb.sessions.find(s => s.id === id) || null;
  }

  // Registro de crisis
  async logCrisis(crisisData) {
    // Añadir ID y timestamp
    const id = `crisis${Date.now()}`;
    const logEntry = {
      id,
      ...crisisData,
      timestamp: crisisData.timestamp || new Date().toISOString()
    };
    
    // Guardar
    this.mockDb.crisisLogs.push(logEntry);
    
    return id;
  }

  async getCrisisLogs(options = {}) {
    let result = [...this.mockDb.crisisLogs];
    
    // Filtrar por nivel mínimo
    if (options.minLevel) {
      result = result.filter(log => log.level >= options.minLevel);
    }
    
    // Filtrar por profesional
    if (options.professionalDni) {
      result = result.filter(log => log.professionalDni === options.professionalDni);
    }
    
    // Ordenar por timestamp (más reciente primero)
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Limitar cantidad
    if (options.limit) {
      result = result.slice(0, options.limit);
    }
    
    return result;
  }
}

module.exports = DatabaseService;
