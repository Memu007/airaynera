$(document).ready(function() {
    // --- DEPENDENCIES ---
    // - jQuery
    // - currentUser object (global)
    // - notificaciones object (from notifications.js)

    // --- PROFILE MANAGEMENT ---

    // Función para mostrar la sección de perfil profesional
    window.showProfileSection = function() {
        console.log('Mostrando sección de perfil profesional');
        
        $('.custom-notification').remove();
        
        hideAllScreens();
        $('#dashboardScreen').removeClass('d-none');
        
        $('.main-panel .container-fluid > div').addClass('d-none');
        $('#profileSection').removeClass('d-none').css('opacity', '1');
        
        $('.sidebar .nav-link').removeClass('active');
        $('.sidebar .nav-link').each(function() {
            if ($(this).text().trim().includes('Mi Perfil')) {
                $(this).addClass('active');
            }
        });
        
        updateBreadcrumbs(); // Assumes breadcrumbs.js is loaded
        
        initProfileSection();
        
        $('#profileSection').animate({opacity: 1}, 300);
    }

    // Función para inicializar la sección de perfil con datos del usuario
    window.initProfileSection = function() {
        if (!currentUser) return;

        // Cargar datos del usuario en el formulario
        $('#nombre').val(currentUser.name || '');
        $('#apellido').val(currentUser.apellido || ''); // Assuming apellido exists
        $('#email').val(currentUser.email || '');
        $('#telefono').val(currentUser.phone || '');
        $('#especialidad').val(currentUser.specialty || 'default');
        $('#biografia').val(currentUser.bio || '');

        // Simular carga de otros datos
        $('#idiomas').val(['es', 'en']); 
        $('#precio-consulta').val('3500');

        // Listeners para recalcular la completitud del perfil
        $('#form-perfil input, #form-perfil textarea, #form-perfil select').on('input change', function() {
            // Delay to allow select changes to register
            setTimeout(updateProfileCompleteness, 100);
        });

        // Manejar el guardado del perfil
        $('#form-perfil').on('submit', function(e) {
            e.preventDefault();
            const $btn = $('#guardar-perfil');
            const originalText = $btn.html();
            $btn.html('<i class="fas fa-spinner fa-spin"></i> Guardando...');
            $btn.prop('disabled', true);

            // Simular guardado
            setTimeout(() => {
                // TODO: Aquí iría la lógica para guardar en Firestore
                $btn.html(originalText);
                $btn.prop('disabled', false);
                notificaciones.show('Perfil actualizado correctamente', 'success');
                updateProfileCompleteness();
            }, 1200);
        });

        updateProfileCompleteness();
    }

    // Función para actualizar el indicador de completitud del perfil
    window.updateProfileCompleteness = function() {
        const totalFields = 8;
        let completedFields = 0;
        
        if ($('#nombre').val().trim()) completedFields++;
        if ($('#apellido').val().trim()) completedFields++;
        if ($('#email').val().trim() && !$('#email').hasClass('is-invalid')) completedFields++;
        if ($('#telefono').val().trim() && !$('#telefono').hasClass('is-invalid')) completedFields++;
        if ($('#especialidad').val() && $('#especialidad').val() !== 'default') completedFields++;
        if ($('#biografia').val().trim()) completedFields++;
        if ($('#idiomas').val() && $('#idiomas').val().length > 0) completedFields++;
        if ($('#precio-consulta').val().trim()) completedFields++;
        
        const percentage = Math.round((completedFields / totalFields) * 100);
        
        $('#profile-completeness-percentage').text(percentage + '%');
        $('#profile-completeness-bar').css('width', percentage + '%').attr('aria-valuenow', percentage);
        
        $('#profile-completeness-bar').removeClass('bg-danger bg-warning bg-info bg-success');
        if (percentage < 25) {
            $('#profile-completeness-bar').addClass('bg-danger');
        } else if (percentage < 50) {
            $('#profile-completeness-bar').addClass('bg-warning');
        } else if (percentage < 75) {
            $('#profile-completeness-bar').addClass('bg-info');
        } else {
            $('#profile-completeness-bar').addClass('bg-success');
            if (percentage === 100 && !window.profileCompletionCelebrated) {
                setTimeout(() => {
                    notificaciones.show('¡Felicitaciones! Tu perfil está completo.', 'success');
                    window.profileCompletionCelebrated = true;
                }, 500);
            }
        }
    }
});
