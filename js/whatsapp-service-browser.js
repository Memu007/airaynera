// WhatsApp Service - Versión compatible con navegador
// Simulación de funcionalidades para el frontend

class WhatsAppService {
    constructor() {
        this.connected = false;
        this.apiVersion = 'v18.0';
        console.log('WhatsApp Service inicializado para navegador');
    }

    // Simular configuración
    async configure() {
        console.log('WhatsApp Service configurado');
        return true;
    }

    // Simular conexión
    async connect() {
        console.log('Conectando con WhatsApp API...');
        this.connected = true;
        return true;
    }

    // Simular envío de mensaje
    async sendMessage(to, message) {
        console.log(`Enviando mensaje a ${to}: ${message}`);
        return { success: true, messageId: 'msg_' + Date.now() };
    }

    // Simular recepción de mensajes
    onMessage(callback) {
        console.log('Listener de mensajes configurado');
        // Simular mensaje de prueba después de 2 segundos
        setTimeout(() => {
            callback({
                from: '+5491123456789',
                body: 'Hola, necesito agendar una cita',
                timestamp: Date.now()
            });
        }, 2000);
    }

    // Simular transcripción de audio
    async transcribeAudio(audioData) {
        console.log('Transcribiendo audio...');
        return {
            text: 'Paciente reporta mejora en el estado de ánimo después del tratamiento.',
            confidence: 0.95
        };
    }

    // Simular análisis de sentimiento
    async analyzeSentiment(text) {
        console.log('Analizando sentimiento:', text);
        return {
            sentiment: 'positive',
            score: 0.8,
            emotions: ['joy', 'relief']
        };
    }
}

// Hacer disponible globalmente
window.WhatsAppService = WhatsAppService;

// Inicializar chat de landing page
function initLandingChat() {
    const chatBox = $('#whatsapp-chat');
    if (chatBox.length === 0) return;

    chatBox.empty();
    
    // Mensaje inicial del bot
    setTimeout(() => {
        chatBox.append(`
            <div class="message bot">
                ¡Hola! Soy AIRA, tu asistente médico inteligente. 
                ¿En qué puedo ayudarte hoy?
            </div>
        `);
        
        // Opciones rápidas
        setTimeout(() => {
            chatBox.append(`
                <div class="message bot">
                    <div class="quick-replies">
                        <button class="quick-reply" onclick="sendQuickReply('nueva_sesion')">📝 Nueva sesión</button>
                        <button class="quick-reply" onclick="sendQuickReply('nuevo_paciente')">👤 Nuevo paciente</button>
                        <button class="quick-reply" onclick="sendQuickReply('estadisticas')">📊 Estadísticas</button>
                    </div>
                </div>
            `);
            chatBox.scrollTop(chatBox[0].scrollHeight);
        }, 1000);
        
    }, 500);
}

// Manejar respuestas rápidas
function sendQuickReply(action) {
    const chatBox = $('#whatsapp-chat');
    let userMessage = '';
    let botResponse = '';
    
    switch(action) {
        case 'nueva_sesion':
            userMessage = 'Quiero registrar una nueva sesión';
            botResponse = '¡Perfecto! Para registrar una sesión, enviame un audio o texto con tus notas.';
            break;
        case 'nuevo_paciente':
            userMessage = 'Necesito agregar un nuevo paciente';
            botResponse = '¡Claro! Para agregar un paciente, decime su nombre completo, DNI y obra social.';
            break;
        case 'estadisticas':
            userMessage = 'Mostrame mis estadísticas';
            botResponse = 'Generando tus estadísticas... En el último mes, el ánimo promedio de tus pacientes subió un 15%. ¡Buen trabajo!';
            break;
    }
    
    // Mostrar mensaje del usuario
    chatBox.append(`<div class="message user">${userMessage}</div>`);
    chatBox.scrollTop(chatBox[0].scrollHeight);
    
    // Respuesta del bot después de un delay
    setTimeout(() => {
        chatBox.append(`<div class="message bot">${botResponse}</div>`);
        chatBox.scrollTop(chatBox[0].scrollHeight);
        
        // Reiniciar chat después de 4 segundos
        setTimeout(() => {
            initLandingChat();
        }, 4000);
    }, 1000);
}

// Inicializar cuando el DOM esté listo
$(document).ready(function() {
    console.log('WhatsApp Service Browser cargado');
    
    // Inicializar chat de landing si existe
    if ($('#whatsapp-chat').length > 0) {
        initLandingChat();
    }
});
