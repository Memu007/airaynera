const axios = require('axios');
const config = require('../config/environment');
const logger = require('../utils/logger');
const DatabaseService = require('./DatabaseService');
const AIService = require('./AIService');
const CrisisDetectionService = require('./CrisisDetectionService');
const ResilienceService = require('./ResilienceService');

class WhatsAppService {
    constructor() {
        this.conversations = new Map();
        this.startCleanupTimer();
    }

    async processMessage(phoneNumber, message, messageType = 'text') {
        try {
            logger.medical.patientInteraction(phoneNumber, 'MESSAGE_RECEIVED', { 
                type: messageType,
                length: message.length 
            });

            const conversation = this.getConversation(phoneNumber);
            
            if (messageType === 'text') {
                return await this.handleTextMessage(conversation, message);
            } else if (messageType === 'audio') {
                return await this.handleAudioMessage(conversation, message);
            }

            return this.createResponse('Tipo de mensaje no soportado');

        } catch (error) {
            logger.error('Message processing error:', error);
            return this.createResponse('Error procesando mensaje. Intenta nuevamente.');
        }
    }

    getConversation(phoneNumber) {
        if (!this.conversations.has(phoneNumber)) {
            this.conversations.set(phoneNumber, {
                phoneNumber,
                state: 'idle',
                professionalDni: null,
                currentPatient: null,
                sessionData: {},
                lastActivity: Date.now(),
                attempts: 0
            });
        }

        const conversation = this.conversations.get(phoneNumber);
        conversation.lastActivity = Date.now();
        return conversation;
    }

    async handleTextMessage(conversation, message) {
        // Crisis detection first (always active)
        const crisisDetection = await ResilienceService.executeWithFallback(
            'crisis',
            () => CrisisDetectionService.detectCrisis(message, conversation.professionalDni),
            () => CrisisDetectionService.detectCrisis(message, conversation.professionalDni, true)
        );

        if (crisisDetection.isCrisis) {
            return this.createResponse(crisisDetection.response, [], true);
        }

        // Route to appropriate handler based on state
        switch (conversation.state) {
            case 'idle':
                return this.handleIdleState(conversation, message);
            case 'awaiting_pin':
                return await this.handlePinInput(conversation, message);
            case 'main_menu':
                return this.handleMainMenu(conversation, message);
            case 'patient_registration':
                return await this.handlePatientRegistration(conversation, message);
            case 'patient_selection':
                return await this.handlePatientSelection(conversation, message);
            case 'session_creation':
                return await this.handleSessionCreation(conversation, message);
            case 'history_navigation':
                return await this.handleHistoryNavigation(conversation, message);
            default:
                // Recovery mode
                const recovery = ResilienceService.recoverConversation(message);
                conversation.state = recovery.newState;
                return this.createResponse(recovery.response);
        }
    }

    handleIdleState(conversation, message) {
        const dniValidation = require('./SecurityService').validateInput(message, 'dni');
        
        if (dniValidation.valid) {
            conversation.professionalDni = dniValidation.sanitized;
            conversation.state = 'awaiting_pin';
            conversation.attempts = 0;
            
            return this.createResponse(
                `👋 Hola! Soy AIRA, tu asistente médico.\n\n🔐 Ingresá tu PIN de 4 dígitos para continuar:`,
                ['🔄 Reintentar', '❓ Ayuda']
            );
        }

        return this.createResponse(
            `🌱 **AIRA Bot - Asistente Médico**\n\n` +
            `Para comenzar, enviá tu **DNI** (solo números):\n\n` +
            `📋 Ejemplo: 12345678\n\n` +
            `🔒 Tu información está protegida con encriptación médica.`,
            ['❓ Ayuda', '📞 Soporte']
        );
    }

