/**
 * AIRA Medical System - Accessibility Manager
 * WCAG 2.1 AA compliance para profesionales de la salud mental
 * Enfoque en accesibilidad para profesionales (35-65 años)
 */

class AccessibilityManager {
    constructor(app) {
        this.app = app;
        this.settings = this.loadAccessibilitySettings();
        this.isHighContrast = false;
        this.isLargeText = false;
        this.isReducedMotion = false;
        this.keyboardUser = false;

        this.init();
    }

    /**
     * Inicializar gestor de accesibilidad
     */
    init() {
        console.log('♿ Inicializando Accessibility Manager - WCAG 2.1 AA');

        // Detectar preferencias del usuario
        this.detectUserPreferences();

        // Aplicar configuración guardada
        this.applyAccessibilitySettings();

        // Configurar navegación por teclado
        this.setupKeyboardNavigation();

        // Configurar ARIA labels y roles
        this.setupARIA();

        // Configurar lectores de pantalla
        this.setupScreenReaderSupport();

        // Configurar anuncios dinámicos
        this.setupLiveRegions();

        // Configurar detección de usuario de teclado
        this.setupKeyboardUserDetection();

        console.log('✅ Accessibility Manager inicializado');
    }

    /**
     * Detectar preferencias de accesibilidad del sistema/navegador
     */
    detectUserPreferences() {
        // Detectar preferencia de movimiento reducido
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        this.isReducedMotion = prefersReducedMotion.matches;
        prefersReducedMotion.addEventListener('change', (e) => {
            this.isReducedMotion = e.matches;
            this.updateMotionPreference();
        });

        // Detectar preferencia de alto contraste
        const prefersHighContrast = window.matchMedia('(prefers-contrast: high)');
        this.isHighContrast = prefersHighContrast.matches;
        prefersHighContrast.addEventListener('change', (e) => {
            this.isHighContrast = e.matches;
            this.updateContrastPreference();
        });

        // Detectar preferencia de texto grande
        const prefersLargeText = window.matchMedia('(min-resolution: 120dpi)');
        this.isLargeText = prefersLargeText.matches;
    }

    /**
     * Cargar configuración de accesibilidad guardada
     */
    loadAccessibilitySettings() {
        try {
            const saved = localStorage.getItem('aira_accessibility');
            return saved ? JSON.parse(saved) : {
                highContrast: this.isHighContrast,
                largeText: this.isLargeText,
                reducedMotion: this.isReducedMotion,
                focusVisible: true,
                screenReaderOptimized: false,
                keyboardShortcuts: true,
                announcementsEnabled: true
            };
        } catch (error) {
            console.error('Error cargando configuración de accesibilidad:', error);
            return this.getDefaultSettings();
        }
    }

    /**
     * Obtener configuración por defecto
     */
    getDefaultSettings() {
        return {
            highContrast: false,
            largeText: false,
            reducedMotion: false,
            focusVisible: true,
            screenReaderOptimized: false,
            keyboardShortcuts: true,
            announcementsEnabled: true
        };
    }

    /**
     * Aplicar configuración de accesibilidad
     */
    applyAccessibilitySettings() {
        try {
            console.log('♿ Aplicando configuración de accesibilidad');
            const body = document.body;

            // Aplicar clases de accesibilidad
            body.classList.toggle('high-contrast', this.settings.highContrast);
            body.classList.toggle('large-text', this.settings.largeText);
            body.classList.toggle('reduced-motion', this.settings.reducedMotion);
            body.classList.toggle('focus-visible', this.settings.focusVisible);
            body.classList.toggle('screen-reader-optimized', this.settings.screenReaderOptimized);

            // Actualizar variables CSS
            this.updateCSSVariables();

            // Configurar atributos ARIA con manejo de errores
            this.updateARIAAttributes();

            // Aplicar configuración específica para healthcare
            this.applyHealthcareAccessibility();

            console.log('✅ Configuración de accesibilidad aplicada correctamente');
        } catch (error) {
            console.error('❌ Error aplicando configuración de accesibilidad:', error);
            // No lanzar el error para permitir que la aplicación continúe
        }
    }

