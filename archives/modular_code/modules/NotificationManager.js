/**
 * AIRA Medical System - Notification Manager Module
 * Sistema de alertas médicas con priorización para profesionales
 * Optimizado para psicólogos y psiquiatras
 */

class NotificationManager {
    constructor(app) {
        this.app = app;
        this.notifications = [];
        this.maxNotifications = 5;
        this.notificationQueue = [];
        this.audioContext = null;
        this.soundEnabled = true;
        this.vibrationEnabled = true;

        // Configuración específica para notificaciones médicas
        this.config = {
            autoHide: {
                success: 4000,
                info: 6000,
                warning: 8000,
                error: 10000
            },
            maxVisibleNotifications: 5,
            soundEnabled: true,
            vibrationEnabled: 'vibrate' in navigator,
            position: 'top-right',
            allowHTML: false,
            showProgress: false,
            pauseOnHover: true
        };

        // Tipos de notificaciones médicas
        this.notificationTypes = {
            success: {
                icon: '✅',
                color: '#48bb78',
                sound: 'success',
                priority: 'low'
            },
            info: {
                icon: 'ℹ️',
                color: '#4299e1',
                sound: 'info',
                priority: 'normal'
            },
            warning: {
                icon: '⚠️',
                color: '#ed8936',
                sound: 'warning',
                priority: 'high'
            },
            error: {
                icon: '❌',
                color: '#f56565',
                sound: 'error',
                priority: 'critical'
            },
            medical: {
                icon: '🏥',
                color: '#805ad5',
                sound: 'medical',
                priority: 'high'
            },
            session: {
                icon: '🩺',
                color: '#2c7a7b',
                sound: 'session',
                priority: 'normal'
            },
            whatsapp: {
                icon: '💬',
                color: '#25d366',
                sound: 'whatsapp',
                priority: 'high'
            },
            security: {
                icon: '🔒',
                color: '#e53e3e',
                sound: 'security',
                priority: 'critical'
            }
        };

        this.init();
    }

    /**
     * Inicializar Notification Manager
     */
    init() {
        console.log('🔔 Inicializando Notification Manager para alertas médicas');

        // Configurar contenedor de notificaciones
        this.setupNotificationContainer();

        // Inicializar contexto de audio para sonidos
        this.setupAudioContext();

        // Configurar manejo de permisos
        this.setupPermissions();

        // Configurar listeners para eventos del sistema
        this.setupSystemListeners();

        // Limpiar notificaciones antiguas periódicamente
        this.setupCleanupTimer();

        console.log('✅ Notification Manager inicializado');
    }