    async handlePinInput(conversation, message) {
        const pinValidation = require('./SecurityService').validateInput(message, 'pin');
        
        if (!pinValidation.valid) {
            conversation.attempts++;
            if (conversation.attempts >= 3) {
                conversation.state = 'idle';
                return this.createResponse(
                    '🚫 Demasiados intentos fallidos. Comenzá nuevamente con tu DNI.',
                    ['🔄 Reiniciar']
                );
            }
            
            return this.createResponse(
                `❌ PIN inválido. Debe ser de 4 dígitos.\n\nIntentos restantes: ${3 - conversation.attempts}`,
                ['🔄 Reintentar']
            );
        }

        // Authenticate with database
        const authResult = await DatabaseService.authenticateProfessional(
            conversation.professionalDni, 
            pinValidation.sanitized
        );

        if (authResult.success) {
            conversation.state = 'main_menu';
            conversation.professional = authResult.professional;
            
            return this.createResponse(
                `✅ **Bienvenido/a Dr/a. ${authResult.professional.nombre}**\n\n` +
                `🏥 Especialidad: ${authResult.professional.especialidad}\n` +
                `📋 Matrícula: ${authResult.professional.matricula}\n\n` +
                `¿En qué te ayudo hoy?`,
                [
                    '👥 Gestionar pacientes',
                    '📝 Nueva sesión',
                    '📋 Ver historial',
                    '📊 Estadísticas',
                    '❓ Ayuda'
                ]
            );
        } else {
            conversation.attempts++;
            if (conversation.attempts >= 3) {
                conversation.state = 'idle';
                return this.createResponse(
                    '🚫 Demasiados intentos fallidos. Comenzá nuevamente.',
                    ['🔄 Reiniciar']
                );
            }
            
            return this.createResponse(
                `❌ ${authResult.error}\n\nIntentos restantes: ${3 - conversation.attempts}`,
                ['🔄 Reintentar']
            );
        }
    }

    handleMainMenu(conversation, message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('paciente') || lowerMessage.includes('gestionar')) {
            return this.showPatientManagement(conversation);
        } else if (lowerMessage.includes('sesión') || lowerMessage.includes('nueva')) {
            return this.showPatientSelection(conversation);
        } else if (lowerMessage.includes('historial') || lowerMessage.includes('ver')) {
            return this.showHistoryOptions(conversation);
        } else if (lowerMessage.includes('estadística') || lowerMessage.includes('stats')) {
            return this.showStatistics(conversation);
        } else if (lowerMessage.includes('ayuda')) {
            return this.showHelp(conversation);
        }

