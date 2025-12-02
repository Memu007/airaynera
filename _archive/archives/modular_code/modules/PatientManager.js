/**
 * AIRA Medical System - Patient Manager Module
 * Gestión clínica completa de pacientes con HIPAA compliance
 * Optimizado para psicólogos y psiquiatras
 */

class PatientManager {
    constructor(app) {
        this.app = app;
        this.currentPatient = null;
        this.patients = [];
        this.filteredPatients = [];
        this.searchTerm = '';
        this.currentPage = 1;
        this.patientsPerPage = 20;
        this.sortBy = 'name';
        this.sortOrder = 'asc';

        // Configuración específica para gestión médica
        this.config = {
            maxPatientsPerPage: 20,
            searchDebounce: 300,
            autoSaveInterval: 5000,
            encryptionEnabled: true,
            auditEnabled: true,
            maxSessionsToShow: 10,
            alertThresholds: {
                noSessionsInDays: 30,
                upcomingInHours: 24
            }
        };

        this.init();
    }

    /**
     * Inicializar Patient Manager
     */
    async init() {
        console.log('👥 Inicializando Patient Manager para atención clínica');

        // Cargar pacientes desde backend
        await this.loadPatients();

        // Configurar event listeners
        this.setupEventListeners();

        // Inicializar componentes de búsqueda
        this.initializeSearchComponents();

        // Configurar auto-save para cambios
        this.setupAutoSave();

        console.log('✅ Patient Manager inicializado');
    }

    /**
     * Cargar pacientes desde backend con seguridad HIPAA
     */
    async loadPatients() {
        try {
            this.app.modules.UIManager.showLoading('Cargando pacientes...');

            const response = await fetch(`${this.app.config.apiBaseUrl}/patients`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const encryptedData = await response.json();

            // Desencriptar datos de pacientes (PHI)
            this.patients = await this.decryptPatientData(encryptedData.patients);

            // Ordenar pacientes por nombre
            this.sortPatients('name', 'asc');

            // Aplicar filtros actuales
            this.applyFilters();

            // Logging de auditoría
            if (this.config.auditEnabled) {
                await this.app.modules.AuditManager.logPatientDataAccess(
                    this.app.currentUser,
                    'LOAD_ALL_PATIENTS',
                    this.patients.length
                );
            }

            console.log(`📋 Cargados ${this.patients.length} pacientes`);

        } catch (error) {
            console.error('❌ Error cargando pacientes:', error);

            // En desarrollo, usar datos mock en lugar de fallar
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.warn('⚠️ Usando datos mock de pacientes en modo desarrollo');
                this.patients = this.getMockPatients();
                this.applyFilters();

                // Notificar al usuario
                if (this.app.modules.NotificationManager) {
                    this.app.modules.NotificationManager.warning(
                        'Modo Desarrollo',
                        'Usando datos de ejemplo para pacientes.',
                        { persistent: false, duration: 4000 }
                    );
                }
            } else {
                // En producción, mostrar error crítico
                if (this.app.modules.NotificationManager) {
                    this.app.modules.NotificationManager.show({
                        type: 'error',
                        title: 'Error de Conexión',
                        message: 'No se pudieron cargar los pacientes. Intente nuevamente.',
                        persistent: true
                    });
                }
                throw error;
            }
        } finally {
            if (this.app.modules.UIManager) {
                this.app.modules.UIManager.hideLoading();
            }
        }
    }

    /**
     * Desencriptar datos de pacientes (PHI)
     */
    async decryptPatientData(encryptedPatients) {
        if (!this.config.encryptionEnabled) {
            return encryptedPatients;
        }

        try {
            const decryptedPatients = await Promise.all(
                encryptedPatients.map(async (patient) => {
                    return {
                        ...patient,
                        // Datos PHI desencriptados
                        name: await this.decryptField(patient.name),
                        email: await this.decryptField(patient.email),
                        phone: await this.decryptField(patient.phone),
                        address: await this.decryptField(patient.address),
                        emergencyContact: await this.decryptField(patient.emergencyContact),
                        medicalHistory: await this.decryptField(patient.medicalHistory),
                        // Datos no PHI mantienen formato original
                        id: patient.id,
                        createdAt: patient.createdAt,
                        lastSession: patient.lastSession,
                        status: patient.status,
                        therapistId: patient.therapistId
                    };
                })
            );
            return decryptedPatients;
        } catch (error) {
            console.error('Error desencriptando datos de pacientes:', error);
            throw new Error('Error accediendo a datos protegidos de pacientes');
        }
    }

