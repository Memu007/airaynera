// js/services/analytics-service.js

// Instancias de gráficos para evitar errores de recreación
let moodChartInstance = null;
let moodEvolutionChartInstance = null;
let topPatientsChartInstance = null;

// Función principal para cargar todos los gráficos
async function loadCharts() {
    try {
        const sessionsSnapshot = await db.collection('sessions').get();
        const sessions = sessionsSnapshot.docs.map(doc => doc.data());

        if (sessions.length > 0) {
            createMoodChart(sessions);
            createMoodEvolutionChart(sessions);
            createTopPatientsChart(sessions);
        } else {
            // Ocultar o mostrar un mensaje si no hay datos
            $('#moodChart, #moodEvolutionChart, #topPatientsChart').hide();
            $('.chart-container').append('<p>No hay datos suficientes para mostrar los gráficos.</p>');
        }
    } catch (error) {
        console.error("Error al cargar los datos para los gráficos: ", error);
        notificaciones.error('Error de Gráficos', 'No se pudieron cargar las visualizaciones.');
    }
}

// Crear gráfico de estado de ánimo general
function createMoodChart(sessions) {
    const moodCounts = sessions.reduce((acc, session) => {
        const mood = session.mood_assessment || 0;
        acc[mood] = (acc[mood] || 0) + 1;
        return acc;
    }, {});

    const ctx = document.getElementById('moodChart').getContext('2d');
    if (moodChartInstance) {
        moodChartInstance.destroy();
    }
    moodChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Muy Mal', 'Mal', 'Regular', 'Bien', 'Muy Bien'],
            datasets: [{
                data: [moodCounts[1] || 0, moodCounts[2] || 0, moodCounts[3] || 0, moodCounts[4] || 0, moodCounts[5] || 0],
                backgroundColor: ['#dc3545', '#ffc107', '#fd7e14', '#28a745', '#007bff'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            legend: { position: 'bottom' },
            title: { display: true, text: 'Distribución de Estado de Ánimo' }
        }
    });
}

// Crear gráfico de evolución del estado de ánimo
function createMoodEvolutionChart(sessions) {
    // Ordenar sesiones por fecha
    sessions.sort((a, b) => a.created_at.toDate() - b.created_at.toDate());

    const ctx = document.getElementById('moodEvolutionChart').getContext('2d');
    if (moodEvolutionChartInstance) {
        moodEvolutionChartInstance.destroy();
    }
    moodEvolutionChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: sessions.map(s => moment(s.created_at.toDate()).format('DD/MM')),
            datasets: [{
                label: 'Promedio de Ánimo',
                data: sessions.map(s => s.mood_assessment),
                borderColor: '#007bff',
                backgroundColor: 'rgba(0, 123, 255, 0.1)',
                fill: true,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { yAxes: [{ ticks: { beginAtZero: true, max: 5 } }] },
            title: { display: true, text: 'Evolución del Estado de Ánimo' }
        }
    });
}

// Crear gráfico de pacientes con más sesiones
function createTopPatientsChart(sessions) {
    const patientSessionCounts = sessions.reduce((acc, session) => {
        acc[session.patient_name] = (acc[session.patient_name] || 0) + 1;
        return acc;
    }, {});

    const sortedPatients = Object.entries(patientSessionCounts).sort(([, a], [, b]) => b - a).slice(0, 5);

    const ctx = document.getElementById('topPatientsChart').getContext('2d');
    if (topPatientsChartInstance) {
        topPatientsChartInstance.destroy();
    }
    topPatientsChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedPatients.map(p => p[0]),
            datasets: [{
                label: 'Nº de Sesiones',
                data: sortedPatients.map(p => p[1]),
                backgroundColor: '#28a745',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            legend: { display: false },
            title: { display: true, text: 'Top 5 Pacientes por Sesiones' },
            scales: { yAxes: [{ ticks: { beginAtZero: true } }] }
        }
    });
}

// Exponer la función principal al scope global
window.loadCharts = loadCharts;