        return this.createResponse(
            '🤔 No entendí tu solicitud. Seleccioná una opción:',
            [
                '👥 Gestionar pacientes',
                '📝 Nueva sesión',
                '📋 Ver historial',
                '📊 Estadísticas',
                '❓ Ayuda'
            ]
        );
    }

    showPatientManagement(conversation) {
        conversation.state = 'patient_registration';
        conversation.sessionData = { step: 'menu' };
        
        return this.createResponse(
            '👥 **Gestión de Pacientes**\n\n¿Qué querés hacer?',
            [
                '➕ Registrar nuevo paciente',
                '📋 Ver lista de pacientes',
                '🔙 Volver al menú'
            ]
        );
    }

    async showPatientSelection(conversation) {
        const patientsResult = await DatabaseService.getPatients(conversation.professionalDni);
        
        if (!patientsResult.success) {
            return this.createResponse(
                '❌ Error al cargar pacientes. Intenta nuevamente.',
                ['🔄 Reintentar', '🔙 Volver']
            );
        }

        if (patientsResult.patients.length === 0) {
            return this.createResponse(
                '📋 No tenés pacientes registrados.\n\n¿Querés registrar uno nuevo?',
                ['➕ Registrar paciente', '🔙 Volver al menú']
            );
        }

        conversation.state = 'patient_selection';
        conversation.sessionData = { patients: patientsResult.patients };

        const patientList = patientsResult.patients
            .map((p, i) => `${i + 1}. ${p.nombre} (${p.dni})`)
            .join('\n');

        return this.createResponse(
            `📋 **Seleccionar Paciente para Sesión**\n\n${patientList}\n\nEnviá el número del paciente:`,
            ['🔙 Volver al menú']
        );
    }

    async handlePatientRegistration(conversation, message) {
        const { step } = conversation.sessionData;
        
        if (step === 'menu') {
            if (message.toLowerCase().includes('registrar') || message.toLowerCase().includes('nuevo')) {
                conversation.sessionData.step = 'nombre';
                return this.createResponse(
                    '➕ **Registro de Nuevo Paciente**\n\n📝 Enviá el **nombre completo** del paciente:'
                );
            } else if (message.toLowerCase().includes('lista') || message.toLowerCase().includes('ver')) {
                return await this.showPatientList(conversation);
            } else if (message.toLowerCase().includes('volver')) {
                conversation.state = 'main_menu';
                return this.handleMainMenu(conversation, '');
            }
        }

        // Handle patient registration steps
        return await this.processPatientRegistrationStep(conversation, message);
    }

    async processPatientRegistrationStep(conversation, message) {
        const { step } = conversation.sessionData;
        
        switch (step) {
            case 'nombre':
                conversation.sessionData.nombre = message.trim();
                conversation.sessionData.step = 'dni';
                return this.createResponse('📋 Ahora enviá el **DNI** del paciente (solo números):');
                
            case 'dni':
                const dniValidation = require('./SecurityService').validateInput(message, 'dni');
                if (!dniValidation.valid) {
                    return this.createResponse('❌ DNI inválido. Debe tener 7-8 dígitos. Intenta nuevamente:');
                }
                conversation.sessionData.dni = dniValidation.sanitized;
                conversation.sessionData.step = 'obra_social';
                return this.createResponse('🏥 Enviá la **obra social** del paciente:');
                
            case 'obra_social':
                conversation.sessionData.obra_social = message.trim();
                conversation.sessionData.step = 'telefono';
                return this.createResponse('📞 Por último, enviá el **teléfono** del paciente:');
                
            case 'telefono':
                const phoneValidation = require('./SecurityService').validateInput(message, 'phone');
                if (!phoneValidation.valid) {
                    return this.createResponse('❌ Teléfono inválido. Intenta nuevamente:');
                }
                
                conversation.sessionData.telefono = phoneValidation.sanitized;
                
                // Register patient
                const result = await DatabaseService.registerPatient(
                    conversation.professionalDni,
                    conversation.sessionData
                );
                
                if (result.success) {
                    conversation.state = 'main_menu';
                    conversation.sessionData = {};
                    
                    return this.createResponse(
                        `✅ **Paciente registrado exitosamente**\n\n` +
                        `👤 ${result.patient.nombre}\n` +
                        `📋 DNI: ${result.patient.dni}\n\n` +
                        `¿Qué querés hacer ahora?`,
                        [
                            '📝 Crear sesión para este paciente',
                            '👥 Gestionar más pacientes',
                            '🔙 Volver al menú'
                        ]
                    );
                } else {
                    return this.createResponse(
                        `❌ Error al registrar paciente: ${result.error}`,
                        ['🔄 Reintentar', '🔙 Volver al menú']
                    );
                }
        }
    }

    async handlePatientSelection(conversation, message) {
        const patientIndex = parseInt(message) - 1;
        const { patients } = conversation.sessionData;
        
        if (isNaN(patientIndex) || patientIndex < 0 || patientIndex >= patients.length) {
            return this.createResponse(
                '❌ Número inválido. Seleccioná un paciente de la lista:',
                ['🔙 Volver al menú']
            );
        }
        
        const selectedPatient = patients[patientIndex];
        conversation.currentPatient = selectedPatient;
        conversation.state = 'session_creation';
        conversation.sessionData = { step: 'observaciones' };
        
        return this.createResponse(
            `📝 **Nueva Sesión - ${selectedPatient.nombre}**\n\n` +
            `Escribí las **observaciones de la sesión**:\n\n` +
            `💡 Incluí síntomas, comportamientos, técnicas aplicadas, evolución, etc.`
        );
    }

    async handleSessionCreation(conversation, message) {
        if (conversation.sessionData.step === 'observaciones') {
            const observaciones = message.trim();
            
            if (observaciones.length < 20) {
                return this.createResponse(
                    '📝 Las observaciones son muy breves. Por favor, proporcioná más detalles sobre la sesión:'
                );
            }
            
            // Process with AI
            const aiResult = await ResilienceService.executeWithFallback(
                'ai',
                () => AIService.processSessionWithAI(observaciones),
                () => ({
                    success: false,
                    summary: AIService.getFallbackSummary(),
                    moodScore: AIService.getFallbackMood(),
                    aiProcessed: false
                })
            );
            
            // Prepare session data
            const sessionData = {
                patient_id: conversation.currentPatient.id,
                patient_name: conversation.currentPatient.nombre,
                observaciones,
                resumen: aiResult.summary,
                mood_score: aiResult.moodScore,
                session_type: 'regular',
                duration_minutes: null // Could be added later
            };
            
            // Save session
            const saveResult = await ResilienceService.executeWithFallback(
                'database',
                () => DatabaseService.registerSession(conversation.professionalDni, sessionData),
                () => {
                    const sessionId = ResilienceService.bufferSession({
                        professionalDni: conversation.professionalDni,
                        ...sessionData
                    });
                    return { success: true, sessionId, buffered: true };
                }
            );
            
            if (saveResult.success) {
                conversation.state = 'main_menu';
                conversation.sessionData = {};
                
                const statusMessage = saveResult.buffered ? 
                    '⏳ Sesión guardada temporalmente (se sincronizará automáticamente)' :
                    '✅ Sesión guardada exitosamente';
                
                return this.createResponse(
                    `${statusMessage}\n\n` +
                    `📊 **Resumen de la Sesión:**\n` +
                    `👤 Paciente: ${conversation.currentPatient.nombre}\n` +
                    `😊 Estado emocional: ${this.getMoodEmoji(aiResult.moodScore)} (${aiResult.moodScore}/5)\n` +
                    `🤖 IA: ${aiResult.aiProcessed ? 'Procesado' : 'Modo fallback'}\n\n` +
                    `**Resumen:**\n${aiResult.summary}\n\n` +
                    `¿Qué querés hacer ahora?`,
                    [
                        '📝 Nueva sesión',
                        '📋 Ver historial',
                        '🔙 Menú principal'
                    ]
                );
            } else {
                return this.createResponse(
                    `❌ Error al guardar sesión: ${saveResult.error}`,
                    ['🔄 Reintentar', '🔙 Volver al menú']
                );
            }
        }
    }

    getMoodEmoji(score) {
        const emojis = {
            1: '😰',
            2: '😔',
            3: '😐',
            4: '😊',
            5: '😄'
        };
        return emojis[score] || '😐';
    }

    async handleAudioMessage(conversation, audioData) {
        // For now, return a message indicating audio is not yet supported
        return this.createResponse(
            '🎤 Los mensajes de audio estarán disponibles próximamente.\n\n' +
            'Por favor, enviá tu mensaje como texto.'
        );
    }

    showHistoryOptions(conversation) {
        conversation.state = 'history_navigation';
        conversation.sessionData = { step: 'options' };
        
        return this.createResponse(
            '📋 **Historial de Sesiones**\n\n¿Qué querés ver?',
            [
                '📅 Últimas 10 sesiones',
                '🚨 Solo crisis detectadas',
                '👤 Por paciente específico',
                '🔙 Volver al menú'
            ]
        );
    }

    async handleHistoryNavigation(conversation, message) {
        const lowerMessage = message.toLowerCase();
        
        if (lowerMessage.includes('últimas') || lowerMessage.includes('10')) {
            return await this.showRecentSessions(conversation);
        } else if (lowerMessage.includes('crisis')) {
            return await this.showCrisisSessions(conversation);
        } else if (lowerMessage.includes('paciente')) {
            return await this.showPatientSelection(conversation);
        } else if (lowerMessage.includes('volver')) {
            conversation.state = 'main_menu';
            return this.handleMainMenu(conversation, '');
        }
        
        return this.showHistoryOptions(conversation);
    }

    async showRecentSessions(conversation) {
        const sessionsResult = await DatabaseService.getSessions(
            conversation.professionalDni,
            { limit: 10 }
        );
        
        if (!sessionsResult.success || sessionsResult.sessions.length === 0) {
            return this.createResponse(
                '📋 No hay sesiones registradas.',
                ['🔙 Volver al menú']
            );
        }
        
        const sessionsList = this.formatSessionsHistory(sessionsResult.sessions);
        
        return this.createResponse(
            `📅 **Últimas 10 Sesiones**\n\n${sessionsList}`,
            ['🔙 Volver al menú', '📊 Ver estadísticas']
        );
    }

    async showCrisisSessions(conversation) {
        const sessionsResult = await DatabaseService.getSessions(
            conversation.professionalDni,
            { crisis_only: true, limit: 20 }
        );
        
        if (!sessionsResult.success || sessionsResult.sessions.length === 0) {
            return this.createResponse(
                '✅ No hay crisis detectadas en el historial.',
                ['🔙 Volver al menú']
            );
        }
        
        const sessionsList = this.formatSessionsHistory(sessionsResult.sessions);
        
        return this.createResponse(
            `🚨 **Sesiones con Crisis Detectadas**\n\n${sessionsList}`,
            ['🔙 Volver al menú', '📞 Contactar supervisor']
        );
    }

    formatSessionsHistory(sessions) {
        return sessions.map(session => {
            const date = new Date(session.created_at.seconds * 1000).toLocaleDateString('es-AR');
            const moodEmoji = this.getMoodEmoji(session.mood_score);
            const crisisFlag = session.crisis_detected ? '🚨' : '';
            
            return `${crisisFlag}${date} - ${moodEmoji} (${session.mood_score}/5)\n` +
                   `${session.resumen.substring(0, 100)}...`;
        }).join('\n\n');
    }

    async showStatistics(conversation) {
        const stats = await DatabaseService.getStats(conversation.professionalDni);
        
        if (!stats) {
            return this.createResponse(
                '❌ Error al cargar estadísticas.',
                ['🔙 Volver al menú']
            );
        }
        
        return this.createResponse(
            `📊 **Estadísticas**\n\n` +
            `👥 Pacientes registrados: ${stats.total_patients}\n` +
            `📝 Sesiones totales: ${stats.total_sessions}\n` +
            `🚨 Sesiones con crisis: ${stats.crisis_sessions}\n` +
            `📈 Tasa de crisis: ${stats.crisis_rate}%\n\n` +
            `🔄 Última actualización: ${new Date().toLocaleString('es-AR')}`,
            ['🔙 Volver al menú', '📋 Ver historial']
        );
    }

    showHelp(conversation) {
        return this.createResponse(
            `❓ **Ayuda - AIRA Bot**\n\n` +
            `🔐 **Seguridad:** Toda tu información está encriptada\n` +
            `🚨 **Crisis:** Detección automática de situaciones de riesgo\n` +
            `🤖 **IA:** Resúmenes automáticos con Google Gemini\n\n` +
            `**Comandos principales:**\n` +
            `• Enviá tu DNI para iniciar\n` +
            `• Usá los botones de respuesta rápida\n` +
            `• Escribí "menú" para volver al inicio\n\n` +
            `📞 **Soporte:** soporte@airabot.com`,
            ['🔙 Volver al menú', '📞 Contactar soporte']
        );
    }

    createResponse(text, quickReplies = [], isUrgent = false) {
        return {
            text,
            quickReplies,
            isUrgent,
            timestamp: new Date()
        };
    }

    startCleanupTimer() {
        // Clean up inactive conversations every 30 minutes
        setInterval(() => {
            const now = Date.now();
            const timeout = config.SESSION.TIMEOUT_MS;
            
            for (const [phoneNumber, conversation] of this.conversations.entries()) {
                if (now - conversation.lastActivity > timeout) {
                    this.conversations.delete(phoneNumber);
                    logger.info(`Cleaned up inactive conversation: ${phoneNumber}`);
                }
            }
        }, config.SESSION.CLEANUP_INTERVAL_MS);
    }

    // Get service statistics
    getStats() {
        return {
            active_conversations: this.conversations.size,
            conversations_by_state: this.getConversationsByState()
        };
    }

    getConversationsByState() {
        const states = {};
        for (const conversation of this.conversations.values()) {
            states[conversation.state] = (states[conversation.state] || 0) + 1;
        }
        return states;
    }
}

