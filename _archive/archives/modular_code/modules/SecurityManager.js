/**
 * AIRA Medical System - Security Manager Module
 * Seguridad médica en frontend con protección HIPAA
 * Optimizado para profesionales de la salud mental
 */

class SecurityManager {
    constructor(app) {
        this.app = app;
        this.encryptionKey = null;
        this.sessionTimeout = null;
        this.securityConfig = {
            maxSessionDuration: 60 * 60 * 1000, // 1 hora
            warningTime: 5 * 60 * 1000, // 5 minutos antes
            maxFailedAttempts: 3,
            lockoutDuration: 15 * 60 * 1000, // 15 minutos
            secureCookieAttributes: 'SameSite=Strict; Secure; HttpOnly',
            encryptionAlgorithm: 'AES-GCM',
            passwordMinLength: 12,
            sessionRenewalThreshold: 10 * 60 * 1000 // 10 minutos
        };

        // Estado de seguridad
        this.state = {
            isAuthenticated: false,
            userId: null,
            userRole: null,
            sessionStart: null,
            lastActivity: null,
            failedAttempts: 0,
            lockoutUntil: null,
            twoFactorRequired: false,
            securityLevel: 'STANDARD'
        };

        this.init();
    }

    /**
     * Inicializar Security Manager
     */
    init() {
        console.log('🔒 Inicializando Security Manager para protección médica');

        // Generar o cargar clave de encriptación
        this.initializeEncryption();

        // Configurar detección de actividad
        this.setupActivityDetection();

        // Configurar timeout de sesión
        this.setupSessionTimeout();

        // Configurar detección de seguridad
        this.setupSecurityDetection();

        // Configurar protección CSRF
        this.setupCSRFProtection();

        // Configurar headers de seguridad
        this.setupSecurityHeaders();

        // Verificar estado de sesión actual
        this.checkSessionStatus();

        console.log('✅ Security Manager inicializado');
    }

    /**
     * Inicializar sistema de encriptación
     */
    async initializeEncryption() {
        try {
            // Generar clave de encriptación única para esta sesión
            this.encryptionKey = await this.generateEncryptionKey();

            // Almacenar de forma segura (en memoria, no persistente)
            console.log('🔐 Sistema de encriptación inicializado');
        } catch (error) {
            console.error('❌ Error inicializando encriptación:', error);
            throw new Error('Error crítico de seguridad: No se pudo inicializar encriptación');
        }
    }

    /**
     * Generar clave de encriptación AES-GCM
     */
    async generateEncryptionKey() {
        try {
            // Generar clave aleatoria de 256 bits
            const key = await crypto.subtle.generateKey(
                {
                    name: 'AES-GCM',
                    length: 256
                },
                true, // extractable
                ['encrypt', 'decrypt']
            );

            return key;
        } catch (error) {
            console.error('❌ Error generando clave de encriptación:', error);
            throw error;
        }
    }

    /**
     * Configurar detección de actividad del usuario
     */
    setupActivityDetection() {
        const activityEvents = [
            'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'
        ];

        const updateActivity = () => {
            this.state.lastActivity = Date.now();
            this.resetSessionTimeout();
        };

        activityEvents.forEach(event => {
            document.addEventListener(event, updateActivity, true);
        });

        // Actualizar actividad cada minuto
        setInterval(() => {
            if (this.state.isAuthenticated) {
                this.state.lastActivity = Date.now();
            }
        }, 60000);
    }

    /**
     * Configurar timeout de sesión
     */
    setupSessionTimeout() {
        this.resetSessionTimeout();
    }

