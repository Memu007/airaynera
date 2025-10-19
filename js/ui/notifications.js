// Sistema de notificaciones - Módulo de UI
const notificaciones = {
    // Muestra una notificación del tipo especificado
    mostrar: function(tipo, titulo, mensaje, duracion = 4000) {
        const id = 'notif-' + Date.now();
        const html = `
            <div id="${id}" class="nueva-notificacion nueva-notificacion-${tipo}">
                <div class="nueva-notificacion-icono">
                    ${this.obtenerIcono(tipo)}
                </div>
                <div class="nueva-notificacion-contenido">
                    <div class="nueva-notificacion-titulo">${titulo}</div>
                    <div class="nueva-notificacion-mensaje">${mensaje}</div>
                </div>
                <div class="nueva-notificacion-barra-progreso"></div>
            </div>
        `;
        
        $('#nuevo-notificaciones').append(html).attr('aria-live', 'assertive');

        const $barra = $(`#${id} .nueva-notificacion-barra-progreso`);
        $barra.css({
            'width': '100%',
            'animation': `${duracion}ms linear barraProgreso`
        });
        
        if (duracion > 0) {
            setTimeout(() => {
                $(`#${id}`).addClass('salida');
                setTimeout(() => { $(`#${id}`).remove(); }, 400);
            }, duracion);
        }
    },
    
    exito: function(titulo, mensaje, duracion = 4000) { this.mostrar('success', titulo, mensaje, duracion); },
    error: function(titulo, mensaje, duracion = 4000) { this.mostrar('error', titulo, mensaje, duracion); },
    advertencia: function(titulo, mensaje, duracion = 4000) { this.mostrar('warning', titulo, mensaje, duracion); },
    info: function(titulo, mensaje, duracion = 4000) { this.mostrar('info', titulo, mensaje, duracion); },

    bienvenidaNuevo: function() {
        this.exito(
            'Bienvenido a AIRA',
            'Tu registro ha sido completado. Ahora puedes usar todas las funcionalidades.',
            6000
        );
    },
    
    obtenerIcono: function(tipo) {
        const iconos = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-times-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        return iconos[tipo] || '';
    },
    
    remover: function(id) {
        $(`#${id}`).addClass('salida');
        setTimeout(() => { $(`#${id}`).remove(); }, 400);
    }
};

// Agregar keyframes para la animación de la barra de progreso dinámicamente
$(document).ready(function() {
    if ($('style#animation-styles').length === 0) {
        $('<style id="animation-styles">')
            .prop('type', 'text/css')
            .html(`
                @keyframes barraProgreso {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `)
            .appendTo('head');
    }
});
