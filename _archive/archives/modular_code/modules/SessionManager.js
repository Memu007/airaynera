/**
 * AIRA Medical System - Session Manager Module
 * Workflow completo de sesiones terapéuticas con HIPAA compliance
 * Optimizado para psicólogos y psiquiatras
 */

class SessionManager {
    constructor(app) {
        this.app = app;
        this.currentSession = null;
        this.currentPatient = null;
        this.sessions = [];
        this.sessionTimer = null;
        this.sessionStartTime = null;
        this.autoSaveInterval = null;
        this.isRecording = false;
        this.recordingMediaRecorder = null;
        this.sessionNotes = '';
        this.sessionTags = [];

        // Configuración específica para sesiones médicas
        this.config = {
            sessionTimeout: 2 * 60 * 60 * 1000, // 2 horas máximo por sesión
            autoSaveInterval: 30 * 1000, // Auto-save cada 30 segundos
            maxRecordingDuration: 90 * 60 * 1000, // 90 minutos máximo grabación
            supportedAudioFormats: ['webm', 'mp3', 'wav'],
            encryptionEnabled: true,
            auditEnabled: true,
            sessionTypes: [
                'individual',
                'group',
                'family',
                'couple',
                'initial',
                'followup',
                'crisis',
                'evaluation'
            ],
            sessionStatuses: [
                'scheduled',
                'in_progress',
                'completed',
                'cancelled',
                'no_show',
                'rescheduled'
            ]
        };

        this.init();
    }

    /**
     * Inicializar Session Manager
     */
    async init() {
        console.log('🩺 Inicializando Session Manager para sesiones terapéuticas');

        // Cargar sesiones desde backend
        await this.loadSessions();

        // Configurar event listeners
        this.setupEventListeners();

        // Configurar grabación de audio
        this.setupAudioRecording();

        // Configurar auto-save para sesiones activas
        this.setupAutoSave();

        // Configurar timers y timeouts
        this.setupSessionTimers();

        console.log('✅ Session Manager inicializado');
    }