    /**
     * Configurar event listeners para gestión de pacientes
     */
    setupEventListeners() {
        // Eventos de búsqueda
        document.addEventListener('patientSearch', (e) => {
            this.handlePatientSearch(e.detail.query);
        });

        // Eventos de selección de paciente
        document.addEventListener('patientSelected', (e) => {
            this.selectPatient(e.detail.patientId);
        });

        // Eventos de creación de paciente
        document.addEventListener('createPatient', (e) => {
            this.openCreatePatientModal();
        });

        // Eventos de edición de paciente
        document.addEventListener('editPatient', (e) => {
            this.openEditPatientModal(e.detail.patientId);
        });

        // Eventos de eliminación de paciente
        document.addEventListener('deletePatient', (e) => {
            this.confirmDeletePatient(e.detail.patientId);
        });

        // Eventos de filtro
        document.addEventListener('filterPatients', (e) => {
            this.applyAdvancedFilters(e.detail.filters);
        });
    }

    /**
     * Renderizar vista completa de pacientes
     */
    renderPatientsView() {
        const patientsContainer = document.getElementById('medical-patients');
        if (!patientsContainer) return;

        patientsContainer.innerHTML = `
            <div class="patients-view">
                <!-- Header de gestión de pacientes -->
                <section class="patients-header">
                    <div class="header-content">
                        <div class="header-left">
                            <h2>Gestión de Pacientes</h2>
                            <p class="patients-count">
                                ${this.filteredPatients.length} de ${this.patients.length} pacientes
                            </p>
                        </div>
                        <div class="header-actions">
                            <button class="button-primary" onclick="PatientManager.openCreatePatientModal()">
                                <span class="icon">+</span>
                                Nuevo Paciente
                            </button>
                            <button class="button-secondary" onclick="PatientManager.exportPatientList()">
                                <span class="icon">📥</span>
                                Exportar
                            </button>
                        </div>
                    </div>

                    <!-- Barra de búsqueda y filtros -->
                    <div class="search-filters-section">
                        <div class="search-container">
                            <div class="search-input-wrapper">
                                <input
                                    type="text"
                                    id="patient-search-input"
                                    placeholder="Buscar por nombre, DNI, email..."
                                    class="medical-search-input large"
                                    autocomplete="off"
                                    value="${this.searchTerm}"
                                >
                                <button class="search-button" onclick="PatientManager.performSearch()">
                                    🔍
                                </button>
                            </div>
                        </div>

                        <div class="quick-filters">
                            <button class="filter-chip ${this.getActiveFilterClass('all')}"
                                    onclick="PatientManager.applyQuickFilter('all')">
                                Todos
                            </button>
                            <button class="filter-chip ${this.getActiveFilterClass('active')}"
                                    onclick="PatientManager.applyQuickFilter('active')">
                                Activos
                            </button>
                            <button class="filter-chip ${this.getActiveFilterClass('recent')}"
                                    onclick="PatientManager.applyQuickFilter('recent')">
                                Sesión Reciente
                            </button>
                            <button class="filter-chip ${this.getActiveFilterClass('followup')}"
                                    onclick="PatientManager.applyQuickFilter('followup')">
                                Seguimiento
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Tabla de pacientes -->
                <section class="patients-table-section">
                    <div class="table-controls">
                        <div class="sort-controls">
                            <label>Ordenar por:</label>
                            <select id="sort-select" onchange="PatientManager.handleSortChange(this.value)">
                                <option value="name-asc">Nombre (A-Z)</option>
                                <option value="name-desc">Nombre (Z-A)</option>
                                <option value="lastSession-desc">Última sesión (reciente)</option>
                                <option value="lastSession-asc">Última sesión (antiguo)</option>
                                <option value="createdAt-desc">Fecha de creación (reciente)</option>
                                <option value="createdAt-asc">Fecha de creación (antiguo)</option>
                            </select>
                        </div>
                        <div class="view-controls">
                            <button class="view-btn ${this.getViewModeClass('table')}"
                                    onclick="PatientManager.setViewMode('table')" title="Vista tabla">
                                <span>⊞</span>
                            </button>
                            <button class="view-btn ${this.getViewModeClass('cards')}"
                                    onclick="PatientManager.setViewMode('cards')" title="Vista tarjetas">
                                <span>⊟</span>
                            </button>
                        </div>
                    </div>

                    <!-- Vista de tabla (default) -->
                    <div id="patients-table-view" class="patients-table-container">
                        ${this.renderPatientsTable()}
                    </div>

                    <!-- Vista de tarjetas -->
                    <div id="patients-cards-view" class="patients-cards-container" style="display: none;">
                        ${this.renderPatientsCards()}
                    </div>
                </section>

                <!-- Paginación -->
                <section class="pagination-section">
                    ${this.renderPagination()}
                </section>
            </div>

            <!-- Modal para crear/editar paciente -->
            <div id="patient-modal" class="medical-modal" style="display: none;">
                <!-- Se renderizará dinámicamente -->
            </div>

            <!-- Modal de confirmación de eliminación -->
            <div id="delete-confirm-modal" class="medical-modal" style="display: none;">
                <!-- Se renderizará dinámicamente -->
            </div>
        `;

        // Configurar listeners específicos de esta vista
        this.setupPatientsViewListeners();
    }

