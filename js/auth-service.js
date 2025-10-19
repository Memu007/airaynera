/**
 * Servicio de Autenticación - Versión de Desarrollo Segura
 * 
 * Este servicio maneja la autenticación simulada con validaciones básicas
 * para el entorno de desarrollo. En producción, debe reemplazarse por
 * una implementación real con Firebase Auth o similar.
 */
class AuthService {
    constructor() {
        this.currentUser = null;
        this.isAuthenticated = false;
        console.log('[Auth] Servicio de autenticación inicializado');
    }

    /**
     * Inicializa el servicio de autenticación
     * @returns {Promise<boolean>} True si la inicialización fue exitosa
     */
    async init() {
        try {
            // Verificar si hay una sesión guardada
            const savedUser = sessionStorage.getItem('aira_current_user');
            if (savedUser) {
                this.currentUser = JSON.parse(savedUser);
                this.isAuthenticated = true;
                console.log('[Auth] Sesión recuperada');
            }
            return true;
        } catch (error) {
            console.error('[Auth] Error al inicializar:', error);
            return false;
        }
    }

    /**
     * Inicia sesión con email y contraseña
     * @param {string} email - Email del usuario
     * @param {string} password - Contraseña
     * @returns {Promise<object>} Datos del usuario autenticado
     */
    async login(email, password) {
        try {
            // Validaciones básicas
            if (!email || !password) {
                throw new Error('Por favor completa todos los campos');
            }

            // Validación de formato de email
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('El formato del email no es válido');
            }

            // Simular validación de credenciales
            // NOTA: En producción, esto debe reemplazarse con una llamada real a Firebase Auth
            console.log(`[Auth] Intento de inicio de sesión para: ${email}`);
            
            // Simular retraso de red
            await new Promise(resolve => setTimeout(resolve, 800));

            // Crear usuario simulado
            this.currentUser = {
                uid: `dev_${Date.now()}`,
                email: email,
                name: email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                role: 'professional',
                isNewUser: false,
                lastLogin: new Date().toISOString()
            };

            // Guardar en sessionStorage
            sessionStorage.setItem('aira_current_user', JSON.stringify(this.currentUser));
            this.isAuthenticated = true;
            
            console.log(`[Auth] Inicio de sesión exitoso: ${email}`);
            return this.currentUser;
            
        } catch (error) {
            console.error('[Auth] Error en login:', error.message);
            throw error; // Re-lanzar para manejo en el UI
        }
    }

    /**
     * Cierra la sesión actual
     * @returns {Promise<boolean>} True si el cierre de sesión fue exitoso
     */
    async logout() {
        try {
            // Limpiar datos de sesión
            sessionStorage.removeItem('aira_current_user');
            this.currentUser = null;
            this.isAuthenticated = false;
            
            console.log('[Auth] Sesión cerrada correctamente');
            return true;
            
        } catch (error) {
            console.error('[Auth] Error al cerrar sesión:', error);
            return false;
        }
    }

    /**
     * Obtiene el usuario actualmente autenticado
     * @returns {object|null} Datos del usuario o null si no hay sesión
     */
    getCurrentUser() {
        return this.currentUser;
    }

    /**
     * Verifica si hay un usuario autenticado
     * @returns {boolean} True si hay un usuario autenticado
     */
    isLoggedIn() {
        return this.isAuthenticated && this.currentUser !== null;
    }
}

// Exportar instancia única del servicio
window.authService = new AuthService();
