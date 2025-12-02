        // AIRA - Professional Medical Panel
        
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
        
        // Sistema de notificaciones - Completamente nuevo
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
                
                // Agregar notificación al contenedor
                $('#nuevo-notificaciones').append(html);
                
                // Mejorar accesibilidad
                $('#nuevo-notificaciones').attr('aria-live', 'assertive');

                // Animación de barra de progreso
                const $barra = $(`#${id} .nueva-notificacion-barra-progreso`);
                $barra.css({
                    'width': '100%',
                    'animation': `${duracion}ms linear barraProgreso`
                });
                
                // Autocierre con animación
                if (duracion > 0) {
                    setTimeout(() => {
                        $(`#${id}`).addClass('salida');
                        setTimeout(() => {
                            $(`#${id}`).remove();
                        }, 400); // Duración de animación de salida
                    }, duracion);
                }
            },
            
            // Variantes por tipo
            exito: function(titulo, mensaje, duracion = 4000) {
                this.mostrar('success', titulo, mensaje, duracion);
            },
            
            error: function(titulo, mensaje, duracion = 4000) {
                this.mostrar('error', titulo, mensaje, duracion);
            },
            
            advertencia: function(titulo, mensaje, duracion = 4000) {
                this.mostrar('warning', titulo, mensaje, duracion);
            },
            
            info: function(titulo, mensaje, duracion = 4000) {
                this.mostrar('info', titulo, mensaje, duracion);
            },

            // Mensaje de bienvenida para nuevos usuarios
            bienvenidaNuevo: function() {
                console.log("Mostrando notificación de bienvenida");
                this.exito(
                    'Bienvenido a AIRA',
                    'Tu registro ha sido completado correctamente. Ahora puedes comenzar a utilizar todas las funcionalidades de AIRA.',
                    6000
                );
            },
            
            // Obtener icono para el tipo de notificación
            obtenerIcono: function(tipo) {
                switch(tipo) {
                    case 'success':
                        return '<i class="fas fa-check-circle"></i>';
                    case 'error':
                        return '<i class="fas fa-times-circle"></i>';
                    case 'warning':
                        return '<i class="fas fa-exclamation-triangle"></i>';
                    case 'info':
                        return '<i class="fas fa-info-circle"></i>';
                    default:
                        return '';
                }
            },
            
            // Eliminar notificación por ID
            remover: function(id) {
                $(`#${id}`).addClass('salida');
                setTimeout(() => {
                    $(`#${id}`).remove();
                }, 400);
            }
        };
        
        // Agregar keyframe para la barra de progreso
        $('<style>')
            .prop('type', 'text/css')
            .html(`
                @keyframes barraProgreso {
                    from { width: 100%; }
                    to { width: 0%; }
                }
            `)
            .appendTo('head');
        
        // Menú Mobile
        $(document).ready(function() {
            // Eliminar cualquier notificación existente al cargar la página
            $('.custom-notification').remove();
            
            // Inicializar tooltips y popovers
            $('[data-toggle="tooltip"]').tooltip();
            $('[data-toggle="popover"]').popover();
            
            // Inicializar contadores de pacientes
            updatePatientsCounter();
            
            // Conectar botón eliminar paciente
            $('#btnEliminarPaciente').on('click', eliminarPaciente);
            
            // Toggle para mostrar/ocultar pacientes inactivos
            $('#toggleInactivePacientes').on('change', function() {
                showInactivePacientes = $(this).prop('checked');
                loadPatientsData($('#patientSearch').val().toLowerCase());
            });
            
            // Toggle de visualización para contraseña
            $('.password-toggle').on('click', function() {
                const passwordField = $(this).closest('.input-group').find('input');
                const icon = $(this).find('i');
                
                if (passwordField.attr('type') === 'password') {
                    passwordField.attr('type', 'text');
                    icon.removeClass('fa-eye').addClass('fa-eye-slash');
                    $(this).attr('aria-label', 'Ocultar contraseña');
                } else {
                    passwordField.attr('type', 'password');
                    icon.removeClass('fa-eye-slash').addClass('fa-eye');
                    $(this).attr('aria-label', 'Mostrar contraseña');
                }
            });
            
            // Evaluador de seguridad de contraseña
            $('input[type="password"]').on('input', function() {
                const password = $(this).val();
                const meter = $(this).closest('.form-group').find('.password-strength-meter');
                const progressBar = meter.find('.progress-bar');
                const feedback = meter.find('.password-feedback');
                
                if (password.length > 0) {
                    meter.removeClass('d-none');
                    
                    // Evaluar fortaleza
                    let strength = 0;
                    if (password.length >= 8) strength += 20;
                    if (password.match(/[A-Z]/)) strength += 20;
                    if (password.match(/[a-z]/)) strength += 20;
                    if (password.match(/[0-9]/)) strength += 20;
                    if (password.match(/[^A-Za-z0-9]/)) strength += 20;
                    
                    progressBar.css('width', strength + '%');
                    progressBar.attr('aria-valuenow', strength);
                    
                    // Color según fortaleza
                    if (strength <= 40) {
                        progressBar.removeClass('bg-warning bg-success').addClass('bg-danger');
                        feedback.text('Débil - Añade mayúsculas, números y símbolos');
                    } else if (strength <= 60) {
                        progressBar.removeClass('bg-danger bg-success').addClass('bg-warning');
                        feedback.text('Media - Intenta mejorarla');
                    } else {
                        progressBar.removeClass('bg-danger bg-warning').addClass('bg-success');
                        feedback.text('Fuerte - ¡Excelente contraseña!');
                    }
                } else {
                    meter.addClass('d-none');
                }
            });
            // Actualizar breadcrumbs según la sección
            window.updateBreadcrumbs = () => {
                if ($('#dashboardSection').is(':visible')) {
                    breadcrumbSystem.show('Dashboard');
                } else if ($('#patientsSection').is(':visible')) {
                    breadcrumbSystem.show('Pacientes', 'Dashboard');
                } else if ($('#patientDetailSection').is(':visible')) {
                    const nombre = $('#patientDetailName').text();
                    breadcrumbSystem.setPath([
                        {text: 'Dashboard', url: '#dashboardSection'},
                        {text: 'Pacientes', url: '#patientsSection'},
                        {text: nombre}
                    ]);
                } else if ($('#sessionsSection').is(':visible')) {
                    breadcrumbSystem.show('Sesiones', 'Dashboard');
                } else if ($('#landingSection').is(':visible')) {
                    breadcrumbSystem.hide();
                } else if ($('#loginSection').is(':visible')) {
                    breadcrumbSystem.hide();
                } else if ($('#profileSection').is(':visible')) {
                    breadcrumbSystem.show('Mi Perfil', 'Dashboard');
                }
            };
            
            // Actualizar breadcrumbs en cambios de sección
            // Usando eventos en lugar de observer para evitar bucles
            updateBreadcrumbs();
            
            // Agregar event listeners a los enlaces que cambian de sección
            $('.sidebar-link, .nav-link, [data-section]').on('click', function() {
                // Pequeño delay para asegurar que la sección se muestre primero
                setTimeout(updateBreadcrumbs, 100);
            });
            
            // Inicializar sidebar en mobile
            if ($(window).width() < 768) {
                $('.sidebar').addClass('collapsed');
            }
            
            // Toggle menú mobile
            $('#mobileMenuToggle').on('click', function() {
                $('.sidebar').toggleClass('collapsed');
                $(this).find('i').toggleClass('fa-bars fa-times');
                
                // Cambiar aria-label
                if ($('.sidebar').hasClass('collapsed')) {
                    $(this).attr('aria-label', 'Mostrar menú');
                } else {
                    $(this).attr('aria-label', 'Ocultar menú');
                }
            });
            
            // Inicializar sección de perfil profesional
            if (currentUser) {
                initProfileSection();
            }            
            // Simular sincronización sin notificación
            setTimeout(() => {
                $('.sync-indicator').addClass('d-none');
                // Quitamos la notificación automática
            }, 1500);
            
            if (isDemoMode) {
                setTimeout(startTutorial, 500);
            }
        });
        
        let currentUser = null;

        let isDemoMode = false;
        let landingChatTimeout;
        
        // Chart instances to prevent recreation errors
        let moodChartInstance = null;
        let moodEvolutionChartInstance = null;
        let topPatientsChartInstance = null;
        let whatsappSimulationTimeout;


        // Demo data
        const demoData = {
            user: { name: "Dr. Luscana", isNewUser: true, email: "dr.luscana@ejemplo.com", phone: "11-4567-8900", bio: "Psiquiatra especializada en trastornos de ansiedad y depresión. Más de 10 años de experiencia en el tratamiento de pacientes adultos." },
            patients: [
                { id: "p1", name: "María García", dni: "11111111", insurance: "OSDE", phone: "1145678901" },
                { id: "p2", name: "Juan Pérez", dni: "22222222", insurance: "Swiss Medical", phone: "1156789012" },
                { id: "p3", name: "Ana López", dni: "33333333", insurance: "Galeno", phone: "1167890123" },
                { id: "p4", name: "Carlos Rodríguez", dni: "44444444", insurance: "OSDE", phone: "1178901234" },
                { id: "p5", name: "Lucía Martínez", dni: "55555555", insurance: "OSECAC", phone: "1189012345" }
            ],
            sessions: [
                { id: "s_today_1", patient_id: "p1", patient_name: "María García", summary: "Sesión de hoy. Se discuten avances en la terapia de exposición para la ansiedad social. Paciente reporta haber iniciado una conversación con un desconocido.", mood_assessment: 4, requires_followup: false, created_at: new Date(new Date().setHours(10, 30)), created_via: "whatsapp", medication_notes: "Mantener dosis de Sertralina en 50mg." },
                { id: "s_today_2", patient_id: "p3", patient_name: "Ana López", summary: "Seguimiento de hoy. La paciente refiere sentirse con más energía y motivación. Se exploran estrategias de mindfulness para mantener el estado de ánimo.", mood_assessment: 4, requires_followup: false, created_at: new Date(new Date().setHours(11, 0)), created_via: "web", medication_notes: "" },
            ]
        };
        
        // LOGIN & USER FLOW
        document.addEventListener('DOMContentLoaded', function() {
            initLandingChat();
            $('#loginForm').on('submit', e => { e.preventDefault(); doLogin(); });
            $('#registerForm').on('submit', e => { e.preventDefault(); doRegister(); });
            $('#paymentForm').on('submit', e => { e.preventDefault(); processPayment(); });
            $('#patientSearch').on('keyup', filterPatients);
        });
        
        function doLogin() {
            if ($('#dni').val().trim() && $('#pin').val().trim()) {
                currentUser = { ...demoData.user, name: "Dr. Pabula", isNewUser: false };
                appData = JSON.parse(JSON.stringify(demoData)); 
                isDemoMode = false;
                showDashboard();
            } else {
                showError("#errorMessage", "Completá ambos campos");
            }
        }

        function doRegister() {
            console.log(" Iniciando proceso de registro...");
            const name = $('#regName').val().trim();
            const specialty = $('#regSpecialty').val();
            const dni = $('#regDni').val().trim();
            const birthdate = $('#regBirthdate').val();

            if (name && specialty && dni && birthdate) {
                console.log(" Datos de registro válidos:", { name, specialty, dni, birthdate });
                currentUser = { name: name, dni: dni, specialty: specialty, isNewUser: true };
                
                // Cargar datos de ejemplo para usuarios nuevos
                const ejemplosPacientes = [
                    { id: "p1", name: "Ejemplo: María García", dni: "30111222", insurance: "OSDE", phone: "1145678901" }
                ];
                


                isDemoMode = false;
                console.log(" Usuario creado con datos de ejemplo:", currentUser);

                $('#registerModal').modal('hide');
                hideAllScreens();
                $('#paymentScreen').removeClass('d-none');
                console.log(" Pantalla de pago mostrada");
            } else {
                console.log(" Datos de registro incompletos");
                alert("Por favor, completá todos los campos de registro.");
            }
        }
        
        function processPayment() {
            console.log(" Iniciando proceso de pago...");
            const btn = $('#paymentBtn');
            const btnText = $('#paymentText');
            const spinner = $('#paymentSpinner');
            
            if (!$('#cardName').val() || !$('#cardNumber').val() || !$('#cardExpiry').val() || !$('#cardCvc').val()) {
                console.log(" Datos de tarjeta incompletos");
                showError("#paymentErrorMessage", "Por favor, completá todos los datos de la tarjeta.");
                return;
            }

            console.log(" Datos de tarjeta válidos, procesando pago...");
            btnText.addClass('d-none');
            spinner.removeClass('d-none');
            btn.prop('disabled', true);

            setTimeout(() => {
                btn.removeClass('btn-success').addClass('btn-primary');
                spinner.addClass('d-none');
                btnText.html('<i class="fas fa-check"></i> ¡Pago Aceptado!').removeClass('d-none');
                console.log(" Pago procesado exitosamente");
                
                setTimeout(() => {
                    console.log(" Redirigiendo al dashboard post-registro...");
                    showDashboard();
                    
                    // Mostrar notificación de bienvenida para nuevos usuarios después del registro
                    setTimeout(() => {
                        console.log("Mostrando notificación de bienvenida para nuevo usuario");
                        notificaciones.bienvenidaNuevo();
                    }, 1000);
                }, 1500);

            }, 2000);
        }

        function showDashboard() {
            hideAllScreens();
            $('#dashboardScreen').removeClass('d-none');
            $('.sync-indicator').removeClass('d-none');
            
            if (currentUser) {
                const initials = currentUser.name.split(' ').map(n => n[0]).join('');
                $('#userName').text(currentUser.name);
                $('#welcomeName').text(currentUser.name);
                $('#userInitials').text(initials);
            }
            
            $('#logoutBtn, #userInfo').toggle(!isDemoMode);

            // Mostrar panel principal
            $('.main-panel .container-fluid > div').addClass('d-none');
            $('#dashboardSection').removeClass('d-none');
            
            // Actualizar breadcrumbs
            updateBreadcrumbs();
            
            loadDashboardData();
            loadPatientsData();
            loadSessionsData();
            loadCharts();
            
            // Inicializar perfil del usuario
            if (currentUser) {
                initProfileSection();
            }            
            // Simular sincronización sin notificación
            setTimeout(() => {
                $('.sync-indicator').addClass('d-none');
                // Quitamos la notificación automática
            }, 1500);
            
            if (isDemoMode) {
                setTimeout(startTutorial, 500);
            } else if (currentUser && currentUser.isNewUser) {
                // Mensaje de bienvenida para nuevos usuarios
                setTimeout(() => {
                    notificaciones.info('¡Bienvenido/a!', 'Gracias por elegirnos para gestionar tu consultorio.');
                    currentUser.isNewUser = false; // Para que no se muestre de nuevo
                }, 1000);
            }
        }
        
        function startDemo() {
            console.log(" Iniciando modo demo...");
            try {
                isDemoMode = true;
                currentUser = { ...demoData.user, name: "Dr. Luscana" };
                appData = JSON.parse(JSON.stringify(demoData));
                console.log(" Datos de demo cargados:", currentUser);
                showDashboard();
                console.log(" Dashboard mostrado en modo demo");
            } catch (error) {
                console.error(" Error en startDemo:", error);
                alert("Error al iniciar demo: " + error.message);
            }
        }

        function showError(selector, message) {
            $(selector).text(message).removeClass('d-none');
            setTimeout(() => $(selector).addClass('d-none'), 3000);
        }
        
        // Función para mostrar la sección de perfil profesional
        function showProfileSection() {
            console.log('Mostrando sección de perfil profesional');
            
            // Eliminar cualquier notificación existente
            $('.custom-notification').remove();
            
            // Asegurar que estamos en el dashboard
            hideAllScreens();
            $('#dashboardScreen').removeClass('d-none');
            
            // Ocultar todas las secciones y mostrar solo perfil
            $('.main-panel .container-fluid > div').addClass('d-none');
            $('#profileSection').removeClass('d-none').css('opacity', '1');
            
            // Actualizar menú lateral
            $('.sidebar .nav-link').removeClass('active');
            $('.sidebar .nav-link').each(function() {
                if ($(this).text().trim().includes('Mi Perfil')) {
                    $(this).addClass('active');
                }
            });
            
            // Actualizar breadcrumbs de forma explícita
            $('#breadcrumb').html(`
                <li class="breadcrumb-item"><a href="#" onclick="showDashboard()">Dashboard</a></li>
                <li class="breadcrumb-item active">Mi Perfil</li>
            `);
            $('.breadcrumb-container').removeClass('d-none');
            
            // Inicializar la sección de perfil
            initProfileSection();
            
            // Aplicar animación suave para mejor experiencia de usuario
            $('#profileSection').animate({opacity: 1}, 300);
        }
        
        function hideAllScreens() {
            $('#landingScreen, #loginScreen, #dashboardScreen, #demoEndScreen, #paymentScreen').addClass('d-none');
        }

        function logout() {
            const overlay = $(`
                <div class="loading-overlay">
                    <div class="loading loading-spinner"></div>
                    <h3 class="mt-4 font-weight-light">Cerrando sesión...</h3>
                </div>
            `);
            $('body').append(overlay);
            setTimeout(() => overlay.css('opacity', 1), 10);

            setTimeout(() => {
                overlay.css('opacity', 0);
                setTimeout(() => {
                    overlay.remove();
                    hideAllScreens();
                    $('#landingScreen').removeClass('d-none');
                    // Eliminamos notificación automática
                    currentUser = null;
                    isDemoMode = false;
                    $('#dni, #pin').val('');
                }, 300);
            }, 1000);
        }
        
        // NAVIGATION
        function showSection(sectionName) {
            $('.main-panel .container-fluid > div').addClass('d-none');
            $('#' + sectionName + 'Section').removeClass('d-none');
            $('.sidebar .nav-link').removeClass('active');
            $(`.sidebar .nav-link[onclick*="'${sectionName}'"]`).addClass('active');
            if(sectionName === 'sessions'){
                loadSessionsData(); // Reload data when switching to this tab
            } else if (sectionName === 'analytics') {
                loadCharts(); // Reload charts
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
            //     showNotification('¡Gracias por elegirnos! Ya podés explorar.', 'success');
            // }
            window.scrollTo(0, 0);
        }
        
        function showDemoEndScreen() {
             hideAllScreens();
             $('#demoEndScreen').removeClass('d-none');
        }

        function demoEndRegister(){
            hideAllScreens();
            $('#landingScreen').removeClass('d-none');
            showRegisterModal();
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
            $('#btn-guardar-datos-personales').on('click', function() {
                // Validar campos obligatorios
                const nombre = $('#nombre').val().trim();
                const email = $('#email').val().trim();
                const telefono = $('#telefono').val().trim();
                
                if (!nombre) {
                    showNotification('El nombre es obligatorio', 'warning');
                    $('#nombre').focus();
                    return;
                }
                
                if (!email) {
                    showNotification('El email es obligatorio', 'warning');
                    $('#email').focus();
                    return;
                }
                
                if (!isValidEmail(email)) {
                    showNotification('El formato del email no es válido', 'warning');
                    $('#email').focus();
                    return;
                }
                
                if (telefono && !isValidPhone(telefono)) {
                    showNotification('El formato del teléfono no es válido', 'warning');
                    $('#telefono').focus();
                    return;
                }
                
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
                    showNotification('Datos personales guardados correctamente', 'success');
                    
                    // Actualizar nombre en el panel
                    $('#userName, #welcomeName').text(nombre);
                    $('#userInitials').text(nombre.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase());
                }, 800);
            });
            
            // Botón guardar configuración de cuenta
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
        
        // Función para actualizar el indicador de completitud del perfil
        function updateProfileCompleteness() {
            // Campos a verificar para la completitud
            const totalFields = 8; // Total de campos importantes para el perfil (reducido tras eliminar secciones)
            let completedFields = 0;
            
            // Verificar datos personales
            if ($('#nombre').val().trim()) completedFields++;
            if ($('#apellido').val().trim()) completedFields++;
            if ($('#email').val().trim() && !$('#email').hasClass('is-invalid')) completedFields++;
            if ($('#telefono').val().trim() && !$('#telefono').hasClass('is-invalid')) completedFields++;
            if ($('#especialidad').val() && $('#especialidad').val() !== 'default') completedFields++;
            if ($('#biografia').val().trim()) completedFields++;
            
            // Verificar configuración
            if ($('#idiomas').val() && $('#idiomas').val().length > 0) completedFields++;
            if ($('#precio-consulta').val().trim()) completedFields++;
            
            // Campos eliminados (horarios y bienestar profesional)
            
            // Calcular porcentaje
            const percentage = Math.round((completedFields / totalFields) * 100);
            
            // Actualizar UI
            $('#profile-completeness-percentage').text(percentage + '%');
            $('#profile-completeness-bar').css('width', percentage + '%').attr('aria-valuenow', percentage);
            
            // Cambiar color según porcentaje
            $('#profile-completeness-bar').removeClass('bg-danger bg-warning bg-info bg-success');
            if (percentage < 25) {
                $('#profile-completeness-bar').addClass('bg-danger');
            } else if (percentage < 50) {
                $('#profile-completeness-bar').addClass('bg-warning');
            } else if (percentage < 75) {
                $('#profile-completeness-bar').addClass('bg-info');
            } else {
                $('#profile-completeness-bar').addClass('bg-success');
                
                // Si el perfil está completo, mostrar mensaje de felicitación
                if (percentage === 100 && !window.profileCompletionCelebrated) {
                    setTimeout(() => {
                        showNotification('¡Felicitaciones! Tu perfil está completo. Esto aumentará la confianza de tus pacientes.', 'success');
                        window.profileCompletionCelebrated = true;
                    }, 500);
                }
            }
        }
        
        // DASHBOARD DATA & RENDERING
        async function loadDashboardData() {
            try {
                // Para optimizar, lanzamos las consultas en paralelo
                const [patientsSnapshot, sessionsSnapshot, followupsSnapshot, todaySessionsSnapshot] = await Promise.all([
                    db.collection('patients').get(),
                    db.collection('sessions').get(),
                    db.collection('sessions').where('requiresFollowUp', '==', true).get(),
                    getTodaySessionsQuery()
                ]);

                const sessionsTodayList = todaySessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                $('#totalPatients').text(patientsSnapshot.size);
                $('#totalSessions').text(sessionsSnapshot.size);
                $('#followupsNeeded').text(followupsSnapshot.size);
                $('#sessionsToday').text(sessionsTodayList.length);

                // TODO: Refactorizar estas funciones para que lean de Firestore o reciban los datos
                loadRecentSessions(); 
                populateTodaysSessionsModal(sessionsTodayList);

            } catch (error) {
                console.error("Error al cargar los datos del dashboard: ", error);
                notificaciones.error('Error de Dashboard', 'No se pudieron cargar las métricas.');
                // Poner contadores a 0 en caso de error
                $('#totalPatients, #totalSessions, #followupsNeeded, #sessionsToday').text('0');
            }
        }

        function getTodaySessionsQuery() {
            const now = new Date();
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

            return db.collection('sessions')
                .where('createdAt', '>=', startOfDay)
                .where('createdAt', '<', endOfDay)
                .get();
        }

        async function loadRecentSessions() {
            const container = $('#recentSessionsList');
            container.html('<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>'); // Estado de carga

            try {
                const querySnapshot = await db.collection('sessions')
                                              .orderBy('createdAt', 'desc')
                                              .limit(5)
                                              .get();

                if (querySnapshot.empty) {
                    container.html(`<div class="empty-state p-3"><div class="empty-state-icon">📝</div><h5>No hay sesiones aún</h5><button class="btn btn-primary btn-sm" onclick="showNewSessionModal()">➕ Primera Sesión</button></div>`);
                    return;
                }

                const html = querySnapshot.docs.map(doc => {
                    const session = { id: doc.id, ...doc.data() };
                    const moodEmojis = { 1: "😢", 2: "😕", 3: "😐", 4: "🙂", 5: "😊" };
                    const badgeClass = session.createdVia === 'whatsapp' ? 'badge-whatsapp' : 'badge-web';
                    const followupBadge = session.requiresFollowUp ? `<span class="badge badge-followup">Seguimiento</span>` : `<span class="badge badge-stable">Estable</span>`;
                    
                    return `
                    <div class="session-activity-item" onclick="showSessionDetail('${session.id}')">
                        <div class="patient-avatar mr-3 patient-avatar-small">
                            ${session.patientName[0]}
                        </div>
                        <div class="flex-grow-1">
                            <div class="d-flex align-items-center justify-content-between">
                                <div>
                                    <h6 class="mb-0 font-weight-bold patient-name-heading">${session.patientName}</h6>
                                    <div class="session-meta mt-1">
                                        <span><i class="fas fa-calendar-alt mr-1"></i> ${session.createdAt.toDate().toLocaleDateString('es-AR')}</span>
                                        <span class="mx-2">|</span>
                                        <span>${moodEmojis[session.moodAssessment]} ${session.moodAssessment}/5</span>
                                    </div>
                                </div>
                                <div class="text-right">
                                   <span class="badge ${badgeClass}">${session.createdVia === 'whatsapp' ? 'WhatsApp' : 'Web'}</span>
                                   ${followupBadge}
                                </div>
                            </div>
                        </div>
                    </div>
                    `;
                }).join('');

                container.html(html);

            } catch (error) {
                console.error("Error al cargar sesiones recientes: ", error);
                container.html('<div class="empty-state p-3"><div class="empty-state-icon">😢</div><h5>Error al cargar</h5><p>No se pudieron obtener las sesiones recientes.</p></div>');
            }
        }

        // PATIENTS DATA
        // Función para alternar el estado del paciente (activo/inactivo)
        async function togglePatientStatus(id) {
            try {
                const patientRef = db.collection('patients').doc(id);
                const doc = await patientRef.get();
                if (!doc.exists) {
                    notificaciones.error('Error', 'No se encontró el paciente.');
                    return;
                }

                const patient = doc.data();
                const newStatus = patient.status === 'inactive' ? 'active' : 'inactive';

                await patientRef.update({ status: newStatus });

                $('#patientDetailModal').modal('hide');
                loadPatientsData(); // Recarga los datos, que a su vez llama a updatePatientsCounter

                const mensaje = newStatus === 'inactive' ? 
                    `${patient.name} ha sido desactivado.` : 
                    `${patient.name} ha sido activado.`;
                notificaciones.info(
                    newStatus === 'inactive' ? 'Paciente desactivado' : 'Paciente activado',
                    mensaje
                );
            } catch (error) {
                console.error("Error al cambiar el estado del paciente: ", error);
                notificaciones.error('Error', 'No se pudo actualizar el estado del paciente.');
            }
        }
        
        // Variable para controlar la visualización de pacientes inactivos
        let showInactivePacientes = false;
        
        // Contador de pacientes activos e inactivos
        function updatePatientsCounter(patients = []) {
            const activePatientsCount = patients.filter(p => p.status !== 'inactive').length;
            const inactivePatientsCount = patients.filter(p => p.status === 'inactive').length;
            $('#activePatientsCount').text(activePatientsCount);
            $('#inactivePatientsCount').text(inactivePatientsCount);
        }
        
        async function loadPatientsData(filter = '') {
            const container = $('#patientsList');
            container.html('<div class="col-12 text-center p-5"><i class="fas fa-spinner fa-spin fa-2x"></i></div>');

            try {
                // 1. Obtener pacientes y sesiones en paralelo para optimizar
                const [patientsSnapshot, sessionsSnapshot] = await Promise.all([
                    db.collection('patients').get(),
                    db.collection('sessions').orderBy('createdAt', 'desc').get()
                ]);

                const patients = patientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                const sessions = sessionsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 2. Crear un mapa con la última sesión de cada paciente para búsqueda eficiente O(1)
                const lastSessionMap = {};
                for (const session of sessions) {
                    if (!lastSessionMap[session.patientId]) {
                        lastSessionMap[session.patientId] = session;
                    }
                }

                // 3. Aplicar filtros de búsqueda en el cliente
                const filteredPatients = patients.filter(p => 
                    (p.name.toLowerCase().includes(filter.toLowerCase()) || 
                    (p.dni && p.dni.includes(filter)) || 
                    (p.phone && p.phone.includes(filter))) &&
                    (showInactivePacientes || p.status !== 'inactive')
                );

                if (filteredPatients.length === 0) {
                    container.html('<div class="col-12"><div class="empty-state"><div class="empty-state-icon">🤷‍♀️</div><h5>No se encontraron pacientes</h5><p>Intenta con otro término de búsqueda o registra un nuevo paciente.</p></div></div>');
                    updatePatientsCounter(patients);
                    return;
                }
                
                // 4. Renderizar las tarjetas de paciente
                const getMoodColorClass = (moodScore) => {
                    if (moodScore <= 2) return 'danger';
                    if (moodScore === 3) return 'warning';
                    if (moodScore >= 4) return 'success';
                    return 'primary';
                };

                const html = filteredPatients.map(patient => {
                    const lastSession = lastSessionMap[patient.id];
                    const colorClass = lastSession ? getMoodColorClass(lastSession.moodAssessment) : 'primary';
                    const isInactive = patient.status === 'inactive';
                    const inactiveClass = isInactive ? 'inactive-patient' : '';
                    const inactiveBadge = isInactive ? '<span class="badge badge-secondary ml-2">Inactivo</span>' : '';
                    
                    return `<div class="col-xl-4 col-lg-6 mb-4"><div class="card patient-card stats-card ${colorClass} h-100 ${inactiveClass}" onclick="showPatientDetail('${patient.id}')"><div class="card-body"><div class="d-flex align-items-center mb-3"><div class="patient-avatar mr-3">${patient.name[0]}</div><div><h5 class="card-title mb-0">${patient.name}${inactiveBadge}</h5><small class="text-muted">DNI: ****${patient.dni ? patient.dni.slice(-4) : ''}</small></div></div><p class="text-muted"><i class="fas fa-briefcase-medical mr-2"></i> ${patient.insurance}</p><div class="mt-auto d-flex justify-content-end"><button class="btn btn-sm btn-outline-primary" onclick="event.stopPropagation(); viewPatientSessions('${patient.id}')">Ver Sesiones</button></div></div></div></div>`;
                }).join('');

                container.html(html);
                updatePatientsCounter(patients);

            } catch (error) {
                console.error("Error al cargar pacientes desde Firestore: ", error);
                container.html('<div class="col-12"><div class="empty-state"><div class="empty-state-icon">🔌</div><h5>Error de Conexión</h5><p>No se pudo conectar con la base de datos. Verifique su conexión y la configuración de Firebase.</p></div></div>');
            }
        }
        
        function filterPatients(){
            const searchTerm = $('#patientSearch').val().toLowerCase();
            loadPatientsData(searchTerm);
        }
        
        // Variables para eliminar pacientes
        let pacienteIdAEliminar = null;
        
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
                    <div class="card session-card stats-card ${colorClass}" onclick="showSessionDetail('${session.id}')">
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
                renderSessions([], 'Error al Filtrar', 'Hubo un problema al consultar la base de datos.');
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


        // CHARTS
        async function loadCharts() {
            if (moodChartInstance) moodChartInstance.destroy();
            if (moodEvolutionChartInstance) moodEvolutionChartInstance.destroy();
            if (topPatientsChartInstance) topPatientsChartInstance.destroy();

            // TODO: Para optimizar a futuro, estas agregaciones deberían hacerse con Cloud Functions.
            try {
                const sessionsSnapshot = await db.collection('sessions').get();
                const sessions = sessionsSnapshot.docs.map(doc => doc.data());

                // 1. Gráfico de Donut: Distribución de ánimo
                const moodData = sessions.reduce((acc, { moodAssessment }) => { 
                    acc[moodAssessment] = (acc[moodAssessment] || 0) + 1; 
                    return acc; 
                }, {});
                moodChartInstance = new Chart($('#moodChart'), { type: 'doughnut', data: { labels: ['😢 Muy bajo', '😕 Bajo', '😐 Neutral', '🙂 Bueno', '😊 Muy bueno'], datasets: [{ data: [moodData[1]||0, moodData[2]||0, moodData[3]||0, moodData[4]||0, moodData[5]||0], backgroundColor: ['#e74c3c', '#f39c12', '#ffc107', '#2ecc71', '#3498db'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 10 } } } } } });

                // 2. Gráfico de Líneas: Evolución del ánimo mensual
                const moodEvolutionEl = $('#moodEvolutionChart');
                if(moodEvolutionEl.length) {
                    const monthlyMoods = sessions.reduce((acc, session) => {
                        const month = session.createdAt.toDate().toLocaleString('es-AR', { month: 'long' });
                        if (!acc[month]) {
                            acc[month] = { total: 0, count: 0 };
                        }
                        acc[month].total += session.moodAssessment;
                        acc[month].count++;
                        return acc;
                    }, {});

                    const sortedMonths = Object.keys(monthlyMoods).sort((a, b) => new Date(`1 ${a} 2000`) - new Date(`1 ${b} 2000`));
                    const labels = sortedMonths;
                    const data = sortedMonths.map(month => (monthlyMoods[month].total / monthlyMoods[month].count).toFixed(2));

                    moodEvolutionChartInstance = new Chart(moodEvolutionEl, {
                        type: 'line',
                        data: { labels, datasets: [{ label: 'Estado de Ánimo Promedio', data, borderColor: '#4a9d95', backgroundColor: 'rgba(74, 157, 149, 0.1)', fill: true, tension: 0.4 }] },
                        options: { scales: { y: { beginAtZero: false, max: 5 } } }
                    });
                }

                // 3. Gráfico de Barras: Top 5 pacientes con más sesiones
                const topPatientsEl = $('#topPatientsChart');
                if(topPatientsEl.length) {
                    const patientCounts = sessions.reduce((acc, session) => {
                        acc[session.patientName] = (acc[session.patientName] || 0) + 1;
                        return acc;
                    }, {});

                    const sortedPatients = Object.entries(patientCounts).sort(([,a],[,b]) => b-a).slice(0, 5);
                    
                    topPatientsChartInstance = new Chart(topPatientsEl, {
                        type: 'bar',
                        data: {
                            labels: sortedPatients.map(p => p[0]),
                            datasets: [{ label: 'N° de Sesiones', data: sortedPatients.map(p => p[1]), backgroundColor: ['#6b73a9', '#764ba2', '#667eea', '#8898aa', '#a07e96'] }]
                        },
                        options: { indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } }
                    });
                }
            } catch (error) {
                console.error("Error al cargar los gráficos: ", error);
                notificaciones.error('Error en Gráficos', 'No se pudieron cargar los datos para los gráficos.');
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

        async function showPatientDetail(id) {
            try {
                const doc = await db.collection('patients').doc(id).get();
                if (!doc.exists) {
                    notificaciones.error('Error', 'No se pudo encontrar al paciente.');
                    return;
                }
                const patient = { id: doc.id, ...doc.data() };

                // Fill patient info
                $('#patientDetailName').text(patient.name);

                const detailHTML = `
                    <p><i class="fas fa-id-card fa-fw mr-2 text-muted"></i> <strong>DNI:</strong> ${patient.dni}</p>
                    <p><i class="fas fa-phone fa-fw mr-2 text-muted"></i> <strong>Teléfono:</strong> ${patient.phone}</p>
                    <p><i class="fas fa-hospital-user fa-fw mr-2 text-muted"></i> <strong>Obra Social:</strong> ${patient.insurance}</p>
                `;
                $('#patientDetailBody').html(detailHTML);

                // Determinar si el paciente está activo o inactivo
                const isActive = patient.status !== 'inactive';
                const toggleActiveText = isActive ? 'Desactivar' : 'Activar';
                const toggleActiveIcon = isActive ? 'fa-user-slash' : 'fa-user-check';
                const toggleActiveClass = isActive ? 'btn-outline-warning' : 'btn-outline-success';
                
                const footerHTML = `
                    <button type="button" class="btn btn-secondary" data-dismiss="modal">Cerrar</button>
                    <button type="button" class="btn btn-primary" onclick="viewPatientSessions('${patient.id}')">Ver Historial de Sesiones</button>
                    <div class="ml-auto d-flex">
                        <button type="button" class="btn ${toggleActiveClass} mr-2" onclick="togglePatientStatus('${patient.id}')"><i class="fas ${toggleActiveIcon} mr-1"></i> ${toggleActiveText}</button>
                        <button type="button" class="btn btn-outline-danger" onclick="confirmarEliminarPaciente('${patient.id}')"><i class="fas fa-trash mr-1"></i> Eliminar</button>
                    </div>
                `;
                $('#patientDetailFooter').html(footerHTML);

                $('#patientDetailModal').modal('show');
            } catch (error) {
                console.error("Error al cargar los detalles del paciente: ", error);
                notificaciones.error('Error', 'No se pudieron cargar los datos del paciente.');
            }
        }
        async function showNewSessionModal(patientId) { 
            $('#newSessionForm')[0].reset();
            const select = $('#sessionPatient');
            select.html('<option value="">Cargando pacientes...</option>');

            try {
                const querySnapshot = await db.collection('patients').where('status', '==', 'active').orderBy('name').get();
                const patientOptions = querySnapshot.docs.map(doc => {
                    const patient = { id: doc.id, ...doc.data() };
                    return `<option value="${patient.id}">${patient.name}</option>`;
                }).join('');
                
                select.html('<option value="">Seleccionar paciente</option>' + patientOptions);

                if (patientId) {
                    select.val(patientId);
                }
            } catch (error) {
                console.error("Error al cargar pacientes para el modal: ", error);
                select.html('<option value="">Error al cargar pacientes</option>');
                notificaciones.error('Error', 'No se pudieron cargar los pacientes.');
            }

            $('#newSessionModal').modal('show'); 
        }

        // FORMS
        $('#newPatientForm').on('submit', async function(e) {
            e.preventDefault();
            const newPatient = {
                name: $('#patientName').val(),
                dni: $('#patientDni').val(),
                insurance: $('#patientInsurance').val(),
                phone: $('#patientPhone').val(),
                created_at: new Date(),
                created_via: 'web',
                status: 'active' // Asignar estado activo por defecto
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
            const newSession = {
                patientId: patientId,
                patientName: patientName,
                summary: $('#sessionContent').val(),
                moodAssessment: mood,
                requiresFollowUp: mood <= 2,
                createdAt: new Date(),
                createdVia: 'web',
                medicationNotes: $('#sessionMedication').val()
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

        function showNotification(message, type = 'info') {
            // Filtrar notificaciones automáticas no deseadas
            if (window.location.hash === '#profile') {
                if (message.includes('Sección actualizada') || 
                    !message.toLowerCase().includes('error')) {
                    console.log('Notificación filtrada:', message);
                    return; // No mostrar esta notificación
                }
            }
            
            // Configurar según el tipo de notificación
            let emoji = 'ℹ️';
            let color = '#667eea';
            
            switch(type) {
                case 'success':
                    emoji = '✅';
                    color = '#51d88a';
                    break;
                case 'warning':
                    emoji = '⚠️';
                    color = '#f6993f';
                    break;
                case 'error':
                    emoji = '❌';
                    color = '#e3342f';
                    break;
            }
            
            const notification = $(`<div class="custom-notification notification-${type}">
                <div class="d-flex align-items-center">
                    <div class="notification-icon">${emoji}</div>
                    <div class="notification-content">
                        <div class="notification-message">${message}</div>
                    </div>
                    <button class="notification-close" onclick="$(this).closest('.custom-notification').remove()">&times;</button>
                </div>
            </div>`);
            
            // Agregar al DOM
            $('body').append(notification);
            
            // Animar entrada
            setTimeout(() => {
                notification.css('transform', 'translateX(0)');
            }, 10);
            
            // Auto-cerrar después de 5 segundos
            setTimeout(() => {
                notification.css('transform', 'translateX(120%)');
                
                // Eliminar del DOM después de la animación
                setTimeout(() => {
                    notification.remove();
                }, 400);
            }, 5000);
        }

        // --- WHATSAPP DEMO ---
        async function runWhatsappSimulation() {
            clearTimeout(whatsappSimulationTimeout);
            const chatBox = $('#whatsappDemoMessages');
            chatBox.html('');
            $('#whatsappDemoFooter').hide();

            $('#whatsappDemoModal').modal({
                backdrop: 'static',
                keyboard: false
            });

            const addMessage = (text, type = 'bot', delay = 600) => {
                return new Promise(resolve => {
                    whatsappSimulationTimeout = setTimeout(() => {
                        const messageHtml = `<div class="message ${type}">${text}</div>`;
                        chatBox.append(messageHtml);
                        chatBox.scrollTop(chatBox[0].scrollHeight);
                        resolve();
                    }, delay);
                });
            };
            
            // Start of the scripted sequence
            await addMessage('hola', 'user-choice', 200);
            await addMessage(`¡Hola Dr. Luscana! 👋<br>¿Qué querés hacer hoy?`, 'bot', 400);
            await addMessage('📝 Ingresar Sesión', 'user-choice', 300);
            await addMessage(`Ok, Dr. Para empezar, enviame tus notas de la sesión. Podés mandar un audio o un texto.`, 'bot', 600);
            await addMessage(
                `<div class="d-flex align-items-center"><i class="fas fa-play-circle mr-2"></i> <div>0:45</div> <div class="progress ml-2 audio-progress-container"><div class="progress-bar bg-success w-100"></div></div></div>`,
                'audio-message',
                800
            );
            await addMessage('Perfecto, Dr. Ya transcribí y analicé el audio. Acá tenés un resumen de la sesión para que copies y pegues en la historia clínica:', 'bot', 800);
            await addMessage(
                `<strong>Resumen de la Sesión con IA:</strong><br>
                Paciente: Ana López<br>
                Estado de Ánimo: Refiere sentirse más animada y con mayor energía.<br>
                Tópicos Clave: Ansiedad nocturna, técnicas de respiración, ajuste de medicación.<br>
                Plan: Continuar con ejercicios de mindfulness, evaluar efectividad del ajuste de medicación en la próxima consulta.`,
                'summary-message',
                800
            );
            await addMessage(`¿Querés empezar a usar AIRA para organizar tu práctica?`, 'bot', 500);

            // Asegurar que el último mensaje sea visible
            setTimeout(() => {
                chatBox.scrollTop(chatBox[0].scrollHeight);
            }, 600);
            
            setTimeout(() => {
                $('#whatsappDemoFooter').removeClass('d-none').addClass('d-block');
            }, 500);
        }
        
        // La función startDemo() ya está definida arriba

        function finishWhatsappDemo() {
            $('#whatsappDemoModal').modal('hide');
            if(isDemoMode) {
                // En modo demo, mostrar la pantalla final con call to action
                showDemoEndScreen();
            } else {
                $('#demoEndScreen').removeClass('d-none');
                $('#landingContent').addClass('d-none');
            }
            // Reiniciar estado del footer para próximo uso
            setTimeout(() => {
                $('#whatsappDemoFooter').removeClass('d-block').addClass('d-none');
            }, 500);
        }

        // Mobile sidebar toggle
        $('#sidebarToggle').on('click', () => $('.sidebar').toggleClass('show'));
        
        // Funciones para vincular celular
        function showLinkPhoneModal() {
            $('#linkPhoneModal').modal('show');
        }
        
        function linkPhone() {
            const phoneNumber = $('#phoneNumber').val().trim();
            
            // Validar número de teléfono
            if (!phoneNumber || phoneNumber.length !== 10 || !/^[0-9]{10}$/.test(phoneNumber)) {
                showNotification('Por favor ingresá un número de celular válido (10 dígitos)', 'warning');
                return;
            }
            
            // Aquí iría la lógica para enviar el mensaje de WhatsApp
            // En la demo, simulamos el envío
            $('#linkPhoneModal').modal('hide');
            
            // Mostrar mensaje de éxito
            setTimeout(() => {
                showNotification('✅ Mensaje enviado correctamente a +54' + phoneNumber, 'success');
            }, 800);
            
            // Limpiar campo
            $('#phoneNumber').val('');
        }
        
        // --- LANDING PAGE CHAT ---

        let landingChatResetTimeout;

        function initLandingChat() {
            const chatBox = $('#landing-chat-messages');
            chatBox.html(`
                <div class="message bot">
                    ¡Hola Dr. Pabula! 👋<br>
                    ¿Qué querés hacer hoy?
                </div>
                <div class="message-options">
                    <div class="option" onclick="handleLandingChat(this, 'new_session')">📝 Nueva sesión</div>
                    <div class="option" onclick="handleLandingChat(this, 'new_patient')">👤 Nuevo paciente</div>
                    <div class="option" onclick="handleLandingChat(this, 'stats')">📊 Ver estadísticas</div>
                </div>
            `);
        }

        function handleLandingChat(element, action) {
            clearTimeout(landingChatResetTimeout);
            const chatBox = $('#landing-chat-messages');
            const choiceText = $(element).text();
            
            chatBox.find('.message-options').remove();
            chatBox.append(`<div class="message user-choice">${choiceText}</div>`);
            chatBox.scrollTop(chatBox[0].scrollHeight);

            let botResponse = '';
            switch(action) {
                case 'new_session':
                    botResponse = '¡Perfecto! Para registrar una sesión, enviame un audio o texto con tus notas.';
                    break;
                case 'new_patient':
                    botResponse = '¡Claro! Para agregar un paciente, decime su nombre completo, DNI y obra social.';
                    break;
                case 'stats':
                    botResponse = 'Generando tus estadísticas... En el último mes, el ánimo promedio de tus pacientes subió un 15%. ¡Buen trabajo!';
                    break;
            }

            setTimeout(() => {
                chatBox.append(`<div class="message bot">${botResponse}</div>`);
                chatBox.scrollTop(chatBox[0].scrollHeight);

                landingChatResetTimeout = setTimeout(() => {
                    initLandingChat();
                }, 4000);
            }, 1000);
        }

        // LANDING PAGE FUNCTIONS
        function showLoginFromLanding() { hideAllScreens(); $('#loginScreen').removeClass('d-none'); }
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
