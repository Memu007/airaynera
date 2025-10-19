/**
 * Servicio de Autenticación Segura - AIRA
 * Manejo de JWT, sesiones y autenticación con mejores prácticas
 * @version 2.0.0
 */

(function(window) {
    'use strict';

    const AuthSecure = {
        // Configuración
        config: {
            tokenKey: 'aira_auth_token',
            refreshKey: 'aira_refresh_token',
            userKey: 'aira_user_data',
            tokenExpiry: 15 * 60 * 1000, // 15 minutos
            refreshExpiry: 7 * 24 * 60 * 60 * 1000, // 7 días
            apiBaseUrl: '/api/auth'
        },

        // Estado de autenticación
        state: {
            isAuthenticated: false,
            user: null,
            tokenExpiryTimer: null,
            refreshTimer: null
        },

        /**
         * Inicializar el servicio de autenticación
         */
        init() {
            this.checkStoredAuth();
            this.setupInterceptors();
            this.setupAutoRefresh();
            this.setupInactivityLogout();
        },

        /**
         * Login seguro con credenciales
         */
        async login(email, password) {
            try {
                // Validar inputs
                const emailValidation = SecurityUtils.validateInput(email, 'email');
                const passwordValidation = this.validatePassword(password);

                if (!emailValidation.valid || !passwordValidation.valid) {
                    throw new Error('Credenciales inválidas');
                }

                // Hash de password en cliente (adicional al hash del servidor)
                const hashedPassword = await this.hashPassword(password);

                // Llamar API con rate limiting
                const rateLimiter = new SecurityUtils.RateLimiter(3, 60000); // 3 intentos por minuto
                if (!rateLimiter.check(email)) {
                    throw new Error('Demasiados intentos. Espere un momento.');
                }

                const response = await fetch(`${this.config.apiBaseUrl}/login`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({
                        email: emailValidation.sanitized,
                        password: hashedPassword
                    })
                });

                if (!response.ok) {
                    const error = await response.json();
                    throw new Error(error.message || 'Error de autenticación');
                }

                const data = await response.json();
                
                // Almacenar tokens de forma segura
                this.storeAuthData(data);
                
                // Configurar estado
                this.state.isAuthenticated = true;
                this.state.user = data.user;

                // Disparar evento
                window.dispatchEvent(new CustomEvent('auth:login', { detail: data.user }));

                return { success: true, user: data.user };

            } catch (error) {
                console.error('Login error:', error);
                this.logSecurityEvent('login_failed', { email });
                throw error;
            }
        },

        /**
         * Logout seguro
         */
        async logout() {
            try {
                // Llamar API de logout
                await fetch(`${this.config.apiBaseUrl}/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${this.getToken()}`,
                        'X-CSRF-Token': csrfToken
                    }
                });
            } catch (error) {
                console.error('Logout API error:', error);
            }

            // Limpiar datos locales
            this.clearAuthData();
            
            // Resetear estado
            this.state.isAuthenticated = false;
            this.state.user = null;

            // Cancelar timers
            if (this.state.tokenExpiryTimer) {
                clearTimeout(this.state.tokenExpiryTimer);
            }
            if (this.state.refreshTimer) {
                clearInterval(this.state.refreshTimer);
            }

            // Disparar evento
            window.dispatchEvent(new Event('auth:logout'));

            // Redirigir a login
            window.location.href = '/login';
        },

        /**
         * Almacenar datos de autenticación de forma segura
         */
        storeAuthData(data) {
            const { token, refreshToken, user } = data;

            // Encriptar tokens antes de almacenar
            const encryptedToken = this.encryptData(token);
            const encryptedRefresh = this.encryptData(refreshToken);

            // Usar sessionStorage para token principal
            sessionStorage.setItem(this.config.tokenKey, encryptedToken);
            
            // localStorage solo para refresh token (con encriptación)
            localStorage.setItem(this.config.refreshKey, encryptedRefresh);

            // Datos de usuario sin info sensible
            const safeUserData = {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            };
            sessionStorage.setItem(this.config.userKey, JSON.stringify(safeUserData));

            // Configurar expiración
            this.setupTokenExpiry();
        },

        /**
         * Obtener token actual
         */
        getToken() {
            const encryptedToken = sessionStorage.getItem(this.config.tokenKey);
            if (!encryptedToken) return null;
            
            try {
                return this.decryptData(encryptedToken);
            } catch (error) {
                console.error('Error decrypting token:', error);
                this.clearAuthData();
                return null;
            }
        },

        /**
         * Refrescar token
         */
        async refreshToken() {
            try {
                const refreshToken = this.getRefreshToken();
                if (!refreshToken) {
                    throw new Error('No refresh token available');
                }

                const response = await fetch(`${this.config.apiBaseUrl}/refresh`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-Token': csrfToken
                    },
                    body: JSON.stringify({ refreshToken })
                });

                if (!response.ok) {
                    throw new Error('Failed to refresh token');
                }

                const data = await response.json();
                this.storeAuthData(data);

                return true;
            } catch (error) {
                console.error('Token refresh error:', error);
                this.logout();
                return false;
            }
        },

        /**
         * Configurar auto-refresh de token
         */
        setupAutoRefresh() {
            // Refrescar token 5 minutos antes de expirar
            this.state.refreshTimer = setInterval(() => {
                if (this.state.isAuthenticated) {
                    this.refreshToken();
                }
            }, this.config.tokenExpiry - (5 * 60 * 1000));
        },

        /**
         * Configurar logout por inactividad
         */
        setupInactivityLogout() {
            let inactivityTimer;
            const inactivityTimeout = 30 * 60 * 1000; // 30 minutos

            const resetTimer = () => {
                clearTimeout(inactivityTimer);
                inactivityTimer = setTimeout(() => {
                    if (this.state.isAuthenticated) {
                        this.logout();
                        alert('Sesión cerrada por inactividad');
                    }
                }, inactivityTimeout);
            };

            // Eventos que resetean el timer
            ['mousedown', 'keypress', 'scroll', 'touchstart'].forEach(event => {
                document.addEventListener(event, resetTimer, true);
            });

            resetTimer();
        },

        /**
         * Interceptor para agregar token a requests
         */
        setupInterceptors() {
            // Override fetch para agregar auth headers
            const originalFetch = window.fetch;
            window.fetch = async (url, options = {}) => {
                // Solo para rutas de API
                if (url.startsWith('/api/') && !url.includes('/auth/')) {
                    const token = this.getToken();
                    if (token) {
                        options.headers = {
                            ...options.headers,
                            'Authorization': `Bearer ${token}`,
                            'X-CSRF-Token': csrfToken
                        };
                    }
                }

                try {
                    const response = await originalFetch(url, options);
                    
                    // Si 401, intentar refresh
                    if (response.status === 401 && !url.includes('/auth/')) {
                        const refreshed = await this.refreshToken();
                        if (refreshed) {
                            // Reintentar request original
                            options.headers['Authorization'] = `Bearer ${this.getToken()}`;
                            return originalFetch(url, options);
                        }
                    }

                    return response;
                } catch (error) {
                    throw error;
                }
            };
        },

        /**
         * Validar fortaleza de contraseña
         */
        validatePassword(password) {
            const errors = [];
            
            if (password.length < 8) {
                errors.push('Mínimo 8 caracteres');
            }
            if (!/[A-Z]/.test(password)) {
                errors.push('Al menos una mayúscula');
            }
            if (!/[a-z]/.test(password)) {
                errors.push('Al menos una minúscula');
            }
            if (!/[0-9]/.test(password)) {
                errors.push('Al menos un número');
            }
            if (!/[^A-Za-z0-9]/.test(password)) {
                errors.push('Al menos un caracter especial');
            }

            return {
                valid: errors.length === 0,
                errors,
                strength: this.calculatePasswordStrength(password)
            };
        },

        /**
         * Calcular fortaleza de contraseña
         */
        calculatePasswordStrength(password) {
            let strength = 0;
            
            if (password.length >= 8) strength++;
            if (password.length >= 12) strength++;
            if (/[A-Z]/.test(password) && /[a-z]/.test(password)) strength++;
            if (/[0-9]/.test(password)) strength++;
            if (/[^A-Za-z0-9]/.test(password)) strength++;

            const strengthMap = ['Muy débil', 'Débil', 'Regular', 'Fuerte', 'Muy fuerte'];
            return {
                score: strength,
                label: strengthMap[strength] || 'Muy débil'
            };
        },

        /**
         * Hash de password (cliente-side, adicional al servidor)
         */
        async hashPassword(password) {
            const encoder = new TextEncoder();
            const data = encoder.encode(password);
            const hash = await crypto.subtle.digest('SHA-256', data);
            return Array.from(new Uint8Array(hash))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        },

        /**
         * Encriptar datos (básico, mejorar en producción)
         */
        encryptData(data) {
            // En producción usar Web Crypto API con AES-GCM
            return btoa(encodeURIComponent(data));
        },

        /**
         * Desencriptar datos
         */
        decryptData(encryptedData) {
            return decodeURIComponent(atob(encryptedData));
        },

        /**
         * Registrar evento de seguridad
         */
        logSecurityEvent(event, data = {}) {
            const logEntry = {
                event,
                timestamp: new Date().toISOString(),
                userAgent: navigator.userAgent,
                ...data
            };

            // En producción, enviar a servidor
            console.log('Security Event:', logEntry);
        },

        /**
         * Verificar si usuario tiene permiso
         */
        hasPermission(permission) {
            if (!this.state.user) return false;
            
            const rolePermissions = {
                admin: ['*'],
                doctor: ['patients:read', 'patients:write', 'sessions:*'],
                assistant: ['patients:read', 'sessions:read']
            };

            const userPermissions = rolePermissions[this.state.user.role] || [];
            
            return userPermissions.includes('*') || 
                   userPermissions.includes(permission) ||
                   userPermissions.some(p => {
                       const regex = new RegExp('^' + p.replace('*', '.*') + '$');
                       return regex.test(permission);
                   });
        },

        /**
         * Limpiar datos de autenticación
         */
        clearAuthData() {
            sessionStorage.removeItem(this.config.tokenKey);
            sessionStorage.removeItem(this.config.userKey);
            localStorage.removeItem(this.config.refreshKey);
            SecurityUtils.clearTokens();
        },

        /**
         * Verificar autenticación almacenada
         */
        checkStoredAuth() {
            const token = this.getToken();
            const userData = sessionStorage.getItem(this.config.userKey);

            if (token && userData) {
                this.state.isAuthenticated = true;
                this.state.user = JSON.parse(userData);
                this.setupTokenExpiry();
                return true;
            }

            return false;
        },

        /**
         * Configurar expiración de token
         */
        setupTokenExpiry() {
            if (this.state.tokenExpiryTimer) {
                clearTimeout(this.state.tokenExpiryTimer);
            }

            this.state.tokenExpiryTimer = setTimeout(() => {
                this.refreshToken();
            }, this.config.tokenExpiry - (2 * 60 * 1000)); // 2 minutos antes
        },

        /**
         * Obtener refresh token
         */
        getRefreshToken() {
            const encrypted = localStorage.getItem(this.config.refreshKey);
            if (!encrypted) return null;
            
            try {
                return this.decryptData(encrypted);
            } catch (error) {
                console.error('Error decrypting refresh token:', error);
                return null;
            }
        }
    };

    // Inicializar cuando el DOM esté listo
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => AuthSecure.init());
    } else {
        AuthSecure.init();
    }

    // Exportar
    window.AuthSecure = AuthSecure;

})(window); 