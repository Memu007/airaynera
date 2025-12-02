document.addEventListener('DOMContentLoaded', function() {
    // Función que se ejecuta cuando se abre el documento
    
    // Función para observar cambios en el DOM y reemplazar "Hoy" por "OK"
    const observarDOM = (function(){
        const MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
        
        return function(obj, callback){
            if(!obj || obj.nodeType !== 1) return;
            
            if(MutationObserver){
                const mutationObserver = new MutationObserver(callback);
                mutationObserver.observe(obj, { childList: true, subtree: true });
                return mutationObserver;
            }
        };
    })();
    
    // Observar todo el documento para encontrar cuando se abre el calendario
    observarDOM(document.body, function(mutaciones) {
        // Buscar cualquier botón "Hoy" en los elementos modificados o sus hijos
        const botones = document.querySelectorAll('button');
        
        botones.forEach(function(boton) {
            if(boton.textContent === 'Hoy') {
                boton.textContent = 'OK';
                boton.title = 'Aceptar';
                console.log('Botón "Hoy" reemplazado por "OK"');
            }
        });
    });
    
    // También intentar reemplazar directamente al cargar
    setTimeout(function() {
        const botones = document.querySelectorAll('button');
        botones.forEach(function(boton) {
            if(boton.textContent === 'Hoy') {
                boton.textContent = 'OK';
                boton.title = 'Aceptar';
                console.log('Botón "Hoy" reemplazado por "OK" al inicio');
            }
        });
    }, 1000);
});