    /**
     * Resetear timeout de sesión
     */
    resetSessionTimeout() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }

        // Timeout para advertencia
        this.sessionTimeout = setTimeout(() => {
            this.showSessionWarning();
        }, this.securityConfig.maxSessionDuration - this.securityConfig.warningTime);

        // Timeout para logout
        setTimeout(() => {
            this.forceLogout('SESSION_TIMEOUT');
        }, this.securityConfig.maxSessionDuration);
    }

    /**
     * Mostrar advertencia de sesión
     */
    showSessionWarning() {
        // Emitir evento de advertencia
        document.dispatchEvent(new CustomEvent('sessionWarning', {
            detail: {
                message: 'Tu sesión expirará en 5 minutos por inactividad',
                remainingTime: this.securityConfig.warningTime
            }
        }));

        // Notificación al usuario
        if (this.app.modules.NotificationManager) {
            this.app.modules.NotificationManager.warning(
                'Sesión por Expirar',
                'Tu sesión expirará en 5 minutos. Guarda tu trabajo.',
                {
                    persistent: true,
                    actions: [
                        {
                            label: 'Extender Sesión',
                            action: () => this.extendSession()
                        }
                    ]
                }
            );
        }
    }

    /**
     * Extender sesión
     */
    extendSession() {
        this.state.lastActivity = Date.now();
        this.resetSessionTimeout();

        // Notificar al servidor
        this.renewSession();

        // Confirmar al usuario
        if (this.app.modules.NotificationManager) {
            this.app.modules.NotificationManager.success(
                'Sesión Extendida',
                'Tu sesión ha sido extendida por 1 hora más.'
            );
        }
    }

    /**
     * Configurar detección de seguridad
     */
    setupSecurityDetection() {
        // Detectar múltiples pestañas
        this.setupTabDetection();

        // Detectar cambios de red
        this.setupNetworkDetection();

        // Detectar inyección de código
        this.setupCodeInjectionDetection();

        // Detectar devtools abierto
        this.setupDevToolsDetection();
    }

    /**
     * Configurar detección de múltiples pestañas
     */
    setupTabDetection() {
        const channel = new BroadcastChannel('aira-security');

        channel.onmessage = (event) => {
            if (event.data.type === 'SESSION_CONFLICT') {
                this.handleSessionConflict();
            }
        };

        // Anunciar sesión activa
        setInterval(() => {
            if (this.state.isAuthenticated) {
                channel.postMessage({
                    type: 'SESSION_ACTIVE',
                    userId: this.state.userId,
                    timestamp: Date.now()
                });
            }
        }, 30000);
    }

    /**
     * Configurar detección de cambios de red
     */
    setupNetworkDetection() {
        window.addEventListener('online', () => {
            this.logSecurityEvent('NETWORK_CHANGE', 'Conexión restaurada');
            this.validateSession();
        });

        window.addEventListener('offline', () => {
            this.logSecurityEvent('NETWORK_CHANGE', 'Conexión perdida');
        });
    }

    /**
     * Configurar detección de inyección de código
     */
    setupCodeInjectionDetection() {
        // Monitorear cambios en DOM no autorizados
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            this.checkElementSecurity(node);
                        }
                    });
                }
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    /**
     * Verificar seguridad de elementos DOM
     */
    checkElementSecurity(element) {
        // Detectar scripts no autorizados
        if (element.tagName === 'SCRIPT') {
            const src = element.getAttribute('src');
            if (src && !this.isAllowedScript(src)) {
                this.logSecurityEvent('CODE_INJECTION', `Script no autorizado detectado: ${src}`);
                element.remove();
            }
        }

        // Detectar iframes no autorizados
        if (element.tagName === 'IFRAME') {
            const src = element.getAttribute('src');
            if (src && !this.isAllowedIframe(src)) {
                this.logSecurityEvent('CODE_INJECTION', `Iframe no autorizado detectado: ${src}`);
                element.remove();
            }
        }
    }

    /**
     * Verificar si script está permitido
     */
    isAllowedScript(src) {
        const allowedDomains = [
            location.hostname,
            'fonts.googleapis.com',
            'cdnjs.cloudflare.com',
            'www.googletagmanager.com'
        ];

        try {
            const url = new URL(src);
            return allowedDomains.some(domain => url.hostname.includes(domain));
        } catch {
            return false;
        }
    }

    /**
     * Verificar si iframe está permitido
     */
    isAllowedIframe(src) {
        // Generalmente no permitimos iframes por seguridad
        return false;
    }

    /**
     * Configurar detección de DevTools
     */
    setupDevToolsDetection() {
        let devtools = { open: false, orientation: null };

        const threshold = 160;

        setInterval(() => {
            if (window.outerHeight - window.innerHeight > threshold ||
                window.outerWidth - window.innerWidth > threshold) {
                if (!devtools.open) {
                    devtools.open = true;
                    this.logSecurityEvent('DEVTOOLS_OPENED', 'DevTools detectado');
                }
            } else {
                devtools.open = false;
            }
        }, 500);
    }

    /**
     * Configurar protección CSRF
     */
    setupCSRFProtection() {
        // Generar token CSRF
        this.csrfToken = this.generateCSRFToken();

        // Agregar token a todos los formularios
        document.addEventListener('DOMContentLoaded', () => {
            this.addCSRFToForms();
        });
    }

    /**
     * Generar token CSRF
     */
    generateCSRFToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Agregar token CSRF a formularios
     */
    addCSRFToForms() {
        const forms = document.querySelectorAll('form');
        forms.forEach(form => {
            if (!form.querySelector('input[name="_csrf"]')) {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = '_csrf';
                input.value = this.csrfToken;
                form.appendChild(input);
            }
        });
    }

    /**
     * Configurar headers de seguridad
     */
    setupSecurityHeaders() {
        // En producción, estos headers deben ser configurados en el servidor
        // Aquí los configuramos para solicitudes fetch
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            const [url, options = {}] = args;

            // Agregar headers de seguridad
            options.headers = {
                ...options.headers,
                'X-Requested-With': 'XMLHttpRequest',
                'X-CSRF-Token': this.csrfToken,
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache'
            };

            return originalFetch(url, options);
        };
    }

    /**
     * Verificar estado de sesión
     */
    async checkSessionStatus() {
        try {
            const token = localStorage.getItem('authToken');
            if (!token) {
                this.state.isAuthenticated = false;
                return;
            }

            // Verificar token con servidor
            const response = await fetch(`${this.app.config.apiBaseUrl}/auth/verify`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const userData = await response.json();
                this.setAuthenticatedState(userData);
            } else {
                this.state.isAuthenticated = false;
                localStorage.removeItem('authToken');
            }
        } catch (error) {
            console.error('Error verificando sesión:', error);
            this.state.isAuthenticated = false;
        }
    }

    /**
     * Establecer estado autenticado
     */
    setAuthenticatedState(userData) {
        this.state.isAuthenticated = true;
        this.state.userId = userData.id;
        this.state.userRole = userData.role;
        this.state.sessionStart = Date.now();
        this.state.lastActivity = Date.now();

        // Resetear intentos fallidos
        this.state.failedAttempts = 0;
        this.state.lockoutUntil = null;

        this.resetSessionTimeout();
    }

    /**
     * Manejar conflicto de sesión
     */
    handleSessionConflict() {
        this.logSecurityEvent('SESSION_CONFLICT', 'Múltiples sesiones detectadas');

        if (this.app.modules.NotificationManager) {
            this.app.modules.NotificationManager.security(
                'Conflicto de Sesión',
                'Se detectó otra sesión activa. Esta sesión será cerrada por seguridad.',
                {
                    persistent: true,
                    actions: [
                        {
                            label: 'Entendido',
                            action: () => this.forceLogout('SESSION_CONFLICT')
                        }
                    ]
                }
            );
        }

        // Forzar logout después de mostrar notificación
        setTimeout(() => {
            this.forceLogout('SESSION_CONFLICT');
        }, 5000);
    }

    /**
     * Forzar logout por razones de seguridad
     */
    forceLogout(reason) {
        this.logSecurityEvent('FORCED_LOGOUT', reason);

        // Limpiar estado
        this.state.isAuthenticated = false;
        this.state.userId = null;
        this.state.userRole = null;

        // Limpiar tokens
        localStorage.removeItem('authToken');
        sessionStorage.clear();

        // Emitir evento
        document.dispatchEvent(new CustomEvent('forceLogout', {
            detail: { reason }
        }));

        // Redirigir a login
        window.location.href = '/demo.html';
    }

    /**
     * Renovar sesión con servidor
     */
    async renewSession() {
        try {
            const response = await fetch(`${this.app.config.apiBaseUrl}/auth/renew`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.token) {
                    localStorage.setItem('authToken', data.token);
                }
            } else {
                console.warn('Error renovando sesión');
            }
        } catch (error) {
            console.error('Error renovando sesión:', error);
        }
    }

    /**
     * Validar sesión con servidor
     */
    async validateSession() {
        if (!this.state.isAuthenticated) return;

        try {
            const response = await fetch(`${this.app.config.apiBaseUrl}/auth/validate`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                this.forceLogout('SESSION_INVALID');
            }
        } catch (error) {
            console.error('Error validando sesión:', error);
        }
    }

    /**
     * Métodos de encriptación/desencriptación
     */

    /**
     * Encriptar datos
     */
    async encrypt(data) {
        if (!this.encryptionKey) {
            throw new Error('Clave de encriptación no disponible');
        }

        try {
            const encodedData = new TextEncoder().encode(JSON.stringify(data));
            const iv = crypto.getRandomValues(new Uint8Array(12)); // 96 bits IV para AES-GCM

            const encryptedData = await crypto.subtle.encrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.encryptionKey,
                encodedData
            );

            return {
                encryptedData: Array.from(new Uint8Array(encryptedData)),
                iv: Array.from(iv)
            };
        } catch (error) {
            console.error('Error encriptando datos:', error);
            throw error;
        }
    }

    /**
     * Desencriptar datos
     */
    async decrypt(encryptedData, iv) {
        if (!this.encryptionKey) {
            throw new Error('Clave de encriptación no disponible');
        }

        try {
            const decryptedData = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: new Uint8Array(iv)
                },
                this.encryptionKey,
                new Uint8Array(encryptedData)
            );

            const decodedData = new TextDecoder().decode(decryptedData);
            return JSON.parse(decodedData);
        } catch (error) {
            console.error('Error desencriptando datos:', error);
            throw error;
        }
    }

    /**
     * Hash de contraseña
     */
    async hashPassword(password, salt) {
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(password + salt);
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (error) {
            console.error('Error hasheando contraseña:', error);
            throw error;
        }
    }

    /**
     * Generar salt aleatorio
     */
    generateSalt() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    /**
     * Validar fortaleza de contraseña
     */
    validatePasswordStrength(password) {
        const checks = {
            length: password.length >= this.securityConfig.passwordMinLength,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            numbers: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        const score = Object.values(checks).filter(Boolean).length;

        return {
            score,
            maxScore: Object.keys(checks).length,
            strength: score >= 4 ? 'STRONG' : score >= 3 ? 'MEDIUM' : 'WEAK',
            checks
        };
    }

    /**
     * Logging de eventos de seguridad
     */
    logSecurityEvent(eventType, message, severity = 'MEDIUM') {
        if (this.app.modules.AuditManager) {
            this.app.modules.AuditManager.logSecurityEvent(
                this.app.currentUser,
                eventType,
                message
            );
        }

        console.warn(`🔒 Security Event [${eventType}]: ${message}`);

        // Emitir evento para que otros módulos reaccionen
        document.dispatchEvent(new CustomEvent('securityEvent', {
            detail: {
                type: eventType,
                message,
                severity,
                timestamp: new Date().toISOString()
            }
        }));
    }

    /**
     * Métodos públicos para verificación de seguridad
     */

    /**
     * Verificar si usuario está autenticado
     */
    isAuthenticated() {
        return this.state.isAuthenticated;
    }

    /**
     * Verificar rol de usuario
     */
    hasRole(requiredRole) {
        if (!this.state.isAuthenticated) return false;

        const roleHierarchy = {
            'admin': 3,
            'psychiatrist': 2,
            'psychologist': 2,
            'medical_professional': 1,
            'patient': 0
        };

        const userLevel = roleHierarchy[this.state.userRole] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        return userLevel >= requiredLevel;
    }

    /**
     * Obtener estado de seguridad actual
     */
    getSecurityState() {
        return {
            ...this.state,
            sessionDuration: this.state.sessionStart ? Date.now() - this.state.sessionStart : 0,
            timeUntilExpiry: this.state.lastActivity ?
                this.securityConfig.maxSessionDuration - (Date.now() - this.state.lastActivity) : 0
        };
    }

    /**
     * Limpiar recursos de seguridad
     */
    cleanup() {
        if (this.sessionTimeout) {
            clearTimeout(this.sessionTimeout);
        }

        // Limpiar clave de encriptación (simulado, en realidad no se puede limpiar completamente)
        this.encryptionKey = null;
    }
}

// Hacer SecurityManager disponible globalmente
window.SecurityManager = SecurityManager;