// Function to send WhatsApp message (external API call)
async function sendWhatsAppMessage(phoneNumber, response) {
    try {
        const payload = {
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'text',
            text: {
                body: response.text
            }
        };

        // Add quick replies if present
        if (response.quickReplies && response.quickReplies.length > 0) {
            payload.type = 'interactive';
            payload.interactive = {
                type: 'button',
                body: {
                    text: response.text
                },
                action: {
                    buttons: response.quickReplies.slice(0, 3).map((reply, index) => ({
                        type: 'reply',
                        reply: {
                            id: `btn_${index}`,
                            title: reply.substring(0, 20)
                        }
                    }))
                }
            };
            delete payload.text;
        }

        const apiResponse = await axios.post(
            `${config.WHATSAPP.API_URL}/${config.WHATSAPP.PHONE_ID}/messages`,
            payload,
            {
                headers: {
                    'Authorization': `Bearer ${config.WHATSAPP.TOKEN}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        logger.info('WhatsApp message sent successfully', { 
            to: phoneNumber,
            message_id: apiResponse.data.messages?.[0]?.id 
        });

        return { success: true, messageId: apiResponse.data.messages?.[0]?.id };

    } catch (error) {
        logger.error('WhatsApp send error:', error.response?.data || error.message);
        return { success: false, error: error.message };
    }
}

module.exports = {
    WhatsAppService: new WhatsAppService(),
    sendWhatsAppMessage
}; 