/**
 * Security Utils - Librería de seguridad para AIRA
 * Prevención de XSS, CSRF y otras vulnerabilidades
 * @version 1.0.0
 */

(function(window) {
    'use strict';

    // Namespace para las utilidades de seguridad
    const SecurityUtils = {};

    /**
     * Sanitiza texto para prevenir XSS
     * Escapa caracteres HTML peligrosos
     * @param {string} text - Texto a sanitizar
     * @returns {string} Texto sanitizado
     */
    SecurityUtils.sanitizeHTML = function(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        
        return String(text).replace(/[&<>"'/]/g, char => map[char]);
    };

    /**
     * Crea elementos DOM seguros sin usar innerHTML
     * @param {string} tag - Tipo de elemento
     * @param {object} attributes - Atributos del elemento
     * @param {string|Node} content - Contenido del elemento
     * @returns {HTMLElement} Elemento DOM seguro
     */
    SecurityUtils.createElement = function(tag, attributes = {}, content = '') {
        const element = document.createElement(tag);
        
        // Agregar atributos de forma segura
        Object.keys(attributes).forEach(key => {
            if (key === 'className') {
                element.className = attributes[key];
            } else if (key === 'dataset') {
                Object.keys(attributes[key]).forEach(dataKey => {
                    element.dataset[dataKey] = attributes[key][dataKey];
                });
            } else if (key.startsWith('on')) {
                // Eventos - usar addEventListener en lugar de onclick
                console.warn('Use addEventListener instead of inline handlers');
            } else {
                element.setAttribute(key, attributes[key]);
            }
        });
        
        // Agregar contenido de forma segura
        if (typeof content === 'string') {
            element.textContent = content;
        } else if (content instanceof Node) {
            element.appendChild(content);
        }
        
        return element;
    };

    /**
     * Valida y sanitiza entrada de usuario
     * @param {string} input - Entrada del usuario
     * @param {string} type - Tipo de validación (email, phone, dni, text)
     * @returns {object} {valid: boolean, sanitized: string, errors: array}
     */
    SecurityUtils.validateInput = function(input, type = 'text') {
        const result = {
            valid: true,
            sanitized: '',
            errors: []
        };
        
        if (!input) {
            result.valid = false;
            result.errors.push('Campo requerido');
            return result;
        }
        
        // Sanitizar primero
        result.sanitized = this.sanitizeHTML(input.trim());
        
        // Validar según tipo
        switch(type) {
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(input)) {
                    result.valid = false;
                    result.errors.push('Email inválido');
                }
                break;
                
            case 'phone':
                const phoneRegex = /^[\d\s\-\+\(\)]+$/;
                if (!phoneRegex.test(input)) {
                    result.valid = false;
                    result.errors.push('Teléfono inválido');
                }
                break;
                
            case 'dni':
                const dniRegex = /^\d{7,8}$/;
                const cleanDNI = input.replace(/\D/g, '');
                if (!dniRegex.test(cleanDNI)) {
                    result.valid = false;
                    result.errors.push('DNI debe tener 7 u 8 dígitos');
                }
                result.sanitized = cleanDNI;
                break;
                
            case 'name':
                const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\.\-']+$/;
                if (!nameRegex.test(input)) {
                    result.valid = false;
                    result.errors.push('Nombre contiene caracteres inválidos');
                }
                break;
        }
        
        return result;
    };

    /**
     * Genera token CSRF
     * @returns {string} Token CSRF
     */
    SecurityUtils.generateCSRFToken = function() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    };

    /**
     * Almacena token de forma segura en sessionStorage
     * @param {string} token - Token a almacenar
     * @param {string} key - Clave de almacenamiento
     */
    SecurityUtils.storeToken = function(token, key = 'authToken') {
        if (!token) return;
        
        // En producción, encriptar el token antes de almacenar
        try {
            // Por ahora almacenamos en sessionStorage (más seguro que localStorage)
            sessionStorage.setItem(key, token);
        } catch (e) {
            console.error('Error storing token:', e);
        }
    };

    /**
     * Recupera token de forma segura
     * @param {string} key - Clave del token
     * @returns {string|null} Token o null si no existe
     */
    SecurityUtils.getToken = function(key = 'authToken') {
        try {
            return sessionStorage.getItem(key);
        } catch (e) {
            console.error('Error retrieving token:', e);
            return null;
        }
    };

    /**
     * Limpia tokens almacenados
     */
    SecurityUtils.clearTokens = function() {
        try {
            sessionStorage.clear();
        } catch (e) {
            console.error('Error clearing tokens:', e);
        }
    };

    /**
     * Valida URL para prevenir open redirect
     * @param {string} url - URL a validar
     * @returns {boolean} true si la URL es segura
     */
    SecurityUtils.isValidURL = function(url) {
        try {
            const parsed = new URL(url, window.location.origin);
            // Solo permitir URLs del mismo origen o whitelisted
            const allowedHosts = [
                window.location.hostname,
                'api.whatsapp.com',
                'wa.me'
            ];
            return allowedHosts.includes(parsed.hostname);
        } catch (e) {
            return false;
        }
    };

    /**
     * Rate limiting para prevenir spam/DoS
     */
    SecurityUtils.RateLimiter = class {
        constructor(maxRequests = 10, windowMs = 60000) {
            this.maxRequests = maxRequests;
            this.windowMs = windowMs;
            this.requests = new Map();
        }
        
        check(identifier) {
            const now = Date.now();
            const userRequests = this.requests.get(identifier) || [];
            
            // Limpiar requests antiguos
            const recentRequests = userRequests.filter(time => now - time < this.windowMs);
            
            if (recentRequests.length >= this.maxRequests) {
                return false; // Rate limit exceeded
            }
            
            recentRequests.push(now);
            this.requests.set(identifier, recentRequests);
            return true;
        }
    };

    /**
     * Content Security Policy helper
     */
    SecurityUtils.CSP = {
        getNonce: function() {
            // En producción, esto debe venir del servidor
            return SecurityUtils.generateCSRFToken().substring(0, 16);
        },
        
        getPolicy: function() {
            return {
                'default-src': ["'self'"],
                'script-src': ["'self'", "'nonce-' + this.getNonce()", 'https://cdn.jsdelivr.net'],
                'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
                'img-src': ["'self'", 'data:', 'https:'],
                'connect-src': ["'self'", 'https://api.whatsapp.com'],
                'font-src': ["'self'", 'https://fonts.gstatic.com'],
                'object-src': ["'none'"],
                'frame-ancestors': ["'none'"],
                'base-uri': ["'self'"],
                'form-action': ["'self'"]
            };
        }
    };

    // Exportar al objeto global
    window.SecurityUtils = SecurityUtils;

    // También exportar funciones individuales para conveniencia
    window.sanitizeHTML = SecurityUtils.sanitizeHTML;
    window.validateInput = SecurityUtils.validateInput;

})(window); 