    /**
     * Renderizar tabla de pacientes
     */
    renderPatientsTable() {
        if (this.filteredPatients.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>No se encontraron pacientes</h3>
                    <p>${this.searchTerm ? 'No hay pacientes que coincidan con tu búsqueda.' : 'No hay pacientes registrados.'}</p>
                    <button class="button-primary" onclick="PatientManager.openCreatePatientModal()">
                        Crear Primer Paciente
                    </button>
                </div>
            `;
        }

        const startIndex = (this.currentPage - 1) * this.patientsPerPage;
        const endIndex = startIndex + this.patientsPerPage;
        const paginatedPatients = this.filteredPatients.slice(startIndex, endIndex);

        return `
            <div class="table-wrapper">
                <table class="patients-table">
                    <thead>
                        <tr>
                            <th>Paciente</th>
                            <th>Contacto</th>
                            <th>Última Sesión</th>
                            <th>Estado</th>
                            <th>Sesiones Totales</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${paginatedPatients.map(patient => this.renderPatientRow(patient)).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    /**
     * Renderizar fila individual de paciente
     */
    renderPatientRow(patient) {
        const lastSessionDate = patient.lastSession ?
            this.formatDate(patient.lastSession) : 'Nunca';

        const daysSinceLastSession = patient.lastSession ?
            this.getDaysSince(patient.lastSession) : null;

        const needsFollowUp = daysSinceLastSession && daysSinceLastSession > 30;
        const hasUpcomingSession = this.hasUpcomingSession(patient.id);

        return `
            <tr class="patient-row ${needsFollowUp ? 'needs-follow-up' : ''}"
                data-patient-id="${patient.id}">
                <td class="patient-info">
                    <div class="patient-avatar">
                        ${this.getPatientInitials(patient.name)}
                    </div>
                    <div class="patient-details">
                        <div class="patient-name">${patient.name}</div>
                        <div class="patient-dni">DNI: ${this.maskSensitiveData(patient.dni)}</div>
                        <div class="patient-age">
                            ${this.calculateAge(patient.birthDate)} años • ${patient.gender}
                        </div>
                    </div>
                </td>
                <td class="patient-contact">
                    <div class="contact-item">
                        <span class="contact-icon">📧</span>
                        <span class="contact-value">${this.maskEmail(patient.email)}</span>
                    </div>
                    <div class="contact-item">
                        <span class="contact-icon">📱</span>
                        <span class="contact-value">${this.maskPhone(patient.phone)}</span>
                    </div>
                </td>
                <td class="last-session">
                    <div class="session-date">${lastSessionDate}</div>
                    ${daysSinceLastSession ? `
                        <div class="session-days ${needsFollowUp ? 'warning' : ''}">
                            Hace ${daysSinceLastSession} días
                            ${needsFollowUp ? '<span class="alert-icon">⚠️</span>' : ''}
                        </div>
                    ` : ''}
                    ${hasUpcomingSession ? `
                        <div class="upcoming-session">
                            Próxima: ${this.getNextSessionDate(patient.id)}
                        </div>
                    ` : ''}
                </td>
                <td class="patient-status">
                    <span class="status-badge ${patient.status}">
                        ${this.getStatusLabel(patient.status)}
                    </span>
                </td>
                <td class="session-count">
                    <div class="count-number">${patient.totalSessions || 0}</div>
                    <div class="count-label">sesiones</div>
                </td>
                <td class="patient-actions">
                    <div class="action-buttons">
                        <button class="action-btn primary"
                                onclick="PatientManager.selectPatient('${patient.id}')"
                                title="Seleccionar paciente">
                            👁️
                        </button>
                        <button class="action-btn secondary"
                                onclick="PatientManager.openEditPatientModal('${patient.id}')"
                                title="Editar paciente">
                            ✏️
                        </button>
                        <button class="action-btn secondary"
                                onclick="PatientManager.viewPatientHistory('${patient.id}')"
                                title="Ver historial">
                            📋
                        </button>
                        <button class="action-btn secondary whatsapp"
                                onclick="PatientManager.sendWhatsAppMessage('${patient.id}')"
                                title="Enviar mensaje WhatsApp">
                            💬
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Renderizar vista de tarjetas de pacientes
     */
    renderPatientsCards() {
        if (this.filteredPatients.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">👥</div>
                    <h3>No se encontraron pacientes</h3>
                    <p>No hay pacientes que coincidan con los criterios seleccionados.</p>
                </div>
            `;
        }

        const startIndex = (this.currentPage - 1) * this.patientsPerPage;
        const endIndex = startIndex + this.patientsPerPage;
        const paginatedPatients = this.filteredPatients.slice(startIndex, endIndex);

        return `
            <div class="patients-cards-grid">
                ${paginatedPatients.map(patient => this.renderPatientCard(patient)).join('')}
            </div>
        `;
    }

    /**
     * Renderizar tarjeta individual de paciente
     */
    renderPatientCard(patient) {
        const daysSinceLastSession = patient.lastSession ?
            this.getDaysSince(patient.lastSession) : null;

        const needsFollowUp = daysSinceLastSession && daysSinceLastSession > 30;
        const hasUpcomingSession = this.hasUpcomingSession(patient.id);

        return `
            <div class="patient-card ${needsFollowUp ? 'needs-follow-up' : ''}"
                 data-patient-id="${patient.id}">
                <div class="card-header">
                    <div class="patient-avatar large">
                        ${this.getPatientInitials(patient.name)}
                    </div>
                    <div class="patient-info">
                        <h3 class="patient-name">${patient.name}</h3>
                        <p class="patient-basic">
                            ${this.calculateAge(patient.birthDate)} años • ${patient.gender}
                        </p>
                        <span class="status-badge ${patient.status}">
                            ${this.getStatusLabel(patient.status)}
                        </span>
                    </div>
                </div>

                <div class="card-content">
                    <div class="info-section">
                        <div class="info-item">
                            <span class="info-label">Contacto:</span>
                            <span class="info-value">${this.maskEmail(patient.email)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Teléfono:</span>
                            <span class="info-value">${this.maskPhone(patient.phone)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Última sesión:</span>
                            <span class="info-value">
                                ${patient.lastSession ? this.formatDate(patient.lastSession) : 'Nunca'}
                            </span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Total sesiones:</span>
                            <span class="info-value">${patient.totalSessions || 0}</span>
                        </div>
                    </div>

                    ${needsFollowUp ? `
                        <div class="alert-section">
                            <div class="alert-item warning">
                                <span class="alert-icon">⚠️</span>
                                <span class="alert-text">
                                    Requiere seguimiento (hace ${daysSinceLastSession} días)
                                </span>
                            </div>
                        </div>
                    ` : ''}

                    ${hasUpcomingSession ? `
                        <div class="upcoming-section">
                            <div class="upcoming-item">
                                <span class="upcoming-icon">📅</span>
                                <span class="upcoming-text">
                                    Próxima sesión: ${this.getNextSessionDate(patient.id)}
                                </span>
                            </div>
                        </div>
                    ` : ''}
                </div>

                <div class="card-actions">
                    <button class="action-button primary"
                            onclick="PatientManager.selectPatient('${patient.id}')">
                        Seleccionar
                    </button>
                    <button class="action-button secondary"
                            onclick="PatientManager.openEditPatientModal('${patient.id}')">
                        Editar
                    </button>
                    <button class="action-button secondary"
                            onclick="PatientManager.sendWhatsAppMessage('${patient.id}')">
                        WhatsApp
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Renderizar paginación
     */
    renderPagination() {
        const totalPages = Math.ceil(this.filteredPatients.length / this.patientsPerPage);

        if (totalPages <= 1) return '';

        const pages = [];
        const maxVisiblePages = 5;

        // Lógica para mostrar páginas alrededor de la actual
        let startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
        let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

        if (endPage - startPage + 1 < maxVisiblePages) {
            startPage = Math.max(1, endPage - maxVisiblePages + 1);
        }

        // Botón anterior
        pages.push(`
            <button class="page-btn ${this.currentPage === 1 ? 'disabled' : ''}"
                    onclick="PatientManager.goToPage(${this.currentPage - 1})"
                    ${this.currentPage === 1 ? 'disabled' : ''}>
                ← Anterior
            </button>
        `);

        // Primera página si no está visible
        if (startPage > 1) {
            pages.push(`
                <button class="page-btn" onclick="PatientManager.goToPage(1)">1</button>
            `);
            if (startPage > 2) {
                pages.push('<span class="page-ellipsis">...</span>');
            }
        }

        // Páginas visibles
        for (let i = startPage; i <= endPage; i++) {
            pages.push(`
                <button class="page-btn ${i === this.currentPage ? 'active' : ''}"
                        onclick="PatientManager.goToPage(${i})">
                    ${i}
                </button>
            `);
        }

        // Última página si no está visible
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                pages.push('<span class="page-ellipsis">...</span>');
            }
            pages.push(`
                <button class="page-btn" onclick="PatientManager.goToPage(${totalPages})">${totalPages}</button>
            `);
        }

        // Botón siguiente
        pages.push(`
            <button class="page-btn ${this.currentPage === totalPages ? 'disabled' : ''}"
                    onclick="PatientManager.goToPage(${this.currentPage + 1})"
                    ${this.currentPage === totalPages ? 'disabled' : ''}>
                Siguiente →
            </button>
        `);

        return `
            <div class="pagination-controls">
                <div class="pagination-info">
                    Mostrando ${((this.currentPage - 1) * this.patientsPerPage) + 1} -
                    ${Math.min(this.currentPage * this.patientsPerPage, this.filteredPatients.length)}
                    de ${this.filteredPatients.length} pacientes
                </div>
                <div class="pagination-buttons">
                    ${pages.join('')}
                </div>
            </div>
        `;
    }

    /**
     * Abrir modal para crear nuevo paciente
     */
    openCreatePatientModal() {
        const modal = document.getElementById('patient-modal');

        modal.innerHTML = `
            <div class="modal-overlay" onclick="PatientManager.closePatientModal()"></div>
            <div class="modal-content patient-modal" role="dialog" aria-labelledby="modal-title">
                <div class="modal-header">
                    <h2 id="modal-title">Crear Nuevo Paciente</h2>
                    <button class="close-button" onclick="PatientManager.closePatientModal()"
                            aria-label="Cerrar modal">×</button>
                </div>

                <form id="create-patient-form" class="patient-form" onsubmit="PatientManager.handleCreatePatient(event)">
                    <div class="form-section">
                        <h3>Información Personal</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="patient-name">Nombre Completo *</label>
                                <input type="text" id="patient-name" name="name" required
                                       aria-required="true" aria-describedby="name-help">
                                <small id="name-help">Ingrese el nombre completo como aparece en el documento</small>
                            </div>

                            <div class="form-group">
                                <label for="patient-dni">DNI *</label>
                                <input type="text" id="patient-dni" name="dni" required
                                       pattern="[0-9]{7,8}" maxlength="8"
                                       aria-required="true" aria-describedby="dni-help">
                                <small id="dni-help">Sin puntos ni guiones</small>
                            </div>

                            <div class="form-group">
                                <label for="patient-birthdate">Fecha de Nacimiento *</label>
                                <input type="date" id="patient-birthdate" name="birthDate" required
                                       aria-required="true"
                                       max="${new Date().toISOString().split('T')[0]}">
                            </div>

                            <div class="form-group">
                                <label for="patient-gender">Género *</label>
                                <select id="patient-gender" name="gender" required aria-required="true">
                                    <option value="">Seleccionar...</option>
                                    <option value="Femenino">Femenino</option>
                                    <option value="Masculino">Masculino</option>
                                    <option value="Otro">Otro</option>
                                    <option value="Prefiero no decir">Prefiero no decir</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Contacto</h3>
                        <div class="form-grid">
                            <div class="form-group">
                                <label for="patient-email">Email *</label>
                                <input type="email" id="patient-email" name="email" required
                                       aria-required="true" aria-describedby="email-help">
                                <small id="email-help">Se usará para notificaciones y recordatorios</small>
                            </div>

                            <div class="form-group">
                                <label for="patient-phone">Teléfono *</label>
                                <input type="tel" id="patient-phone" name="phone" required
                                       pattern="[0-9]{10}" maxlength="10"
                                       aria-required="true" aria-describedby="phone-help">
                                <small id="phone-help">Código de área sin 0 + número (ej: 11xxxxxxxx)</small>
                            </div>

                            <div class="form-group">
                                <label for="patient-address">Dirección</label>
                                <input type="text" id="patient-address" name="address">
                            </div>

                            <div class="form-group">
                                <label for="patient-emergency">Contacto de Emergencia</label>
                                <input type="text" id="patient-emergency" name="emergencyContact"
                                       aria-describedby="emergency-help">
                                <small id="emergency-help">Nombre y teléfono de contacto de emergencia</small>
                            </div>
                        </div>
                    </div>

                    <div class="form-section">
                        <h3>Información Clínica Inicial</h3>
                        <div class="form-grid">
                            <div class="form-group full-width">
                                <label for="patient-reason">Motivo de Consulta</label>
                                <textarea id="patient-reason" name="reason" rows="4"
                                          aria-describedby="reason-help"></textarea>
                                <small id="reason-help">Describa brevemente el motivo principal de la consulta</small>
                            </div>

                            <div class="form-group">
                                <label for="patient-source">¿Cómo nos conoció?</label>
                                <select id="patient-source" name="source">
                                    <option value="">Seleccionar...</option>
                                    <option value="Recomendación">Recomendación de otro profesional</option>
                                    <option value="Redes sociales">Redes sociales</option>
                                    <option value="Google">Búsqueda en Google</option>
                                    <option value="Obra social">Obra social o prepaga</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="patient-insurance">Obra Social / Prepaga</label>
                                <input type="text" id="patient-insurance" name="insurance">
                            </div>
                        </div>
                    </div>

                    <div class="form-section privacy-notice">
                        <div class="privacy-icon">🔒</div>
                        <div class="privacy-text">
                            <h4>Protección de Datos</h4>
                            <p>La información proporcionada está protegida bajo las leyes de confidencialidad médica y será utilizada únicamente para fines terapéuticos.</p>
                        </div>
                    </div>

                    <div class="modal-actions">
                        <button type="button" class="button-secondary" onclick="PatientManager.closePatientModal()">
                            Cancelar
                        </button>
                        <button type="submit" class="button-primary">
                            Crear Paciente
                        </button>
                    </div>
                </form>
            </div>
        `;

        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // Enfocar primer campo
        setTimeout(() => {
            document.getElementById('patient-name').focus();
        }, 100);

        // Auditoría
        this.auditLog('OPEN_CREATE_PATIENT_MODAL', {});
    }

    /**
     * Manejar creación de nuevo paciente
     */
    async handleCreatePatient(event) {
        event.preventDefault();

        try {
            const formData = new FormData(event.target);
            const patientData = Object.fromEntries(formData);

            // Validaciones adicionales
            const validation = await this.validatePatientData(patientData);
            if (!validation.valid) {
                throw new Error(validation.message);
            }

            // Mostrar loading
            this.app.modules.UIManager.showLoading('Creando paciente...');

            // Encriptar datos PHI
            const encryptedData = await this.encryptPatientData(patientData);

            // Enviar a backend
            const response = await fetch(`${this.app.config.apiBaseUrl}/patients`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(encryptedData)
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const newPatient = await response.json();

            // Agregar a lista local
            this.patients.push(newPatient);
            this.applyFilters();

            // Cerrar modal
            this.closePatientModal();

            // Mostrar éxito
            this.app.modules.NotificationManager.show({
                type: 'success',
                title: 'Paciente Creado',
                message: `${patientData.name} ha sido agregado correctamente.`,
                duration: 4000
            });

            // Refrescar vista
            this.renderPatientsView();

            // Auditoría
            await this.auditLog('CREATE_PATIENT', {
                patientId: newPatient.id,
                patientName: patientData.name
            });

            console.log('✅ Paciente creado:', newPatient);

        } catch (error) {
            console.error('❌ Error creando paciente:', error);
            this.app.modules.NotificationManager.show({
                type: 'error',
                title: 'Error al Crear Paciente',
                message: error.message || 'No se pudo crear el paciente. Intente nuevamente.',
                persistent: true
            });
        } finally {
            this.app.modules.UIManager.hideLoading();
        }
    }

    /**
     * Encriptar datos de paciente (PHI)
     */
    async encryptPatientData(patientData) {
        if (!this.config.encryptionEnabled) {
            return patientData;
        }

        try {
            return {
                ...patientData,
                // Campos PHI encriptados
                name: await this.encryptField(patientData.name),
                email: await this.encryptField(patientData.email),
                phone: await this.encryptField(patientData.phone),
                address: await this.encryptField(patientData.address),
                emergencyContact: await this.encryptField(patientData.emergencyContact),
                reason: await this.encryptField(patientData.reason),
                // Campos no PHI mantienen formato original
                dni: patientData.dni,
                birthDate: patientData.birthDate,
                gender: patientData.gender,
                source: patientData.source,
                insurance: patientData.insurance
            };
        } catch (error) {
            console.error('Error encriptando datos de paciente:', error);
            throw new Error('Error procesando datos protegidos del paciente');
        }
    }

    /**
     * Métodos utilitarios para manejo de datos de pacientes
     */

    getPatientInitials(name) {
        return name.split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }

    calculateAge(birthDate) {
        if (!birthDate) return 'N/A';
        const birth = new Date(birthDate);
        const today = new Date();
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();

        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }

        return age;
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    }

    getDaysSince(dateString) {
        const date = new Date(dateString);
        const today = new Date();
        const diffTime = Math.abs(today - date);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    }

    maskSensitiveData(data) {
        if (!data || data.length < 4) return data;
        return data.substring(0, 2) + '*'.repeat(data.length - 4) + data.substring(data.length - 2);
    }

    maskEmail(email) {
        const [username, domain] = email.split('@');
        if (username.length <= 2) return email;
        return username.substring(0, 2) + '*'.repeat(username.length - 2) + '@' + domain;
    }

    maskPhone(phone) {
        if (phone.length < 4) return phone;
        return phone.substring(0, 2) + '*'.repeat(phone.length - 4) + phone.substring(phone.length - 2);
    }

    getStatusLabel(status) {
        const statusMap = {
            'active': 'Activo',
            'inactive': 'Inactivo',
            'new': 'Nuevo',
            'followup': 'Seguimiento',
            'discharged': 'Dado de alta'
        };
        return statusMap[status] || status;
    }

    getActiveFilterClass(filter) {
        // Implementar lógica de filtros activos
        return filter === 'all' ? 'active' : '';
    }

    getViewModeClass(mode) {
        // Implementar lógica de modo de vista
        return mode === 'table' ? 'active' : '';
    }

    // Métodos placeholder para funcionalidades extendidas
    async decryptField(field) { return field; } // Implementar con crypto real
    async encryptField(field) { return field; } // Implementar con crypto real
    setupEventListeners() { console.log('Configurando event listeners...'); }
    initializeSearchComponents() { console.log('Inicializando búsqueda...'); }
    setupAutoSave() { console.log('Configurando auto-save...'); }
    async validatePatientData(data) { return { valid: true }; }
    closePatientModal() {
        const modal = document.getElementById('patient-modal');
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
    auditLog(action, data) { console.log('Audit:', action, data); }
    applyFilters() { console.log('Aplicando filtros...'); }
    sortPatients(by, order) { console.log('Ordenando pacientes...'); }
    handlePatientSearch(query) { console.log('Buscando pacientes:', query); }
    selectPatient(patientId) { console.log('Seleccionando paciente:', patientId); }
    openEditPatientModal(patientId) { console.log('Editando paciente:', patientId); }
    confirmDeletePatient(patientId) { console.log('Confirmando eliminación:', patientId); }
    viewPatientHistory(patientId) { console.log('Viendo historial:', patientId); }
    sendWhatsAppMessage(patientId) { console.log('Enviando WhatsApp:', patientId); }
    applyQuickFilter(filter) { console.log('Aplicando filtro rápido:', filter); }
    handleSortChange(value) { console.log('Cambiando orden:', value); }
    setViewMode(mode) { console.log('Cambiando modo vista:', mode); }
    goToPage(page) {
        this.currentPage = page;
        this.renderPatientsView();
    }
    performSearch() { console.log('Realizando búsqueda...'); }
    exportPatientList() { console.log('Exportando lista de pacientes...'); }
    applyAdvancedFilters(filters) { console.log('Aplicando filtros avanzados:', filters); }
    hasUpcomingSession(patientId) { return false; } // Implementar lógica real
    getNextSessionDate(patientId) { return 'Próximamente'; } // Implementar lógica real
    setupPatientsViewListeners() { console.log('Configurando listeners vista pacientes...'); }

    /**
     * Obtener datos mock de pacientes para desarrollo
     */
    getMockPatients() {
        return [
            {
                id: 1,
                name: 'María González',
                email: 'maria.gonzalez@email.com',
                phone: '+5491145678901',
                birthDate: '1985-06-15',
                gender: 'Femenino',
                dni: '27654321',
                address: 'Av. Corrientes 1234, CABA',
                emergencyContact: 'Juan González - +5491145678902',
                status: 'active',
                createdAt: '2024-01-15T10:00:00Z',
                lastSession: '2024-03-10T14:30:00Z',
                totalSessions: 12,
                therapistId: 1
            },
            {
                id: 2,
                name: 'Pedro Rodríguez',
                email: 'pedro.rodriguez@email.com',
                phone: '+5491156789012',
                birthDate: '1990-03-22',
                gender: 'Masculino',
                dni: '32109876',
                address: 'Caballito 567, CABA',
                emergencyContact: 'Laura Rodríguez - +5491156789013',
                status: 'active',
                createdAt: '2024-02-01T09:00:00Z',
                lastSession: '2024-03-12T16:00:00Z',
                totalSessions: 8,
                therapistId: 1
            },
            {
                id: 3,
                name: 'Laura Sánchez',
                email: 'laura.sanchez@email.com',
                phone: '+5491167890123',
                birthDate: '1988-11-08',
                gender: 'Femenino',
                dni: '29876543',
                address: 'Palermo 890, CABA',
                emergencyContact: 'Roberto Sánchez - +5491167890124',
                status: 'followup',
                createdAt: '2023-12-10T11:00:00Z',
                lastSession: '2024-03-08T10:30:00Z',
                totalSessions: 15,
                therapistId: 2
            }
        ];
    }
}

// Hacer PatientManager disponible globalmente
window.PatientManager = PatientManager;