// Bot de WhatsApp simplificado que delega lógica a Gemini 1.5
const GeminiService = require('./gemini-service-v2');
const DatabaseService = require('./database-service'); // Asumimos que existe
const SecurityManager = require('./security-manager'); // Asumimos que existe

class SimpleWhatsAppBot {
  constructor() {
    console.log('Inicializando SimpleWhatsAppBot');
    this.geminiService = new GeminiService();
    this.dbService = new DatabaseService();
    this.securityManager = new SecurityManager();
    
    // Estados del bot
    const STATES = {
      IDLE: 'idle',                   // Menú principal
      MANAGING_PATIENTS: 'patients',  // Gestión de pacientes
      IN_SESSION: 'session',          // Sesión activa
      VIEWING_HISTORY: 'history'      // Consulta de historial
    };

    // Seguimiento de conversaciones
    this.conversations = new Map();
    this.STATES = STATES;
  }

  // Inicializa o recupera una conversación por número de teléfono
  getConversation(phoneNumber) {
    if (!this.conversations.has(phoneNumber)) {
      this.conversations.set(phoneNumber, {
        phoneNumber,
        state: this.STATES.IDLE,
        history: [],
        lastActivity: Date.now(),
        professional: null,
        selectedPatient: null
      });
    }
    return this.conversations.get(phoneNumber);
  }

  // Procesa un mensaje entrante de WhatsApp
  async processMessage(phone, message) {
    const conversation = this.getConversation(phone);
    
    // Solo manejar texto (eliminar chequeo de crisis)
    if (message.type !== 'text') {
      return "Solo puedo procesar mensajes de texto por ahora.";
    }

    // Router básico por estado
    switch(conversation.state) {
      case this.STATES.IDLE:
        return this.handleIdle(phone, message.text);
      case this.STATES.MANAGING_PATIENTS:
        return this.handlePatients(phone, message.text);
      case this.STATES.IN_SESSION:
        return this.handleSession(phone, message.text);
      case this.STATES.VIEWING_HISTORY:
        return this.handleHistory(phone, message.text);
      default:
        this.resetConversation(phone);
        return "Hubo un error. Volvé a empezar por favor.";
    }
  }

  // Maneja las acciones del sistema basadas en la respuesta de Gemini
  async processAction(conversation, action) {
    const { tipo, datos } = action;
    
    try {
      switch (tipo) {
        case 'AUTENTICAR':
          // Autenticar profesional
          if (datos.dni && datos.pin) {
            const isAuth = await this.securityManager.authenticateProfessional(datos.dni, datos.pin);
            if (isAuth) {
              conversation.professional = await this.dbService.getProfessionalByDni(datos.dni);
              conversation.state = this.STATES.MANAGING_PATIENTS;
            }
            return isAuth;
          }
          return false;
          
        case 'REGISTRAR_PACIENTE':
          // Registrar nuevo paciente
          if (conversation.professional && datos.dni && datos.nombre) {
            const patientId = await this.dbService.registerPatient({
              ...datos,
              professionalDni: conversation.professional.dni
            });
            return { success: true, patientId };
          }
          return { success: false, reason: 'datos_insuficientes' };
          
        case 'LISTAR_PACIENTES':
          // Obtener lista de pacientes
          if (conversation.professional) {
            return await this.dbService.getPatientsByProfessional(conversation.professional.dni);
          }
          return [];
          
        case 'CREAR_SESION':
          // Crear una nueva sesión
          if (conversation.professional && datos.paciente_id && datos.observaciones) {
            const sessionData = {
              ...datos,
              professional: conversation.professional.dni,
              timestamp: new Date().toISOString()
            };
            const sessionId = await this.dbService.createSession(sessionData);
            return { success: true, sessionId };
          }
          return { success: false, reason: 'datos_insuficientes' };
          
        case 'VER_HISTORIAL':
          // Obtener historial de sesiones
          if (conversation.professional) {
            // Filtrar según datos.filtro
            return await this.dbService.getSessions({
              professionalDni: conversation.professional.dni,
              filter: datos.filtro || 'ultimas',
              limit: datos.cantidad || 10,
              patientId: datos.paciente_id
            });
          }
          return [];
          
        default:
          console.log(`Acción no implementada: ${tipo}`);
          return null;
      }
    } catch (error) {
      console.error(`Error procesando acción ${tipo}:`, error);
      return { error: error.message };
    }
  }

  // Procesa mensajes de audio (placeholder)
  async processAudioMessage(audioUrl) {
    // En un sistema real, aquí transcribiríamos el audio
    // Por ahora devolvemos un placeholder
    return "[Contenido de audio transcrito]";
  }

  // Resetea una conversación
  resetConversation(phoneNumber) {
    this.conversations.set(phoneNumber, {
      phoneNumber,
      state: this.STATES.IDLE,
      history: [],
      lastActivity: Date.now(),
      professional: null,
      selectedPatient: null
    });
  }

  // Limpia conversaciones inactivas (para llamar periódicamente)
  cleanupInactiveConversations(maxInactiveTime = 3600000) { // 1 hora por defecto
    const now = Date.now();
    for (const [phoneNumber, conversation] of this.conversations.entries()) {
      if (now - conversation.lastActivity > maxInactiveTime) {
        this.conversations.delete(phoneNumber);
      }
    }
  }

  // Manejo de estados
  async handleIdle(phone, message) {
    // Implementar lógica para estado IDLE
  }

  async handlePatients(phone, message) {
    // Implementar lógica para estado MANAGING_PATIENTS
  }

  async handleSession(phone, message) {
    // Implementar lógica para estado IN_SESSION
  }

  async handleHistory(phone, message) {
    // Implementar lógica para estado VIEWING_HISTORY
  }
}

module.exports = SimpleWhatsAppBot;
