// AIRA - Professional Medical Panel

// ====================================================================
// SISTEMAS GLOBALES (Notificaciones, Breadcrumbs)
// ====================================================================

const breadcrumbSystem = {
    show(current, parent = 'Inicio') {
        const container = $('#breadcrumbs');
        const list = container.find('.breadcrumb');
        list.html(`<li class="breadcrumb-item"><a href="#" onclick="showSection('dashboardSection')">${parent}</a></li><li class="breadcrumb-item active">${current}</li>`);
        container.removeClass('d-none');
    },
    hide() {
        $('#breadcrumbs').addClass('d-none');
    }
};

const notificaciones = {
    mostrar: function(tipo, titulo, mensaje, duracion = 4000) {
        const id = 'notif-' + Date.now();
        const html = `
            <div class="custom-notification ${tipo}" id="${id}" role="alert" aria-live="assertive">
                <div class="notification-icon">${this.obtenerIcono(tipo)}</div>
                <div class="notification-content">
                    <h6 class="notification-title">${titulo}</h6>
                    <p class="notification-message">${mensaje}</p>
                </div>
                <button type="button" class="notification-close" aria-label="Cerrar"><i class="fas fa-times"></i></button>
                <div class="notification-progress"></div>
            </div>`;
        $('#notification-container').append(html);
        const $notif = $(`#${id}`);
        setTimeout(() => $notif.addClass('show'), 10);
        const timeoutId = setTimeout(() => this.remover(id), duracion);
        $notif.data('timeoutId', timeoutId);
        $notif.find('.notification-progress').css('animation', `progress-bar ${duracion / 1000}s linear forwards`);
    },
    exito(titulo, mensaje, duracion = 4000) { this.mostrar('success', titulo, mensaje, duracion); },
    error(titulo, mensaje, duracion = 4000) { this.mostrar('error', titulo, mensaje, duracion); },
    advertencia(titulo, mensaje, duracion = 4000) { this.mostrar('warning', titulo, mensaje, duracion); },
    info(titulo, mensaje, duracion = 4000) { this.mostrar('info', titulo, mensaje, duracion); },
    bienvenidaNuevo() { this.mostrar('welcome', '¡Bienvenido/a a AIRA!', 'Tu cuenta ha sido creada. ¡Empecemos!', 6000); },
    obtenerIcono(tipo) {
        const icons = { success: 'fa-check-circle', welcome: 'fa-check-circle', error: 'fa-times-circle', warning: 'fa-exclamation-triangle', info: 'fa-info-circle' };
        return `<i class="fas ${icons[tipo] || 'fa-info-circle'}"></i>`;
    },
    remover(id) {
        const $notif = $(`#${id}`);
        $notif.removeClass('show');
        setTimeout(() => $notif.remove(), 300);
    }
};

$('<style>').prop('type', 'text/css').html(`@keyframes progress-bar { from { width: 100%; } to { width: 0%; } }`).appendTo('head');

// ====================================================================
// ESTADO Y DATOS DE LA APLICACIÓN
// ====================================================================

let currentUser = null;
let appData = { patients: [], sessions: [] };
let isDemoMode = false;
const whatsappService = new WhatsAppService();

// Chart instances
let moodChartInstance = null;
let moodEvolutionChartInstance = null;
let topPatientsChartInstance = null;

const demoData = {
    user: { name: "Dr. Demo", isNewUser: true, email: "dr.demo@ejemplo.com", phone: "11-1234-5678", bio: "Especialista en psiquiatría con foco en terapias cognitivo-conductuales." },
    patients: [
        { id: "p1", name: "María García", dni: "11111111", insurance: "OSDE", phone: "1145678901" },
        { id: "p2", name: "Juan Pérez", dni: "22222222", insurance: "Swiss Medical", phone: "1156789012" }
    ],
    sessions: [
        { id: "s_today_1", patient_id: "p1", patient_name: "María García", summary: "Avances en terapia de exposición.", mood_assessment: 4, requires_followup: false, created_at: new Date(new Date().setHours(10, 30)), created_via: "whatsapp" },
        { id: "s_today_2", patient_id: "p2", patient_name: "Juan Pérez", summary: "Exploración de estrategias de mindfulness.", mood_assessment: 4, requires_followup: false, created_at: new Date(new Date().setHours(11, 0)), created_via: "web" }
    ]
};

// ====================================================================
// FLUJO DE AUTENTICACIÓN Y NAVEGACIÓN
// ====================================================================

function checkAuthState() {
    const savedUser = localStorage.getItem('aira-user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        return true;
    }
    return false;
}

function doLogin() {
    // Lógica de login (actualmente simulada)
    currentUser = { id: 'user123', name: 'Dr. Luscana', email: 'dr.luscana@example.com' };
    localStorage.setItem('aira-user', JSON.stringify(currentUser));
    showDashboard();
}

