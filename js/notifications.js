// Notifications Service - Sistema de notificaciones
class NotificationService {
    constructor() {
        console.log('NotificationService inicializado');
    }

    show(message, type = 'info') {
        console.log(`Notification [${type}]:`, message);
        
        // Crear notificación visual simple
        const notification = $(`
            <div class="alert alert-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'info'} alert-dismissible fade show" 
                 style="position: fixed; top: 20px; right: 20px; z-index: 9999; min-width: 300px;">
                ${message}
                <button type="button" class="close" data-dismiss="alert">
                    <span>&times;</span>
                </button>
            </div>
        `);
        
        $('body').append(notification);
        
        // Auto-remover después de 5 segundos
        setTimeout(() => {
            notification.fadeOut(() => notification.remove());
        }, 5000);
    }

    success(message) {
        this.show(message, 'success');
    }

    error(message) {
        this.show(message, 'error');
    }

    info(message) {
        this.show(message, 'info');
    }
}

// Hacer disponible globalmente
window.notifications = new NotificationService();
console.log('Notifications cargado');