    /**
     * Actualizar variables CSS dinámicas
     */
    updateCSSVariables() {
        const root = document.documentElement;

        if (this.settings.highContrast) {
            root.style.setProperty('--text-color', '#000000');
            root.style.setProperty('--background-color', '#ffffff');
            root.style.setProperty('--border-color', '#000000');
            root.style.setProperty('--link-color', '#0000ff');
            root.style.setProperty('--focus-color', '#ff0000');
        }

        if (this.settings.largeText) {
            root.style.setProperty('--base-font-size', '18px');
            root.style.setProperty('--heading-font-size', '24px');
            root.style.setProperty('--small-font-size', '16px');
        }

        if (this.settings.reducedMotion) {
            root.style.setProperty('--transition-duration', '0s');
            root.style.setProperty('--animation-duration', '0s');
        }
    }

    /**
     * Configurar navegación por teclado optimizada
     */
    setupKeyboardNavigation() {
        // Mapeo de atajos específicos para accesibilidad
        const accessibilityShortcuts = {
            'Alt+M': () => this.toggleAccessibilityMenu(),
            'Alt+C': () => this.toggleHighContrast(),
            'Alt+L': () => this.toggleLargeText(),
            'Alt+R': () => this.toggleReducedMotion(),
            'Alt+S': () => this.toggleScreenReaderMode(),
            'Alt+H': () => this.announceHelp(),
            'Escape': () => this.closeModalsAndMenus(),
            'Tab': () => this.handleTabNavigation(),
            'Enter': () => this.handleEnterActivation(),
            'Space': () => this.handleSpaceActivation()
        };

        // Configurar event listeners para teclado
        document.addEventListener('keydown', (e) => {
            // Solo procesar si no está en un input
            if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
                const key = this.getKeyboardShortcut(e);
                if (accessibilityShortcuts[key]) {
                    e.preventDefault();
                    accessibilityShortcuts[key]();
                }
            }
        });

        // Configurar skip links
        this.setupSkipLinks();

