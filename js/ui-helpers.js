// UI Helpers - Funciones auxiliares para la interfaz
function showLoading(message = 'Cargando...') {
    console.log('Loading:', message);
}

function hideLoading() {
    console.log('Loading hidden');
}

function showError(message) {
    console.error('Error:', message);
    alert('Error: ' + message);
}

function showSuccess(message) {
    console.log('Success:', message);
    alert('Éxito: ' + message);
}

function formatDate(date) {
    return new Date(date).toLocaleDateString('es-AR');
}

function formatTime(date) {
    return new Date(date).toLocaleTimeString('es-AR');
}

console.log('UI Helpers cargado');