    /**
     * Configurar contenedor de notificaciones
     */
    setupNotificationContainer() {
        const container = document.getElementById('medical-notifications');
        if (!container) {
            console.warn('⚠️ Contenedor de notificaciones no encontrado');
            return;
        }

        // Aplicar estilos base al contenedor
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            pointer-events: none;
            max-width: 420px;
            width: 100%;
        `;

        this.container = container;
    }

    /**
     * Inicializar contexto de audio para sonidos
     */
    setupAudioContext() {
        try {
            // Crear contexto de audio para sonidos del sistema
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Sonidos predefinidos para diferentes tipos de alerta
            this.sounds = {
                success: this.createTone(800, 0.1),
                info: this.createTone(600, 0.1),
                warning: this.createTone(400, 0.2),
                error: this.createTone(300, 0.3),
                medical: this.createTone(500, 0.2),
                session: this.createTone(700, 0.15),
                whatsapp: this.createTone(1000, 0.1),
                security: this.createTone(200, 0.4)
            };
        } catch (error) {
            console.warn('⚠️ No se pudo inicializar contexto de audio:', error);
            this.soundEnabled = false;
        }
    }

    /**
     * Crear tono de audio
     */
    createTone(frequency, duration) {
        if (!this.audioContext) return null;

        return {
            frequency,
            duration,
            play: () => {
                try {
                    // Reanudar AudioContext si está suspendido
                    if (this.audioContext.state === 'suspended') {
                        this.audioContext.resume();
                    }

                    const oscillator = this.audioContext.createOscillator();
                    const gainNode = this.audioContext.createGain();

                    oscillator.connect(gainNode);
                    gainNode.connect(this.audioContext.destination);

                    oscillator.frequency.value = frequency;
                    oscillator.type = 'sine';

                    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
                    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

                    oscillator.start(this.audioContext.currentTime);
                    oscillator.stop(this.audioContext.currentTime + duration);
                } catch (error) {
                    console.warn('⚠️ Error reproduciendo tono:', error);
                    // No mostrar error al usuario para no interrumpir
                }
            }
        };
    }

    /**
     * Configurar manejo de permisos
     */
    setupPermissions() {
        // Verificar permisos de notificación del navegador
        if ('Notification' in window) {
            if (Notification.permission === 'default') {
                // Solicitar permiso de forma no intrusiva
                this.requestNotificationPermission();
            }
        }

        // Verificar soporte para vibración
        if (!('vibrate' in navigator)) {
            this.vibrationEnabled = false;
        }
    }

    /**
     * Solicitar permiso de notificación del navegador
     */
    async requestNotificationPermission() {
        try {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                console.log('✅ Permiso de notificación concedido');
            } else {
                console.log('ℹ️ Permiso de notificación denegado');
            }
        } catch (error) {
            console.warn('⚠️ Error solicitando permiso de notificación:', error);
        }
    }

    /**
     * Configurar listeners para eventos del sistema
     */
    setupSystemListeners() {
        // Eventos de sesión
        document.addEventListener('sessionStarted', (e) => {
            this.show({
                type: 'session',
                title: 'Sesión Iniciada',
                message: `Sesión con ${e.detail.patientName} ha comenzado.`,
                persistent: false
            });
        });

        document.addEventListener('sessionEnded', (e) => {
            this.show({
                type: 'success',
                title: 'Sesión Finalizada',
                message: `Sesión con ${e.detail.patientName} completada exitosamente.`,
                persistent: false
            });
        });

        // Eventos de seguridad
        document.addEventListener('securityEvent', (e) => {
            this.show({
                type: 'security',
                title: 'Alerta de Seguridad',
                message: e.detail.message,
                persistent: true,
                actions: e.detail.actions || []
            });
        });

        // Eventos de WhatsApp
        document.addEventListener('whatsappMessage', (e) => {
            this.show({
                type: 'whatsapp',
                title: 'Mensaje WhatsApp',
                message: `Nuevo mensaje de ${e.detail.patientName}`,
                persistent: false,
                actions: [
                    {
                        label: 'Ver',
                        action: () => window.location.hash = '#sessions'
                    }
                ]
            });
        });

        // Eventos de error del sistema
        window.addEventListener('error', (e) => {
            this.show({
                type: 'error',
                title: 'Error del Sistema',
                message: 'Ha ocurrido un error inesperado. El equipo técnico ha sido notificado.',
                persistent: false
            });
        });

        // Eventos de conexión
        window.addEventListener('online', () => {
            this.show({
                type: 'success',
                title: 'Conexión Restablecida',
                message: 'La conexión a internet ha sido restablecida.',
                persistent: false
            });
        });

        window.addEventListener('offline', () => {
            this.show({
                type: 'warning',
                title: 'Sin Conexión',
                message: 'Se ha perdido la conexión a internet. Algunas funciones pueden no estar disponibles.',
                persistent: true
            });
        });
    }

    /**
     * Configurar timer de limpieza
     */
    setupCleanupTimer() {
        // Limpiar notificaciones expiradas cada minuto
        setInterval(() => {
            this.cleanupExpiredNotifications();
        }, 60000);
    }

    /**
     * Mostrar notificación principal
     */
    show(options) {
        // Normalizar opciones
        const notification = this.normalizeNotification(options);

        // Verificar límite de notificaciones visibles
        if (this.notifications.length >= this.maxNotifications) {
            // Agregar a cola si no hay espacio
            this.notificationQueue.push(notification);
            return;
        }

        // Crear y mostrar notificación
        this.createNotification(notification);

        // Sonido y vibración si están habilitados
        this.triggerNotificationFeedback(notification);

        // Logging de auditoría
        this.auditNotification(notification);

        return notification.id;
    }

    /**
     * Normalizar opciones de notificación
     */
    normalizeNotification(options) {
        const type = options.type || 'info';
        const config = this.notificationTypes[type] || this.notificationTypes.info;

        return {
            id: this.generateId(),
            type,
            title: options.title || 'Notificación',
            message: options.message || '',
            icon: options.icon || config.icon,
            color: config.color,
            priority: options.priority || config.priority,
            duration: options.duration || this.config.autoHide[type] || 6000,
            persistent: options.persistent || false,
            actions: options.actions || [],
            timestamp: new Date(),
            autoHide: options.autoHide !== false && !options.persistent,
            showProgress: options.showProgress || false,
            pauseOnHover: options.pauseOnHover !== false
        };
    }

    /**
     * Crear elemento de notificación
     */
    createNotification(notification) {
        const element = document.createElement('div');
        element.className = 'medical-notification';
        element.dataset.notificationId = notification.id;
        element.style.cssText = `
            background: white;
            border-left: 4px solid ${notification.color};
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
            margin-bottom: 12px;
            overflow: hidden;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            pointer-events: auto;
            position: relative;
        `;

        // Contenido de la notificación
        element.innerHTML = `
            <div class="notification-content" style="padding: 16px;">
                <div class="notification-header" style="display: flex; align-items: flex-start; margin-bottom: 8px;">
                    <span class="notification-icon" style="
                        font-size: 20px;
                        margin-right: 12px;
                        line-height: 1;
                    ">${notification.icon}</span>
                    <div class="notification-title" style="
                        font-weight: 600;
                        color: #2d3748;
                        flex: 1;
                        margin-right: 8px;
                    ">${notification.title}</div>
                    ${!notification.persistent ? `
                        <button class="notification-close" onclick="NotificationManager.hide('${notification.id}')" style="
                            background: none;
                            border: none;
                            color: #718096;
                            cursor: pointer;
                            font-size: 16px;
                            padding: 0;
                            line-height: 1;
                            opacity: 0.7;
                            transition: opacity 0.2s;
                        " onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'">×</button>
                    ` : ''}
                </div>

                ${notification.message ? `
                    <div class="notification-message" style="
                        color: #718096;
                        font-size: 14px;
                        line-height: 1.5;
                        margin-bottom: 12px;
                    ">${notification.message}</div>
                ` : ''}

                ${notification.actions && notification.actions.length > 0 ? `
                    <div class="notification-actions" style="
                        display: flex;
                        gap: 8px;
                        flex-wrap: wrap;
                    ">
                        ${notification.actions.map(action => `
                            <button class="notification-action" onclick="NotificationManager.handleAction('${notification.id}', '${action.label}')" style="
                                background: ${notification.color};
                                color: white;
                                border: none;
                                padding: 6px 12px;
                                border-radius: 4px;
                                font-size: 12px;
                                cursor: pointer;
                                transition: opacity 0.2s;
                            " onmouseover="this.style.opacity='0.8'" onmouseout="this.style.opacity='1'">
                                ${action.label}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                ${notification.showProgress && notification.autoHide ? `
                    <div class="notification-progress" style="
                        height: 3px;
                        background: #e2e8f0;
                        border-radius: 0 0 0 0;
                        overflow: hidden;
                        margin-top: 8px;
                    ">
                        <div class="progress-bar" style="
                            height: 100%;
                            background: ${notification.color};
                            width: 100%;
                            animation: progress ${notification.duration}ms linear;
                        "></div>
                    </div>
                ` : ''}
            </div>
        `;

        // Agregar a contenedor
        this.container.appendChild(element);

        // Agregar al array de notificaciones activas
        this.notifications.push({
            ...notification,
            element,
            timeoutId: null
        });

        // Animación de entrada
        requestAnimationFrame(() => {
            element.style.opacity = '1';
            element.style.transform = 'translateX(0)';
        });

        // Configurar auto-hide si aplica
        if (notification.autoHide && notification.duration > 0) {
            const timeoutId = setTimeout(() => {
                this.hide(notification.id);
            }, notification.duration);

            // Guardar timeout ID para limpieza
            const notificationIndex = this.notifications.findIndex(n => n.id === notification.id);
            if (notificationIndex !== -1) {
                this.notifications[notificationIndex].timeoutId = timeoutId;
            }
        }

        // Configurar eventos de hover si aplica
        if (notification.pauseOnHover) {
            element.addEventListener('mouseenter', () => {
                const notificationIndex = this.notifications.findIndex(n => n.id === notification.id);
                if (notificationIndex !== -1 && this.notifications[notificationIndex].timeoutId) {
                    clearTimeout(this.notifications[notificationIndex].timeoutId);
                    this.notifications[notificationIndex].timeoutId = null;
                }
            });

            element.addEventListener('mouseleave', () => {
                if (notification.autoHide && notification.duration > 0) {
                    const timeoutId = setTimeout(() => {
                        this.hide(notification.id);
                    }, 1000); // Dar 1 segundo después de quitar el mouse

                    const notificationIndex = this.notifications.findIndex(n => n.id === notification.id);
                    if (notificationIndex !== -1) {
                        this.notifications[notificationIndex].timeoutId = timeoutId;
                    }
                }
            });
        }

        return element;
    }

    /**
     * Ocultar notificación específica
     */
    hide(notificationId) {
        const notificationIndex = this.notifications.findIndex(n => n.id === notificationId);
        if (notificationIndex === -1) return;

        const notification = this.notifications[notificationIndex];

        // Limpiar timeout si existe
        if (notification.timeoutId) {
            clearTimeout(notification.timeoutId);
        }

        // Animación de salida
        notification.element.style.opacity = '0';
        notification.element.style.transform = 'translateX(100%)';

        // Eliminar del DOM después de la animación
        setTimeout(() => {
            if (notification.element.parentNode) {
                notification.element.parentNode.removeChild(notification.element);
            }
        }, 300);

        // Eliminar del array
        this.notifications.splice(notificationIndex, 1);

        // Procesar cola de notificaciones
        this.processQueue();
    }

    /**
     * Procesar cola de notificaciones pendientes
     */
    processQueue() {
        if (this.notificationQueue.length > 0 && this.notifications.length < this.maxNotifications) {
            const nextNotification = this.notificationQueue.shift();
            this.createNotification(nextNotification);
        }
    }

    /**
     * Limpiar notificaciones expiradas
     */
    cleanupExpiredNotifications() {
        const now = new Date();
        const expiredNotifications = this.notifications.filter(n =>
            !n.persistent && n.timestamp && (now - n.timestamp) > 300000 // 5 minutos
        );

        expiredNotifications.forEach(notification => {
            this.hide(notification.id);
        });
    }

    /**
     * Activar feedback de notificación (sonido y vibración)
     */
    triggerNotificationFeedback(notification) {
        // Reproducir sonido si está habilitado
        if (this.soundEnabled && this.sounds[notification.type]) {
            try {
                this.sounds[notification.type].play();
            } catch (error) {
                console.warn('⚠️ Error reproduciendo sonido:', error);
            }
        }

        // Vibración si está habilitada y la notificación es de alta prioridad
        if (this.vibrationEnabled && ['critical', 'high'].includes(notification.priority)) {
            try {
                navigator.vibrate(200);
            } catch (error) {
                console.warn('⚠️ Error activando vibración:', error);
            }
        }

        // Notificación del navegador para críticas
        if (notification.priority === 'critical' && 'Notification' in window && Notification.permission === 'granted') {
            try {
                const browserNotification = new Notification(notification.title, {
                    body: notification.message,
                    icon: '/favicon.ico',
                    tag: notification.id,
                    requireInteraction: notification.persistent
                });

                // Auto-cerrar después de 5 segundos si no es persistente
                if (!notification.persistent) {
                    setTimeout(() => {
                        browserNotification.close();
                    }, 5000);
                }

                // Al hacer click, enfocar la ventana
                browserNotification.onclick = () => {
                    window.focus();
                    browserNotification.close();
                };
            } catch (error) {
                console.warn('⚠️ Error creando notificación del navegador:', error);
            }
        }
    }

    /**
     * Manejar acción de notificación
     */
    handleAction(notificationId, actionLabel) {
        const notification = this.notifications.find(n => n.id === notificationId);
        if (!notification) return;

        const action = notification.actions.find(a => a.label === actionLabel);
        if (action && action.action) {
            try {
                action.action();
            } catch (error) {
                console.error('❌ Error ejecutando acción de notificación:', error);
            }
        }

        // Ocultar notificación después de ejecutar acción (a menos que sea persistente)
        if (!notification.persistent) {
            this.hide(notificationId);
        }
    }

    /**
     * Auditoría de notificaciones
     */
    auditNotification(notification) {
        if (this.app.modules.AuditManager && this.app.modules.AuditManager.logNotification) {
            this.app.modules.AuditManager.logNotification({
                type: notification.type,
                title: notification.title,
                priority: notification.priority,
                persistent: notification.persistent,
                timestamp: notification.timestamp
            });
        }
    }

    /**
     * Generar ID único para notificación
     */
    generateId() {
        return `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Métodos públicos de conveniencia
     */

    // Notificación de éxito
    success(title, message, options = {}) {
        return this.show({
            type: 'success',
            title,
            message,
            ...options
        });
    }

    // Notificación de información
    info(title, message, options = {}) {
        return this.show({
            type: 'info',
            title,
            message,
            ...options
        });
    }

    // Notificación de advertencia
    warning(title, message, options = {}) {
        return this.show({
            type: 'warning',
            title,
            message,
            ...options
        });
    }

    // Notificación de error
    error(title, message, options = {}) {
        return this.show({
            type: 'error',
            title,
            message,
            persistent: true,
            ...options
        });
    }

    // Notificación médica
    medical(title, message, options = {}) {
        return this.show({
            type: 'medical',
            title,
            message,
            ...options
        });
    }

    // Notificación de sesión
    session(title, message, options = {}) {
        return this.show({
            type: 'session',
            title,
            message,
            ...options
        });
    }

    // Notificación de WhatsApp
    whatsapp(title, message, options = {}) {
        return this.show({
            type: 'whatsapp',
            title,
            message,
            ...options
        });
    }

    // Notificación de seguridad
    security(title, message, options = {}) {
        return this.show({
            type: 'security',
            title,
            message,
            persistent: true,
            ...options
        });
    }

    // Limpiar todas las notificaciones
    clearAll() {
        const notificationIds = this.notifications.map(n => n.id);
        notificationIds.forEach(id => this.hide(id));
    }

    // Obtener notificaciones activas
    getActiveNotifications() {
        return [...this.notifications];
    }

    // Configurar opciones globales
    configure(options) {
        Object.assign(this.config, options);
    }

    // Habilitar/deshabilitar sonido
    setSoundEnabled(enabled) {
        this.soundEnabled = enabled;
        localStorage.setItem('aira_notifications_sound', enabled);
    }

    // Habilitar/deshabilitar vibración
    setVibrationEnabled(enabled) {
        this.vibrationEnabled = enabled;
        localStorage.setItem('aira_notifications_vibration', enabled);
    }
}

// Hacer NotificationManager disponible globalmente
window.NotificationManager = NotificationManager;