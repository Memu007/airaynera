/**
 * Fix para reemplazar el botón "Hoy" con "OK" en los calendarios
 */
document.addEventListener('DOMContentLoaded', function() {
    // Observamos cambios en el DOM para detectar cuando se abre el calendario
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                // Buscamos cualquier elemento recién añadido que podría ser el calendario
                for (let i = 0; i < mutation.addedNodes.length; i++) {
                    const node = mutation.addedNodes[i];
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Buscar el botón "Hoy" dentro del calendario
                        if (node.classList && node.classList.contains('datepicker-dropdown')) {
                            fixCalendar(node);
                        } else {
                            // También buscar dentro del nodo añadido
                            const calendars = node.querySelectorAll('.datepicker-dropdown');
                            calendars.forEach(fixCalendar);
                        }
                    }
                }
            }
        });
    });

    // Configurar el observer
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Función para arreglar el calendario
    function fixCalendar(calendar) {
        // Buscar el botón "Hoy"
        const todayButton = calendar.querySelector('button.today');
        if (todayButton) {
            todayButton.textContent = 'OK';
            todayButton.title = 'Aceptar fecha';
        }
        
        // Alternativa: también buscar por texto
        const buttons = calendar.querySelectorAll('button');
        buttons.forEach(function(btn) {
            if (btn.textContent === 'Hoy') {
                btn.textContent = 'OK';
                btn.title = 'Aceptar fecha';
            }
        });
    }
    
    // También intentar corregir cualquier calendario que ya esté presente
    const calendars = document.querySelectorAll('.datepicker-dropdown');
    calendars.forEach(fixCalendar);
});
