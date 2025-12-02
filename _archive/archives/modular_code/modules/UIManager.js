/**
 * AIRA Medical System - UI Manager Module
 * Interfaz optimizada para profesionales de la salud mental
 * Especialmente diseñada para psicólogos/psiquiatras (35-65 años)
 */

class UIManager {
    constructor(app) {
        this.app = app;
        this.currentView = 'dashboard';
        this.patientContext = null;
        this.sessionContext = null;

        // Configuración UI para healthcare
        this.uiConfig = {
            // Tipografía legible para profesionales
            fontSize: {
                base: '16px',
                heading: '20px',
                small: '14px'
            },

            // Colores clínico-profesionales (calmados, no distractivos)
            colors: {
                primary: '#2c7a7b',      // Teal profesional
                secondary: '#4a5568',    // Gris neutro
                success: '#48bb78',      // Verde éxito
                warning: '#ed8936',      // Naranja advertencia
                danger: '#f56565',       // Rojo peligro
                light: '#f7fafc',        // Fondo claro
                dark: '#2d3748',         // Texto oscuro
                medical: '#805ad5'       // Púrpura médico
            },

            // Espaciado optimizado para facilitar lectura
            spacing: {
                small: '8px',
                medium: '16px',
                large: '24px',
                xlarge: '32px'
            },

            // Bordes y sombras sutiles
            borderRadius: '8px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
        };

        this.init();
    }

    /**
     * Inicializar UI Manager
     */
    async init() {
        console.log('🎨 Inicializando UIManager para healthcare');

        // Crear estructura base de la interfaz
        this.createBaseLayout();

        // Aplicar estilos específicos para healthcare
        this.applyMedicalStyling();

        // Inicializar componentes principales
        this.initializeMedicalComponents();
    }

    /**
     * Crear layout base modular
     */
    createBaseLayout() {
        const app = document.getElementById('app') || document.body;

        // Limpiar contenido existente de forma segura
        if (app.innerHTML) {
            app.innerHTML = '';
        }

        // Crear estructura principal
        app.innerHTML = `
            <header id="medical-header" class="medical-header">
                <!-- Header para profesionales -->
            </header>

            <nav id="medical-navigation" class="medical-navigation">
                <!-- Navegación principal -->
            </nav>

            <main id="medical-main" class="medical-main">
                <!-- Contenido principal dinámico -->
                <div id="medical-dashboard" class="medical-view">
                    <!-- Dashboard principal -->
                </div>

                <div id="medical-patients" class="medical-view" style="display: none;">
                    <!-- Gestión de pacientes -->
                </div>

                <div id="medical-sessions" class="medical-view" style="display: none;">
                    <!-- Gestión de sesiones -->
                </div>

                <div id="medical-reports" class="medical-view" style="display: none;">
                    <!-- Reportes y análisis -->
                </div>
            </main>

            <aside id="medical-sidebar" class="medical-sidebar">
                <!-- Panel lateral contextual -->
            </aside>

            <footer id="medical-footer" class="medical-footer">
                <!-- Footer informativo -->
            </footer>

            <!-- Modales -->
            <div id="medical-modals" class="medical-modals">
                <!-- Contenedor para modales -->
            </div>

            <!-- Notificaciones -->
            <div id="medical-notifications" class="medical-notifications">
                <!-- Contenedor para notificaciones -->
            </div>
        `;

        // Aplicar clases base para responsive
        document.body.classList.add('aira-medical-app', 'healthcare-optimized');
    }

    /**
     * Inicializar interfaz médica completa
     */
    async initializeMedicalInterface() {
        try {
            console.log('🏥 Construyendo interfaz médica profesional');

            // Renderizar header profesional
            this.renderMedicalHeader();

            // Renderizar navegación principal
            this.renderMedicalNavigation();

            // Renderizar dashboard principal
            await this.renderMedicalDashboard();

            // Renderizar sidebar contextual
            this.renderMedicalSidebar();

            // Configurar responsive para móviles/tablets
            this.setupResponsiveLayout();

            // Inicializar tooltips para ayuda contextual
            this.initializeTooltips();

            console.log('✅ Interfaz médica inicializada');

        } catch (error) {
            console.error('❌ Error inicializando interfaz médica:', error);
            throw error;
        }
    }

