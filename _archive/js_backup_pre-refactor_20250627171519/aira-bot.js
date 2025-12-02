// js/aira-bot.js

class GeminiService {
    constructor() {
        // En un entorno real, aquí se inicializaría la API de Gemini
        // Para la demo, usamos un mock que simula el análisis.
        console.log("Servicio Gemini (mock) inicializado.");
    }

    async analyzeClinicalText(text) {
        console.log(`[Gemini] Analizando texto: "${text}"...`);
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500)); // Simular latencia de red

        const summary = this.generateSummary(text);
        const mood = this.analyzeMood(text);

        console.log(`[Gemini] Análisis completado.`);
        return { summary, mood };
    }

    generateSummary(text) {
        const sentences = text.split(/[.!?]+/);
        return sentences[0] || 'No se pudo generar un resumen.';
    }

    analyzeMood(text) {
        const positiveWords = ['bien', 'mejora', 'estable', 'contento', 'progreso'];
        const negativeWords = ['mal', 'dolor', 'empeora', 'triste', 'problema'];
        let score = 3;
        positiveWords.forEach(word => {
            if (text.toLowerCase().includes(word)) score = Math.min(5, score + 1);
        });
        negativeWords.forEach(word => {
            if (text.toLowerCase().includes(word)) score = Math.max(1, score - 1);
        });
        return score;
    }
}

class AIRABot {
    constructor(nlp) {
        if (nlp && nlp.NlpManager) {
            this.nlpManager = new nlp.NlpManager({ languages: ['es'], forceNER: true });
            this.initializeNlp();
        } else {
            console.warn('NLP.js no está cargado.');
        }
        
        this.state = 'idle';
        this.sessionData = {};
        this.currentPatient = null;
        this.isProcessing = false;
        this.isRecording = false;
        this.debugMode = false;
        this.pendingAction = null;
        
        this.geminiService = new GeminiService();
        
        this.patients = [
            { id: 1, nombre: 'Juan Pérez', dni: '12345678', obra_social: 'OSDE', telefono: '1122334455' },
            { id: 2, nombre: 'María Gómez', dni: '23456789', obra_social: 'Swiss Medical', telefono: '1155667788' },
            { id: 3, nombre: 'María Fernández', dni: '34567890', obra_social: 'Medicus', telefono: '1156789012' }
        ];
        
        this.sessions = this.generateDemoSessions();
        this.stats = {
            messagesProcessed: 0,
            patientsRegistered: this.patients.length,
            sessionsCreated: this.sessions.length,
            errors: 0
        };
        
        this.currentFilteredSessions = null;
        this.historyPage = 0;
        this.historyPageSize = 5;
        
        this.updateTime();
        setInterval(() => this.updateTime(), 60000);
        
        this.log('Bot inicializado correctamente');
        console.log('Servicio Gemini inicializado para AIRA Bot');
    }

    initializeNlp() {
        this.log('Inicializando y entrenando modelo NLP...');
        
        // 1. Saludos
        this.nlpManager.addDocument('es', 'hola', 'saludo.inicio');
        this.nlpManager.addDocument('es', 'buen día', 'saludo.inicio');
        this.nlpManager.addDocument('es', 'buenas tardes', 'saludo.inicio');
        this.nlpManager.addAnswer('es', 'saludo.inicio', '¡Hola! 👋 Soy AIRA Bot. ¿Cómo puedo ayudarte?');

        // 2. Despedidas
        this.nlpManager.addDocument('es', 'adiós', 'despedida.fin');
        this.nlpManager.addDocument('es', 'chau', 'despedida.fin');
        this.nlpManager.addAnswer('es', 'despedida.fin', '¡Hasta luego! Que tengas un buen día.');

        // 3. Acciones principales
        this.nlpManager.addDocument('es', 'quiero registrar un paciente', 'accion.registrar_paciente');
        this.nlpManager.addDocument('es', 'nuevo paciente', 'accion.registrar_paciente');
        this.nlpManager.addDocument('es', 'iniciar una nueva sesión', 'accion.nueva_sesion');
        this.nlpManager.addDocument('es', 'ver el historial', 'accion.ver_historial');

        // Entrenar y guardar
        (async () => {
            await this.nlpManager.train();
            this.nlpManager.save();
            this.log('Modelo NLP entrenado y listo.');
        })();
    }

    // NOTE: All other methods from the AIRABot class would be here.
    // Due to brevity, they are omitted, but they are part of the class.
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIRABot, GeminiService };
}