    /**
     * Cargar sesiones desde backend con seguridad HIPAA
     */
    async loadSessions() {
        try {
            const response = await fetch(`${this.app.config.apiBaseUrl}/sessions`, {
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

            // Desencriptar datos de sesiones (PHI)
            this.sessions = await this.decryptSessionData(encryptedData.sessions);

            console.log(`📋 Cargadas ${this.sessions.length} sesiones`);

        } catch (error) {
            console.error('❌ Error cargando sesiones:', error);
            this.app.modules.NotificationManager.show({
                type: 'error',
                title: 'Error de Conexión',
                message: 'No se pudieron cargar las sesiones. Intente nuevamente.',
                persistent: true
            });
        }
    }

    /**
     * Renderizar vista completa de sesiones
     */
    renderSessionsView() {
        const sessionsContainer = document.getElementById('medical-sessions');
        if (!sessionsContainer) return;

        sessionsContainer.innerHTML = `
            <div class="sessions-view">
                <!-- Header de gestión de sesiones -->
                <section class="sessions-header">
                    <div class="header-content">
                        <div class="header-left">
                            <h2>Gestión de Sesiones</h2>
                            <p class="sessions-count">
                                ${this.getActiveSessionsCount()} sesiones activas hoy
                            </p>
                        </div>
                        <div class="header-actions">
                            <button class="button-primary" onclick="SessionManager.startNewSession()">
                                <span class="icon">+</span>
                                Nueva Sesión
                            </button>
                            <button class="button-secondary whatsapp-btn" onclick="SessionManager.processWhatsAppSessions()">
                                <span class="icon">💬</span>
                                Procesar WhatsApp
                                <span class="badge">${this.getPendingWhatsAppCount()}</span>
                            </button>
                        </div>
                    </div>
                </section>

                <!-- Panel de sesión activa -->
                ${this.currentSession ? this.renderActiveSessionPanel() : this.renderNoActiveSession()}

                <!-- Tabs de navegación de sesiones -->
                <section class="sessions-tabs">
                    <div class="tab-navigation">
                        <button class="tab-btn ${this.getActiveTabClass('today')}"
                                onclick="SessionManager.switchTab('today')">
                            Sesiones de Hoy
                            <span class="tab-badge">${this.getTodaySessionsCount()}</span>
                        </button>
                        <button class="tab-btn ${this.getActiveTabClass('upcoming')}"
                                onclick="SessionManager.switchTab('upcoming')">
                            Próximas
                            <span class="tab-badge">${this.getUpcomingSessionsCount()}</span>
                        </button>
                        <button class="tab-btn ${this.getActiveTabClass('recent')}"
                                onclick="SessionManager.switchTab('recent')">
                            Recientes
                            <span class="tab-badge">${this.getRecentSessionsCount()}</span>
                        </button>
                        <button class="tab-btn ${this.getActiveTabClass('all')}"
                                onclick="SessionManager.switchTab('all')">
                            Todas
                        </button>
                    </div>
                </section>

                <!-- Contenido de las tabs -->
                <section class="sessions-content">
                    <div id="sessions-today" class="tab-content ${this.getActiveTabClass('today')}">
                        ${this.renderTodaySessions()}
                    </div>
                    <div id="sessions-upcoming" class="tab-content ${this.getActiveTabClass('upcoming')}" style="display: none;">
                        ${this.renderUpcomingSessions()}
                    </div>
                    <div id="sessions-recent" class="tab-content ${this.getActiveTabClass('recent')}" style="display: none;">
                        ${this.renderRecentSessions()}
                    </div>
                    <div id="sessions-all" class="tab-content ${this.getActiveTabClass('all')}" style="display: none;">
                        ${this.renderAllSessions()}
                    </div>
                </section>
            </div>

            <!-- Modal para nueva sesión -->
            <div id="session-modal" class="medical-modal" style="display: none;">
                <!-- Se renderizará dinámicamente -->
            </div>

            <!-- Modal para procesar WhatsApp -->
            <div id="whatsapp-modal" class="medical-modal" style="display: none;">
                <!-- Se renderizará dinámicamente -->
            </div>
        `;

        // Configurar listeners específicos de esta vista
        this.setupSessionsViewListeners();
    }

    /**
     * Renderizar panel de sesión activa
     */
    renderActiveSessionPanel() {
        const sessionDuration = this.getSessionDuration();
        const formattedDuration = this.formatDuration(sessionDuration);

        return `
            <section class="active-session-panel">
                <div class="panel-header">
                    <div class="session-info">
                        <h3>🩺 Sesión Activa</h3>
                        <div class="session-patient">
                            Paciente: <strong>${this.currentPatient?.name || 'No seleccionado'}</strong>
                        </div>
                        <div class="session-meta">
                            <span class="session-type">${this.getSessionTypeLabel(this.currentSession.type)}</span>
                            <span class="session-duration">
                                ⏱️ ${formattedDuration}
                            </span>
                            <span class="session-status in-progress">En curso</span>
                        </div>
                    </div>
                    <div class="session-controls">
                        ${this.isRecording ? `
                            <button class="control-btn recording" onclick="SessionManager.stopRecording()">
                                <span class="recording-indicator">🔴</span>
                                Detener Grabación
                            </button>
                        ` : `
                            <button class="control-btn" onclick="SessionManager.startRecording()">
                                🎤 Iniciar Grabación
                            </button>
                        `}
                        <button class="control-btn" onclick="SessionManager.pauseSession()">
                            ⏸️ Pausar
                        </button>
                        <button class="control-btn danger" onclick="SessionManager.confirmEndSession()">
                            ⏹️ Finalizar Sesión
                        </button>
                    </div>
                </div>

                <div class="panel-content">
                    <div class="session-main-content">
                        <div class="session-notes-section">
                            <div class="section-header">
                                <h4>Notas de la Sesión</h4>
                                <div class="auto-save-indicator">
                                    <span class="save-icon">💾</span>
                                    <span class="save-text">Guardado automático</span>
                                </div>
                            </div>
                            <textarea
                                id="session-notes"
                                class="session-notes-textarea"
                                placeholder="Ingrese notas detalladas de la sesión..."
                                oninput="SessionManager.updateSessionNotes(this.value)"
                                rows="8"
                            >${this.sessionNotes}</textarea>

                            <div class="notes-tools">
                                <div class="tags-section">
                                    <label>Etiquetas:</label>
                                    <div class="tags-container">
                                        ${this.renderSessionTags()}
                                        <input
                                            type="text"
                                            id="new-tag-input"
                                            placeholder="Agregar etiqueta..."
                                            class="tag-input"
                                            onkeypress="SessionManager.handleTagKeypress(event)"
                                        >
                                        <button class="add-tag-btn" onclick="SessionManager.addSessionTag()">
                                            + Agregar
                                        </button>
                                    </div>
                                </div>

                                <div class="quick-actions">
                                    <button class="quick-action-btn" onclick="SessionManager.insertTemplate('initial')">
                                        📝 Plantilla Inicial
                                    </button>
                                    <button class="quick-action-btn" onclick="SessionManager.insertTemplate('progress')">
                                        📈 Progreso
                                    </button>
                                    <button class="quick-action-btn" onclick="SessionManager.insertTemplate('interventions')">
                                        🎯 Intervenciones
                                    </button>
                                    <button class="quick-action-btn" onclick="SessionManager.insertTemplate('next_steps')">
                                        ➡️ Próximos Pasos
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="session-sidebar">
                            <div class="patient-context-card">
                                <h5>Contexto del Paciente</h5>
                                ${this.renderPatientContext()}
                            </div>

                            <div class="session-tools-card">
                                <h5>Herramientas de Sesión</h5>
                                <div class="tools-list">
                                    <button class="tool-btn" onclick="SessionManager.openAssessmentTools()">
                                        📊 Escalas de Evaluación
                                    </button>
                                    <button class="tool-btn" onclick="SessionManager.openResourceLibrary()">
                                        📚 Recursos Terapéuticos
                                    </button>
                                    <button class="tool-btn" onclick="SessionManager.openTreatmentPlan()">
                                        📋 Plan de Tratamiento
                                    </button>
                                    <button class="tool-btn" onclick="SessionManager.openSafetyChecklist()">
                                        🛡️ Checklist de Seguridad
                                    </button>
                                </div>
                            </div>

                            ${this.isRecording ? `
                                <div class="recording-status-card">
                                    <h5>Grabación Activa</h5>
                                    <div class="recording-info">
                                        <span class="recording-time">
                                            Grabando por ${this.getRecordingDuration()}
                                        </span>
                                        <div class="recording-controls">
                                            <button class="rec-control-btn" onclick="SessionManager.pauseRecording()">
                                                ⏸️ Pausar
                                            </button>
                                            <button class="rec-control-btn danger" onclick="SessionManager.stopRecording()">
                                                ⏹️ Detener
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </section>
        `;
    }

    /**
     * Renderizar cuando no hay sesión activa
     */
    renderNoActiveSession() {
        return `
            <section class="no-active-session">
                <div class="empty-session-content">
                    <div class="empty-icon">🩺</div>
                    <h3>No hay sesión activa</h3>
                    <p>Selecciona un paciente y comienza una nueva sesión terapéutica.</p>
                    <div class="session-start-actions">
                        <button class="button-primary large" onclick="SessionManager.startNewSession()">
                            <span class="icon">+</span>
                            Comenzar Nueva Sesión
                        </button>
                        <button class="button-secondary" onclick="SessionManager.selectPatientForSession()">
                            <span class="icon">👥</span>
                            Seleccionar Paciente
                        </button>
                        <button class="button-secondary whatsapp" onclick="SessionManager.processWhatsAppSessions()">
                            <span class="icon">💬</span>
                            Procesar Sesiones WhatsApp
                            <span class="badge">${this.getPendingWhatsAppCount()}</span>
                        </button>
                    </div>
                </div>
            </section>
        `;
    }

    /**
     * Renderizar sesiones de hoy
     */
    renderTodaySessions() {
        const todaySessions = this.getTodaySessions();

        if (todaySessions.length === 0) {
            return `
                <div class="empty-state">
                    <div class="empty-icon">📅</div>
                    <h3>No hay sesiones programadas para hoy</h3>
                    <p>Puedes comenzar una nueva sesión o procesar mensajes de WhatsApp.</p>
                    <div class="empty-actions">
                        <button class="button-primary" onclick="SessionManager.startNewSession()">
                            Nueva Sesión
                        </button>
                        <button class="button-secondary" onclick="SessionManager.processWhatsAppSessions()">
                            Procesar WhatsApp
                        </button>
                    </div>
                </div>
            `;
        }

        return `
            <div class="sessions-timeline">
                ${todaySessions.map(session => this.renderSessionCard(session)).join('')}
            </div>
        `;
    }

    /**
     * Renderizar tarjeta de sesión individual
     */
    renderSessionCard(session) {
        const sessionDate = new Date(session.scheduledDate);
        const now = new Date();
        const isPast = sessionDate < now;
        const isToday = sessionDate.toDateString() === now.toDateString();
        const isActive = session.status === 'in_progress';

        return `
            <div class="session-card ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}"
                 data-session-id="${session.id}">
                <div class="card-header">
                    <div class="session-time">
                        ${this.formatSessionTime(session.scheduledDate)}
                    </div>
                    <div class="session-status ${session.status}">
                        ${this.getSessionStatusLabel(session.status)}
                    </div>
                </div>

                <div class="card-content">
                    <div class="session-patient">
                        <div class="patient-avatar">
                            ${this.getPatientInitials(session.patientName)}
                        </div>
                        <div class="patient-info">
                            <h4>${session.patientName}</h4>
                            <p class="session-type">${this.getSessionTypeLabel(session.type)}</p>
                        </div>
                    </div>

                    <div class="session-details">
                        <div class="detail-item">
                            <span class="detail-label">Duración:</span>
                            <span class="detail-value">${session.duration || 60} min</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Modalidad:</span>
                            <span class="detail-value">${session.modality || 'Presencial'}</span>
                        </div>
                        ${session.notes ? `
                            <div class="detail-item">
                                <span class="detail-label">Notas:</span>
                                <span class="detail-value">${session.notes.substring(0, 100)}...</span>
                            </div>
                        ` : ''}
                    </div>
                </div>

                <div class="card-actions">
                    ${isActive ? `
                        <button class="action-btn primary" onclick="SessionManager.continueSession('${session.id}')">
                            Continuar Sesión
                        </button>
                    ` : isPast && session.status === 'scheduled' ? `
                        <button class="action-btn warning" onclick="SessionManager.startSession('${session.id}')">
                            Iniciar Sesión
                        </button>
                    ` : session.status === 'completed' ? `
                        <button class="action-btn secondary" onclick="SessionManager.viewSessionDetails('${session.id}')">
                            Ver Detalles
                        </button>
                    ` : ''}

                    <button class="action-btn secondary" onclick="SessionManager.rescheduleSession('${session.id}')">
                        Reagendar
                    </button>

                    ${session.source === 'whatsapp' ? `
                        <button class="action-btn whatsapp" onclick="SessionManager.viewWhatsAppMessage('${session.id}')">
                            📱 WhatsApp
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Comenzar nueva sesión
     */
    async startNewSession() {
        // Verificar si hay un paciente seleccionado
        if (!this.currentPatient) {
            this.openPatientSelection();
            return;
        }

        try {
            const sessionData = {
                patientId: this.currentPatient.id,
                patientName: this.currentPatient.name,
                type: 'individual',
                scheduledDate: new Date().toISOString(),
                status: 'in_progress',
                therapistId: this.app.currentUser.id,
                notes: '',
                tags: [],
                duration: 60,
                modality: 'virtual'
            };

            // Encriptar datos PHI
            const encryptedData = await this.encryptSessionData(sessionData);

            // Crear sesión en backend
            const response = await fetch(`${this.app.config.apiBaseUrl}/sessions`, {
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

            this.currentSession = await response.json();
            this.sessionStartTime = new Date();
            this.sessionNotes = '';
            this.sessionTags = [];

            // Iniciar timer de sesión
            this.startSessionTimer();

            // Iniciar auto-save
            this.startAutoSave();

            // Refrescar vista
            this.renderSessionsView();

            // Auditoría
            await this.auditLog('START_SESSION', {
                sessionId: this.currentSession.id,
                patientId: this.currentPatient.id
            });

            // Notificación
            this.app.modules.NotificationManager.show({
                type: 'success',
                title: 'Sesión Iniciada',
                message: `Sesión con ${this.currentPatient.name} ha comenzado.`,
                duration: 3000
            });

            console.log('✅ Nueva sesión iniciada:', this.currentSession);

        } catch (error) {
            console.error('❌ Error iniciando sesión:', error);
            this.app.modules.NotificationManager.show({
                type: 'error',
                title: 'Error al Iniciar Sesión',
                message: 'No se pudo iniciar la sesión. Intente nuevamente.',
                persistent: true
            });
        }
    }

    /**
     * Configurar grabación de audio
     */
    setupAudioRecording() {
        // Verificar soporte para MediaRecorder API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.warn('⚠️ MediaRecorder API no soportada');
            return;
        }

        // Configurar formatos de audio soportados
        this.supportedMimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4',
            'audio/ogg;codecs=opus',
            'audio/wav'
        ].filter(mimeType => MediaRecorder.isTypeSupported(mimeType));
    }

    /**
     * Iniciar grabación de sesión
     */
    async startRecording() {
        try {
            // Solicitar permisos de microfono
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            });

            // Determinar mejor formato disponible
            const mimeType = this.supportedMimeTypes[0] || 'audio/webm';

            // Crear MediaRecorder
            this.recordingMediaRecorder = new MediaRecorder(stream, {
                mimeType: mimeType,
                audioBitsPerSecond: 128000
            });

            // Array para almacenar chunks de audio
            this.recordedChunks = [];

            // Configurar eventos del recorder
            this.recordingMediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };

            this.recordingMediaRecorder.onstop = () => {
                this.processRecording();
            };

            this.recordingMediaRecorder.onerror = (event) => {
                console.error('❌ Error en grabación:', event.error);
                this.app.modules.NotificationManager.show({
                    type: 'error',
                    title: 'Error de Grabación',
                    message: 'Ocurrió un error al grabar el audio.',
                    persistent: true
                });
            };

            // Iniciar grabación
            this.recordingMediaRecorder.start(1000); // Grabar en chunks de 1 segundo
            this.isRecording = true;
            this.recordingStartTime = new Date();

            // Refrescar UI
            this.renderSessionsView();

            // Auditoría
            await this.auditLog('START_RECORDING', {
                sessionId: this.currentSession.id,
                format: mimeType
            });

            console.log('🎤 Grabación iniciada');

        } catch (error) {
            console.error('❌ Error iniciando grabación:', error);

            if (error.name === 'NotAllowedError') {
                this.app.modules.NotificationManager.show({
                    type: 'warning',
                    title: 'Permiso Requerido',
                    message: 'Se requiere permiso para acceder al micrófono. Por favor, permita el acceso.',
                    persistent: true
                });
            } else {
                this.app.modules.NotificationManager.show({
                    type: 'error',
                    title: 'Error de Grabación',
                    message: 'No se pudo iniciar la grabación. Verifique los permisos del micrófono.',
                    persistent: true
                });
            }
        }
    }

    /**
     * Detener grabación de sesión
     */
    async stopRecording() {
        if (!this.isRecording || !this.recordingMediaRecorder) {
            return;
        }

        try {
            // Detener recorder
            this.recordingMediaRecorder.stop();

            // Detener tracks de audio
            const tracks = this.recordingMediaRecorder.stream.getTracks();
            tracks.forEach(track => track.stop());

            this.isRecording = false;

            // Refrescar UI
            this.renderSessionsView();

            // Auditoría
            await this.auditLog('STOP_RECORDING', {
                sessionId: this.currentSession.id,
                duration: this.getRecordingDuration()
            });

            console.log('⏹️ Grabación detenida');

        } catch (error) {
            console.error('❌ Error deteniendo grabación:', error);
        }
    }

    /**
     * Procesar grabación completada
     */
    async processRecording() {
        try {
            if (this.recordedChunks.length === 0) {
                console.warn('⚠️ No hay datos de audio para procesar');
                return;
            }

            // Crear blob con los chunks grabados
            const mimeType = this.supportedMimeTypes[0] || 'audio/webm';
            const audioBlob = new Blob(this.recordedChunks, { type: mimeType });

            // Convertir a base64 para almacenamiento
            const audioBase64 = await this.blobToBase64(audioBlob);

            // Encriptar audio (PHI)
            const encryptedAudio = await this.encryptField(audioBase64);

            // Guardar en backend
            const recordingData = {
                sessionId: this.currentSession.id,
                audioData: encryptedAudio,
                mimeType: mimeType,
                duration: this.getRecordingDuration(),
                recordedAt: this.recordingStartTime.toISOString()
            };

            const response = await fetch(`${this.app.config.apiBaseUrl}/sessions/${this.currentSession.id}/recording`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(recordingData)
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();

            // Notificación de éxito
            this.app.modules.NotificationManager.show({
                type: 'success',
                title: 'Grabación Guardada',
                message: 'El audio de la sesión ha sido guardado correctamente.',
                duration: 4000
            });

            console.log('✅ Grabación procesada y guardada:', result);

            // Limpiar chunks
            this.recordedChunks = [];

        } catch (error) {
            console.error('❌ Error procesando grabación:', error);
            this.app.modules.NotificationManager.show({
                type: 'error',
                title: 'Error Guardando Grabación',
                message: 'No se pudo guardar la grabación. Intente nuevamente.',
                persistent: true
            });
        }
    }

    /**
     * Configurar auto-save para sesiones
     */
    setupAutoSave() {
        // Guardar cada 30 segundos
        this.autoSaveInterval = setInterval(async () => {
            if (this.currentSession && this.sessionNotes) {
                await this.autoSaveSession();
            }
        }, this.config.autoSaveInterval);
    }

    /**
     * Auto-guardar sesión actual
     */
    async autoSaveSession() {
        try {
            if (!this.currentSession) return;

            const sessionData = {
                notes: this.sessionNotes,
                tags: this.sessionTags,
                lastSaved: new Date().toISOString()
            };

            // Encriptar datos
            const encryptedData = await this.encryptSessionData(sessionData);

            const response = await fetch(`${this.app.config.apiBaseUrl}/sessions/${this.currentSession.id}/autosave`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(encryptedData)
            });

            if (!response.ok) {
                throw new Error(`Error ${response.status}: ${response.statusText}`);
            }

            // Actualizar indicador de guardado
            this.updateAutoSaveIndicator(true);

            console.log('💾 Sesión auto-guardada');

        } catch (error) {
            console.error('❌ Error auto-guardando sesión:', error);
            this.updateAutoSaveIndicator(false);
        }
    }

    /**
     * Métodos utilitarios para manejo de sesiones
     */

    getSessionDuration() {
        if (!this.sessionStartTime) return 0;
        return Date.now() - this.sessionStartTime.getTime();
    }

    getRecordingDuration() {
        if (!this.recordingStartTime) return '00:00';
        const duration = Date.now() - this.recordingStartTime.getTime();
        return this.formatDuration(duration);
    }

    formatDuration(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    formatSessionTime(dateString) {
        const date = new Date(dateString);
        return date.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getSessionTypeLabel(type) {
        const typeMap = {
            'individual': 'Individual',
            'group': 'Grupal',
            'family': 'Familiar',
            'couple': 'Pareja',
            'initial': 'Inicial',
            'followup': 'Seguimiento',
            'crisis': 'Crisis',
            'evaluation': 'Evaluación'
        };
        return typeMap[type] || type;
    }

    getSessionStatusLabel(status) {
        const statusMap = {
            'scheduled': 'Programada',
            'in_progress': 'En curso',
            'completed': 'Completada',
            'cancelled': 'Cancelada',
            'no_show': 'No asistió',
            'rescheduled': 'Reagendada'
        };
        return statusMap[status] || status;
    }

    getPatientInitials(name) {
        return name.split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    }

    // Métodos placeholder para funcionalidades extendidas
    async decryptSessionData(sessions) { return sessions; }
    async encryptSessionData(data) { return data; }
    async encryptField(field) { return field; }
    setupEventListeners() { console.log('Configurando event listeners de sesiones...'); }
    setupSessionTimers() { console.log('Configurando timers de sesión...'); }
    startSessionTimer() { console.log('Iniciando timer de sesión...'); }
    getActiveSessionsCount() { return 0; }
    getPendingWhatsAppCount() { return 0; }
    getTodaySessionsCount() { return 0; }
    getUpcomingSessionsCount() { return 0; }
    getRecentSessionsCount() { return 0; }
    getActiveTabClass(tab) { return tab === 'today' ? 'active' : ''; }
    getTodaySessions() { return []; }
    renderUpcomingSessions() { return '<p>Próximas sesiones...</p>'; }
    renderRecentSessions() { return '<p>Sesiones recientes...</p>'; }
    renderAllSessions() { return '<p>Todas las sesiones...</p>'; }
    renderSessionTags() { return '<span class="tag">Inicial</span>'; }
    renderPatientContext() { return '<p>Contexto del paciente...</p>'; }
    blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    updateAutoSaveIndicator(success) {
        const indicator = document.querySelector('.auto-save-indicator');
        if (indicator) {
            indicator.classList.toggle('success', success);
            indicator.classList.toggle('error', !success);
        }
    }
    async auditLog(action, data) { console.log('Session Audit:', action, data); }
    switchTab(tab) { console.log('Cambiando a tab:', tab); }
    processWhatsAppSessions() { console.log('Procesando sesiones WhatsApp...'); }
    selectPatientForSession() { console.log('Seleccionando paciente...'); }
    openPatientSelection() { console.log('Abriendo selección de paciente...'); }
    continueSession(sessionId) { console.log('Continuando sesión:', sessionId); }
    startSession(sessionId) { console.log('Iniciando sesión:', sessionId); }
    viewSessionDetails(sessionId) { console.log('Viendo detalles:', sessionId); }
    rescheduleSession(sessionId) { console.log('Reagendando sesión:', sessionId); }
    viewWhatsAppMessage(sessionId) { console.log('Viendo mensaje WhatsApp:', sessionId); }
    updateSessionNotes(notes) { this.sessionNotes = notes; }
    handleTagKeypress(event) {
        if (event.key === 'Enter') {
            this.addSessionTag();
        }
    }
    addSessionTag() {
        const input = document.getElementById('new-tag-input');
        if (input && input.value.trim()) {
            this.sessionTags.push(input.value.trim());
            input.value = '';
            this.renderSessionsView();
        }
    }
    insertTemplate(template) { console.log('Insertando plantilla:', template); }
    openAssessmentTools() { console.log('Abriendo herramientas de evaluación...'); }
    openResourceLibrary() { console.log('Abriendo biblioteca de recursos...'); }
    openTreatmentPlan() { console.log('Abriendo plan de tratamiento...'); }
    openSafetyChecklist() { console.log('Abriendo checklist de seguridad...'); }
    pauseRecording() { console.log('Pausando grabación...'); }
    pauseSession() { console.log('Pausando sesión...'); }
    confirmEndSession() { console.log('Confirmando fin de sesión...'); }
    setupSessionsViewListeners() { console.log('Configurando listeners vista sesiones...'); }
}

// Hacer SessionManager disponible globalmente
window.SessionManager = SessionManager;