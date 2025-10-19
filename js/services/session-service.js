$(document).ready(function() {
    // --- DEPENDENCIES ---
    // - jQuery
    // - Firestore (db)
    // - moment.js
    // - notificaciones object (from notifications.js)

    // --- SESSION RENDERING & DATA ---

    // Carga las sesiones recientes para el dashboard
    window.loadRecentSessions = async function() {
        const container = $('#recentSessionsList');
        container.html('<div class="text-center p-3"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>');

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

    // Obtiene las sesiones de hoy para el dashboard
    window.getTodaySessionsQuery = function() {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        return db.collection('sessions')
            .where('createdAt', '>=', startOfDay)
            .where('createdAt', '<', endOfDay)
            .get();
    }

    // Rellena el modal con las sesiones de hoy
    window.populateTodaysSessionsModal = function(sessions) {
        const list = $('#todaysSessionsList');
        list.empty();

        if (sessions.length === 0) {
            list.html('<li class="list-group-item">No hay sesiones programadas para hoy.</li>');
            return;
        }

        sessions.forEach(session => {
            const patientName = session.patientName || 'Paciente no identificado';
            const sessionTime = session.createdAt.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const listItem = `
                <li class="list-group-item d-flex justify-content-between align-items-center">
                    <div>
                        <strong>${patientName}</strong>
                        <br>
                        <small class="text-muted">Hora: ${sessionTime}</small>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="showSessionDetail('${session.id}')">Ver Detalles</button>
                </li>`;
            list.append(listItem);
        });
    }

    // Muestra el detalle de una sesión (Implementación pendiente de migración)
    window.showSessionDetail = async function(sessionId) {
        console.log("Mostrando detalle de sesión: ", sessionId);
        notificaciones.show('Funcionalidad de detalle de sesión aún no migrada completamente.', 'info');
    }

    // Muestra las sesiones de un paciente (Implementación pendiente de migración)
    window.viewPatientSessions = async function(patientId) {
        console.log("Viendo sesiones del paciente: ", patientId);
        notificaciones.show('Funcionalidad de ver sesiones de paciente aún no migrada completamente.', 'info');
    }
});
