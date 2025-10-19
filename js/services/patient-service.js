$(document).ready(function() {
    // --- DEPENDENCIES ---
    // - jQuery
    // - Firestore (db)
    // - notificaciones object (from notifications.js)
    // - breadcrumbSystem object (from breadcrumbs.js)

    let showInactivePacientes = false;



    // --- PATIENT DATA & RENDERING ---

    // Cargar y mostrar la lista de pacientes desde Firestore
    window.loadPatientsData = async function(filter = '') {
        const patientsRef = db.collection('patients');
        const sessionsRef = db.collection('sessions');
        const listContainer = $('#patient-list-container');
        const loadingSpinner = $('#patient-list-loading');
        const emptyState = $('#patient-list-empty');

        loadingSpinner.removeClass('d-none');
        listContainer.html('');
        emptyState.addClass('d-none');

        try {
            const [patientsSnapshot, sessionsSnapshot] = await Promise.all([
                patientsRef.get(),
                sessionsRef.orderBy('created_at', 'desc').get()
            ]);

            const lastSessionMap = new Map();
            sessionsSnapshot.docs.forEach(doc => {
                const session = doc.data();
                if (!lastSessionMap.has(session.patient_id)) {
                    lastSessionMap.set(session.patient_id, session.created_at.toDate());
                }
            });

            let patients = patientsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                last_session_date: lastSessionMap.get(doc.id) || null
            }));

            if (filter) {
                patients = patients.filter(p => p.name.toLowerCase().includes(filter));
            }

            if (!showInactivePacientes) {
                // Define 'inactive' as no session in the last 60 days
                const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
                patients = patients.filter(p => p.last_session_date && p.last_session_date > sixtyDaysAgo);
            }

            if (patients.length === 0) {
                emptyState.removeClass('d-none');
            } else {
                patients.sort((a, b) => (b.last_session_date || 0) - (a.last_session_date || 0));
                patients.forEach(patient => {
                    const lastSession = patient.last_session_date ? `Última sesión: ${moment(patient.last_session_date).format('DD/MM/YYYY')}` : 'Sin sesiones recientes';
                    const sanitizedPatientName = securityService.sanitizeHTML(patient.name);
                    const patientCard = `
                        <div class="col-md-6 col-lg-4 mb-4">
                            <div class="card patient-card h-100" onclick="uiService.showPatientDetail('${patient.id}')">
                                <div class="card-body">
                                    <h5 class="card-title">${sanitizedPatientName}</h5>
                                    <p class="card-text text-muted">${lastSession}</p>
                                </div>
                            </div>
                        </div>`;
                    listContainer.append(patientCard);
                });
            }
        } catch (error) {
            console.error("Error loading patients data: ", error);
            notificaciones.show('Error al cargar pacientes.', 'error');
            emptyState.removeClass('d-none').text('Error al cargar datos. Intente de nuevo.');
        } finally {
            loadingSpinner.addClass('d-none');
            updatePatientsCounter();
        }
    }



    // Actualizar el contador de pacientes
    window.updatePatientsCounter = async function() {
        try {
            const snapshot = await db.collection('patients').get();
            $('#patientsCounter').text(snapshot.size);
        } catch (error) {
            console.error("Error updating patients counter: ", error);
            $('#patientsCounter').text('?');
        }
    }

    // Eliminar un paciente (función de ejemplo)
    window.eliminarPaciente = function() {
        // This is a placeholder. Actual deletion needs confirmation and Firestore logic.
        notificaciones.show('Función para eliminar paciente no implementada.', 'info');
    }

    // --- EVENT LISTENERS ---

    // Búsqueda de pacientes
    $('#patientSearch').on('keyup', function() {
        const searchTerm = $(this).val().toLowerCase();
        loadPatientsData(searchTerm);
    });

    // Toggle para mostrar/ocultar pacientes inactivos
    $('#toggleInactivePacientes').on('change', function() {
        showInactivePacientes = $(this).prop('checked');
        loadPatientsData($('#patientSearch').val().toLowerCase());
    });

    // Conectar botón eliminar paciente en el modal
    $('#btnEliminarPaciente').on('click', eliminarPaciente);
});
