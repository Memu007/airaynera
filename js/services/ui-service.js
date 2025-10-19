// ==============================================
// UI Service
// ==============================================
// Este servicio se encarga de la lógica de la interfaz de usuario,
// como la gestión de modales y otras interacciones visuales.

(function(window) {
    'use strict';

    // Dependencias (asumimos que 'db' y 'notificaciones' son globales)

    async function showPatientDetail(id) {
        try {
            const doc = await db.collection('patients').doc(id).get();
            if (!doc.exists) {
                notificaciones.error('Error', 'No se pudo encontrar al paciente.');
                return;
            }
            const patient = { id: doc.id, ...doc.data() };

            // Fill patient info
            $('#patientDetailName').text(patient.name); // .text() ya sanitiza, no es necesario cambiarlo.

            const detailHTML = `
                <p><i class="fas fa-id-card fa-fw mr-2 text-muted"></i> <strong>DNI:</strong> ${securityService.sanitizeHTML(patient.dni)}</p>
                <p><i class="fas fa-phone fa-fw mr-2 text-muted"></i> <strong>Teléfono:</strong> ${securityService.sanitizeHTML(patient.phone)}</p>
                <p><i class="fas fa-hospital-user fa-fw mr-2 text-muted"></i> <strong>Obra Social:</strong> ${securityService.sanitizeHTML(patient.insurance)}</p>
            `;
            $('#patientDetailBody').html(detailHTML);

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
                return `<option value="${patient.id}">${securityService.sanitizeHTML(patient.name)}</option>`;
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

    function showLinkPhoneModal() {
        $('#linkPhoneModal').modal('show');
    }

    function linkPhone() {
        const phoneNumber = $('#phoneNumber').val().trim();
        if (!phoneNumber || phoneNumber.length !== 10 || !/^[0-9]{10}$/.test(phoneNumber)) {
            notificaciones.warning('Atención', 'Por favor ingresá un número de celular válido (10 dígitos)');
            return;
        }
        $('#linkPhoneModal').modal('hide');
        setTimeout(() => {
            notificaciones.success('Éxito', 'Mensaje enviado correctamente a +54' + phoneNumber);
        }, 800);
        $('#phoneNumber').val('');
    }

    // Exponer funciones al scope global
    window.uiService = {
        showPatientDetail,
        showNewSessionModal,
        showLinkPhoneModal,
        linkPhone
    };

})(window);
