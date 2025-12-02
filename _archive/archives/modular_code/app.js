/**
 * AIRA Medical System - Core Application Module
 * Sistema modular principal para profesionales de la salud mental
 * Versión 2.0.0 - Healthcare Optimized
 */

class AIRAMedicalApp {
    constructor() {
        this.version = '2.0.0';
        this.modules = {};
        this.currentUser = null;
        this.isInitialized = false;

        // Configuración específica para healthcare
        this.config = {
            apiBaseUrl: '/api',
            timeout: 30000,
            retryAttempts: 3,
            sessionTimeout: 60 * 60 * 1000, // 1 hora para sesión médica
            autoSave: true,
            accessibility: {
                highContrast: false,
                largeText: false,
                reducedMotion: false
            }
        };

        this.init();
    }

    /**
     * Inicialización segura de la aplicación médica
     */
    async init() {
        try {
            console.log('🏥 Iniciando AIRA Medical System v' + this.version);

            // Para desarrollo: omitir verificación de autenticación y usar mock data
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🔓 Modo desarrollo detected - usando mock authentication');
                this.currentUser = {
                    id: 1,
                    name: 'Dr. Ana García',
                    email: 'ana.garcia@aira-medical.com',
                    role: 'psychologist',
                    lastName: 'García',
                    specialization: 'Psicología Clínica',
                    license: 'MP-12345'
                };
                this.isAuthenticated = true;
            } else {
                // Verificar autenticación primero
                if (!await this.verifyAuthentication()) {
                    console.warn('❌ Autenticación requerida');
                    this.redirectToLogin();
                    return;
                }
            }

            // Cargar módulos principales
            await this.loadCoreModules();

            // Inicializar UI específica para healthcare
            await this.initializeMedicalUI();

            // Configurar event listeners médicos
            this.setupMedicalEventListeners();

            // Marcar como inicializado
            this.isInitialized = true;

            console.log('✅ AIRA Medical System inicializado correctamente');

            // Mostrar notificación de bienvenida para profesionales
            this.showWelcomeNotification();

        } catch (error) {
            console.error('❌ Error crítico en inicialización:', error);

            // En desarrollo, intentar mostrar la aplicación aunque haya errores parciales
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('⚠️ Intentando mostrar aplicación parcial en modo desarrollo');
                this.isInitialized = true; // Marcar como inicializado para mostrar UI
                // Forzar mostrar la aplicación aunque algunos módulos fallen
                this.forceShowApplication();
            } else {
                this.handleCriticalError(error);
            }
        }
    }

    /**
     * Verificación de autenticación mejorada para médicos
     */
    async verifyAuthentication() {
        // En desarrollo, siempre retornar true si ya está seteado el usuario
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return this.isAuthenticated === true;
        }

        try {
            const token = localStorage.getItem('authToken');
            if (!token) return false;

            // Verificar token con backend
            const response = await fetch(`${this.config.apiBaseUrl}/auth/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                localStorage.removeItem('authToken');
                return false;
            }

            const userData = await response.json();
            this.currentUser = userData;

            // Verificar rol de profesional de la salud
            const validRoles = ['psychologist', 'psychiatrist', 'medical_professional'];
            if (!validRoles.includes(userData.role)) {
                console.error('Rol no autorizado para acceso médico:', userData.role);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error verificando autenticación:', error);
            return false;
        }
    }

    /**
     * Cargar módulos principales del sistema médico
     */
    async loadCoreModules() {
        const coreModules = [
            'UIManager',
            'PatientManager',
            'SessionManager',
            'SecurityManager',
            'NotificationManager',
            'AuditManager',
            'AccessibilityManager'
        ];

        for (const moduleName of coreModules) {
            try {
                await this.loadModule(moduleName);
                console.log(`📦 Módulo ${moduleName} cargado`);
            } catch (error) {
                console.error(`❌ Error cargando módulo ${moduleName}:`, error);
                // En desarrollo, continuar con otros módulos en lugar de fallar completamente
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    console.warn(`⚠️ Continuando sin el módulo ${moduleName} en modo desarrollo`);
                } else {
                    throw error; // En producción, fallar completamente
                }
            }
        }
    }

    /**
     * Cargar módulo individual
     */
    async loadModule(moduleName) {
        if (this.modules[moduleName]) {
            return this.modules[moduleName];
        }

        const modulePath = `/src/js/modules/${moduleName.toLowerCase()}.js`;

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = modulePath;
            script.onload = () => {
                if (window[moduleName]) {
                    this.modules[moduleName] = new window[moduleName](this);
                    resolve(this.modules[moduleName]);
                } else {
                    reject(new Error(`Módulo ${moduleName} no encontrado`));
                }
            };
            script.onerror = () => reject(new Error(`Error cargando ${modulePath}`));
            document.head.appendChild(script);
        });
    }

    /**
     * Inicializar UI específica para healthcare
     */
    async initializeMedicalUI() {
        // Aplicar configuración de accesibilidad guardada
        this.loadAccessibilitySettings();

        // Inicializar componentes médicos principales
        if (this.modules.UIManager) {
            await this.modules.UIManager.initializeMedicalInterface();
        }

        // Configurar atajos de teclado para profesionales
        this.setupMedicalKeyboardShortcuts();

        // Inicializar guardado automático para sesiones
        if (this.config.autoSave) {
            this.setupAutoSave();
        }
    }

    /**
     * Configurar event listeners para eventos médicos
     */
    setupMedicalEventListeners() {
        // Listener para cierre de sesión seguro
        document.addEventListener('logout', () => this.handleSecureLogout());

        // Listener para cambios en paciente
        document.addEventListener('patientChanged', (e) => this.handlePatientChange(e.detail));

        // Listener para inicio de sesión
        document.addEventListener('sessionStarted', (e) => this.handleSessionStart(e.detail));

        // Listener para cierre de sesión
        document.addEventListener('sessionEnded', (e) => this.handleSessionEnd(e.detail));

        // Listener para eventos de seguridad
        document.addEventListener('securityEvent', (e) => this.handleSecurityEvent(e.detail));

        // Listener para inactividad (timeout de sesión médica)
        this.setupInactivityDetection();
    }

    /**
     * Configurar detección de inactividad para sesión médica
     */
    setupInactivityDetection() {
        let inactivityTimer;

        const resetTimer = () => {
            clearTimeout(inactivityTimer);
            inactivityTimer = setTimeout(() => {
                console.warn('⏰ Sesión médica inactiva - cerrando por seguridad');
                this.handleSecureLogout();
            }, this.config.sessionTimeout);
        };

        // Eventos que resetean el timer
        ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, resetTimer, true);
        });

        resetTimer(); // Iniciar timer
    }

    /**
     * Manejar cambio de paciente
     */
    async handlePatientChange(patientData) {
        try {
            // Logging de auditoría para cambio de paciente
            if (this.modules.AuditManager) {
                await this.modules.AuditManager.logPatientAccess(this.currentUser, patientData);
            }

            // Actualizar UI con nuevo paciente
            if (this.modules.UIManager) {
                await this.modules.UIManager.updatePatientContext(patientData);
            }

            console.log(`👤 Cambio a paciente: ${patientData.name}`);
        } catch (error) {
            console.error('Error en cambio de paciente:', error);
        }
    }

    /**
     * Manejar inicio de sesión clínica
     */
    async handleSessionStart(sessionData) {
        try {
            // Auditoría de inicio de sesión
            if (this.modules.AuditManager) {
                await this.modules.AuditManager.logSessionStart(this.currentUser, sessionData);
            }

            // Configurar auto-save para esta sesión
            if (this.config.autoSave) {
                this.startSessionAutoSave(sessionData);
            }

            console.log(`🩺 Iniciada sesión con paciente ${sessionData.patientName}`);
        } catch (error) {
            console.error('Error iniciando sesión clínica:', error);
        }
    }

    /**
     * Manejar fin de sesión clínica
     */
    async handleSessionEnd(sessionData) {
        try {
            // Detener auto-save
            if (this.currentAutoSaveInterval) {
                clearInterval(this.currentAutoSaveInterval);
            }

            // Auditoría de fin de sesión
            if (this.modules.AuditManager) {
                await this.modules.AuditManager.logSessionEnd(this.currentUser, sessionData);
            }

            console.log(`✅ Finalizada sesión con paciente ${sessionData.patientName}`);
        } catch (error) {
            console.error('Error finalizando sesión clínica:', error);
        }
    }

    /**
     * Manejar eventos de seguridad
     */
    handleSecurityEvent(securityData) {
        console.warn('🔒 Evento de seguridad:', securityData);

        if (securityData.level === 'CRITICAL') {
            // Cerrar sesión inmediatamente
            this.handleSecureLogout();
        } else if (securityData.level === 'HIGH') {
            // Notificar y requerir re-autenticación
            this.showSecurityNotification(securityData);
        }
    }

    /**
     * Cerrar sesión de forma segura
     */
    async handleSecureLogout() {
        try {
            // Auditoría de cierre de sesión
            if (this.modules.AuditManager) {
                await this.modules.AuditManager.logLogout(this.currentUser);
            }

            // Limpiar datos locales
            localStorage.removeItem('authToken');
            sessionStorage.clear();

            // Notificar backend
            await fetch(`${this.config.apiBaseUrl}/auth/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('🔒 Sesión cerrada securely');

            // Redirigir a login
            window.location.href = '/demo.html';

        } catch (error) {
            console.error('Error en cierre seguro de sesión:', error);
            // Forzar redirección even si hay error
            window.location.href = '/demo.html';
        }
    }

    /**
     * Mostrar notificación de bienvenida para profesionales
     */
    showWelcomeNotification() {
        if (this.modules.NotificationManager) {
            const hour = new Date().getHours();
            let greeting = 'Buenos días';

            if (hour >= 12 && hour < 19) greeting = 'Buenas tardes';
            else if (hour >= 19) greeting = 'Buenas noches';

            this.modules.NotificationManager.show({
                type: 'success',
                title: `${greeting}, Dr. ${this.currentUser.lastName}`,
                message: 'Sistema AIRA listo para atención clínica',
                duration: 4000,
                icon: 'medical-icon'
            });
        }
    }

    /**
     * Mostrar notificación de seguridad
     */
    showSecurityNotification(securityData) {
        if (this.modules.NotificationManager) {
            this.modules.NotificationManager.show({
                type: 'warning',
                title: 'Alerta de Seguridad',
                message: securityData.message,
                duration: 10000,
                persistent: true,
                actions: [
                    {
                        label: 'Re-autenticar',
                        action: () => this.requireReAuthentication()
                    }
                ]
            });
        }
    }

    /**
     * Configurar atajos de teclado para profesionales
     */
    setupMedicalKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + K: Buscar paciente
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.triggerPatientSearch();
            }

            // Ctrl/Cmd + N: Nueva sesión
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.triggerNewSession();
            }

            // Ctrl/Cmd + S: Guardar (si hay sesión activa)
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.triggerSaveSession();
            }

            // F1: Ayuda contextual
            if (e.key === 'F1') {
                e.preventDefault();
                this.showContextualHelp();
            }
        });
    }

    /**
     * Métodos trigger para atajos
     */
    triggerPatientSearch() {
        document.dispatchEvent(new CustomEvent('openPatientSearch'));
    }

    triggerNewSession() {
        document.dispatchEvent(new CustomEvent('openNewSession'));
    }

    triggerSaveSession() {
        document.dispatchEvent(new CustomEvent('saveCurrentSession'));
    }

    showContextualHelp() {
        document.dispatchEvent(new CustomEvent('showHelp', {
            detail: { context: 'shortcuts' }
        }));
    }

    /**
     * Configuración de accesibilidad
     */
    loadAccessibilitySettings() {
        const settings = JSON.parse(localStorage.getItem('aira_accessibility') || '{}');

        Object.assign(this.config.accessibility, settings);
        this.applyAccessibilitySettings();
    }

    applyAccessibilitySettings() {
        const { accessibility } = this.config;
        const body = document.body;

        // Alto contraste
        if (accessibility.highContrast) {
            body.classList.add('high-contrast');
        }

        // Texto grande
        if (accessibility.largeText) {
            body.classList.add('large-text');
        }

        // Movimiento reducido
        if (accessibility.reducedMotion) {
            body.classList.add('reduced-motion');
        }
    }

    /**
     * Forzar mostrar aplicación aunque haya errores
     */
    forceShowApplication() {
        try {
            console.log('🔧 Forzando visualización de la aplicación');

            // Ocultar pantalla de carga
            const loadingScreen = document.getElementById('loading-screen');
            if (loadingScreen) {
                loadingScreen.style.display = 'none';
            }

            // Ocultar error boundary
            const errorBoundary = document.getElementById('error-boundary');
            if (errorBoundary) {
                errorBoundary.style.display = 'none';
            }

            // Mostrar aplicación
            const app = document.getElementById('app');
            if (app) {
                app.style.display = 'grid';
                app.style.visibility = 'visible';
            }

            // Inicializar event handlers básicos si no está disponible
            if (!window.EventHandlers) {
                this.setupBasicEventHandlers();
            }

            // Mostrar notificación de que hay errores
            if (this.modules.NotificationManager) {
                this.modules.NotificationManager.warning(
                    'Aplicación en Modo Desarrollo',
                    'Algunos módulos tienen errores. La aplicación funciona con limitaciones.',
                    {
                        persistent: false,
                        duration: 8000
                    }
                );
            }

            console.log('✅ Aplicación forzada a mostrarse (modo desarrollo)');
        } catch (error) {
            console.error('❌ Error forzando aplicación:', error);
        }
    }

    /**
     * Configurar event handlers básicos como fallback
     */
    setupBasicEventHandlers() {
        // Configurar handlers básicos si EventHandlers no está disponible
        console.log('🎧 Configurando event handlers básicos');

        // Configurar navegación básica
        document.addEventListener('click', (e) => {
            if (e.target.matches('.nav-item')) {
                const viewName = e.target.getAttribute('data-view');
                if (viewName) {
                    this.switchToView(viewName);
                }
            }
        });
    }

    /**
     * Cambiar a vista específica (fallback)
     */
    switchToView(viewName) {
        // Ocultar todas las vistas
        document.querySelectorAll('.medical-view').forEach(view => {
            view.style.display = 'none';
        });

        // Mostrar vista seleccionada
        const selectedView = document.getElementById(`medical-${viewName}`);
        if (selectedView) {
            selectedView.style.display = 'block';
        }

        console.log(`🔄 Cambiado a vista: ${viewName}`);
    }

    /**
     * Redirigir a login
     */
    redirectToLogin() {
        window.location.href = '/demo.html';
    }

    /**
     * Manejar error crítico
     */
    handleCriticalError(error) {
        console.error('🚨 Error crítico del sistema:', error);

        // Mostrar mensaje de error amigable
        document.body.innerHTML = `
            <div style="text-align: center; margin-top: 100px; font-family: Arial, sans-serif;">
                <h1 style="color: #d32f2f;">Sistema temporalmente no disponible</h1>
                <p>Por favor, contacte al soporte técnico o recargue la página.</p>
                <button onclick="window.location.reload()" style="
                    background: #1976d2;
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 4px;
                    cursor: pointer;
                ">Recargar</button>
            </div>
        `;
    }
}

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    window.AIRAApp = new AIRAMedicalApp();
});

// Exportar para uso en módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AIRAMedicalApp;
}