// AIRA - Professional Medical Panel

let currentUser = null;
let isDemoMode = false; // Se establece en false por defecto para la autenticación real

// Los datos de demostración se mantienen por si se necesita la funcionalidad, pero no se usan en el flujo de auth real.
const demoData = {
    user: { name: "Dr. Luscana", isNewUser: true, email: "dr.luscana@ejemplo.com", phone: "11-4567-8900", bio: "Psiquiatra especializada en trastornos de ansiedad y depresión. Más de 10 años de experiencia en el tratamiento de pacientes adultos." },
    patients: [
        { id: "p1", name: "María García", dni: "11111111", insurance: "OSDE", phone: "1145678901" },
        { id: "p2", name: "Juan Pérez", dni: "22222222", insurance: "Swiss Medical", phone: "1156789012" },
    ],
    sessions: [
        { id: "s_today_1", patient_id: "p1", patient_name: "María García", summary: "Sesión de hoy.", mood_assessment: 4, requires_followup: false, created_at: new Date(new Date().setHours(10, 30)), created_via: "whatsapp", medication_notes: "Mantener dosis." },
    ]
};

$(document).ready(function() {

    // --- 1. INICIALIZACIÓN DE LA INTERFAZ DE USUARIO ---
    $('.custom-notification').remove();
    $('[data-toggle="tooltip"]').tooltip();
    $('[data-toggle="popover"]').popover();
    if (typeof updatePatientsCounter === 'function') updatePatientsCounter();
    if (typeof initLandingChat === 'function') initLandingChat();

    // Toggle de visualización para contraseña
    $(document).on('click', '.password-toggle', function() {
        const passwordField = $(this).closest('.input-group').find('input');
        const icon = $(this).find('i');
        if (passwordField.attr('type') === 'password') {
            passwordField.attr('type', 'text');
            icon.removeClass('fa-eye').addClass('fa-eye-slash');
        } else {
            passwordField.attr('type', 'password');
            icon.removeClass('fa-eye-slash').addClass('fa-eye');
        }
    });

    // --- 2. LÓGICA DE AUTENTICACIÓN DE FIREBASE ---
    console.log("Inicializando Firebase...");
    
    // Verificar que Firebase esté disponible
    if (typeof firebase === 'undefined') {
        console.error('Firebase no está cargado correctamente');
        showError("#loginErrorMessage", "Error: Firebase no se ha cargado correctamente. Por favor, recargá la página.");
        return;
    }
    
    // Verificar si hay aplicaciones Firebase inicializadas
    if (!firebase.apps || firebase.apps.length === 0) {
        console.error('No hay aplicaciones Firebase inicializadas');
        showError("#loginErrorMessage", "Error: La aplicación no se ha configurado correctamente. Por favor, contacta al soporte.");
        return;
    }
    
    console.log('Firebase está disponible y configurado correctamente');

    // Inicializar el servicio de autenticación
    try {
        console.log('Inicializando servicio de autenticación...');
        authService.init(handleAuthStateChange);
        console.log('Servicio de autenticación inicializado correctamente');
    } catch (error) {
        console.error('Error al inicializar el servicio de autenticación:', error);
        showError("#loginErrorMessage", "Error al iniciar el servicio de autenticación. Por favor, recargá la página.");
    }

    /**
     * Manejador de cambios en el estado de autenticación
     * @param {object} user - Usuario autenticado o null si no hay sesión
     */
    function handleAuthStateChange(user) {
        console.log('[Auth] Cambio en el estado de autenticación');
        
        // Verificar si hay un usuario autenticado
        const authUser = authService.getCurrentUser();
        
        if (authUser) {
            // Usuario está logueado
            console.log('[Auth] Usuario autenticado:', authUser.email);
            
            // Usar los datos del servicio de autenticación
            currentUser = { 
                id: authUser.id,
                email: authUser.email,
                name: authUser.name || 'Profesional',
                role: authUser.role || 'user',
                isNewUser: false,
                // Mantener compatibilidad con el código existente
                uid: authUser.id
            };
            
            // Actualizar la UI con los datos del usuario
            if (currentUser.name) {
                $('.user-name').text(currentUser.name);
                $('#welcomeName').text(currentUser.name);
            }
            
            // Determinar si estamos en la página de login o en otra página
            const currentPath = window.location.pathname;
            const isLoginPage = currentPath.endsWith('demo.html');
            const isLandingPage = currentPath.endsWith('demopagina.html') || currentPath === '/' || currentPath === '';
            
            if (isLoginPage) {
                // Si estamos en la página de login, redirigir al dashboard
                console.log('[Auth] Redirigiendo al dashboard...');
                showDashboard();
            } else if (isLandingPage) {
                // Si estamos en la landing page, actualizar la UI pero no redirigir
                console.log('[Auth] Actualizando UI de la landing page para usuario autenticado');
                updateLandingPageForLoggedInUser(currentUser);
            } else {
                // Si estamos en otra página, mostrar el dashboard
                console.log('[Auth] Mostrando dashboard');
                showDashboard();
            }
            
        } else {
            // Usuario no está logueado
            console.log('[Auth] No hay usuario autenticado');
            currentUser = null;
            
            // Verificar en qué página estamos
            const currentPath = window.location.pathname;
            const isLoginPage = currentPath.endsWith('demo.html');
            const isLandingPage = currentPath.endsWith('demopagina.html') || currentPath === '/' || currentPath === '';
            const isProtectedPage = !isLoginPage && !isLandingPage;
            
            if (isProtectedPage) {
                // Si estamos en una página protegida, redirigir al login
                console.log('[Auth] Redirigiendo a la página de login');
                window.location.href = '/demo.html?redirect=' + encodeURIComponent(currentPath);
            } else if (isLandingPage) {
                // Si estamos en la landing page, actualizar la UI para invitados
                console.log('[Auth] Actualizando UI de la landing page para invitado');
                updateLandingPageForGuest();
            } else if (isLoginPage) {
                // Si estamos en la página de login, asegurarse de que esté visible
                hideAllScreens();
                $('#loginScreen').removeClass('d-none');
            }
        }
    }

    // --- 3. LISTENERS DE EVENTOS DE AUTENTICACIÓN ---

    // Listener para el formulario de login
    $('#loginForm').on('submit', async function(e) {
        e.preventDefault();
        
        const dni = $('#dni').val().trim();
        const password = $('#pin').val().trim();
        // Convertir DNI a email temporal (formato: dni-12345678@aira.app)
        const email = `dni-${dni}@aira.app`;
        const $loginBtn = $('#loginBtn');
        const $loginText = $('#loginText');
        const $loginSpinner = $('#loginSpinner');
        const $errorMessage = $("#loginErrorMessage");
        
        // Validar campos
        if (!dni || !password) {
            showError("#loginErrorMessage", "Por favor, completá tu DNI y contraseña.");
            return;
        }
        
        // Validar formato de DNI (solo números, entre 7 y 8 dígitos)
        if (!/^\d{7,8}$/.test(dni)) {
            showError("#loginErrorMessage", "El DNI debe contener entre 7 y 8 dígitos numéricos.");
            return;
        }
        
        try {
            console.log('[Auth] Intentando iniciar sesión con:', email);
            
            // Usar el servicio de autenticación simulado
            const user = await authService.login(email, password);
            console.log('[Auth] Inicio de sesión exitoso:', user.email);
            
            // Actualizar la UI con los datos del usuario
            if (user && user.name) {
                $('.user-name').text(user.name);
                $('#welcomeName').text(user.name);
            }
            
            // Obtener parámetro de redirección si existe
            const urlParams = new URLSearchParams(window.location.search);
            const redirectTo = urlParams.get('redirect') || '/index.html';
            
            // Redirigir al dashboard o a la URL de redirección
            console.log('[Auth] Redirigiendo a:', redirectTo);
            window.location.href = redirectTo;
            
        } catch (error) {
            console.error('[Auth] Error al iniciar sesión:', error);
            
            // Mostrar mensaje de error específico
            let errorMessage = "Error al iniciar sesión. Por favor, intentá de nuevo.";
            
            if (error.message.includes('credenciales') || error.message.includes('incorrectos')) {
                errorMessage = "Email o contraseña incorrectos.";
            } else if (error.message.includes('demasiados intentos')) {
                errorMessage = "Demasiados intentos fallidos. Por favor, intentá de nuevo más tarde.";
            } else if (error.message.includes('deshabilitada')) {
                errorMessage = "Esta cuenta ha sido deshabilitada. Por favor, contactá al soporte.";
            }
            
            showError("#loginErrorMessage", errorMessage);
            
            // Restaurar el botón de inicio de sesión
            $('#loginButton').prop('disabled', false).html('Iniciar Sesión');
        }
    });

    // Listener para el formulario de registro
    $('#registerForm').on('submit', async function(e) {
        e.preventDefault();
        
        const email = $('#registerEmail').val().trim();
        const password = $('#registerPassword').val().trim();
        const confirmPassword = $('#registerConfirmPassword').val().trim();
        const $btn = $(this).find('button[type="submit"]');
        const $btnText = $btn.find('.btn-text');
        const $btnSpinner = $btn.find('.spinner-border');
        
        // Validar contraseñas coincidentes
        if (password !== confirmPassword) {
            showError("#registerErrorMessage", "Las contraseñas no coinciden.");
            return;
        }
        
        // Validar fortaleza de la contraseña
        if (password.length < 6) {
            showError("#registerErrorMessage", "La contraseña debe tener al menos 6 caracteres.");
            return;
        }
        const originalText = $btn.html();
        const errorMessageDiv = $('#registerErrorMessage');
        errorMessageDiv.addClass('d-none');
        if (!email || password.length < 6) {
            errorMessageDiv.text("Ingresá un email válido y una contraseña de al menos 6 caracteres.").removeClass('d-none');
            return;
        }
        try {
            $btn.html('<i class="fas fa-spinner fa-spin"></i> Registrando...').prop('disabled', true);
            await authService.doRegister(email, password);
            $('#registerModal').modal('hide');
        } catch (error) {
            errorMessageDiv.text(authService.translateError(error.code)).removeClass('d-none');
            $btn.html(originalText).prop('disabled', false);
        }
    });

    // Listener para los botones de logout
    $('body').on('click', '#logoutBtn, #logoutButton, .logout-link', async function(e) {
        e.preventDefault();
        console.log('[Auth] Iniciando cierre de sesión...');
        
        // Mostrar mensaje de confirmación
        const confirmLogout = confirm('¿Estás seguro de que querés cerrar sesión?');
        if (!confirmLogout) {
            console.log('[Auth] Cierre de sesión cancelado por el usuario');
            return;
        }
        
        try {
            // Mostrar estado de carga
            const $logoutBtn = $(this);
            const originalText = $logoutBtn.html();
            $logoutBtn.html('<i class="fas fa-spinner fa-spin"></i> Cerrando sesión...').prop('disabled', true);
            
            // Cerrar sesión en el servicio de autenticación
            await authService.logout();
            
            // Limpiar datos de la aplicación
            currentUser = null;
            
            // Limpiar cualquier dato de sesión existente
            sessionStorage.clear();
            localStorage.clear();
            
            // Eliminar cookies
            document.cookie.split(';').forEach(cookie => {
                const [name] = cookie.trim().split('=');
                document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
            });
            
            console.log('[Auth] Sesión cerrada correctamente');
            
            // Mostrar notificación de éxito
            if (typeof notificaciones !== 'undefined') {
                notificaciones.info('Sesión cerrada', 'Has cerrado sesión correctamente. Redirigiendo...');
            } else {
                alert('Sesión cerrada correctamente. Serás redirigido al inicio.');
            }
            
            // Redirigir a la página de login después de un breve retraso
            setTimeout(() => {
                window.location.href = '/demo.html?logout=1';
            }, 1500);
            
        } catch (error) {
            console.error('[Auth] Error al cerrar sesión:', error);
            
            // Mostrar mensaje de error
            if (typeof notificaciones !== 'undefined') {
                notificaciones.error('Error', 'Ocurrió un error al cerrar la sesión. Por favor, inténtalo de nuevo.');
            } else {
                alert('Error al cerrar sesión. Por favor, inténtalo de nuevo.');
            }
            
            // Forzar recarga de la página como último recurso
            setTimeout(() => {
                window.location.href = '/demo.html?error=logout_failed';
            }, 1000);
        }
    });
});
        



        


    /**
     * Muestra el dashboard principal después de una autenticación exitosa
     */
    function showDashboard() {
        // Verificar si hay un usuario autenticado
        if (!authService.isLoggedIn()) {
            console.warn('[Auth] Intento de acceder al dashboard sin autenticación');
            window.location.href = '/demo.html?error=unauthorized';
            return;
        }
        
        console.log('[Auth] Mostrando dashboard para usuario:', authService.getCurrentUser().email);
        
        // Actualizar la UI con los datos del usuario
        const user = authService.getCurrentUser();
        if (user && user.name) {
            $('.user-name').text(user.name);
            $('#welcomeName').text(user.name);
        }
        
        // Si ya estamos en el dashboard, solo actualizar los datos
        if (window.location.pathname.endsWith('index.html')) {
            loadDashboardData();
            return;
        }
        
        // Redirigir al dashboard
        window.location.href = '/index.html';
    }
    
    /**
     * Inicia la demo con datos de prueba
     */
    function startDemo() {
        console.log("Iniciando modo demo...");
        try {
            isDemoMode = true;
            currentUser = { ...demoData.user, name: "Dr. Luscana" };
            appData = JSON.parse(JSON.stringify(demoData));
            console.log("Datos de demo cargados:", currentUser);
            showDashboard();
            console.log("Dashboard mostrado en modo demo");
        } catch (error) {
            console.error("Error en startDemo:", error);
            alert("Error al iniciar demo: " + error.message);
        }
    }

    /**
     * Oculta todas las pantallas principales
     */
    function hideAllScreens() {
        // Oculta todas las pantallas principales. loginScreen no existe como pantalla, es un modal.
        $('#landingScreen, #dashboardScreen, #demoEndScreen, #paymentScreen').addClass('d-none');
    }
    
    /**
     * Actualiza la UI de la landing page para un usuario autenticado
     * @param {object} user - Datos del usuario autenticado
     */
    function updateLandingPageForLoggedInUser(user) {
        console.log('[UI] Actualizando landing page para usuario autenticado');
        
        // Actualizar el botón de login para mostrar el nombre del usuario
        const $loginBtn = $('.login-button, .btn-login, .navbar-login-btn');
        if ($loginBtn.length) {
            $loginBtn.html(`
                <i class="fas fa-user-circle mr-2"></i>
                ${user.name.split(' ')[0]}
                <i class="fas fa-chevron-down ml-2"></i>
            `).removeClass('btn-outline-primary')
              .addClass('btn-primary')
              .attr('title', `Ver perfil de ${user.name}`);
            
            // Eliminar cualquier menú desplegable existente
            $('.user-dropdown-menu').remove();
            
            // Agregar menú desplegable
            $loginBtn.after(`
                <div class="dropdown-menu dropdown-menu-right user-dropdown-menu" aria-labelledby="userDropdown">
                    <a class="dropdown-item" href="#" onclick="showSection('profile')">
                        <i class="fas fa-user mr-2"></i> Mi Perfil
                    </a>
                    <a class="dropdown-item" href="#" id="dashboardLink">
                        <i class="fas fa-tachometer-alt mr-2"></i> Ir al Panel
                    </a>
                    <div class="dropdown-divider"></div>
                    <a class="dropdown-item text-danger" href="#" id="logoutLink">
                        <i class="fas fa-sign-out-alt mr-2"></i> Cerrar Sesión
                    </a>
                </div>
            `);
            
            // Configurar eventos del menú desplegable
            $loginBtn.off('click').on('click', function(e) {
                e.preventDefault();
                $('.user-dropdown-menu').toggleClass('show');
            });
            
            // Cerrar menú al hacer clic fuera
            $(document).on('click', function(e) {
                if (!$(e.target).closest('.user-dropdown-menu, .login-button, .btn-login, .navbar-login-btn').length) {
                    $('.user-dropdown-menu').removeClass('show');
                }
            });
            
            // Navegación desde el menú
            $('#dashboardLink').on('click', function(e) {
                e.preventDefault();
                showDashboard();
            });
            
            $('#logoutLink').on('click', function(e) {
                e.preventDefault();
                authService.logout().then(() => {
                    window.location.href = '/demo.html?logout=1';
                });
            });
        }
    }
    
    /**
     * Restaura la UI de la landing page para invitados
     */
    function updateLandingPageForGuest() {
        console.log('[UI] Actualizando landing page para invitado');
        
        // Restaurar el botón de login
        const $loginBtn = $('.login-button, .btn-login, .navbar-login-btn');
        if ($loginBtn.length) {
            $loginBtn.html(`
                <i class="fas fa-sign-in-alt mr-2"></i> Iniciar Sesión
            `).removeClass('btn-primary')
              .addClass('btn-outline-primary')
              .attr('title', 'Iniciar Sesión')
              .off('click')
              .on('click', function(e) {
                  e.preventDefault();
                  window.location.href = '/demo.html';
              });
            
            // Eliminar menú desplegable si existe
            $('.user-dropdown-menu').remove();
        }
    }


        
        // NAVIGATION
        function showSection(sectionName) {
            $('.main-panel .container-fluid > div').addClass('d-none');
            $('#' + sectionName + 'Section').removeClass('d-none');
            $('.sidebar .nav-link').removeClass('active');
            $(`.sidebar .nav-link[onclick*="'${sectionName}'"]`).addClass('active');
            if (sectionName === 'analytics') {
                window.loadCharts(); // Reload charts
            }
        }
        
        // PANEL TUTORIAL with Intro.js
        function startTutorial() {
            // Si es un usuario nuevo, mostrar tutorial específico
            if (currentUser && currentUser.isNewUser) {
                tutorialNuevoUsuario();
                return;
            }
            
            // Tutorial estándar para modo demo
            introJs().setOptions({
                steps: [
                    {
                        element: document.querySelector('[data-step="1"]'),
                        intro: "¡Hola! Este es tu panel de control, donde tenés un resumen de toda tu actividad. Empecemos el recorrido.",
                        position: 'bottom'
                    },
                    {
                        element: document.querySelector('.sidebar'),
                        intro: "Desde esta barra lateral navegás por las distintas secciones: Pacientes, Sesiones y Análisis. ¡Todo está a un clic de distancia!",
                        position: 'right'
                    },
                    {
                        element: document.querySelector('[data-step="3"]'),
                        intro: "Finalmente, usá estos atajos para las tareas más comunes. ¡Ahora vamos a simular el registro de una sesión por WhatsApp!",
                        position: 'top'
                    }
                ],
                nextLabel: 'Siguiente →',
                prevLabel: '← Anterior',
                skipLabel: 'Omitir',
                doneLabel: '¡Vamos!',
                showProgress: true,
                tooltipClass: 'aira-tour',
                exitOnOverlayClick: false,
                exitOnEsc: false,
                showBullets: false
            }).oncomplete(function() {
                endTutorial();
            }).onexit(function() {
                endTutorial(true); // Mark as skipped
            }).start();
        }
        
        // Tutorial especial para nuevos usuarios
        function tutorialNuevoUsuario() {
            introJs().setOptions({
                steps: [
                    {
                        intro: `¡Bienvenido/a a AIRA, ${currentUser.name}! Tu cuenta ha sido creada exitosamente. Vamos a conocer la plataforma.`
                    },
                    {
                        element: document.querySelector('.dashboard-summary'),
                        intro: "Este es tu panel principal. Aquí verás estadísticas de tus pacientes y sesiones.",
                        position: 'bottom'
                    },
                    {
                        element: document.querySelector('#patientsList'),
                        intro: "Ya agregamos un paciente de ejemplo para que puedas ver cómo funciona la plataforma.",
                        position: 'top'
                    },
                    {
                        element: document.querySelector('.sidebar'),
                        intro: "Usa este menú para navegar entre las diferentes secciones de AIRA.",
                        position: 'right'
                    },
                    {
                        element: document.querySelector('[data-tutorial="newPatient"]'),
                        intro: "Para agregar un nuevo paciente, usa este botón. ¡Es muy sencillo!",
                        position: 'left'
                    },
                    {
                        element: document.querySelector('#quickActionsSection'),
                        intro: "Y aquí tienes acciones rápidas para las tareas más frecuentes.",
                        position: 'top'
                    },
                    {
                        intro: "¡Listo! Ya podés empezar a usar AIRA. Si necesitás ayuda, hacé clic en el ícono de ayuda en la barra superior."
                    }
                ],
                nextLabel: 'Siguiente →',
                prevLabel: '← Anterior',
                skipLabel: 'Omitir',
                doneLabel: '¡Empezar!',
                showProgress: true,
                tooltipClass: 'aira-tour new-user-tour',
                exitOnOverlayClick: false,
                exitOnEsc: false,
                showBullets: false
            }).oncomplete(function() {
                // Marcar que ya no es nuevo usuario al completar el tutorial
                currentUser.isNewUser = false;
                endTutorial();
            }).onexit(function() {
                // Marcar que ya no es nuevo usuario incluso al omitir
                currentUser.isNewUser = false;
                endTutorial(true);
            }).start();
        }


        function endTutorial(wasSkipped = false) {
            if(isDemoMode) {
                 runWhatsappSimulation();
                 return;
            }
            
            if (currentUser) {
                currentUser.isNewUser = false;
            }

            // Eliminamos notificación automática al iniciar sesión
            // if(!wasSkipped){
        }

        function demoEndReturn() {
            hideAllScreens();
            $('#landingScreen').removeClass('d-none');
        }

        // PERFIL PROFESIONAL
        function initProfileSection() {
            // Eliminar cualquier notificación existente al cargar
            $('.custom-notification').remove();
    
    // Cargar datos del usuario actual en los campos del perfil
    if (currentUser) {
        // Datos básicos del usuario
        if (currentUser.name) {
            const nombreCompleto = currentUser.name.split(" ");
            $("#nombre").val(nombreCompleto[0] || "");
            $("#apellido").val(nombreCompleto.slice(1).join(" ") || "");
        }
        if (currentUser.dni) $("#dni-perfil").val(currentUser.dni);
        if (currentUser.specialty) $("#especialidad").val(currentUser.specialty);
        
        // Si es usuario demo, cargar datos adicionales
        if (isDemoMode && demoData && demoData.user) {
            $("#email").val(demoData.user.email || "");
            $("#telefono").val(demoData.user.phone || "");
            $("#biografia").val(demoData.user.bio || "");
        }
    }            
            // Función para validar formato de email
            function isValidEmail(email) {
                const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                return re.test(email);
            }
            
            // Función para validar formato de teléfono
            function isValidPhone(phone) {
                // Acepta formatos como: +54 11 2233-4455, 11-2233-4455, 1122334455
                const re = /^(\+?\d{1,3}\s?)?(\d{2,4}[\s-]?){1,2}\d{4}$/;
                return re.test(phone);
            }
            
            // Botón guardar datos personales
            $('#btn-guardar-config-cuenta').on('click', function() {
                // Efecto visual de guardado
                const $btn = $(this);
                const originalText = $btn.html();
                $btn.html('<i class="fas fa-spinner fa-spin"></i> Guardando...');
                $btn.prop('disabled', true);
                
                // Simular guardado (con un pequeño delay para mostrar el efecto)
                setTimeout(() => {
                    // Restaurar botón
                    $btn.html(originalText);
                    $btn.prop('disabled', false);
                    
                    // Mostrar notificación de éxito
                    showNotification('Configuración guardada correctamente', 'success');
                }, 800);
            });
            
            // Botón cambiar contraseña
            $('#btn-cambiar-password').on('click', function() {
                $('#cambiarPasswordModal').modal('show');
            });
            
            // Funcionalidad para mostrar/ocultar contraseña
            $('.password-toggle').on('click', function() {
                const targetId = $(this).data('target');
                const input = $(targetId);
                const icon = $(this).find('i');
                
                if (input.attr('type') === 'password') {
                    input.attr('type', 'text');
                    icon.removeClass('fa-eye').addClass('fa-eye-slash');
                } else {
                    input.attr('type', 'password');
                    icon.removeClass('fa-eye-slash').addClass('fa-eye');
                }
            });
            
            // Validar fortaleza de contraseña en tiempo real
            $('#password-nueva').on('input', function() {
                const password = $(this).val();
                let strength = 0;
                let message = '';
                let barClass = '';
                
                // Criterios de fortaleza
                if (password.length >= 8) strength += 25;
                if (password.match(/[A-Z]/)) strength += 25;
                if (password.match(/[0-9]/)) strength += 25;
                if (password.match(/[^A-Za-z0-9]/)) strength += 25;
                
                // Actualizar barra de progreso
                $('#password-strength-bar').css('width', strength + '%');
                $('#password-strength-bar').attr('aria-valuenow', strength);
                
                // Establecer clase y mensaje según fortaleza
                if (strength === 0) {
                    barClass = '';
                    message = 'Ingresá una contraseña segura';
                } else if (strength <= 25) {
                    barClass = 'bg-danger';
                    message = 'Muy débil';
                } else if (strength <= 50) {
                    barClass = 'bg-warning';
                    message = 'Débil';
                } else if (strength <= 75) {
                    barClass = 'bg-info';
                    message = 'Buena';
                } else {
                    barClass = 'bg-success';
                    message = 'Excelente';
                }
                
                $('#password-strength-bar').removeClass('bg-danger bg-warning bg-info bg-success').addClass(barClass);
                $('#password-strength-text').text(message);
            });
            
            // Validar coincidencia de contraseñas en tiempo real
            $('#password-confirmar').on('input', function() {
                const password = $('#password-nueva').val();
                const confirm = $(this).val();
                
                if (confirm === '') {
                    $('#password-match').html('');
                } else if (password === confirm) {
                    $('#password-match').html('<small class="text-success"><i class="fas fa-check"></i> Las contraseñas coinciden</small>');
                } else {
                    $('#password-match').html('<small class="text-danger"><i class="fas fa-times"></i> Las contraseñas no coinciden</small>');
                }
            });
            
            // Manejar formulario de cambio de contraseña
            $('#form-cambiar-password').on('submit', function(e) {
                e.preventDefault();
                
                const passwordActual = $('#password-actual').val().trim();
                const passwordNueva = $('#password-nueva').val().trim();
                const passwordConfirmar = $('#password-confirmar').val().trim();
                
                // Validaciones
                if (!passwordActual) {
                    showNotification('Ingresá tu contraseña actual', 'warning');
                    return;
                }
                
                if (!passwordNueva || passwordNueva.length < 6) {
                    showNotification('La nueva contraseña debe tener al menos 6 caracteres', 'warning');
                    return;
                }
                
                if (passwordNueva !== passwordConfirmar) {
                    showNotification('Las contraseñas no coinciden', 'warning');
                    return;
                }
                
                // Efecto visual de guardado
                const $btn = $('button[type="submit"][form="form-cambiar-password"]');
                const originalText = $btn.html();
                $btn.html('<i class="fas fa-spinner fa-spin"></i> Guardando...');
                $btn.prop('disabled', true);
                
                // Simular cambio exitoso (con un pequeño delay para mostrar el efecto)
                setTimeout(() => {
                    // Restaurar botón
                    $btn.html(originalText);
                    $btn.prop('disabled', false);
                    
                    // Cerrar modal y limpiar campos
                    $('#cambiarPasswordModal').modal('hide');
                    $('#password-actual, #password-nueva, #password-confirmar').val('');
                    $('#password-strength-bar').css('width', '0%').removeClass('bg-danger bg-warning bg-info bg-success');
                    $('#password-strength-text').text('Ingresá una contraseña segura');
                    $('#password-match').html('');
                    
                    // Mostrar notificación de éxito
                    setTimeout(() => {
                        showNotification('Contraseña actualizada correctamente', 'success');
                    }, 500);
                }, 800);
            });
            
            // Inicializar tooltips
            
            // Inicializar tooltips
            $('[data-toggle="tooltip"]').tooltip();
            
            // Calcular completitud inicial del perfil
            // updateProfileCompleteness(); // Comentado temporalmente para evitar errores
        }
        

        
        // DASHBOARD DATA & RENDERING
        async function loadDashboardData() {
            try {
                // Cargar métricas principales
                const [patientsSnapshot, sessionsSnapshot, followupsSnapshot, todaySessionsSnapshot] = await Promise.all([
                    db.collection('patients').get(),
                    db.collection('sessions').get(),
                    db.collection('sessions').where('requiresFollowUp', '==', true).get(),
                    window.getTodaySessionsQuery() // Usar la función del servicio
                ]);

                const sessionsTodayList = todaySessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // Actualizar contadores del dashboard
                $('#totalPatients').text(patientsSnapshot.size);
                $('#totalSessions').text(sessionsSnapshot.size);
                $('#followupsNeeded').text(followupsSnapshot.size);
                $('#sessionsToday').text(sessionsTodayList.length);

                // Cargar listas usando funciones de los servicios
                window.loadRecentSessions();
                window.populateTodaysSessionsModal(sessionsTodayList);

            } catch (error) {
                console.error("Error al cargar los datos del dashboard: ", error);
                notificaciones.error('Error de Dashboard', 'No se pudieron cargar las métricas.');
                // Poner contadores a 0 en caso de error
                $('#totalPatients, #totalSessions, #followupsNeeded, #sessionsToday').text('0');
            }
        }




        
        // Variables para eliminar pacientes
        let pacienteIdAEliminar = null;
        
        // Función para ocultar todas las pantallas
        function hideAllScreens() {
            $('.screen').addClass('d-none');
            $('.modal').modal('hide');
        }

        // Función para mostrar el dashboard
        function showDashboard() {
            hideAllScreens();
            $('#dashboardSection').removeClass('d-none');
            
            // Cargar datos del dashboard
            loadDashboardData();
            
            // Actualizar el menú activo
            $('.nav-link').removeClass('active');
            $('#dashboardLink').addClass('active');
            
            // Actualizar breadcrumbs
            if (typeof updateBreadcrumbs === 'function') {
                updateBreadcrumbs('Dashboard');
            }
            
            // Mostrar tutorial si es nuevo usuario
            if (currentUser?.isNewUser) {
                startTutorial();
            }
        }

        // Función para mostrar una sección específica
        function showSection(sectionName) {
            hideAllScreens();
            $(`#${sectionName}Section`).removeClass('d-none');
            
            // Actualizar el menú activo
            $('.nav-link').removeClass('active');
            $(`#${sectionName}Link`).addClass('active');
            
            // Actualizar breadcrumbs
            if (typeof updateBreadcrumbs === 'function') {
                updateBreadcrumbs(sectionName);
            }
            
            // Cargar datos específicos de la sección si es necesario
            if (sectionName === 'patients') {
                loadPatientsData();
            } else if (sectionName === 'sessions') {
                loadSessionsData();
            } else if (sectionName === 'analytics') {
                // Cargar datos de analytics
            } else if (sectionName === 'profile') {
                initProfileSection();
            }
        }

        // Función para mostrar el modal de confirmación
        async function confirmarEliminarPaciente(id) {
            try {
                const patientRef = db.collection('patients').doc(id);
                const doc = await patientRef.get();

                if (!doc.exists) {
                    notificaciones.error('Error', 'No se encontró el paciente a eliminar.');
                    return;
                }

                const patient = doc.data();
                pacienteIdAEliminar = id; // Guardamos el ID del paciente a eliminar

                // Contar sesiones asociadas directamente desde Firestore
                const sessionsSnapshot = await db.collection('sessions').where('patientId', '==', id).get();
                const sesionesAsociadas = sessionsSnapshot.size;
                
                $('#pacienteEliminarNombre').text(patient.name);
                
                let mensajeAdicional = '';
                if (sesionesAsociadas > 0) {
                    mensajeAdicional = `<div class="alert alert-warning mt-2"><i class="fas fa-exclamation-triangle mr-2"></i> Este paciente tiene <strong>${sesionesAsociadas} ${sesionesAsociadas === 1 ? 'sesión' : 'sesiones'}</strong> que también serán eliminadas.</div>`;
                }
                $('#detallesSesionesEliminar').html(mensajeAdicional);
                
                $('#patientDetailModal').modal('hide');
                $('#confirmarEliminarPacienteModal').modal('show');

            } catch (error) {
                console.error("Error al preparar la eliminación del paciente: ", error);
                notificaciones.error('Error', 'No se pudo obtener la información del paciente.');
            }
        }
        
        // Función para eliminar un paciente
        async function eliminarPaciente() {
            if (!pacienteIdAEliminar) return;

            try {
                await db.collection('patients').doc(pacienteIdAEliminar).delete();

                // TODO: Implementar la eliminación en cascada de las sesiones del paciente en Firestore.
                // Esto es CRÍTICO para evitar datos huérfanos. Se puede hacer con una Cloud Function
                // o una transacción que lea y elimine las sesiones asociadas.

                $('#confirmarEliminarPacienteModal').modal('hide');
                loadPatientsData();
                notificaciones.success('Paciente eliminado', 'El paciente ha sido eliminado de la base de datos.');

            } catch (error) {
                console.error("Error al eliminar el paciente de Firestore: ", error);
                notificaciones.error('Error', 'No se pudo eliminar el paciente.');
            } finally {
                pacienteIdAEliminar = null; // Limpiar el ID en cualquier caso
            }
        }

        // SESSIONS DATA
        function renderSessions(sessionsArray, title, subTitle) {
            const container = $('#sessionsList');
            $('#sessionsHeader').text(title);
            $('#sessionsSubHeader').text(subTitle);

            if (!sessionsArray || sessionsArray.length === 0) {
                container.html(`<div class="col-12"><div class="empty-state p-4"><div class="empty-state-icon">📋</div><h5>No se encontraron sesiones</h5><p>No hay sesiones que coincidan con los filtros aplicados.</p><button class="btn btn-primary btn-sm" onclick="loadSessionsData()">Ver Todas las Sesiones</button></div></div>`);
                return;
            }
            
            const html = [...sessionsArray].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(session => {
                const moodEmojis = { 1: "😢", 2: "😕", 3: "😐", 4: "🙂", 5: "😊" };
                
                const getMoodColorClass = (moodScore) => {
                    if (moodScore <= 2) return 'danger';
                    if (moodScore === 3) return 'warning';
                    if (moodScore >= 4) return 'success';
                    return 'info'; 
                }
                const colorClass = getMoodColorClass(session.mood_assessment);

                const badgeClass = session.created_via === 'whatsapp' ? 'badge-whatsapp' : 'badge-web';
                const followupBadge = session.requires_followup ? '<span class="badge badge-followup">Requiere seguimiento</span>' : '<span class="badge badge-stable">Evolución normal</span>';
                return `
                <div class="col-xl-4 col-lg-6 mb-4">
                    <div class="card session-card stats-card ${colorClass}" onclick="uiService.showSessionDetail('${session.id}')">
                        <div class="card-body d-flex flex-column">
                            <div class="d-flex align-items-center mb-3">
                                <div class="patient-avatar mr-3">${session.patient_name[0]}</div>
                                <div class="flex-grow-1">
                                    <h5 class="card-title mb-0 font-weight-bold patient-name-heading">${session.patient_name}</h5>
                                    <small class="text-muted">${new Date(session.created_at).toLocaleDateString('es-AR', { year: 'numeric', month: 'long', day: 'numeric' })}</small>
                                </div>
                                <span class="badge ${badgeClass}">${session.created_via === 'whatsapp' ? 'Wpp' : 'Web'}</span>
                            </div>
                            <p class="card-text text-muted mb-3 flex-grow-1">${session.summary.substring(0, 100)}...</p>
                            <div class="d-flex align-items-center justify-content-between mt-auto">
                                <div class="text-muted small">
                                    <i class="fas fa-smile mr-1"></i> Estado: ${moodEmojis[session.mood_assessment]} ${session.mood_assessment}/5
                                </div>
                                ${followupBadge}
                            </div>
                        </div>
                    </div>
                </div>`;
            }).join('');
            container.html(html);
        }
        
        async function applySessionFilters() {
            const selectedPatientId = $('#sessionPatientFilter').val();
            const startDateVal = $('#startDate').val();
            const endDateVal = $('#endDate').val();

            try {
                // NOTA: Firestore puede requerir un índice compuesto para consultas que filtran por un campo y ordenan por otro.
                let query = db.collection('sessions');

                // Aplicar filtros
                if (selectedPatientId && selectedPatientId !== 'all') {
                    query = query.where('patientId', '==', selectedPatientId);
                }
                if (startDateVal) {
                    query = query.where('createdAt', '>=', new Date(startDateVal + "T00:00:00"));
                }
                if (endDateVal) {
                    query = query.where('createdAt', '<=', new Date(endDateVal + "T23:59:59"));
                }

                // Siempre ordenar para consistencia. El orderBy debe ser sobre el mismo campo de los filtros de rango (createdAt).
                query = query.orderBy('createdAt', 'desc');

                const sessionsSnapshot = await query.get();
                const sessions = sessionsSnapshot.docs.map(doc => {
                    const data = doc.data();
                    // Convertir Timestamps de Firestore a Date de JS para la función de renderizado
                    return {
                        id: doc.id,
                        ...data,
                        created_at: data.createdAt.toDate() 
                    };
                });

                const patientName = $('#sessionPatientFilter option:selected').text();
                const title = (selectedPatientId && selectedPatientId !== 'all') ? `Sesiones de ${patientName}` : 'Todas las Sesiones';
                const subTitle = `${sessions.length} ${sessions.length === 1 ? 'sesión encontrada' : 'sesiones encontradas'}.`;

                renderSessions(sessions, title, subTitle);

            } catch (error) {
                console.error("Error al aplicar filtros de sesión: ", error);
                notificaciones.error('Error de Filtro', 'No se pudieron aplicar los filtros. Es posible que necesites crear un índice en Firestore para esta consulta.');
                renderSessions([], 'Error de Carga', 'No se pudieron obtener los datos de Firestore.');
            }
        }
        
        async function loadSessionsData() {
            const select = $('#sessionPatientFilter');
            select.html('<option value="all">Cargando pacientes...</option>');

            try {
                // Cargar pacientes para el filtro
                const patientsSnapshot = await db.collection('patients').where('status', '==', 'active').orderBy('name').get();
                const patientOptions = patientsSnapshot.docs.map(doc => {
                    const patient = { id: doc.id, ...doc.data() };
                    return `<option value="${patient.id}">${patient.name}</option>`;
                }).join('');
                select.html('<option value="all">Todos los pacientes</option>' + patientOptions);

                // Cargar todas las sesiones
                // TODO: Esto puede ser ineficiente. Considerar paginación en el futuro.
                const sessionsSnapshot = await db.collection('sessions').orderBy('createdAt', 'desc').get();
                const sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                renderSessions(sessions, 'Historial de Sesiones', 'Todas tus sesiones médicas');

            } catch (error) {
                console.error("Error al cargar datos de sesiones desde Firestore: ", error);
                notificaciones.error('Error', 'No se pudieron cargar los datos.');
                renderSessions([], 'Error de Carga', 'No se pudieron obtener los datos de Firestore.');
            }
        }

        function viewPatientSessions(patientId) {
            // Esta función ahora solo necesita configurar la UI y llamar a la función de filtrado,
            // que ya es asíncrona y se encarga de obtener los datos de Firestore.
            $('#patientDetailModal').modal('hide');
            showSection('sessions');
            $('#sessionPatientFilter').val(patientId);
            applySessionFilters();
        }

        async function showFollowupSessions(){
            showSection('sessions');
            try {
                const querySnapshot = await db.collection('sessions').where('requiresFollowUp', '==', true).orderBy('createdAt', 'desc').get();
                const sessions = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        created_at: data.createdAt.toDate()
                    };
                });
                renderSessions(sessions, 'Sesiones con Seguimiento', 'Pacientes que requieren atención prioritaria.');
            } catch (error) {
                console.error("Error al cargar sesiones con seguimiento: ", error);
                notificaciones.error('Error', 'No se pudieron cargar las sesiones con seguimiento.');
                renderSessions([], 'Error de Carga', 'No se pudieron obtener los datos de Firestore.');
            }
        }

        async function exportSessionsToExcel() {
            const selectedPatientId = $('#sessionPatientFilter').val();
            const startDateVal = $('#startDate').val();
            const endDateVal = $('#endDate').val();

            notificaciones.info('Exportando...', 'Generando el archivo Excel con los datos filtrados.');

            try {
                let query = db.collection('sessions');

                // Aplicar los mismos filtros que en applySessionFilters
                if (selectedPatientId && selectedPatientId !== 'all') {
                    query = query.where('patientId', '==', selectedPatientId);
                }
                if (startDateVal) {
                    query = query.where('createdAt', '>=', new Date(startDateVal + "T00:00:00"));
                }
                if (endDateVal) {
                    query = query.where('createdAt', '<=', new Date(endDateVal + "T23:59:59"));
                }
                query = query.orderBy('createdAt', 'desc');

                const sessionsSnapshot = await query.get();

                if (sessionsSnapshot.empty) {
                    notificaciones.warning("Sin Datos", "No hay sesiones para exportar con los filtros actuales.");
                    return;
                }

                const dataToExport = sessionsSnapshot.docs.map(doc => {
                    const s = doc.data();
                    return {
                        'Paciente': s.patientName,
                        'Fecha': s.createdAt.toDate(),
                        'Resumen': s.summary,
                        'Notas de Medicación': s.medicationNotes,
                        'Estado Anímico': s.moodAssessment,
                        'Requiere Seguimiento': s.requiresFollowUp ? 'Sí' : 'No',
                        'Registrado Vía': s.createdVia
                    };
                });

                const worksheet = XLSX.utils.json_to_sheet(dataToExport);
                // Ajustar el ancho de las columnas
                worksheet['!cols'] = [{ wch: 25 }, { wch: 20 }, { wch: 50 }, { wch: 50 }, { wch: 15 }, { wch: 20 }, { wch: 15 }];
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Sesiones");

                // Generar y descargar el archivo
                XLSX.writeFile(workbook, `Sesiones-${new Date().toISOString().slice(0,10)}.xlsx`);

            } catch (error) {
                console.error("Error al exportar sesiones a Excel: ", error);
                notificaciones.error('Error de Exportación', 'No se pudieron obtener los datos para el archivo Excel.');
            }
        }


        // MODALS
        function showTodaysSessionsModal() {
            $('#todaysSessionsModal').modal('show');
        }

        function populateTodaysSessionsModal(sessions) {
            const listEl = $('#todaysSessionsList');
            listEl.empty();
            if (sessions.length === 0) {
                listEl.html('<li class="list-group-item text-center text-muted">No hay sesiones programadas para hoy.</li>');
                return;
            }
            const html = sessions.map(s => `<li class="list-group-item d-flex justify-content-between align-items-center"><div><strong>${s.patient_name}</strong><small class="d-block text-muted">${s.summary.substring(0, 40)}...</small></div><span class="badge badge-primary badge-pill">${new Date(s.created_at).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</span></li>`).join('');
            listEl.html(html);
        }
        
        async function showSessionDetail(sessionId) {
            $('#sessionDetailTitle').text('Cargando...');
            $('#sessionDetailBody').html('<div class="text-center p-5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>');
            $('#sessionDetailModal').modal('show');

            try {
                const sessionRef = db.collection('sessions').doc(sessionId);
                const doc = await sessionRef.get();

                if (!doc.exists) {
                    notificaciones.error('Error', 'No se pudo encontrar la sesión.');
                    $('#sessionDetailModal').modal('hide');
                    return;
                }

                const session = doc.data();
                const moodEmojis = { 1: "😢 Muy bajo", 2: "😕 Bajo", 3: "😐 Neutral", 4: "🙂 Bueno", 5: "😊 Muy bueno" };

                $('#sessionDetailTitle').text(`Sesión de ${session.patientName}`);
                
                const medicationHTML = session.medicationNotes 
                    ? `<h6><i class="fas fa-pills mr-2 text-primary"></i>Medicación</h6><p>${session.medicationNotes}</p><hr>`
                    : '';
                
                const detailHTML = `
                    <h5><i class="fas fa-clipboard-list mr-2 text-primary"></i>Resumen de la Sesión</h5>
                    <p>${session.summary}</p>
                    <hr>
                    ${medicationHTML}
                    <div class="row">
                        <div class="col-md-6">
                            <h6><i class="fas fa-smile mr-2 text-primary"></i>Estado Anímico</h6>
                            <p>${moodEmojis[session.moodAssessment]}</p>
                        </div>
                        <div class="col-md-6">
                            <h6><i class="fas fa-calendar-alt mr-2 text-primary"></i>Fecha y Hora</h6>
                            <p>${session.createdAt.toDate().toLocaleString('es-AR')}</p>
                        </div>
                    </div>
                `;
                
                $('#sessionDetailBody').html(detailHTML);

            } catch (error) {
                console.error("Error al mostrar detalle de sesión: ", error);
                notificaciones.error('Error', 'No se pudieron cargar los detalles de la sesión.');
                $('#sessionDetailModal').modal('hide');
            }
        }



        // FORMS
        $('#newPatientForm').on('submit', async function(e) {
            e.preventDefault();
            if (!currentUser || !currentUser.uid) {
                notificaciones.error('Error de autenticación', 'No se pudo identificar al usuario. Por favor, inicie sesión de nuevo.');
                return;
            }

            const newPatient = {
                name: $('#patientName').val(),
                dni: $('#patientDni').val(),
                insurance: $('#patientInsurance').val(),
                phone: $('#patientPhone').val(),
                created_at: new Date(),
                created_via: 'web',
                status: 'active', // Asignar estado activo por defecto
                userId: currentUser.uid // VINCULAR PACIENTE AL USUARIO
            };

            try {
                await db.collection('patients').add(newPatient);
                loadPatientsData();

                // loadDashboardData(); 
                $('#newPatientModal').modal('hide');
                notificaciones.success('Paciente registrado', 'El nuevo paciente ha sido guardado en la base de datos.');
                this.reset(); // Limpiar el formulario
            } catch (error) {
                console.error("Error al guardar el paciente en Firestore: ", error);
                notificaciones.error('Error de guardado', 'No se pudo registrar el paciente. Inténtelo de nuevo.');
            }
        });

        $('#newSessionForm').on('submit', async function(e) {
            e.preventDefault();
            const patientId = $('#sessionPatient').val();
            const patientName = $('#sessionPatient option:selected').text();
            
            if (!patientId) {
                notificaciones.warning("Atención", "Por favor, seleccioná un paciente válido.");
                return;
            }

            const mood = parseInt($('#sessionMood').val());
            if (!currentUser || !currentUser.uid) {
                notificaciones.error('Error de autenticación', 'No se pudo identificar al usuario. Por favor, inicie sesión de nuevo.');
                return;
            }

            const newSession = {
                patientId: patientId,
                patientName: patientName,
                summary: $('#sessionContent').val(),
                moodAssessment: mood,
                requiresFollowUp: mood <= 2,
                createdAt: new Date(),
                createdVia: 'web',
                medicationNotes: $('#sessionMedication').val(),
                userId: currentUser.uid // VINCULAR SESIÓN AL USUARIO
            };

            try {
                await db.collection('sessions').add(newSession);
                
                // TODO: Refactorizar estas funciones para que lean de Firestore
                loadSessionsData();
                loadDashboardData();
                loadCharts();
                
                $('#newSessionModal').modal('hide');
                notificaciones.success('Éxito', 'Sesión guardada correctamente.');

            } catch (error) {
                console.error("Error al guardar la sesión en Firestore: ", error);
                notificaciones.error('Error', 'No se pudo guardar la sesión.');
            }
        });

        // Función para mostrar un mensaje de error
        function showError(selector, message) {
            const $errorEl = $(selector);
            $errorEl.html(`<i class="fas fa-exclamation-circle mr-2"></i> ${message}`).removeClass('d-none').addClass('show');
            
            // Ocultar después de 5 segundos
            setTimeout(() => {
                $errorEl.removeClass('show');
                setTimeout(() => $errorEl.addClass('d-none'), 300);
            }, 5000);
        }

        // Función para mostrar notificaciones
        function showNotification(message, type = 'info') {
            const types = {
                success: { icon: 'check-circle', class: 'success' },
                error: { icon: 'exclamation-circle', class: 'danger' },
                warning: { icon: 'exclamation-triangle', class: 'warning' },
                info: { icon: 'info-circle', class: 'info' }
            };
            
            const notifType = types[type] || types.info;
            const notificationId = 'notif-' + Date.now();
            
            const $notification = $(`
                <div id="${notificationId}" class="alert alert-${notifType.class} alert-dismissible fade show" role="alert" style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                    <i class="fas fa-${notifType.icon} mr-2"></i> ${message}
                    <button type="button" class="close" data-dismiss="alert" aria-label="Cerrar">
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
            `);
            
            $('body').append($notification);
            
            // Cerrar automáticamente después de 5 segundos
            setTimeout(() => {
                $notification.alert('close');
            }, 5000);
        }

        // Función para cerrar sesión
        async function doLogout() {
            try {
                await authService.doLogout();
                currentUser = null;
                isDemoMode = false;
                hideAllScreens();
                $('#landingScreen').removeClass('d-none');
                
                // Limpiar formularios
                $('#loginForm')[0].reset();
                $('#registerForm')[0]?.reset();
                
                // Limpiar mensajes de error
                $('.alert').alert('close');
                
                console.log("Sesión cerrada correctamente");
            } catch (error) {
                console.error("Error al cerrar sesión:", error);
                showNotification("Error al cerrar la sesión. Por favor, intentá de nuevo.", "error");
            }
        }
        function showRegisterModal() { $('#registerModal').modal('show'); }
        function backToLanding() { hideAllScreens(); $('#landingScreen').removeClass('d-none'); }
        
    function getWhatsAppBotResponse(message) {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('hola') || lowerMessage.includes('buen día')) {
        return { text: '¡Hola! 👋 Soy AIRA. ¿En qué puedo ayudarte hoy?' };
    }

        const match = message.match(/registrar paciente (.+)/i);
    if (match && match[1]) {
        const patientName = match[1].trim();
        return { text: `Paciente ${patientName} ha sido registrado.` };
    }

    return { text: 'No entendí tu solicitud. ¿Puedes intentar de nuevo?' };
}
