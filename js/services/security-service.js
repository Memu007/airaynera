// ==============================================
// Security Service
// ==============================================
// Este servicio proporciona funciones de seguridad reutilizables.

(function(window) {
    'use strict';

    /**
     * Sanitiza una cadena de texto para prevenir ataques XSS.
     * Convierte caracteres HTML especiales en sus entidades correspondientes.
     * @param {string} text - El texto a sanitizar.
     * @returns {string} El texto sanitizado.
     */
    function sanitizeHTML(text) {
        if (typeof text !== 'string') {
            return '';
        }
        const temp = document.createElement('div');
        temp.textContent = text;
        return temp.innerHTML;
    }

    // Exponer la función al scope global a través de un namespace
    window.securityService = {
        sanitizeHTML
    };

})(window);