    /**
     * Renderizar header profesional
     */
    renderMedicalHeader() {
        const header = document.getElementById('medical-header');
        const user = this.app.currentUser;

        header.innerHTML = `
            <div class="header-content">
                <div class="header-left">
                    <div class="logo-section">
                        <div class="logo">
                            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                                <circle cx="20" cy="20" r="18" stroke="${this.uiConfig.colors.medical}" stroke-width="2"/>
                                <path d="M20 10 L20 20 L28 28" stroke="${this.uiConfig.colors.medical}" stroke-width="2" stroke-linecap="round"/>
                                <circle cx="20" cy="20" r="3" fill="${this.uiConfig.colors.medical}"/>
                            </svg>
                        </div>
                        <div class="logo-text">
                            <h1>AIRA</h1>
                            <span class="subtitle">Sistema Médico Profesional</span>
                        </div>
                    </div>
                </div>

                <div class="header-center">
                    <div class="search-section">
                        <div class="search-container">
                            <input
                                type="text"
                                id="patient-search-input"
                                placeholder="Buscar paciente rápido (Ctrl+K)..."
                                class="medical-search-input"
                                autocomplete="off"
                            >
                            <button class="search-button" onclick="AIRAApp.triggerPatientSearch()">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"/>
                                    <path d="M13 13 L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="header-right">
                    <div class="user-section">
                        <div class="user-info">
                            <span class="user-name">Dr. ${user.lastName}</span>
                            <span class="user-role">${this.formatUserRole(user.role)}</span>
                        </div>
                        <div class="user-actions">
                            <button class="icon-button" onclick="AIRAApp.showContextualHelp()" title="Ayuda (F1)">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/>
                                    <text x="10" y="14" text-anchor="middle" font-size="12" fill="currentColor">?</text>
                                </svg>
                            </button>
                            <button class="icon-button" onclick="AIRAApp.handleSecureLogout()" title="Cerrar sesión">
                                <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                                    <path d="M7 7 L12 12 L7 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M3 10 L12 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                    <path d="M15 3 L15 17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                                </svg>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar navegación principal
     */
    renderMedicalNavigation() {
        const navigation = document.getElementById('medical-navigation');

        const navItems = [
            {
                id: 'dashboard',
                label: 'Panel Principal',
                icon: this.getIcon('dashboard'),
                active: true
            },
            {
                id: 'patients',
                label: 'Pacientes',
                icon: this.getIcon('patients'),
                badge: this.getPatientCount()
            },
            {
                id: 'sessions',
                label: 'Sesiones',
                icon: this.getIcon('sessions'),
                badge: this.getTodaySessionsCount()
            },
            {
                id: 'reports',
                label: 'Reportes',
                icon: this.getIcon('reports')
            },
            {
                id: 'whatsapp',
                label: 'WhatsApp',
                icon: this.getIcon('whatsapp'),
                highlight: true
            }
        ];

        navigation.innerHTML = `
            <nav class="medical-nav">
                ${navItems.map(item => `
                    <button
                        class="nav-item ${item.active ? 'active' : ''} ${item.highlight ? 'highlight' : ''}"
                        data-view="${item.id}"
                        onclick="UIManager.switchView('${item.id}')"
                    >
                        <span class="nav-icon">${item.icon}</span>
                        <span class="nav-label">${item.label}</span>
                        ${item.badge ? `<span class="nav-badge">${item.badge}</span>` : ''}
                    </button>
                `).join('')}
            </nav>
        `;
    }

    /**
     * Renderizar dashboard principal
     */
    async renderMedicalDashboard() {
        const dashboard = document.getElementById('medical-dashboard');

        // Obtener datos reales del sistema
        const dashboardData = await this.getDashboardData();

        dashboard.innerHTML = `
            <div class="dashboard-content">
                <section class="dashboard-header">
                    <h2>Bienvenido, Dr. ${this.app.currentUser.lastName}</h2>
                    <p class="dashboard-date">${this.formatCurrentDate()}</p>
                </section>

                <section class="dashboard-stats">
                    <div class="stats-grid">
                        <div class="stat-card primary">
                            <div class="stat-icon">${this.getIcon('patients')}</div>
                            <div class="stat-content">
                                <h3>${dashboardData.totalPatients}</h3>
                                <p>Pacientes Activos</p>
                                <span class="stat-change positive">+${dashboardData.newPatientsThisMonth} este mes</span>
                            </div>
                        </div>

                        <div class="stat-card success">
                            <div class="stat-icon">${this.getIcon('sessions')}</div>
                            <div class="stat-content">
                                <h3>${dashboardData.todaySessions}</h3>
                                <p>Sesiones Hoy</p>
                                <span class="stat-change">${dashboardData.remainingSessions} pendientes</span>
                            </div>
                        </div>

                        <div class="stat-card warning">
                            <div class="stat-icon">${this.getIcon('whatsapp')}</div>
                            <div class="stat-content">
                                <h3>${dashboardData.pendingWhatsApp}</h3>
                                <p>Mensajes WhatsApp</p>
                                <span class="stat-change">${dashboardData.urgentWhatsApp} urgentes</span>
                            </div>
                        </div>

                        <div class="stat-card info">
                            <div class="stat-icon">${this.getIcon('reports')}</div>
                            <div class="stat-content">
                                <h3>${dashboardData.reportsGenerated}</h3>
                                <p>Reportes Semana</p>
                                <span class="stat-change">Último: ${dashboardData.lastReportDate}</span>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="dashboard-main-content">
                    <div class="dashboard-left">
                        <div class="card">
                            <div class="card-header">
                                <h3>Próximas Sesiones Hoy</h3>
                                <button class="button-secondary" onclick="UIManager.switchView('sessions')">
                                    Ver Todas
                                </button>
                            </div>
                            <div class="card-content">
                                ${this.renderUpcomingSessions(dashboardData.upcomingSessions)}
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3>Pacientes Recientes</h3>
                                <button class="button-secondary" onclick="UIManager.switchView('patients')">
                                    Ver Todos
                                </button>
                            </div>
                            <div class="card-content">
                                ${this.renderRecentPatients(dashboardData.recentPatients)}
                            </div>
                        </div>
                    </div>

                    <div class="dashboard-right">
                        <div class="card highlight">
                            <div class="card-header">
                                <h3>Acciones Rápidas</h3>
                            </div>
                            <div class="card-content">
                                <div class="quick-actions">
                                    <button class="action-button primary" onclick="AIRAApp.triggerNewSession()">
                                        <span class="action-icon">${this.getIcon('new-session')}</span>
                                        <span class="action-text">Nueva Sesión</span>
                                        <span class="action-shortcut">Ctrl+N</span>
                                    </button>

                                    <button class="action-button secondary" onclick="UIManager.openPatientSearch()">
                                        <span class="action-icon">${this.getIcon('search')}</span>
                                        <span class="action-text">Buscar Paciente</span>
                                        <span class="action-shortcut">Ctrl+K</span>
                                    </button>

                                    <button class="action-button whatsapp" onclick="UIManager.openWhatsAppInterface()">
                                        <span class="action-icon">${this.getIcon('whatsapp')}</span>
                                        <span class="action-text">Procesar WhatsApp</span>
                                        <span class="badge">${dashboardData.pendingWhatsApp}</span>
                                    </button>

                                    <button class="action-button secondary" onclick="UIManager.generateQuickReport()">
                                        <span class="action-icon">${this.getIcon('report')}</span>
                                        <span class="action-text">Reporte Rápido</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="card">
                            <div class="card-header">
                                <h3>Actividad Reciente</h3>
                            </div>
                            <div class="card-content">
                                ${this.renderRecentActivity(dashboardData.recentActivity)}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        `;
    }

    /**
     * Renderizar sidebar contextual
     */
    renderMedicalSidebar() {
        const sidebar = document.getElementById('medical-sidebar');

        sidebar.innerHTML = `
            <div class="sidebar-content">
                ${this.patientContext ? this.renderPatientContext() : ''}
                ${this.sessionContext ? this.renderSessionContext() : ''}

                <div class="sidebar-section">
                    <h4>Información Rápida</h4>
                    <div class="info-items">
                        <div class="info-item">
                            <span class="info-label">Sesiones Hoy:</span>
                            <span class="info-value" id="today-sessions-count">0</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Pacientes Activos:</span>
                            <span class="info-value" id="active-patients-count">0</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Mensajes Pendientes:</span>
                            <span class="info-value" id="pending-messages-count">0</span>
                        </div>
                    </div>
                </div>

                <div class="sidebar-section">
                    <h4>Atajos de Teclado</h4>
                    <div class="shortcuts">
                        <div class="shortcut-item">
                            <kbd>Ctrl+K</kbd> Buscar paciente
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+N</kbd> Nueva sesión
                        </div>
                        <div class="shortcut-item">
                            <kbd>Ctrl+S</kbd> Guardar sesión
                        </div>
                        <div class="shortcut-item">
                            <kbd>F1</kbd> Ayuda
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Cambiar vista principal
     */
    static switchView(viewName) {
        // Ocultar todas las vistas
        document.querySelectorAll('.medical-view').forEach(view => {
            view.style.display = 'none';
        });

        // Mostrar vista seleccionada
        const selectedView = document.getElementById(`medical-${viewName}`);
        if (selectedView) {
            selectedView.style.display = 'block';
        }

        // Actualizar navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        const activeNavItem = document.querySelector(`[data-view="${viewName}"]`);
        if (activeNavItem) {
            activeNavItem.classList.add('active');
        }

        // Actualizar vista actual
        window.AIRAApp.modules.UIManager.currentView = viewName;

        // Cargar contenido específico de la vista
        window.AIRAApp.modules.UIManager.loadViewContent(viewName);
    }

    /**
     * Cargar contenido específico de vista
     */
    async loadViewContent(viewName) {
        try {
            switch (viewName) {
                case 'patients':
                    await this.loadPatientsView();
                    break;
                case 'sessions':
                    await this.loadSessionsView();
                    break;
                case 'reports':
                    await this.loadReportsView();
                    break;
                case 'whatsapp':
                    await this.loadWhatsAppView();
                    break;
                default:
                    // Dashboard ya está cargado
                    break;
            }
        } catch (error) {
            console.error(`Error cargando vista ${viewName}:`, error);
            this.showErrorMessage('Error al cargar la vista solicitada');
        }
    }

    /**
     * Aplicar estilos específicos para healthcare
     */
    applyMedicalStyling() {
        const style = document.createElement('style');
        style.textContent = this.getMedicalCSS();
        document.head.appendChild(style);
    }

    /**
     * Generar CSS específico para healthcare
     */
    getMedicalCSS() {
        return `
        /* AIRA Medical System - Healthcare CSS */

        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            font-size: ${this.uiConfig.fontSize.base};
            line-height: 1.6;
            color: ${this.uiConfig.colors.dark};
            background-color: ${this.uiConfig.colors.light};
        }

        /* Header Profesional */
        .medical-header {
            background: white;
            border-bottom: 1px solid #e2e8f0;
            padding: ${this.uiConfig.spacing.medium} 0;
            position: sticky;
            top: 0;
            z-index: 100;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }

        .header-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 ${this.uiConfig.spacing.large};
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .logo-section {
            display: flex;
            align-items: center;
            gap: ${this.uiConfig.spacing.medium};
        }

        .logo-text h1 {
            font-size: 24px;
            font-weight: 700;
            color: ${this.uiConfig.colors.medical};
            margin: 0;
        }

        .logo-text .subtitle {
            font-size: ${this.uiConfig.fontSize.small};
            color: ${this.uiConfig.colors.secondary};
        }

        /* Navegación */
        .medical-navigation {
            background: white;
            border-bottom: 1px solid #e2e8f0;
            position: sticky;
            top: 73px;
            z-index: 90;
        }

        .medical-nav {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 ${this.uiConfig.spacing.large};
            display: flex;
            gap: ${this.uiConfig.spacing.medium};
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: ${this.uiConfig.spacing.small};
            padding: ${this.uiConfig.spacing.medium} ${this.uiConfig.spacing.large};
            border: none;
            background: none;
            color: ${this.uiConfig.colors.secondary};
            cursor: pointer;
            border-radius: ${this.uiConfig.borderRadius} ${this.uiConfig.borderRadius} 0 0;
            transition: all 0.2s ease;
            position: relative;
        }

        .nav-item:hover {
            background: #f8fafc;
            color: ${this.uiConfig.colors.primary};
        }

        .nav-item.active {
            background: ${this.uiConfig.colors.primary};
            color: white;
        }

        .nav-item.highlight {
            background: #48bb78;
            color: white;
        }

        .nav-badge {
            background: #f56565;
            color: white;
            font-size: 11px;
            padding: 2px 6px;
            border-radius: 10px;
            font-weight: 600;
        }

        /* Dashboard */
        .dashboard-content {
            max-width: 1200px;
            margin: 0 auto;
            padding: ${this.uiConfig.spacing.large};
        }

        .dashboard-header h2 {
            font-size: 28px;
            font-weight: 600;
            color: ${this.uiConfig.colors.dark};
            margin-bottom: ${this.uiConfig.spacing.small};
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: ${this.uiConfig.spacing.large};
            margin: ${this.uiConfig.spacing.xlarge} 0;
        }

        .stat-card {
            background: white;
            padding: ${this.uiConfig.spacing.large};
            border-radius: ${this.uiConfig.borderRadius};
            box-shadow: ${this.uiConfig.boxShadow};
            display: flex;
            align-items: center;
            gap: ${this.uiConfig.spacing.medium};
        }

        .stat-icon {
            width: 48px;
            height: 48px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }

        .stat-card.primary .stat-icon {
            background: rgba(44, 122, 123, 0.1);
            color: ${this.uiConfig.colors.primary};
        }

        .stat-card.success .stat-icon {
            background: rgba(72, 187, 120, 0.1);
            color: ${this.uiConfig.colors.success};
        }

        .stat-card.warning .stat-icon {
            background: rgba(237, 137, 54, 0.1);
            color: ${this.uiConfig.colors.warning};
        }

        .stat-card.info .stat-icon {
            background: rgba(66, 153, 225, 0.1);
            color: #4299e1;
        }

        .stat-content h3 {
            font-size: 32px;
            font-weight: 700;
            color: ${this.uiConfig.colors.dark};
            margin-bottom: 4px;
        }

        .stat-content p {
            color: ${this.uiConfig.colors.secondary};
            font-size: ${this.uiConfig.fontSize.small};
            margin-bottom: 4px;
        }

        .stat-change {
            font-size: ${this.uiConfig.fontSize.small};
            font-weight: 500;
        }

        .stat-change.positive {
            color: ${this.uiConfig.colors.success};
        }

        /* Cards */
        .card {
            background: white;
            border-radius: ${this.uiConfig.borderRadius};
            box-shadow: ${this.uiConfig.boxShadow};
            margin-bottom: ${this.uiConfig.spacing.large};
            overflow: hidden;
        }

        .card.highlight {
            border-left: 4px solid ${this.uiConfig.colors.medical};
        }

        .card-header {
            padding: ${this.uiConfig.spacing.large};
            border-bottom: 1px solid #e2e8f0;
            display: flex;
            align-items: center;
            justify-content: space-between;
        }

        .card-header h3 {
            font-size: 18px;
            font-weight: 600;
            color: ${this.uiConfig.colors.dark};
        }

        .card-content {
            padding: ${this.uiConfig.spacing.large};
        }

        /* Acciones Rápidas */
        .quick-actions {
            display: grid;
            gap: ${this.uiConfig.spacing.medium};
        }

        .action-button {
            display: flex;
            align-items: center;
            gap: ${this.uiConfig.spacing.medium};
            padding: ${this.uiConfig.spacing.large};
            border: 2px solid transparent;
            border-radius: ${this.uiConfig.borderRadius};
            font-size: ${this.uiConfig.fontSize.base};
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            background: white;
        }

        .action-button:hover {
            transform: translateY(-1px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .action-button.primary {
            background: ${this.uiConfig.colors.primary};
            color: white;
            border-color: ${this.uiConfig.colors.primary};
        }

        .action-button.secondary {
            background: white;
            color: ${this.uiConfig.colors.dark};
            border-color: #e2e8f0;
        }

        .action-button.whatsapp {
            background: #25d366;
            color: white;
            border-color: #25d366;
        }

        .action-icon {
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .action-text {
            flex: 1;
            text-align: left;
        }

        .action-shortcut {
            font-size: 11px;
            color: ${this.uiConfig.colors.secondary};
            background: #f7fafc;
            padding: 2px 6px;
            border-radius: 4px;
        }

        /* Sidebar */
        .medical-sidebar {
            position: fixed;
            right: 0;
            top: 140px;
            width: 300px;
            height: calc(100vh - 140px);
            background: white;
            border-left: 1px solid #e2e8f0;
            padding: ${this.uiConfig.spacing.large};
            overflow-y: auto;
        }

        .sidebar-section {
            margin-bottom: ${this.uiConfig.spacing.xlarge};
        }

        .sidebar-section h4 {
            font-size: 14px;
            font-weight: 600;
            color: ${this.uiConfig.colors.secondary};
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: ${this.uiConfig.spacing.medium};
        }

        .info-item {
            display: flex;
            justify-content: space-between;
            padding: ${this.uiConfig.spacing.small} 0;
            border-bottom: 1px solid #f1f5f9;
        }

        .info-label {
            color: ${this.uiConfig.colors.secondary};
            font-size: ${this.uiConfig.fontSize.small};
        }

        .info-value {
            font-weight: 600;
            color: ${this.uiConfig.colors.dark};
        }

        .shortcuts {
            display: flex;
            flex-direction: column;
            gap: ${this.uiConfig.spacing.small};
        }

        .shortcut-item {
            display: flex;
            align-items: center;
            gap: ${this.uiConfig.spacing.small};
            font-size: ${this.uiConfig.fontSize.small};
            color: ${this.uiConfig.colors.secondary};
        }

        kbd {
            background: #f1f5f9;
            border: 1px solid #cbd5e0;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            font-weight: 600;
            color: ${this.uiConfig.colors.dark};
        }

        /* Responsive */
        @media (max-width: 1024px) {
            .medical-sidebar {
                display: none;
            }

            .dashboard-main-content {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 768px) {
            .header-content {
                flex-direction: column;
                gap: ${this.uiConfig.spacing.medium};
            }

            .medical-nav {
                flex-wrap: wrap;
                gap: ${this.uiConfig.spacing.small};
            }

            .nav-item {
                padding: ${this.uiConfig.spacing.small} ${this.uiConfig.spacing.medium};
                font-size: ${this.uiConfig.fontSize.small};
            }

            .stats-grid {
                grid-template-columns: 1fr;
            }
        }

        /* Accessibility */
        .high-contrast {
            filter: contrast(1.2);
        }

        .large-text {
            font-size: 18px;
        }

        .reduced-motion * {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
        }

        /* Focus styles for keyboard navigation */
        button:focus,
        input:focus,
        select:focus,
        textarea:focus {
            outline: 2px solid ${this.uiConfig.colors.primary};
            outline-offset: 2px;
        }

        /* Loading states */
        .loading {
            opacity: 0.6;
            pointer-events: none;
        }

        .loading::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            width: 20px;
            height: 20px;
            margin: -10px 0 0 -10px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid ${this.uiConfig.colors.primary};
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        `;
    }

    /**
     * Métodos utilitarios para UI
     */
    formatUserRole(role) {
        const roleMap = {
            'psychologist': 'Psicólogo/a',
            'psychiatrist': 'Psiquiatra',
            'medical_professional': 'Profesional Médico',
            'admin': 'Administrador'
        };
        return roleMap[role] || role;
    }

    formatCurrentDate() {
        const options = {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        };
        return new Date().toLocaleDateString('es-ES', options);
    }

    getIcon(type) {
        const icons = {
            dashboard: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/><rect x="11" y="2" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/><rect x="2" y="11" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/><rect x="11" y="11" width="7" height="7" rx="1" stroke="currentColor" stroke-width="2"/></svg>`,
            patients: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="6" r="3" stroke="currentColor" stroke-width="2"/><path d="M4 18C4 14.134 7.134 11 11 11C14.866 11 18 14.134 18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            sessions: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/><path d="M10 6 L10 10 L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            reports: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M2 4 L18 4 M2 8 L18 8 M2 12 L12 12 M2 16 L14 16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            whatsapp: `<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 0C4.477 0 0 4.477 0 10C0 11.657 0.447 13.207 1.236 14.53L0 20L5.47 18.764C6.793 19.553 8.343 20 10 20C15.523 20 20 15.523 20 10C20 4.477 15.523 0 10 0ZM7 5L8.4 6.4L13 3L10 8L8.6 6.6L4 10L7 5Z"/></svg>`,
            'new-session': `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8" stroke="currentColor" stroke-width="2"/><path d="M10 6 L10 14 M6 10 L14 10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            search: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="2"/><path d="M13 13 L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
            report: `<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><rect x="2" y="2" width="16" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M6 8 L14 8 M6 12 L14 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`
        };
        return icons[type] || '';
    }

    async getDashboardData() {
        // Mock data - reemplazar con llamadas reales a la API
        return {
            totalPatients: 156,
            newPatientsThisMonth: 8,
            todaySessions: 6,
            remainingSessions: 2,
            pendingWhatsApp: 3,
            urgentWhatsApp: 1,
            reportsGenerated: 12,
            lastReportDate: 'Ayer',
            upcomingSessions: [
                { time: '09:00', patient: 'María García', type: 'Individual', status: 'confirmed' },
                { time: '10:30', patient: 'Juan Rodríguez', type: 'Terapia', status: 'confirmed' },
                { time: '14:00', patient: 'Ana Martínez', type: 'Seguimiento', status: 'pending' }
            ],
            recentPatients: [
                { name: 'Carlos López', lastSession: '2 días', nextSession: 'Mañana' },
                { name: 'Laura Díaz', lastSession: '1 semana', nextSession: 'Próxima semana' },
                { name: 'Pedro Martín', lastSession: '3 días', nextSession: 'Viernes' }
            ],
            recentActivity: [
                { action: 'Sesión completada', patient: 'María García', time: 'Hace 2 horas' },
                { action: 'Reporte generado', patient: 'Juan Rodríguez', time: 'Hace 4 horas' },
                { action: 'Mensaje WhatsApp', patient: 'Ana Martínez', time: 'Hace 6 horas' }
            ]
        };
    }

    renderUpcomingSessions(sessions) {
        if (!sessions || sessions.length === 0) {
            return '<p style="color: #718096; font-style: italic;">No hay sesiones programadas para hoy</p>';
        }

        return sessions.map(session => `
            <div class="session-item" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                margin-bottom: 8px;
            ">
                <div>
                    <div style="font-weight: 500; color: #2d3748;">${session.time} - ${session.patient}</div>
                    <div style="font-size: 14px; color: #718096;">${session.type}</div>
                </div>
                <span class="status-badge ${session.status}" style="
                    background: ${session.status === 'confirmed' ? '#c6f6d5' : '#fed7d7'};
                    color: ${session.status === 'confirmed' ? '#22543d' : '#c53030'};
                    padding: 4px 8px;
                    border-radius: 12px;
                    font-size: 12px;
                    font-weight: 500;
                ">
                    ${session.status === 'confirmed' ? 'Confirmada' : 'Pendiente'}
                </span>
            </div>
        `).join('');
    }

    renderRecentPatients(patients) {
        if (!patients || patients.length === 0) {
            return '<p style="color: #718096; font-style: italic;">No hay pacientes recientes</p>';
        }

        return patients.map(patient => `
            <div class="patient-item" style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                border: 1px solid #e2e8f0;
                border-radius: 6px;
                margin-bottom: 8px;
                cursor: pointer;
            " onclick="UIManager.selectPatient('${patient.name}')">
                <div>
                    <div style="font-weight: 500; color: #2d3748;">${patient.name}</div>
                    <div style="font-size: 14px; color: #718096;">Última sesión: ${patient.lastSession}</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 14px; color: #48bb78; font-weight: 500;">${patient.nextSession}</div>
                </div>
            </div>
        `).join('');
    }

    renderRecentActivity(activities) {
        if (!activities || activities.length === 0) {
            return '<p style="color: #718096; font-style: italic;">No hay actividad reciente</p>';
        }

        return activities.map(activity => `
            <div class="activity-item" style="
                display: flex;
                align-items: start;
                gap: 12px;
                padding: 8px 0;
                border-bottom: 1px solid #f1f5f9;
            ">
                <div style="
                    width: 8px;
                    height: 8px;
                    background: #cbd5e0;
                    border-radius: 50%;
                    margin-top: 6px;
                "></div>
                <div style="flex: 1;">
                    <div style="font-size: 14px; color: #2d3748;">${activity.action}</div>
                    <div style="font-size: 12px; color: #718096;">${activity.patient} • ${activity.time}</div>
                </div>
            </div>
        `).join('');
    }

    // Métodos placeholder para funcionalidades extendidas
    getPatientCount() { return '156'; }
    getTodaySessionsCount() { return '6'; }
    openPatientSearch() { this.triggerPatientSearch(); }
    openWhatsAppInterface() { console.log('Abriendo interfaz WhatsApp...'); }
    generateQuickReport() { console.log('Generando reporte rápido...'); }
    selectPatient(patientName) { console.log('Paciente seleccionado:', patientName); }
    showErrorMessage(message) { console.error('Error:', message); }

    async loadPatientsView() {
        console.log('Cargando vista de pacientes...');
        // Implementar carga de vista de pacientes
    }

    async loadSessionsView() {
        console.log('Cargando vista de sesiones...');
        // Implementar carga de vista de sesiones
    }

    async loadReportsView() {
        console.log('Cargando vista de reportes...');
        // Implementar carga de vista de reportes
    }

    async loadWhatsAppView() {
        console.log('Cargando vista de WhatsApp...');
        // Implementar carga de vista de WhatsApp
    }

    async updatePatientContext(patientData) {
        this.patientContext = patientData;
        this.renderMedicalSidebar();
    }

    renderPatientContext() {
        if (!this.patientContext) return '';

        return `
            <div class="sidebar-section patient-context">
                <h4>Paciente Actual</h4>
                <div class="patient-card">
                    <div style="font-weight: 600; color: #2d3748; margin-bottom: 8px;">
                        ${this.patientContext.name}
                    </div>
                    <div style="font-size: 14px; color: #718096; margin-bottom: 4px;">
                        ${this.patientContext.email}
                    </div>
                    <div style="font-size: 14px; color: #718096;">
                        Última sesión: ${this.patientContext.lastSession || 'N/A'}
                    </div>
                </div>
            </div>
        `;
    }

    renderSessionContext() {
        if (!this.sessionContext) return '';

        return `
            <div class="sidebar-section session-context">
                <h4>Sesión Actual</h4>
                <div class="session-card">
                    <div style="font-weight: 600; color: #2d3748; margin-bottom: 8px;">
                        ${this.sessionContext.type}
                    </div>
                    <div style="font-size: 14px; color: #718096; margin-bottom: 4px;">
                        Inicio: ${this.sessionContext.startTime}
                    </div>
                    <div style="font-size: 14px; color: #718096;">
                        Duración: ${this.sessionContext.duration}
                    </div>
                    <button class="button-primary" style="
                        width: 100%;
                        margin-top: 12px;
                        padding: 8px;
                        background: ${this.uiConfig.colors.primary};
                        color: white;
                        border: none;
                        border-radius: 4px;
                        cursor: pointer;
                    " onclick="UIManager.endCurrentSession()">
                        Finalizar Sesión
                    </button>
                </div>
            </div>
        `;
    }

    endCurrentSession() {
        console.log('Finalizando sesión actual...');
        // Implementar lógica para finalizar sesión
    }

    setupResponsiveLayout() {
        // Implementar lógica responsive
        console.log('Configurando layout responsive...');
    }

    initializeTooltips() {
        // Implementar tooltips para ayuda contextual
        console.log('Inicializando tooltips...');
    }

    showErrorMessage(message) {
        // Implementar mostrar errores
        console.error('Error:', message);
    }
}

// Hacer UIManager disponible globalmente
window.UIManager = UIManager;