function doLogout() {
    currentUser = null;
    localStorage.removeItem('aira-user');
    $('#appScreen').addClass('d-none');
    $('#landingScreen').removeClass('d-none');
    notificaciones.info('Sesión cerrada', 'Has cerrado sesión correctamente.');
}

function updateBreadcrumbs() {
    const activeSection = $('.main-panel .container-fluid > div:not(.d-none)');
    if (activeSection.length > 0) {
        const sectionId = activeSection.attr('id');
        const navLink = $(`.sidebar .nav-link[onclick*="'${sectionId}'"]`);
        if (navLink.length > 0) {
            const sectionName = navLink.find('.nav-link-text').text().trim() || 'Detalle';
            const parentName = navLink.data('parent') || 'Inicio';
            breadcrumbSystem.show(sectionName, parentName);
        } else if (sectionId === 'dashboardSection') {
            breadcrumbSystem.hide();
        }
    } else {
        breadcrumbSystem.hide();
    }
}

function showSection(sectionId) {
    $('.main-panel .container-fluid > div').addClass('d-none');
    $(`#${sectionId}`).removeClass('d-none');
    $('.sidebar .nav-link').removeClass('active');
    $(`.sidebar .nav-link[onclick*="'${sectionId}'"]`).addClass('active');
    updateBreadcrumbs();
}

function showDashboard() {
    $('#landingScreen').addClass('d-none');
    $('#appScreen').removeClass('d-none');
    showSection('dashboardSection');
    if (currentUser) {
        $('#welcomeName').text(currentUser.name);
        loadDashboardData();
        initProfileSection();
    }
}

// ====================================================================
// INICIALIZACIÓN DEL DASHBOARD Y SECCIONES
// ====================================================================

function loadDashboardData() {
    appData = demoData; // Usamos datos de demo por ahora
    $('#patientCount').text(appData.patients.length);
    $('#sessionCount').text(appData.sessions.length);
    // ... más lógica de carga de datos
}

function initProfileSection() {
    if (!currentUser) return;
    $('#profileName').val(currentUser.name);
    $('#profileEmail').val(currentUser.email);
    // ... más lógica de perfil
}

// ====================================================================
// LÓGICA DEL CHAT DE WHATSAPP
// ====================================================================

function startWhatsAppDemo() {
    $('#whatsappDemoModal').modal('show');
    const chatBox = $('#whatsappDemoMessages');
    chatBox.empty();
    chatBox.append(`<div class="message bot"><div class="message-content">¡Hola! Soy AIRA. ¿Qué necesitas?</div></div>`);
}

async function handleDemoUserInput(message) {
    const chatBox = $('#whatsappDemoMessages');
    chatBox.append(`<div class="message user"><div class="message-content">${message}</div></div>`);
    chatBox.scrollTop(chatBox[0].scrollHeight);

    $('#whatsappMessageInput').prop('disabled', true);
    $('#whatsappChatForm button').prop('disabled', true);

    try {
        const testRecipientNumber = '5491112345678'; // Número de prueba
        const response = await whatsappService.sendMessage(testRecipientNumber, message);
        const botResponse = response.success ? '✅ Mensaje enviado por el servicio.' : '❌ Error al enviar el mensaje.';
        chatBox.append(`<div class="message bot"><div class="message-content">${botResponse}</div></div>`);
    } catch (error) {
        console.error('Error enviando mensaje:', error);
        chatBox.append(`<div class="message bot"><div class="message-content">❌ Ocurrió un error técnico.</div></div>`);
    } finally {
        chatBox.scrollTop(chatBox[0].scrollHeight);
        $('#whatsappMessageInput').prop('disabled', false).focus();
        $('#whatsappChatForm button').prop('disabled', false);
    }
}

// ====================================================================
// MANEJADORES DE EVENTOS (EVENT LISTENERS)
// ====================================================================

$(document).ready(function() {
    // --- Generales ---
    $(document).on('click', '.notification-close', function() {
        const notifId = $(this).parent().attr('id');
        clearTimeout($(`#${notifId}`).data('timeoutId'));
        notificaciones.remover(notifId);
    });

    // --- Navegación ---
    $('#logoutBtn').on('click', doLogout);
    $('.login-btn').on('click', () => $('#loginModal').modal('show'));

    // --- Autenticación ---
    $('#loginForm').on('submit', (e) => { e.preventDefault(); doLogin(); });

    // --- Chat de WhatsApp ---
    $('body').on('click', '[data-action="whatsapp-demo"]', startWhatsAppDemo);
    $('#whatsappChatForm').on('submit', function(e) {
        e.preventDefault();
        const message = $('#whatsappMessageInput').val();
        if (message.trim()) {
            handleDemoUserInput(message.trim());
            $('#whatsappMessageInput').val('');
        }
    });

    // --- Inicialización ---
    if (checkAuthState()) {
        showDashboard();
    } else {
        $('#landingScreen').removeClass('d-none');
    }
});
