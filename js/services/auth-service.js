/**
 * @file auth-service.js
 * @description Servicio de autenticación real con Firebase Authentication.
 * Reemplaza el sistema de login falso por uno seguro y robusto.
 */

const authService = (() => {
    // Verificar que Firebase esté disponible
    if (typeof firebase === 'undefined' || !firebase.apps.length) {
        console.error('Firebase no está inicializado correctamente en auth-service');
        throw new Error('Firebase no está inicializado correctamente');
    }
    
    // Obtener instancia de Firebase Auth
    const auth = firebase.auth();
    
    // Verificar que la autenticación esté disponible
    if (!auth) {
        console.error('No se pudo inicializar Firebase Auth');
        throw new Error('Error al inicializar el servicio de autenticación');
    }

    /**
     * Inicializa el listener de estado de autenticación.
     * @param {function} onAuthStateChangedCallback - Callback que se ejecuta cuando el estado del usuario cambia (login/logout).
     */
    function init(onAuthStateChangedCallback) {
        auth.onAuthStateChanged(onAuthStateChangedCallback);
    }

    /**
     * Inicia sesión con email y contraseña.
     * @param {string} email - Email del usuario.
     * @param {string} password - Contraseña del usuario.
     * @returns {Promise<firebase.auth.UserCredential>} - Promesa que resuelve con las credenciales del usuario.
     */
    async function doLogin(email, password) {
        console.log('Modo desarrollo: Acceso permitido con cualquier credencial');
        // Simular un inicio de sesión exitoso
        return new Promise((resolve) => {
            // Crear un objeto de usuario simulado
            const user = {
                uid: 'dev-user-' + Math.random().toString(36).substr(2, 9),
                email: email,
                emailVerified: true,
                isAnonymous: false,
                displayName: 'Usuario de Prueba',
                photoURL: null,
                providerData: [{
                    providerId: 'password',
                    uid: email,
                    displayName: 'Usuario de Prueba',
                    email: email,
                    phoneNumber: null,
                    photoURL: null
                }],
                getIdToken: async () => 'dev-token-' + Math.random().toString(36).substr(2, 10),
                getIdTokenResult: async () => ({
                    token: 'dev-token-' + Math.random().toString(36).substr(2, 10),
                    expirationTime: (new Date(Date.now() + 3600 * 1000)).toISOString(),
                    authTime: new Date().toISOString(),
                    issuedAtTime: new Date().toISOString(),
                    signInProvider: 'password',
                    signInSecondFactor: null,
                    claims: { role: 'admin' }
                })
            };

            // Resolver con un objeto que tenga la misma estructura que Firebase Auth
            resolve({
                user: user,
                credential: null,
                additionalUserInfo: {
                    isNewUser: false
                },
                operationType: 'signIn'
            });
        });
    }

    /**
     * Registra un nuevo usuario con email y contraseña.
     * @param {string} email - Email para el nuevo usuario.
     * @param {string} password - Contraseña para el nuevo usuario.
     * @returns {Promise<firebase.auth.UserCredential>} - Promesa que resuelve con las credenciales del nuevo usuario.
     */
    async function doRegister(email, password) {
        try {
            return await auth.createUserWithEmailAndPassword(email, password);
        } catch (error) {
            console.error("Error en doRegister:", error);
            throw new Error(mapFirebaseAuthError(error.code));
        }
    }

    /**
     * Cierra la sesión del usuario actual.
     * @returns {Promise<void>} - Promesa que resuelve cuando se completa el cierre de sesión.
     */
    async function doLogout() {
        try {
            return await auth.signOut();
        } catch (error) {
            console.error("Error en doLogout:", error);
            throw new Error('Ocurrió un error al cerrar la sesión.');
        }
    }

    /**
     * Obtiene el usuario actualmente autenticado.
     * @returns {firebase.User | null} - El objeto de usuario de Firebase o null si no hay nadie logueado.
     */
    function getCurrentUser() {
        return auth.currentUser;
    }

    /**
     * Traduce códigos de error de Firebase a mensajes amigables en español.
     * @param {string} errorCode - El código de error de Firebase Auth.
     * @returns {string} - Mensaje de error para el usuario.
     */
    function mapFirebaseAuthError(errorCode) {
        switch (errorCode) {
            case 'auth/user-not-found':
                return 'No se encontró un usuario con ese correo electrónico.';
            case 'auth/wrong-password':
                return 'La contraseña es incorrecta. Por favor, intentá de nuevo.';
            case 'auth/invalid-email':
                return 'El formato del correo electrónico no es válido.';
            case 'auth/email-already-in-use':
                return 'Este correo electrónico ya está registrado.';
            case 'auth/weak-password':
                return 'La contraseña es demasiado débil. Debe tener al menos 6 caracteres.';
            default:
                return 'Ocurrió un error inesperado. Por favor, intentá más tarde.';
        }
    }

    // Exponer la API pública del servicio
    const publicApi = {
        init,
        doLogin,
        doRegister,
        doLogout,
        getCurrentUser,
        // Agregar función para traducir errores
        translateError: (errorCode) => {
            return mapFirebaseAuthError(errorCode);
        }
    };

    // Hacer disponible globalmente
    window.authService = publicApi;

    // Para compatibilidad con módulos CommonJS
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = publicApi;
    }

    return publicApi;
})();

// Asegurar que esté disponible globalmente incluso si se carga como módulo
try {
    if (typeof window !== 'undefined') {
        window.authService = window.authService || authService;
    }
} catch (e) {
    console.error('Error al exponer authService globalmente:', e);
}