        // Configurar focus trapping para modales
        this.setupFocusTrapping();
    }

    /**
     * Configurar skip links para navegación rápida
     */
    setupSkipLinks() {
        const skipLinksHTML = `
            <div class="skip-links" role="navigation" aria-label="Enlaces rápidos">
                <a href="#main-content" class="skip-link">Saltar al contenido principal</a>
                <a href="#medical-navigation" class="skip-link">Saltar a navegación</a>
                <a href="#medical-search" class="skip-link">Saltar a búsqueda</a>
                <a href="#medical-sidebar" class="skip-link">Saltar a información contextual</a>
            </div>
        `;

        // Insertar al inicio del body
        document.body.insertAdjacentHTML('afterbegin', skipLinksHTML);
    }

    /**
     * Configurar ARIA labels y roles dinámicos
     */
    setupARIA() {
        // Configurar landmarks principales
        this.setupLandmarks();

        // Configurar regiones vivas para anuncios
        this.setupLiveRegions();

        // Configurar propiedades ARIA dinámicas
        this.setupDynamicARIA();

        // Configurar roles para widgets complejos
        this.setupWidgetRoles();
    }

    /**
     * Configurar landmarks ARIA principales
     */
    setupLandmarks() {
        // Header
        const header = document.querySelector('.medical-header');
        if (header) {
            header.setAttribute('role', 'banner');
            header.setAttribute('aria-label', 'Cabecera del sistema médico AIRA');
        }

        // Navegación principal
        const nav = document.querySelector('.medical-navigation');
        if (nav) {
            nav.setAttribute('role', 'navigation');
            nav.setAttribute('aria-label', 'Navegación principal del sistema');
        }

        // Contenido principal
        const main = document.querySelector('.medical-main');
        if (main) {
            main.setAttribute('role', 'main');
            main.setAttribute('aria-label', 'Contenido principal');
            main.id = 'main-content';
        }

        // Sidebar
        const sidebar = document.querySelector('.medical-sidebar');
        if (sidebar) {
            sidebar.setAttribute('role', 'complementary');
            sidebar.setAttribute('aria-label', 'Información contextual y acciones rápidas');
            sidebar.id = 'medical-sidebar';
        }

        // Búsqueda
        const search = document.querySelector('#patient-search-input');
        if (search) {
            search.setAttribute('role', 'search');
            search.setAttribute('aria-label', 'Buscar paciente por nombre o documento');
            search.id = 'medical-search';
        }

        // Notificaciones
        const notifications = document.querySelector('.medical-notifications');
        if (notifications) {
            notifications.setAttribute('role', 'status');
            notifications.setAttribute('aria-live', 'polite');
            notifications.setAttribute('aria-label', 'Notificaciones del sistema');
        }
    }

    /**
     * Configurar regiones vivas para anuncios dinámicos
     */
    setupLiveRegions() {
        // Crear contenedor para anuncios importantes
        const announcementsHTML = `
            <div
                id="aria-announcements"
                class="sr-only"
                role="status"
                aria-live="assertive"
                aria-atomic="true"
                aria-label="Anuncios importantes del sistema"
            ></div>
            <div
                id="aria-polite"
                class="sr-only"
                role="status"
                aria-live="polite"
                aria-atomic="true"
                aria-label="Información actualizada del sistema"
            ></div>
        `;

        document.body.insertAdjacentHTML('beforeend', announcementsHTML);
    }

    /**
     * Configurar soporte para lectores de pantalla
     */
    setupScreenReaderSupport() {
        // Configurar etiquetas descriptivas para elementos complejos
        this.addScreenReaderLabels();

        // Configurar descripciones para gráficos y tablas
        this.setupDataDescriptions();

        // Configurar orden de lectura lógico
        this.setupReadingOrder();

        // Agregar hidden text para contexto adicional
        this.addContextualInformation();
    }

    /**
     * Agregar etiquetas específicas para lectores de pantalla
     */
    addScreenReaderLabels() {
        // Labels para botones con iconos
        document.querySelectorAll('button[class*="icon-button"]').forEach(button => {
            if (!button.getAttribute('aria-label')) {
                const title = button.getAttribute('title');
                if (title) {
                    button.setAttribute('aria-label', title);
                }
            }
        });

        // Labels para elementos de navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            const label = item.querySelector('.nav-label')?.textContent;
            if (label && !item.getAttribute('aria-label')) {
                item.setAttribute('aria-label', `Navegar a ${label}`);
            }
        });

        // Labels para tarjetas de estadísticas
        document.querySelectorAll('.stat-card').forEach(card => {
            const title = card.querySelector('h3')?.textContent;
            const description = card.querySelector('p')?.textContent;
            if (title && description) {
                card.setAttribute('aria-label', `${title}: ${description}`);
            }
        });
    }

    /**
     * Configurar detección de usuario de teclado
     */
    setupKeyboardUserDetection() {
        let keyboardTimeout;

        const handleKeyboardUse = () => {
            this.keyboardUser = true;
            document.body.classList.add('keyboard-user');

            // Limpiar timeout existente
            clearTimeout(keyboardTimeout);

            // Después de 10 segundos sin uso de teclado, asumir uso de mouse
            keyboardTimeout = setTimeout(() => {
                this.keyboardUser = false;
                document.body.classList.remove('keyboard-user');
            }, 10000);
        };

        const handleMouseUse = () => {
            // Solo marcar como uso de mouse si no hay interacción reciente con teclado
            if (!this.keyboardUser) {
                document.body.classList.add('mouse-user');
            }
        };

        // Event listeners
        document.addEventListener('keydown', handleKeyboardUse);
        document.addEventListener('mousedown', handleMouseUse);
    }

    /**
     * Configurar focus trapping para modales
     */
    setupFocusTrapping() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                const activeModal = document.querySelector('.modal[aria-hidden="false"]');
                if (activeModal) {
                    this.trapFocus(e, activeModal);
                }
            }
        });
    }

    /**
     * Atrapar focus dentro de un modal
     */
    trapFocus(e, modal) {
        const focusableElements = modal.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
            if (document.activeElement === firstElement) {
                lastElement.focus();
                e.preventDefault();
            }
        } else {
            if (document.activeElement === lastElement) {
                firstElement.focus();
                e.preventDefault();
            }
        }
    }

    /**
     * Actualizar atributos ARIA dinámicamente
     */
    updateARIAAttributes() {
        try {
            console.log('🔧 Actualizando atributos ARIA dinámicos');
            this.setupLandmarks();
            this.setupDynamicARIA();
            this.setupWidgetRoles();
        } catch (error) {
            console.error('❌ Error actualizando atributos ARIA:', error);
        }
    }

    /**
     * Configurar landmarks ARIA principales
     */
    setupLandmarks() {
        // Header
        const header = document.querySelector('.medical-header');
        if (header) {
            header.setAttribute('role', 'banner');
            header.setAttribute('aria-label', 'Cabecera del sistema médico AIRA');
        }

        // Navegación principal
        const nav = document.querySelector('.medical-navigation');
        if (nav) {
            nav.setAttribute('role', 'navigation');
            nav.setAttribute('aria-label', 'Navegación principal del sistema');
        }

        // Contenido principal
        const main = document.querySelector('.medical-main');
        if (main) {
            main.setAttribute('role', 'main');
            main.setAttribute('aria-label', 'Contenido principal');
            main.id = 'main-content';
        }

        // Sidebar
        const sidebar = document.querySelector('.medical-sidebar');
        if (sidebar) {
            sidebar.setAttribute('role', 'complementary');
            sidebar.setAttribute('aria-label', 'Información contextual y acciones rápidas');
            sidebar.id = 'medical-sidebar';
        }

        // Búsqueda
        const search = document.querySelector('#patient-search-input');
        if (search) {
            search.setAttribute('role', 'search');
            search.setAttribute('aria-label', 'Buscar paciente por nombre o documento');
            search.id = 'medical-search';
        }

        // Notificaciones
        const notifications = document.querySelector('.medical-notifications');
        if (notifications) {
            notifications.setAttribute('role', 'status');
            notifications.setAttribute('aria-live', 'polite');
            notifications.setAttribute('aria-atomic', 'true');
            notifications.setAttribute('aria-label', 'Notificaciones del sistema');
        }
    }

    /**
     * Configurar propiedades ARIA dinámicas
     */
    setupDynamicARIA() {
        // Labels para botones con iconos
        document.querySelectorAll('button[class*="icon-button"]').forEach(button => {
            if (!button.getAttribute('aria-label')) {
                const title = button.getAttribute('title');
                if (title) {
                    button.setAttribute('aria-label', title);
                }
            }
        });

        // Labels para elementos de navegación
        document.querySelectorAll('.nav-item').forEach(item => {
            const label = item.querySelector('.nav-label')?.textContent;
            if (label && !item.getAttribute('aria-label')) {
                item.setAttribute('aria-label', `Navegar a ${label}`);
            }
        });

        // Labels para tarjetas de estadísticas
        document.querySelectorAll('.stat-card').forEach(card => {
            const title = card.querySelector('h3')?.textContent;
            const description = card.querySelector('p')?.textContent;
            if (title && description) {
                card.setAttribute('aria-label', `${title}: ${description}`);
            }
        });
    }

    /**
     * Configurar roles para widgets complejos
     */
    setupWidgetRoles() {
        // Implementar roles para widgets complejos
        console.log('🎭 Configurando roles para widgets complejos');
    }

    /**
     * Aplicar accesibilidad específica para healthcare
     */
    applyHealthcareAccessibility() {
        // Mejorar legibilidad de información médica crítica
        this.enhanceMedicalInformationLegibility();

        // Facilitar entrada de datos médicos
        this.optimizeMedicalDataEntry();

        // Mejorar accesibilidad de reportes clínicos
        this.enhanceClinicalReportsAccessibility();

        // Optimizar para profesionales con posible fatiga visual
        this.optimizeForVisualFatigue();
    }

    /**
     * Mejorar legibilidad de información médica crítica
     */
    enhanceMedicalInformationLegibility() {
        // Asegurar contraste suficiente para información médica
        const medicalInfo = document.querySelectorAll('.patient-data, .session-info, .medical-alert');
        medicalInfo.forEach(element => {
            element.classList.add('medical-critical-info');
        });

        // Agregar indicadores visuales adicionales
        const criticalElements = document.querySelectorAll('[data-critical="true"]');
        criticalElements.forEach(element => {
            element.setAttribute('role', 'alert');
            element.setAttribute('aria-live', 'assertive');
        });
    }

    /**
     * Optimizar entrada de datos médicos
     */
    optimizeMedicalDataEntry() {
        // Configurar autocompletado apropiado para campos médicos
        const medicalInputs = document.querySelectorAll('input[data-medical-field]');
        medicalInputs.forEach(input => {
            // Configurar autocomplete apropiado
            const fieldType = input.dataset.medicalField;
            const autocompleteMap = {
                'patient-name': 'name',
                'patient-dni': 'off',
                'patient-phone': 'tel',
                'patient-email': 'email',
                'session-notes': 'off'
            };

            input.setAttribute('autocomplete', autocompleteMap[fieldType] || 'off');

            // Agregar descripciones para lectores de pantalla
            const description = document.createElement('div');
            description.id = `${input.id}-description`;
            description.className = 'sr-only';
            description.textContent = this.getMedicalFieldDescription(fieldType);
            input.parentNode.appendChild(description);
            input.setAttribute('aria-describedby', description.id);
        });
    }

    /**
     * Obtener descripción para campos médicos
     */
    getMedicalFieldDescription(fieldType) {
        const descriptions = {
            'patient-name': 'Ingrese el nombre completo del paciente',
            'patient-dni': 'Ingrese el número de documento del paciente sin guiones ni puntos',
            'patient-phone': 'Ingrese el número de teléfono del paciente con código de área',
            'patient-email': 'Ingrese el correo electrónico del paciente para notificaciones',
            'session-notes': 'Ingrese notas detalladas de la sesión clínica. Este campo es confidencial'
        };
        return descriptions[fieldType] || '';
    }

    /**
     * Métodos públicos para control de accesibilidad
     */

    /**
     * Anunciar mensaje para lectores de pantalla
     */
    announce(message, priority = 'polite') {
        const liveRegion = document.getElementById(
            priority === 'assertive' ? 'aria-announcements' : 'aria-polite'
        );

        if (liveRegion && this.settings.announcementsEnabled) {
            liveRegion.textContent = message;

            // Limpiar después de un tiempo para permitir repetir el mismo mensaje
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Toggle alto contraste
     */
    toggleHighContrast() {
        this.settings.highContrast = !this.settings.highContrast;
        this.applyAccessibilitySettings();
        this.saveAccessibilitySettings();
        this.announce(
            this.settings.highContrast ?
            'Alto contraste activado' :
            'Alto contraste desactivado'
        );
    }

    /**
     * Toggle texto grande
     */
    toggleLargeText() {
        this.settings.largeText = !this.settings.largeText;
        this.applyAccessibilitySettings();
        this.saveAccessibilitySettings();
        this.announce(
            this.settings.largeText ?
            'Texto grande activado' :
            'Texto grande desactivado'
        );
    }

    /**
     * Toggle movimiento reducido
     */
    toggleReducedMotion() {
        this.settings.reducedMotion = !this.settings.reducedMotion;
        this.applyAccessibilitySettings();
        this.saveAccessibilitySettings();
        this.announce(
            this.settings.reducedMotion ?
            'Animaciones reducidas' :
            'Animaciones normales'
        );
    }

    /**
     * Toggle modo lector de pantalla
     */
    toggleScreenReaderMode() {
        this.settings.screenReaderOptimized = !this.settings.screenReaderOptimized;
        this.applyAccessibilitySettings();
        this.saveAccessibilitySettings();
        this.announce(
            this.settings.screenReaderOptimized ?
            'Modo lector de pantalla optimizado activado' :
            'Modo lector de pantalla optimizado desactivado'
        );
    }

    /**
     * Mostrar menú de accesibilidad
     */
    showAccessibilityMenu() {
        // Implementar menú de accesibilidad
        console.log('Mostrando menú de accesibilidad...');
        this.announce('Menú de accesibilidad abierto');
    }

    /**
     * Guardar configuración de accesibilidad
     */
    saveAccessibilitySettings() {
        try {
            localStorage.setItem('aira_accessibility', JSON.stringify(this.settings));
        } catch (error) {
            console.error('Error guardando configuración de accesibilidad:', error);
        }
    }

    /**
     * Obtener shortcut de teclado
     */
    getKeyboardShortcut(e) {
        const parts = [];
        if (e.altKey) parts.push('Alt');
        if (e.ctrlKey) parts.push('Ctrl');
        if (e.shiftKey) parts.push('Shift');
        if (e.metaKey) parts.push('Meta');

        let key = e.key;
        if (key === ' ') key = 'Space';
        if (key === 'Escape') key = 'Escape';

        parts.push(key);
        return parts.join('+');
    }

    /**
     * Manejar navegación con Tab
     */
    handleTabNavigation() {
        if (!this.keyboardUser) {
            this.keyboardUser = true;
            document.body.classList.add('keyboard-user');
        }
    }

    /**
     * Manejar activación con Enter
     */
    handleEnterActivation() {
        // Lógica específica para activación con Enter
    }

    /**
     * Manejar activación con Espacio
     */
    handleSpaceActivation() {
        // Lógica específica para activación con Espacio
    }

    /**
     * Cerrar modales y menús con Escape
     */
    closeModalsAndMenus() {
        // Implementar cierre de modales y menús
        console.log('Cerrando modales y menús...');
    }

    /**
     * Anunciar ayuda contextual
     */
    announceHelp() {
        const helpText = `
            Atajos de accesibilidad disponibles:
            Alt+M: Abrir menú de accesibilidad
            Alt+C: Alternar alto contraste
            Alt+L: Alternar texto grande
            Alt+R: Alternar animaciones reducidas
            Alt+S: Alternar modo lector de pantalla
            Alt+H: Escuchar esta ayuda
            Tab: Navegar entre elementos
            Escape: Cerrar diálogos y menús
        `;

        this.announce(helpText, 'assertive');
    }

    /**
     * Toggle menú de accesibilidad
     */
    toggleAccessibilityMenu() {
        this.showAccessibilityMenu();
    }

    /**
     * Actualizar preferencia de contraste
     */
    updateContrastPreference() {
        this.settings.highContrast = this.isHighContrast;
        this.applyAccessibilitySettings();
        this.saveAccessibilitySettings();
    }

    /**
     * Actualizar preferencia de movimiento
     */
    updateMotionPreference() {
        this.settings.reducedMotion = this.isReducedMotion;
        this.applyAccessibilitySettings();
        this.saveAccessibilitySettings();
    }

    /**
     * Optimizar para fatiga visual de profesionales
     */
    optimizeForVisualFatigue() {
        // Aumentar espaciado entre elementos importantes
        const importantElements = document.querySelectorAll('.patient-info, .session-data, .medical-alert');
        importantElements.forEach(element => {
            element.style.marginBottom = 'var(--spacing-large)';
            element.style.padding = 'var(--spacing-medium)';
        });

        // Mejorar tamaño de click targets para botones importantes
        const importantButtons = document.querySelectorAll('.action-button, .button-primary');
        importantButtons.forEach(button => {
            button.style.minHeight = '48px';
            button.style.minWidth = '48px';
        });
    }

    // Métodos placeholder para funcionalidades extendidas
    setupDynamicARIA() {
        // Implementar configuración ARIA dinámica
        console.log('Configurando ARIA dinámico...');
    }

    setupWidgetRoles() {
        // Implementar roles para widgets complejos
        console.log('Configurando roles para widgets...');
    }

    setupDataDescriptions() {
        // Implementar descripciones para datos complejos
        console.log('Configurando descripciones de datos...');
    }

    setupReadingOrder() {
        // Implementar orden de lectura lógico
        console.log('Configurando orden de lectura...');
    }

    addContextualInformation() {
        // Implementar información contextual adicional
        console.log('Agregando información contextual...');
    }

    enhanceClinicalReportsAccessibility() {
        // Implementar accesibilidad mejorada para reportes
        console.log('Mejorando accesibilidad de reportes clínicos...');
    }
}

// Hacer AccessibilityManager disponible globalmente
window.AccessibilityManager = AccessibilityManager;