/**
 * AIRA Medical System - Event Handlers
 * Centralización de eventos para evitar CSP violations
 */

class EventHandlers {
    constructor(app) {
        this.app = app;
        this.init();
    }

    init() {
        console.log('🎧 Inicializando Event Handlers');
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Eventos del footer
        this.setupFooterEvents();

        // Eventos de loading
        this.setupLoadingEvents();

        // Eventos de modales y navegación
        this.setupNavigationEvents();

        // Eventos de autenticación
        this.setupAuthEvents();
    }

    setupFooterEvents() {
        // Footer help link
        const helpLink = document.querySelector('a[data-action="contextual-help"]');
        if (helpLink) {
            helpLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.app.showContextualHelp) {
                    this.app.showContextualHelp();
                }
            });
        }

        // Footer privacy link
        const privacyLink = document.querySelector('a[data-action="privacy-policy"]');
        if (privacyLink) {
            privacyLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.app.showPrivacyPolicy) {
                    this.app.showPrivacyPolicy();
                }
            });
        }
    }

    setupLoadingEvents() {
        // Error boundary reload button
        const reloadButton = document.querySelector('button[data-action="reload-page"]');
        if (reloadButton) {
            reloadButton.addEventListener('click', (e) => {
                window.location.reload();
            });
        }
    }

    setupNavigationEvents() {
        // Skip links
        const skipLinks = document.querySelectorAll('.skip-link');
        skipLinks.forEach(link => {
            const targetId = link.getAttribute('href').substring(1);
            const target = document.getElementById(targetId);
            if (target) {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    target.focus();
                    target.scrollIntoView();
                });
            }
        });
    }

    setupAuthEvents() {
        // Eventos de autenticación global
        document.addEventListener('login', (e) => {
            if (this.app.modules.AuditManager) {
                this.app.modules.AuditManager.logLogin(this.app.currentUser);
            }
        });

        document.addEventListener('logout', (e) => {
            if (this.app.modules.AuditManager) {
                this.app.modules.AuditManager.logLogout(this.app.currentUser);
            }
        });
    }

    // Eventos dinámicos para elementos que se crean después de la carga inicial
    setupDynamicEvents() {
        // Eventos de navegación del UIManager
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-action="nav-switch"]')) {
                const viewName = e.target.getAttribute('data-view');
                if (this.app.modules.UIManager && this.app.modules.UIManager.switchView) {
                    this.app.modules.UIManager.switchView(viewName);
                }
            }

            // Eventos de acciones de pacientes
            if (e.target.matches('[data-action="select-patient"]')) {
                const patientId = e.target.getAttribute('data-patient-id');
                if (this.app.modules.PatientManager && this.app.modules.PatientManager.selectPatient) {
                    this.app.modules.PatientManager.selectPatient(patientId);
                }
            }

            // Eventos de acciones de sesiones
            if (e.target.matches('[data-action="new-session"]')) {
                if (this.app.modules.SessionManager && this.app.modules.SessionManager.startNewSession) {
                    this.app.modules.SessionManager.startNewSession();
                }
            }

            // Eventos de búsqueda
            if (e.target.matches('[data-action="patient-search"]')) {
                if (this.app.triggerPatientSearch) {
                    this.app.triggerPatientSearch();
                }
            }

            // Eventos de ayuda contextual
            if (e.target.matches('[data-action="contextual-help"]')) {
                if (this.app.showContextualHelp) {
                    this.app.showContextualHelp();
                }
            }
        });
    }
}

// Hacer disponible globalmente
window.EventHandlers = EventHandlers;