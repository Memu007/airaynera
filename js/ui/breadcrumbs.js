// Sistema de navegación Breadcrumbs
const breadcrumbSystem = {
    show: function(current, parent = 'Inicio') {
        $('#breadcrumbs').removeClass('d-none');
        $('#breadcrumb-current').text(current);
        $('#breadcrumb-home').text(parent);
        
        // ARIA para accesibilidad
        $('#breadcrumb-current').attr('aria-current', 'page');
    },
    hide: function() {
        $('#breadcrumbs').addClass('d-none');
    },
    // Para crear rutas más complejas
    setPath: function(segments) {
        // segments es un array de objetos {text: "texto", url: "#url"}
        $('#breadcrumbs ol').empty();
        
        segments.forEach((segment, index) => {
            if (index === segments.length - 1) {
                $('#breadcrumbs ol').append(`<li class="breadcrumb-item active" aria-current="page">${segment.text}</li>`);
            } else {
                $('#breadcrumbs ol').append(`<li class="breadcrumb-item"><a href="${segment.url}">${segment.text}</a></li>`);
            }
        });
        
        $('#breadcrumbs').removeClass('d-none');
    }
};
