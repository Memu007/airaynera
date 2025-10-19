// Configuración segura de Firebase
// Utiliza variables de entorno o configuración inyectada para mayor seguridad

function getFirebaseConfig() {
    // En producción, usa la configuración inyectada por el servidor
    if (window.firebaseConfig) {
        console.log('Usando configuración de Firebase inyectada.');
        return window.firebaseConfig;
    }

    // En desarrollo, usa la configuración directamente
    console.warn('ADVERTENCIA: Usando configuración de Firebase de desarrollo. NO USAR EN PRODUCCIÓN.');
    
    // Configuración de desarrollo (reemplazar con tus credenciales reales)
    const config = {
        apiKey: "AIzaSyC...", // Reemplaza con tu API key real
        authDomain: "tito-30e35.firebaseapp.com",
        projectId: "tito-30e35",
        storageBucket: "tito-30e35.appspot.com",
        messagingSenderId: "1234567890",
        appId: "1:1234567890:web:abcdef123456",
        measurementId: "G-ABCDEFGHIJ"
    };
    
    // Verificar que las credenciales no sean las de ejemplo
    if (config.apiKey === "AIzaSyC...") {
        console.error('ERROR: Configuración de Firebase no válida. Por favor, actualiza las credenciales en firebase-config.js');
        // Mostrar mensaje de error en la interfaz
        if (typeof showError === 'function') {
            showError("#loginErrorMessage", "Error de configuración. Por favor, contacta al soporte.");
        }
    }
    
    return config;
}

// Inicialización de Firebase
let app, db, auth;

// Deshabilitar la inicialización de Firebase para el modo demo
// En un entorno de producción, esta sección debería estar activa y configurada correctamente.
/*
try {
    const firebaseConfig = getFirebaseConfig();
    
    // Inicializar la aplicación de Firebase
    app = firebase.initializeApp(firebaseConfig);
    
    // Inicializar Firestore
    db = firebase.firestore();
    
    // Configuración de Firestore para desarrollo
    if (window.location.hostname === 'localhost') {
        // Habilitar persistencia offline para Firestore
        db.enablePersistence()
            .catch(err => {
                if (err.code == 'failed-precondition') {
                    console.warn('Persistencia offline de Firestore no habilitada: múltiples pestañas abiertas.');
                } else if (err.code == 'unimplemented') {
                    console.warn('Persistencia offline de Firestore no soportada en este navegador.');
                }
            });
    }

    // Inicializar Auth
    auth = firebase.auth();
    console.log('Firebase configurado correctamente');
} catch (error) {
    console.error('Error al inicializar Firebase:', error);
    // Opcional: mostrar un mensaje de error al usuario
    if (typeof showError === 'function') {
        showError("#loginErrorMessage", "Error de conexión. Por favor, recarga la página.");
    }
}
*/

// Hacer las instancias disponibles globalmente
// window.firebaseApp = app;
// window.firebaseDb = db;
// window.firebaseAuth = auth;

// Exportar las instancias de Firebase (para módulos ES6)
if (typeof exports !== 'undefined') {
    module.exports = { app, db, auth };
}
